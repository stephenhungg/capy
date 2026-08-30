import { createHash } from "node:crypto";
import { z } from "zod";
import {
  SessionManifestSchema,
  manifestDigest,
  objectKey,
  type SessionManifest,
} from "./domain.js";
import { ConflictError, InputError, NotFoundError, VerificationError } from "./errors.js";
import type {
  ArtifactVerification,
  SessionCursor,
  SessionRepository,
  StoredSession,
} from "./repository.js";
import { ObjectMissingError, type ObjectStorage } from "./storage.js";

export type IngestionServiceConfig = {
  uploadUrlTtlSeconds: number;
  downloadUrlTtlSeconds: number;
};

const cursorSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  sessionId: z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
});

export class IngestionService {
  constructor(
    private readonly repository: SessionRepository,
    private readonly storage: ObjectStorage,
    private readonly config: IngestionServiceConfig,
  ) {}

  async register(manifest: SessionManifest) {
    const digest = manifestDigest(manifest);
    const artifacts = manifest.artifacts.map((artifact) => ({
      ...artifact,
      objectKey: objectKey(digest, artifact),
    }));
    const registration = await this.repository.registerSession({
      manifest,
      manifestSha256: digest,
      artifacts,
    });

    if (registration.session.manifestSha256 !== digest) {
      throw new ConflictError(
        "this session id is already bound to a different canonical manifest",
      );
    }

    const uploads =
      registration.session.status === "registered"
        ? await Promise.all(
            registration.session.artifacts.map(async (artifact) => ({
              artifactId: artifact.id,
              name: artifact.name,
              byteLength: artifact.byteLength,
              sha256: artifact.sha256,
              ...(await this.storage.createUploadUrl(
                artifact.objectKey,
                artifact,
                this.config.uploadUrlTtlSeconds,
              )),
            })),
          )
        : [];

    return {
      created: registration.created,
      sessionId: manifest.sessionId,
      manifestSha256: digest,
      status: registration.session.status,
      uploads,
    };
  }

  async finalize(sessionId: string) {
    const session = await this.requiredSession(sessionId);
    if (session.status === "verified") return this.finalizationResponse(session);

    const validated = SessionManifestSchema.safeParse(session.manifest);
    if (!validated.success) {
      throw new Error("stored session manifest failed its own schema validation");
    }
    if (
      validated.data.cameraFree !== true ||
      validated.data.cameraStreams !== 0 ||
      !validated.data.artifacts.some((artifact) => artifact.kind === "journal")
    ) {
      throw new VerificationError("camera-free journal evidence is required");
    }

    const verifications: ArtifactVerification[] = [];
    for (const artifact of session.artifacts) {
      verifications.push(await this.verifyArtifact(artifact));
    }

    if (verifications.length !== validated.data.artifacts.length) {
      throw new VerificationError("every declared artifact must be verified");
    }

    const verified = await this.repository.markVerified(
      session.sessionId,
      session.manifestSha256,
      verifications,
    );
    return this.finalizationResponse(verified);
  }

  async publicStatus() {
    const status = await this.repository.publicStatus();
    return {
      state: "ready" as const,
      cameraFree: true as const,
      cameraStreams: 0 as const,
      sessions: {
        total: status.totalSessions,
        verified: status.verifiedSessions,
      },
      artifacts: {
        verified: status.verifiedArtifacts,
      },
      lastIngestedAt: status.lastIngestedAt,
    };
  }

  async list(limit: number, encodedCursor?: string) {
    const cursor = encodedCursor ? this.decodeCursor(encodedCursor) : null;
    const page = await this.repository.listSessions(limit, cursor);
    return {
      sessions: page.sessions,
      nextCursor: page.nextCursor ? this.encodeCursor(page.nextCursor) : null,
    };
  }

  async detail(sessionId: string) {
    const session = await this.requiredSession(sessionId);
    const artifacts = await Promise.all(
      session.artifacts.map(async (artifact) => {
        const download =
          session.status === "verified"
            ? await this.storage.createDownloadUrl(
                artifact.objectKey,
                this.config.downloadUrlTtlSeconds,
              )
            : null;
        return {
          id: artifact.id,
          name: artifact.name,
          kind: artifact.kind,
          mediaType: artifact.mediaType,
          byteLength: artifact.byteLength,
          sha256: artifact.sha256,
          verifiedAt: artifact.verifiedAt,
          download,
        };
      }),
    );
    return {
      sessionId: session.sessionId,
      manifestSha256: session.manifestSha256,
      status: session.status,
      createdAt: session.createdAt,
      verifiedAt: session.verifiedAt,
      manifest: session.manifest,
      artifacts,
    };
  }

  private async requiredSession(sessionId: string): Promise<StoredSession> {
    const session = await this.repository.getSession(sessionId);
    if (!session) throw new NotFoundError("session not found");
    return session;
  }

  private async verifyArtifact(
    artifact: StoredSession["artifacts"][number],
  ): Promise<ArtifactVerification> {
    let stream: AsyncIterable<Uint8Array>;
    try {
      stream = await this.storage.readObject(artifact.objectKey);
    } catch (error) {
      if (error instanceof ObjectMissingError) {
        throw new VerificationError("a declared artifact has not been uploaded", {
          artifactId: artifact.id,
          reason: "missing",
        });
      }
      throw error;
    }

    const hash = createHash("sha256");
    let byteLength = 0;
    for await (const chunk of stream) {
      const bytes = Buffer.from(chunk);
      byteLength += bytes.byteLength;
      if (byteLength > artifact.byteLength) {
        throw new VerificationError("an uploaded artifact is larger than declared", {
          artifactId: artifact.id,
          reason: "byte_length_mismatch",
        });
      }
      hash.update(bytes);
    }
    const sha256 = hash.digest("hex");

    if (byteLength !== artifact.byteLength) {
      throw new VerificationError("an uploaded artifact byte length does not match", {
        artifactId: artifact.id,
        reason: "byte_length_mismatch",
      });
    }
    if (sha256 !== artifact.sha256) {
      throw new VerificationError("an uploaded artifact digest does not match", {
        artifactId: artifact.id,
        reason: "sha256_mismatch",
      });
    }
    return { artifactId: artifact.id, byteLength, sha256 };
  }

  private finalizationResponse(session: StoredSession) {
    return {
      sessionId: session.sessionId,
      manifestSha256: session.manifestSha256,
      status: session.status,
      verifiedAt: session.verifiedAt,
      artifactCount: session.artifacts.length,
    };
  }

  private encodeCursor(cursor: SessionCursor): string {
    return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
  }

  private decodeCursor(encoded: string): SessionCursor {
    try {
      const value: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
      const parsed = cursorSchema.safeParse(value);
      if (!parsed.success) throw new Error("invalid cursor shape");
      return parsed.data;
    } catch {
      throw new InputError("cursor is invalid");
    }
  }
}
