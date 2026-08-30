import { createHash } from "node:crypto";
import { z } from "zod";
import { InputError } from "./errors.js";

const safeIdentifier = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const safeFilename = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const mediaType = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;
const sha256 = /^[a-f0-9]{64}$/;
const visualChannel = /(camera|image|rgb|depth|video)/i;

const MetadataValueSchema = z.union([
  z.string().max(1_024),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const ArtifactManifestSchema = z
  .object({
    id: z.string().min(1).max(64).regex(safeIdentifier),
    name: z.string().min(1).max(128).regex(safeFilename),
    kind: z.enum([
      "journal",
      "telemetry",
      "proprioception",
      "actions",
      "controller_log",
      "metadata",
      "other",
    ]),
    mediaType: z.string().min(3).max(127).regex(mediaType),
    byteLength: z.number().int().positive().max(100 * 1024 * 1024 * 1024),
    sha256: z.string().regex(sha256),
  })
  .strict()
  .superRefine((artifact, context) => {
    if (/^(image|video)\//i.test(artifact.mediaType)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mediaType"],
        message: "visual media types are forbidden by the camera-free contract",
      });
    }
    for (const field of ["id", "name"] as const) {
      if (visualChannel.test(artifact[field])) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: "visual channel identifiers are forbidden by the camera-free contract",
        });
      }
    }
  });

export const SessionManifestSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    sessionId: z.string().min(1).max(128).regex(safeIdentifier),
    robotId: z.string().min(1).max(128).regex(safeIdentifier),
    capabilityId: z.string().min(1).max(128).regex(safeIdentifier),
    runId: z.string().min(1).max(128).regex(safeIdentifier).optional(),
    cameraFree: z.literal(true),
    cameraStreams: z.literal(0),
    startedAt: z.string().datetime({ offset: true }),
    endedAt: z.string().datetime({ offset: true }),
    eventCount: z.number().int().nonnegative().max(1_000_000_000).default(0),
    artifacts: z.array(ArtifactManifestSchema).min(1).max(64),
    metadata: z.record(z.string().min(1).max(64), MetadataValueSchema).default({}),
  })
  .strict()
  .superRefine((manifest, context) => {
    if (Date.parse(manifest.endedAt) < Date.parse(manifest.startedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endedAt"],
        message: "endedAt must not be earlier than startedAt",
      });
    }

    if (!manifest.artifacts.some((artifact) => artifact.kind === "journal")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["artifacts"],
        message: "a camera-free journal artifact is required",
      });
    }

    for (const field of ["id", "name"] as const) {
      const values = manifest.artifacts.map((artifact) => artifact[field]);
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["artifacts"],
          message: `artifact ${field} values must be unique`,
        });
      }
    }

    if (Buffer.byteLength(JSON.stringify(manifest.metadata), "utf8") > 16_384) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["metadata"],
        message: "metadata must not exceed 16 KiB",
      });
    }

    for (const key of Object.keys(manifest.metadata)) {
      if (visualChannel.test(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["metadata", key],
          message: "visual channel metadata keys are forbidden by the camera-free contract",
        });
      }
    }
  });

export type ArtifactManifest = z.infer<typeof ArtifactManifestSchema>;
export type SessionManifest = z.infer<typeof SessionManifestSchema>;
export type SessionStatus = "registered" | "verified";

export function parseManifest(value: unknown): SessionManifest {
  const result = SessionManifestSchema.safeParse(value);
  if (!result.success) {
    throw new InputError(
      "session manifest is invalid",
      result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    );
  }
  return result.data;
}

function sortForCanonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForCanonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, child]) => [key, sortForCanonicalJson(child)]),
    );
  }
  return value;
}

export function canonicalManifest(manifest: SessionManifest): string {
  return JSON.stringify(sortForCanonicalJson(manifest));
}

export function manifestDigest(manifest: SessionManifest): string {
  return createHash("sha256").update(canonicalManifest(manifest), "utf8").digest("hex");
}

export function objectKey(manifestSha256: string, artifact: ArtifactManifest): string {
  return `sessions/${manifestSha256}/${artifact.id}/${artifact.sha256}-${artifact.name}`;
}
