import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalManifest, manifestDigest, parseManifest } from "../src/domain.js";

function manifest() {
  const journal = Buffer.from('{"event":"run.completed"}\n', "utf8");
  return {
    schemaVersion: "1.0",
    sessionId: "i2rt-run-001",
    robotId: "i2rt-001",
    capabilityId: "fixed-insertion-v1",
    cameraFree: true,
    cameraStreams: 0,
    startedAt: "2026-08-30T19:00:00.000Z",
    endedAt: "2026-08-30T19:01:00.000Z",
    eventCount: 1,
    artifacts: [
      {
        id: "journal",
        name: "journal.jsonl",
        kind: "journal",
        mediaType: "application/x-ndjson",
        byteLength: journal.byteLength,
        sha256: createHash("sha256").update(journal).digest("hex"),
      },
    ],
    metadata: { cell: "lab-a", attempt: 1 },
  };
}

describe("session manifests", () => {
  it("canonicalizes object keys and produces a stable digest", () => {
    const parsed = parseManifest(manifest());
    const reordered = parseManifest({
      metadata: parsed.metadata,
      artifacts: parsed.artifacts,
      endedAt: parsed.endedAt,
      startedAt: parsed.startedAt,
      cameraFree: parsed.cameraFree,
      cameraStreams: parsed.cameraStreams,
      capabilityId: parsed.capabilityId,
      robotId: parsed.robotId,
      sessionId: parsed.sessionId,
      eventCount: parsed.eventCount,
      schemaVersion: parsed.schemaVersion,
    });
    expect(canonicalManifest(reordered)).toBe(canonicalManifest(parsed));
    expect(manifestDigest(reordered)).toBe(manifestDigest(parsed));
  });

  it("rejects camera data and manifests without a journal", () => {
    expect(() => parseManifest({ ...manifest(), cameraFree: false })).toThrow(
      "session manifest is invalid",
    );
    expect(() =>
      parseManifest({
        ...manifest(),
        artifacts: [{ ...manifest().artifacts[0], kind: "telemetry" }],
      }),
    ).toThrow("session manifest is invalid");
  });

  it("fails closed on obvious visual artifacts, metadata, streams, and unknown fields", () => {
    const valid = manifest();
    expect(() => parseManifest({ ...valid, cameraStreams: 1 })).toThrow(
      "session manifest is invalid",
    );
    expect(() =>
      parseManifest({
        ...valid,
        artifacts: [{ ...valid.artifacts[0], name: "camera-log.bin" }],
      }),
    ).toThrow("session manifest is invalid");
    expect(() =>
      parseManifest({
        ...valid,
        artifacts: [
          { ...valid.artifacts[0], id: "journal", name: "journal.png", mediaType: "image/png" },
        ],
      }),
    ).toThrow("session manifest is invalid");
    expect(() => parseManifest({ ...valid, metadata: { depthSensor: "none" } })).toThrow(
      "session manifest is invalid",
    );
    expect(() => parseManifest({ ...valid, videoUrl: "https://example.invalid/video" })).toThrow(
      "session manifest is invalid",
    );
  });

  it("rejects path traversal and duplicate artifact identifiers", () => {
    const valid = manifest();
    expect(() =>
      parseManifest({
        ...valid,
        artifacts: [{ ...valid.artifacts[0], name: "../journal.jsonl" }],
      }),
    ).toThrow("session manifest is invalid");
    expect(() =>
      parseManifest({ ...valid, artifacts: [valid.artifacts[0], valid.artifacts[0]] }),
    ).toThrow("session manifest is invalid");
  });
});
