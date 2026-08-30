import type { AppConfig } from "../src/config.js";
import type {
  ArtifactVerification,
  NewSession,
  PublicStatus,
  SessionCursor,
  SessionPage,
  SessionRepository,
  StoredSession,
} from "../src/repository.js";
import type { ArtifactManifest } from "../src/domain.js";
import {
  ObjectMissingError,
  type ObjectStorage,
  type SignedDownload,
  type SignedUpload,
} from "../src/storage.js";

export const INGEST_TOKEN = "ingest-token-that-is-at-least-32-chars";
export const CONTROL_TOKEN = "control-token-that-is-at-least-32-chars";

export const testConfig: AppConfig = {
  nodeEnv: "test",
  databaseUrl: "postgresql://unused:unused@localhost:5432/unused",
  s3: {
    endpoint: "http://storage.invalid",
    region: "auto",
    bucket: "test",
    accessKeyId: "unused",
    secretAccessKey: "unused",
    forcePathStyle: true,
  },
  ingestToken: INGEST_TOKEN,
  controlPlaneToken: CONTROL_TOKEN,
  corsAllowedOrigins: new Set(["https://app.example.com"]),
  uploadUrlTtlSeconds: 600,
  downloadUrlTtlSeconds: 300,
  port: 8080,
  host: "127.0.0.1",
  logLevel: "silent",
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryRepository implements SessionRepository {
  readonly sessions = new Map<string, StoredSession>();
  private clock = 0;

  async initialize(): Promise<void> {}
  async close(): Promise<void> {}
  async ping(): Promise<void> {}

  async registerSession(
    session: NewSession,
  ): Promise<{ created: boolean; session: StoredSession }> {
    const existing = this.sessions.get(session.manifest.sessionId);
    if (existing) return { created: false, session: clone(existing) };
    this.clock += 1;
    const stored: StoredSession = {
      sessionId: session.manifest.sessionId,
      manifestSha256: session.manifestSha256,
      manifest: clone(session.manifest),
      status: "registered",
      createdAt: new Date(Date.UTC(2026, 7, 30, 12, 0, this.clock)).toISOString(),
      verifiedAt: null,
      artifacts: session.artifacts.map((artifact) => ({
        ...clone(artifact),
        actualByteLength: null,
        actualSha256: null,
        verifiedAt: null,
      })),
    };
    this.sessions.set(stored.sessionId, stored);
    return { created: true, session: clone(stored) };
  }

  async getSession(sessionId: string): Promise<StoredSession | null> {
    const session = this.sessions.get(sessionId);
    return session ? clone(session) : null;
  }

  async markVerified(
    sessionId: string,
    manifestSha256: string,
    artifacts: ArtifactVerification[],
  ): Promise<StoredSession> {
    const session = this.sessions.get(sessionId);
    if (!session || session.manifestSha256 !== manifestSha256) throw new Error("session missing");
    if (session.status === "verified") return clone(session);
    const verifiedAt = new Date(Date.UTC(2026, 7, 30, 13, 0, this.clock)).toISOString();
    for (const verification of artifacts) {
      const artifact = session.artifacts.find((candidate) => candidate.id === verification.artifactId);
      if (!artifact) throw new Error("artifact missing");
      artifact.actualByteLength = verification.byteLength;
      artifact.actualSha256 = verification.sha256;
      artifact.verifiedAt = verifiedAt;
    }
    session.status = "verified";
    session.verifiedAt = verifiedAt;
    return clone(session);
  }

  async publicStatus(): Promise<PublicStatus> {
    const sessions = [...this.sessions.values()];
    const verified = sessions.filter((session) => session.status === "verified");
    return {
      totalSessions: sessions.length,
      registeredSessions: sessions.length - verified.length,
      verifiedSessions: verified.length,
      acceptedEvents: verified.reduce((sum, session) => sum + session.manifest.eventCount, 0),
      verifiedArtifacts: verified.reduce((sum, session) => sum + session.artifacts.length, 0),
      lastIngestedAt:
        verified.map((session) => session.verifiedAt).filter((value) => value !== null).sort().at(-1) ??
        null,
    };
  }

  async listSessions(limit: number, cursor: SessionCursor | null): Promise<SessionPage> {
    let sessions = [...this.sessions.values()].sort(
      (left, right) =>
        right.createdAt.localeCompare(left.createdAt) ||
        right.sessionId.localeCompare(left.sessionId),
    );
    if (cursor) {
      sessions = sessions.filter(
        (session) =>
          session.createdAt < cursor.createdAt ||
          (session.createdAt === cursor.createdAt && session.sessionId < cursor.sessionId),
      );
    }
    const hasMore = sessions.length > limit;
    const visible = sessions.slice(0, limit);
    const summaries = visible.map((session) => ({
      sessionId: session.sessionId,
      robotId: session.manifest.robotId,
      capabilityId: session.manifest.capabilityId,
      cameraFree: true as const,
      status: session.status,
      eventCount: session.manifest.eventCount,
      artifactCount: session.artifacts.length,
      startedAt: session.manifest.startedAt,
      endedAt: session.manifest.endedAt,
      createdAt: session.createdAt,
      verifiedAt: session.verifiedAt,
    }));
    const last = summaries.at(-1);
    return {
      sessions: summaries,
      nextCursor:
        hasMore && last ? { createdAt: last.createdAt, sessionId: last.sessionId } : null,
    };
  }
}

export class MemoryStorage implements ObjectStorage {
  readonly objects = new Map<string, Uint8Array>();

  async ping(): Promise<void> {}

  async createUploadUrl(
    objectKey: string,
    artifact: ArtifactManifest,
    expiresInSeconds: number,
  ): Promise<SignedUpload> {
    return {
      url: `memory://upload/${encodeURIComponent(objectKey)}`,
      expiresInSeconds,
      requiredHeaders: {
        "content-type": artifact.mediaType,
        "content-length": String(artifact.byteLength),
        "if-none-match": "*",
      },
    };
  }

  async createDownloadUrl(
    objectKey: string,
    expiresInSeconds: number,
  ): Promise<SignedDownload> {
    return { url: `memory://download/${encodeURIComponent(objectKey)}`, expiresInSeconds };
  }

  async readObject(objectKey: string): Promise<AsyncIterable<Uint8Array>> {
    const bytes = this.objects.get(objectKey);
    if (!bytes) throw new ObjectMissingError(objectKey);
    return (async function* stream() {
      const midpoint = Math.max(1, Math.floor(bytes.length / 2));
      yield bytes.subarray(0, midpoint);
      if (midpoint < bytes.length) yield bytes.subarray(midpoint);
    })();
  }

  close(): void {}
}
