import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { DEMO_BODY_LIMIT_BYTES, DEMO_CONTENT_TYPE } from "../src/demo.js";
import { CONTROL_TOKEN, INGEST_TOKEN, MemoryRepository, MemoryStorage, testConfig } from "./helpers.js";

type DemoBundle = {
  schemaVersion: string;
  fixtureVersion: string;
  artifacts: Record<string, string>;
};

const demoBundlePath = fileURLToPath(
  new URL("../../../packages/i2rt-recorder/fixtures/demo-v1/upload.json", import.meta.url),
);

function demoBundle(): DemoBundle {
  return JSON.parse(readFileSync(demoBundlePath, "utf8")) as DemoBundle;
}

function demoRequest(payload: object) {
  return {
    method: "POST" as const,
    url: "/v1/demo/sessions",
    headers: { "content-type": DEMO_CONTENT_TYPE },
    payload,
  };
}

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

  it("verifies the exact synthetic fixture without auth and leaves durable state untouched", async () => {
    const before = await app.inject({ method: "GET", url: "/v1/public/status" });

    const response = await app.inject(demoRequest(demoBundle()));

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain(
      "application/vnd.capy.i2rt-demo-receipt+json",
    );
    expect(response.json()).toEqual({
      schemaVersion: "capy.i2rt.synthetic-demo-receipt.v1",
      fixtureVersion: "fixed-square-peg-v1@1",
      fixtureSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      dataClass: "synthetic_fixture",
      integrityVerified: true,
      persisted: false,
      physicalEvidence: false,
      evaluationEligible: false,
      payoutEligible: false,
      artifactCount: 4,
      byteLength: 29_211,
    });
    expect(repository.sessions.size).toBe(0);
    expect(storage.objects.size).toBe(0);

    const after = await app.inject({ method: "GET", url: "/v1/public/status" });
    expect(after.json()).toEqual(before.json());

    const authenticatedLane = await app.inject({
      method: "POST",
      url: "/v1/sessions",
      payload: fixture("demo-cannot-cross-auth-boundary").manifest,
    });
    expect(authenticatedLane.statusCode).toBe(401);
  });

  it("rejects a one-byte fixture mutation", async () => {
    const bundle = demoBundle();
    const encoded = bundle.artifacts["events.ndjson"];
    if (!encoded) throw new Error("golden demo bundle has no events artifact");
    const bytes = Buffer.from(encoded, "base64");
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    bundle.artifacts["events.ndjson"] = bytes.toString("base64");

    const response = await app.inject(demoRequest(bundle));

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({ code: "invalid_request" });
    expect(repository.sessions.size).toBe(0);
    expect(storage.objects.size).toBe(0);
  });

  it("rejects the wrong fixture version", async () => {
    const bundle = demoBundle();
    bundle.fixtureVersion = "physical-yam-run@1";

    const response = await app.inject(demoRequest(bundle));

    expect(response.statusCode).toBe(400);
    expect(repository.sessions.size).toBe(0);
    expect(storage.objects.size).toBe(0);
  });

  it("rejects a missing fixture artifact", async () => {
    const bundle = demoBundle();
    delete bundle.artifacts["geometry.json"];

    const response = await app.inject(demoRequest(bundle));

    expect(response.statusCode).toBe(400);
    expect(repository.sessions.size).toBe(0);
    expect(storage.objects.size).toBe(0);
  });

  it("rejects extra fixture fields", async () => {
    const bundle = demoBundle();
    bundle.artifacts["camera.png"] = Buffer.from("not allowed", "utf8").toString("base64");

    const response = await app.inject(demoRequest(bundle));

    expect(response.statusCode).toBe(400);
    expect(repository.sessions.size).toBe(0);
    expect(storage.objects.size).toBe(0);
  });

  it("rejects a physical manifest on the synthetic-only route", async () => {
    const response = await app.inject(demoRequest(fixture("physical-route-confusion").manifest));

    expect(response.statusCode).toBe(400);
    expect(repository.sessions.size).toBe(0);
    expect(storage.objects.size).toBe(0);
  });

  it("requires the vendor media type", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/demo/sessions",
      headers: { "content-type": "application/json" },
      payload: demoBundle(),
    });

    expect(response.statusCode).toBe(415);
  });

  it("rejects a demo body above 128 KiB before verification", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/demo/sessions",
      headers: { "content-type": DEMO_CONTENT_TYPE },
      payload: JSON.stringify({ padding: "x".repeat(DEMO_BODY_LIMIT_BYTES) }),
    });

    expect(response.statusCode).toBe(413);
    expect(response.json().error).toMatchObject({ code: "payload_too_large" });
    expect(repository.sessions.size).toBe(0);
    expect(storage.objects.size).toBe(0);
  });

  it("returns a stable receipt and rate-limits the public verifier", async () => {
    const responses = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      responses.push(await app.inject(demoRequest(demoBundle())));
    }

    expect(responses.slice(0, 3).map((response) => response.statusCode)).toEqual([200, 200, 200]);
    expect(responses[1]?.json()).toEqual(responses[0]?.json());
    expect(responses[2]?.json()).toEqual(responses[0]?.json());
    expect(responses[3]?.statusCode).toBe(429);
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
