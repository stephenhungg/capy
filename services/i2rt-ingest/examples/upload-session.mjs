#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

const [manifestArgument] = process.argv.slice(2);
const apiUrl = process.env.CAPY_INGEST_URL?.replace(/\/$/, "");
const token = process.env.CAPY_INGEST_TOKEN;

if (!manifestArgument || !apiUrl || !token) {
  process.stderr.write(
    "usage: CAPY_INGEST_URL=https://... CAPY_INGEST_TOKEN=... node examples/upload-session.mjs manifest.json\n",
  );
  process.exitCode = 2;
} else {
  const manifestPath = resolve(manifestArgument);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const artifactPaths = new Map();
  for (const artifact of manifest.artifacts) {
    const artifactPath = resolve(dirname(manifestPath), artifact.name);
    const artifactStat = await stat(artifactPath);
    if (artifactStat.size !== artifact.byteLength) {
      throw new Error(`${artifact.name} changed after the manifest was created`);
    }
    const actualSha256 = await sha256File(artifactPath);
    if (actualSha256 !== artifact.sha256) {
      throw new Error(`${artifact.name} sha256 does not match the manifest`);
    }
    artifactPaths.set(artifact.id, artifactPath);
  }

  const registrationResponse = await fetch(`${apiUrl}/v1/sessions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(manifest),
  });
  const registration = await registrationResponse.json();
  if (!registrationResponse.ok) {
    throw new Error(`registration failed (${registrationResponse.status}): ${JSON.stringify(registration)}`);
  }

  for (const upload of registration.uploads) {
    const artifact = manifest.artifacts.find((candidate) => candidate.id === upload.artifactId);
    if (!artifact) throw new Error(`registration returned unknown artifact ${upload.artifactId}`);
    const artifactPath = artifactPaths.get(artifact.id);
    if (!artifactPath) throw new Error(`artifact ${artifact.id} was not preflighted`);
    const artifactStat = await stat(artifactPath);
    if (artifactStat.size !== artifact.byteLength) {
      throw new Error(`${artifact.name} changed after the manifest was created`);
    }
    const uploadResponse = await fetch(upload.url, {
      method: "PUT",
      headers: upload.requiredHeaders,
      body: createReadStream(artifactPath),
      duplex: "half",
    });
    if (!uploadResponse.ok && uploadResponse.status !== 412) {
      throw new Error(`upload failed for ${artifact.id} (${uploadResponse.status})`);
    }
  }

  const finalizeResponse = await fetch(
    `${apiUrl}/v1/sessions/${encodeURIComponent(manifest.sessionId)}/finalize`,
    { method: "POST", headers: { authorization: `Bearer ${token}` } },
  );
  const finalization = await finalizeResponse.json();
  if (!finalizeResponse.ok) {
    throw new Error(`finalization failed (${finalizeResponse.status}): ${JSON.stringify(finalization)}`);
  }
  process.stdout.write(`${JSON.stringify(finalization, null, 2)}\n`);
}
