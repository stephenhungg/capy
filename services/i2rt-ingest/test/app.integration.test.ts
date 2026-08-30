import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { CONTROL_TOKEN, INGEST_TOKEN, MemoryRepository, MemoryStorage, testConfig } from "./helpers.js";

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function fixture(sessionId = "i2rt-run-001") {
  const journal = Buffer.from(
    '{"event":"run.started"}\n{"event":"run.completed","outcome":"success"}\n',
    "utf8",
  );
  return {
    journal,
    manifest: {
      schemaVersion: "1.0",
      sessionId,
      robotId: "i2rt-001",
      capabilityId: "fixed-insertion-v1",
      cameraFree: true,
      cameraStreams: 0,
      startedAt: "2026-08-30T19:00:00.000Z",
      endedAt: "2026-08-30T19:01:00.000Z",
      eventCount: 2,
      artifacts: [
        {
          id: "journal",
          name: "journal.jsonl",
          kind: "journal",
          mediaType: "application/x-ndjson",
          byteLength: journal.byteLength,
          sha256: sha256(journal),
        },
      ],
      metadata: { cell: "lab-a" },
    },
  };
}

describe("i2rt ingestion api", () => {
  let app: FastifyInstance;
  let repository: MemoryRepository;
  let storage: MemoryStorage;

  beforeEach(async () => {
    repository = new MemoryRepository();
    storage = new MemoryStorage();
    app = await buildApp({ config: testConfig, repository, storage, logger: false });
  });

  afterEach(async () => {
    await app.close();
  });

  it("keeps health and aggregate camera-free status public", async () => {
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ ok: true, service: "capy-i2rt-ingest" });

    const status = await app.inject({ method: "GET", url: "/v1/public/status" });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toEqual({
      state: "ready",
      cameraFree: true,
      cameraStreams: 0,
      sessions: { total: 0, verified: 0 },
      artifacts: { verified: 0 },
      lastIngestedAt: null,
    });
  });

  it("requires the correct machine token for registration", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/sessions",
      headers: { authorization: "Bearer wrong" },
      payload: fixture().manifest,
    });
    expect(response.statusCode).toBe(401);
    expect(response.headers["www-authenticate"]).toBe("Bearer");
  });

  it("registers idempotently, detects drift, verifies streams, and serves control data", async () => {
    const { manifest, journal } = fixture();
    const register = () =>
      app.inject({
        method: "POST",
        url: "/v1/sessions",
        headers: { authorization: `Bearer ${INGEST_TOKEN}` },
        payload: manifest,
      });

    const first = await register();
    expect(first.statusCode).toBe(201);
    const firstBody = first.json();
    expect(firstBody).toMatchObject({
      created: true,
      sessionId: manifest.sessionId,
      status: "registered",
    });
    expect(firstBody.uploads).toHaveLength(1);

    const second = await register();
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({ created: false, manifestSha256: firstBody.manifestSha256 });

    const drift = await app.inject({
      method: "POST",
      url: "/v1/sessions",
      headers: { authorization: `Bearer ${INGEST_TOKEN}` },
      payload: { ...manifest, capabilityId: "different-capability" },
    });
    expect(drift.statusCode).toBe(409);
    expect(drift.json().error.code).toBe("manifest_drift");

    const stored = repository.sessions.get(manifest.sessionId);
    expect(stored).toBeDefined();
    storage.objects.set(stored!.artifacts[0]!.objectKey, journal);

    const finalized = await app.inject({
      method: "POST",
      url: `/v1/sessions/${manifest.sessionId}/finalize`,
      headers: { authorization: `Bearer ${INGEST_TOKEN}` },
    });
    expect(finalized.statusCode).toBe(200);
    expect(finalized.json()).toMatchObject({ status: "verified", artifactCount: 1 });

    const finalizedAgain = await app.inject({
      method: "POST",
      url: `/v1/sessions/${manifest.sessionId}/finalize`,
      headers: { authorization: `Bearer ${INGEST_TOKEN}` },
    });
    expect(finalizedAgain.statusCode).toBe(200);
    expect(finalizedAgain.json()).toMatchObject({ status: "verified" });

    const hidden = await app.inject({ method: "GET", url: "/v1/sessions" });
    expect(hidden.statusCode).toBe(401);

    const list = await app.inject({
      method: "GET",
      url: "/v1/sessions",
      headers: { authorization: `Bearer ${CONTROL_TOKEN}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().sessions).toHaveLength(1);

    const detail = await app.inject({
      method: "GET",
      url: `/v1/sessions/${manifest.sessionId}`,
      headers: { authorization: `Bearer ${CONTROL_TOKEN}` },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().artifacts[0].download.url).toContain("memory://download/");

    const status = await app.inject({ method: "GET", url: "/v1/public/status" });
    expect(status.json()).toMatchObject({
      sessions: { total: 1, verified: 1 },
      artifacts: { verified: 1 },
      lastIngestedAt: expect.any(String),
    });
    expect(JSON.stringify(status.json())).not.toContain(manifest.robotId);
    expect(JSON.stringify(status.json())).not.toContain(manifest.sessionId);
  });

  it("leaves a session unverified when streamed bytes do not match", async () => {
    const { manifest } = fixture("i2rt-run-corrupt");
    await app.inject({
      method: "POST",
      url: "/v1/sessions",
      headers: { authorization: `Bearer ${INGEST_TOKEN}` },
      payload: manifest,
    });
    const stored = repository.sessions.get(manifest.sessionId)!;
    storage.objects.set(stored.artifacts[0]!.objectKey, Buffer.alloc(manifest.artifacts[0]!.byteLength));

    const finalize = await app.inject({
      method: "POST",
      url: `/v1/sessions/${manifest.sessionId}/finalize`,
      headers: { authorization: `Bearer ${INGEST_TOKEN}` },
    });
    expect(finalize.statusCode).toBe(422);
    expect(finalize.json().error).toMatchObject({
      code: "artifact_verification_failed",
      details: { artifactId: "journal", reason: "sha256_mismatch" },
    });
    expect(repository.sessions.get(manifest.sessionId)!.status).toBe("registered");
  });

  it("does not grant cors access to unlisted browser origins", async () => {
    const allowed = await app.inject({
      method: "GET",
      url: "/v1/public/status",
      headers: { origin: "https://app.example.com" },
    });
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://app.example.com");

    const denied = await app.inject({
      method: "GET",
      url: "/v1/public/status",
      headers: { origin: "https://evil.example.com" },
    });
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
