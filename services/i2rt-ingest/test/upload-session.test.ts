import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const uploaderPath = fileURLToPath(new URL("../examples/upload-session.mjs", import.meta.url));
const cleanupDirectories: string[] = [];
const cleanupServers: Server[] = [];

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function createBundle(options: { badJournalDigest?: boolean } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "capy-i2rt-upload-"));
  cleanupDirectories.push(directory);
  const files = [
    {
      id: "journal",
      name: "events.ndjson",
      kind: "journal",
      mediaType: "application/x-ndjson",
      bytes: Buffer.from('{"event":"session_end"}\n', "utf8"),
    },
    {
      id: "source-manifest",
      name: "source-manifest.json",
      kind: "metadata",
      mediaType: "application/json",
      bytes: Buffer.from('{"schema_version":"capy.i2rt.camera_free.v1"}\n', "utf8"),
    },
  ];
  for (const file of files) await writeFile(join(directory, file.name), file.bytes);

  const manifest = {
    schemaVersion: "1.0",
    sessionId: "physical-session-001",
    artifacts: files.map((file) => ({
      id: file.id,
      name: file.name,
      kind: file.kind,
      mediaType: file.mediaType,
      byteLength: file.bytes.byteLength,
      sha256:
        options.badJournalDigest && file.id === "journal" ? "0".repeat(64) : sha256(file.bytes),
    })),
  };
  const manifestPath = join(directory, "ingest-manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`, "utf8");
  return { manifest, manifestPath };
}

async function startIngestServer(
  manifest: Awaited<ReturnType<typeof createBundle>>["manifest"],
  putStatuses: Record<string, number>,
) {
  const requests: string[] = [];
  let origin = "";
  const server = createServer((request, response) => {
    void (async () => {
      for await (const _chunk of request) {
        // Drain streamed uploads before responding so the child sees the intended status.
      }
      requests.push(`${request.method} ${request.url}`);

      if (request.method === "POST" && request.url === "/v1/sessions") {
        response.statusCode = 201;
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            created: true,
            sessionId: manifest.sessionId,
            manifestSha256: "a".repeat(64),
            status: "registered",
            uploads: manifest.artifacts.map((artifact) => ({
              artifactId: artifact.id,
              url: `${origin}/upload/${artifact.id}`,
              requiredHeaders: {
                "content-type": artifact.mediaType,
                "content-length": String(artifact.byteLength),
                "if-none-match": "*",
              },
            })),
          }),
        );
        return;
      }

      const artifactId = request.url?.match(/^\/upload\/(.+)$/)?.[1];
      if (request.method === "PUT" && artifactId) {
        response.statusCode = putStatuses[artifactId] ?? 200;
        response.end();
        return;
      }

      if (
        request.method === "POST" &&
        request.url === `/v1/sessions/${manifest.sessionId}/finalize`
      ) {
        response.statusCode = 200;
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            sessionId: manifest.sessionId,
            manifestSha256: "a".repeat(64),
            status: "verified",
            verifiedAt: "2026-08-30T19:01:00.000Z",
            artifactCount: manifest.artifacts.length,
          }),
        );
        return;
      }

      response.statusCode = 404;
      response.end();
    })().catch((error: unknown) => {
      response.statusCode = 500;
      response.end(error instanceof Error ? error.message : "test server failed");
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  cleanupServers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server has no tcp address");
  origin = `http://127.0.0.1:${address.port}`;
  return { origin, requests };
}

async function runUploader(manifestPath: string, apiUrl: string) {
  const child = spawn(process.execPath, [uploaderPath, manifestPath], {
    env: {
      CAPY_INGEST_TOKEN: "test-ingest-token",
      CAPY_INGEST_URL: apiUrl,
      PATH: process.env.PATH ?? "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const [exitCode] = (await once(child, "close")) as [number | null];
  return { exitCode, stdout, stderr };
}

afterEach(async () => {
  await Promise.all(
    cleanupServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
  await Promise.all(
    cleanupDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("session upload example", () => {
  it("continues after a write-once 412 and finalizes the session", async () => {
    const bundle = await createBundle();
    const ingest = await startIngestServer(bundle.manifest, { journal: 412 });

    const result = await runUploader(bundle.manifestPath, ingest.origin);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      sessionId: bundle.manifest.sessionId,
      status: "verified",
      artifactCount: 2,
    });
    expect(ingest.requests).toEqual([
      "POST /v1/sessions",
      "PUT /upload/journal",
      "PUT /upload/source-manifest",
      `POST /v1/sessions/${bundle.manifest.sessionId}/finalize`,
    ]);
  });

  it("keeps non-412 upload failures fatal", async () => {
    const bundle = await createBundle();
    const ingest = await startIngestServer(bundle.manifest, { journal: 503 });

    const result = await runUploader(bundle.manifestPath, ingest.origin);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("upload failed for journal (503)");
    expect(ingest.requests).toEqual(["POST /v1/sessions", "PUT /upload/journal"]);
  });

  it("rejects a same-length artifact with the wrong digest before registration", async () => {
    const bundle = await createBundle({ badJournalDigest: true });
    const ingest = await startIngestServer(bundle.manifest, {});

    const result = await runUploader(bundle.manifestPath, ingest.origin);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("events.ndjson sha256 does not match the manifest");
    expect(ingest.requests).toEqual([]);
  });
});
