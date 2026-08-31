import { createHash } from "node:crypto";
import { z } from "zod";
import { InputError } from "./errors.js";

export const DEMO_CONTENT_TYPE = "application/vnd.capy.i2rt-demo+json";
export const DEMO_BODY_LIMIT_BYTES = 128 * 1024;
export const DEMO_FIXTURE_VERSION = "fixed-square-peg-v1@1";

const canonicalBase64 = z.string().min(1).max(DEMO_BODY_LIMIT_BYTES);

export const DemoBundleSchema = z
  .object({
    schemaVersion: z.literal("capy.i2rt.synthetic-demo.v1"),
    fixtureVersion: z.literal(DEMO_FIXTURE_VERSION),
    artifacts: z
      .object({
        "events.ndjson": canonicalBase64,
        "geometry.json": canonicalBase64,
        "manifest.json": canonicalBase64,
        "session.mcap": canonicalBase64,
      })
      .strict(),
  })
  .strict();

type DemoArtifactName = keyof z.infer<typeof DemoBundleSchema>["artifacts"];

type DemoArtifactContract = {
  name: DemoArtifactName;
  byteLength: number;
  sha256: string;
};

export const DEMO_ARTIFACTS: readonly DemoArtifactContract[] = [
  {
    name: "events.ndjson",
    byteLength: 11_418,
    sha256: "f6c87359d61463a5230c1da5f61618e834eef36df411667d89b1536b3258569f",
  },
  {
    name: "geometry.json",
    byteLength: 580,
    sha256: "046370cfb5ca7494b59a1a5c67f5d3791484aed12164e6217bac2bdfed30c676",
  },
  {
    name: "manifest.json",
    byteLength: 1_619,
    sha256: "796b2bc82419e67f70997e7e63e19cfb0893f757e82c9a32c2fe70d9d7ec4cca",
  },
  {
    name: "session.mcap",
    byteLength: 15_594,
    sha256: "dd65c6bdce68432991cbc08f6916649401ef3f3dcfce09a012fa251a0b421f36",
  },
];

const DEMO_BYTE_LENGTH = DEMO_ARTIFACTS.reduce(
  (total, artifact) => total + artifact.byteLength,
  0,
);

function fixtureDigest(): string {
  const hash = createHash("sha256");
  hash.update("capy.i2rt.synthetic-demo.v1\0", "utf8");
  hash.update(`${DEMO_FIXTURE_VERSION}\0`, "utf8");
  for (const artifact of DEMO_ARTIFACTS) {
    hash.update(`${artifact.name}\0${artifact.byteLength}\0${artifact.sha256}\0`, "utf8");
  }
  return hash.digest("hex");
}

const DEMO_FIXTURE_SHA256 = fixtureDigest();

export const DEMO_RECEIPT = Object.freeze({
  schemaVersion: "capy.i2rt.synthetic-demo-receipt.v1" as const,
  fixtureVersion: DEMO_FIXTURE_VERSION,
  fixtureSha256: DEMO_FIXTURE_SHA256,
  dataClass: "synthetic_fixture" as const,
  integrityVerified: true as const,
  persisted: false as const,
  physicalEvidence: false as const,
  evaluationEligible: false as const,
  payoutEligible: false as const,
  artifactCount: DEMO_ARTIFACTS.length,
  byteLength: DEMO_BYTE_LENGTH,
});

function decodeCanonicalBase64(name: DemoArtifactName, encoded: string): Buffer {
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.toString("base64") !== encoded) {
    throw new InputError("demo bundle is invalid", [
      { path: `artifacts.${name}`, message: "artifact content is not canonical base64" },
    ]);
  }
  return bytes;
}

export function verifyDemoBundle(value: unknown): typeof DEMO_RECEIPT {
  const result = DemoBundleSchema.safeParse(value);
  if (!result.success) {
    throw new InputError(
      "demo bundle is invalid",
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }

  for (const artifact of DEMO_ARTIFACTS) {
    const bytes = decodeCanonicalBase64(artifact.name, result.data.artifacts[artifact.name]);
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (bytes.byteLength !== artifact.byteLength || digest !== artifact.sha256) {
      throw new InputError("demo bundle does not match the fixed synthetic fixture", [
        { path: `artifacts.${artifact.name}`, message: "artifact bytes do not match the fixture" },
      ]);
    }
  }

  return DEMO_RECEIPT;
}
