import pg from "pg";
import type { ArtifactManifest, SessionManifest, SessionStatus } from "./domain.js";

const { Pool } = pg;

export type StoredArtifact = ArtifactManifest & {
  objectKey: string;
  actualByteLength: number | null;
  actualSha256: string | null;
  verifiedAt: string | null;
};

export type StoredSession = {
  sessionId: string;
  manifestSha256: string;
  manifest: SessionManifest;
  status: SessionStatus;
  createdAt: string;
  verifiedAt: string | null;
  artifacts: StoredArtifact[];
};

export type NewSession = {
  manifest: SessionManifest;
  manifestSha256: string;
  artifacts: Array<ArtifactManifest & { objectKey: string }>;
};

export type ArtifactVerification = {
  artifactId: string;
  byteLength: number;
  sha256: string;
};

export type PublicStatus = {
  totalSessions: number;
  registeredSessions: number;
  verifiedSessions: number;
  acceptedEvents: number;
  verifiedArtifacts: number;
  lastIngestedAt: string | null;
};

export type SessionCursor = {
  createdAt: string;
  sessionId: string;
};

export type SessionSummary = {
  sessionId: string;
  robotId: string;
  capabilityId: string;
  cameraFree: true;
  status: SessionStatus;
  eventCount: number;
  artifactCount: number;
  startedAt: string;
  endedAt: string;
  createdAt: string;
  verifiedAt: string | null;
};

export type SessionPage = {
  sessions: SessionSummary[];
  nextCursor: SessionCursor | null;
};

export interface SessionRepository {
  initialize(): Promise<void>;
  close(): Promise<void>;
  ping(): Promise<void>;
  registerSession(session: NewSession): Promise<{ created: boolean; session: StoredSession }>;
  getSession(sessionId: string): Promise<StoredSession | null>;
  markVerified(
    sessionId: string,
    manifestSha256: string,
    artifacts: ArtifactVerification[],
  ): Promise<StoredSession>;
  publicStatus(): Promise<PublicStatus>;
  listSessions(limit: number, cursor: SessionCursor | null): Promise<SessionPage>;
}

type Queryable = Pick<pg.PoolClient, "query">;

type SessionRow = {
  id: string;
  manifest_sha256: string;
  manifest: SessionManifest;
  status: SessionStatus;
  created_at: Date;
  verified_at: Date | null;
};

type ArtifactRow = {
  id: string;
  name: string;
  kind: ArtifactManifest["kind"];
  media_type: string;
  expected_byte_length: string;
  expected_sha256: string;
  object_key: string;
  actual_byte_length: string | null;
  actual_sha256: string | null;
  verified_at: Date | null;
};

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export class PostgresSessionRepository implements SessionRepository {
  private readonly pool: pg.Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      application_name: "capy-i2rt-ingest",
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("SELECT pg_advisory_lock(hashtext('capy_i2rt_schema_v1'))");
      await client.query(`
        CREATE TABLE IF NOT EXISTS capy_i2rt_sessions (
          id TEXT PRIMARY KEY,
          manifest_sha256 CHAR(64) NOT NULL,
          manifest JSONB NOT NULL,
          camera_free BOOLEAN NOT NULL DEFAULT TRUE CHECK (camera_free = TRUE),
          event_count BIGINT NOT NULL DEFAULT 0 CHECK (event_count >= 0),
          status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'verified')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          verified_at TIMESTAMPTZ,
          CHECK ((status = 'verified') = (verified_at IS NOT NULL))
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS capy_i2rt_artifacts (
          session_id TEXT NOT NULL REFERENCES capy_i2rt_sessions(id) ON DELETE RESTRICT,
          id TEXT NOT NULL,
          name TEXT NOT NULL,
          kind TEXT NOT NULL,
          media_type TEXT NOT NULL,
          expected_byte_length BIGINT NOT NULL CHECK (expected_byte_length > 0),
          expected_sha256 CHAR(64) NOT NULL,
          object_key TEXT NOT NULL UNIQUE,
          actual_byte_length BIGINT,
          actual_sha256 CHAR(64),
          verified_at TIMESTAMPTZ,
          PRIMARY KEY (session_id, id),
          UNIQUE (session_id, name),
          CHECK (
            (verified_at IS NULL AND actual_byte_length IS NULL AND actual_sha256 IS NULL)
            OR
            (verified_at IS NOT NULL AND actual_byte_length IS NOT NULL AND actual_sha256 IS NOT NULL)
          )
        )
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS capy_i2rt_sessions_created_idx
        ON capy_i2rt_sessions (created_at DESC, id DESC)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS capy_i2rt_sessions_status_idx
        ON capy_i2rt_sessions (status, verified_at DESC)
      `);
    } finally {
      try {
        await client.query("SELECT pg_advisory_unlock(hashtext('capy_i2rt_schema_v1'))");
      } finally {
        client.release();
      }
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async ping(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  async registerSession(
    session: NewSession,
  ): Promise<{ created: boolean; session: StoredSession }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query<{ id: string }>(
        `
          INSERT INTO capy_i2rt_sessions
            (id, manifest_sha256, manifest, camera_free, event_count)
          VALUES ($1, $2, $3::jsonb, TRUE, $4)
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        `,
        [
          session.manifest.sessionId,
          session.manifestSha256,
          JSON.stringify(session.manifest),
          session.manifest.eventCount,
        ],
      );
      const created = inserted.rowCount === 1;

      if (created) {
        for (const artifact of session.artifacts) {
          await client.query(
            `
              INSERT INTO capy_i2rt_artifacts
                (session_id, id, name, kind, media_type, expected_byte_length,
                 expected_sha256, object_key)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [
              session.manifest.sessionId,
              artifact.id,
              artifact.name,
              artifact.kind,
              artifact.mediaType,
              artifact.byteLength,
              artifact.sha256,
              artifact.objectKey,
            ],
          );
        }
      }

      const stored = await this.loadSession(client, session.manifest.sessionId);
      if (!stored) throw new Error("registered session disappeared inside its transaction");
      await client.query("COMMIT");
      return { created, session: stored };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getSession(sessionId: string): Promise<StoredSession | null> {
    return this.loadSession(this.pool, sessionId);
  }

  async markVerified(
    sessionId: string,
    manifestSha256: string,
    artifacts: ArtifactVerification[],
  ): Promise<StoredSession> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const sessionResult = await client.query<SessionRow>(
        "SELECT * FROM capy_i2rt_sessions WHERE id = $1 FOR UPDATE",
        [sessionId],
      );
      const session = sessionResult.rows[0];
      if (!session) throw new Error("session not found while marking verified");
      if (session.manifest_sha256 !== manifestSha256) {
        throw new Error("manifest digest changed while marking verified");
      }

      if (session.status !== "verified") {
        for (const artifact of artifacts) {
          const updated = await client.query(
            `
              UPDATE capy_i2rt_artifacts
              SET actual_byte_length = $3, actual_sha256 = $4, verified_at = NOW()
              WHERE session_id = $1 AND id = $2 AND verified_at IS NULL
            `,
            [sessionId, artifact.artifactId, artifact.byteLength, artifact.sha256],
          );
          if (updated.rowCount !== 1) {
            throw new Error(`artifact ${artifact.artifactId} could not be marked verified`);
          }
        }

        const updatedSession = await client.query(
          `
            UPDATE capy_i2rt_sessions
            SET status = 'verified', verified_at = NOW()
            WHERE id = $1 AND status = 'registered'
          `,
          [sessionId],
        );
        if (updatedSession.rowCount !== 1) {
          throw new Error("session could not be marked verified");
        }
      }

      const stored = await this.loadSession(client, sessionId);
      if (!stored) throw new Error("verified session disappeared inside its transaction");
      await client.query("COMMIT");
      return stored;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async publicStatus(): Promise<PublicStatus> {
    const result = await this.pool.query<{
      total_sessions: string;
      registered_sessions: string;
      verified_sessions: string;
      accepted_events: string;
      verified_artifacts: string;
      last_ingested_at: Date | null;
    }>(`
      SELECT
        COUNT(*) AS total_sessions,
        COUNT(*) FILTER (WHERE status = 'registered') AS registered_sessions,
        COUNT(*) FILTER (WHERE status = 'verified') AS verified_sessions,
        COALESCE(SUM(event_count) FILTER (WHERE status = 'verified'), 0) AS accepted_events,
        (
          SELECT COUNT(*) FROM capy_i2rt_artifacts WHERE verified_at IS NOT NULL
        ) AS verified_artifacts,
        MAX(verified_at) AS last_ingested_at
      FROM capy_i2rt_sessions
    `);
    const row = result.rows[0];
    if (!row) throw new Error("public status query returned no row");
    return {
      totalSessions: Number(row.total_sessions),
      registeredSessions: Number(row.registered_sessions),
      verifiedSessions: Number(row.verified_sessions),
      acceptedEvents: Number(row.accepted_events),
      verifiedArtifacts: Number(row.verified_artifacts),
      lastIngestedAt: row.last_ingested_at ? iso(row.last_ingested_at) : null,
    };
  }

  async listSessions(limit: number, cursor: SessionCursor | null): Promise<SessionPage> {
    const parameters: unknown[] = [];
    let cursorClause = "";
    if (cursor) {
      parameters.push(cursor.createdAt, cursor.sessionId);
      cursorClause = "WHERE (s.created_at < $1 OR (s.created_at = $1 AND s.id < $2))";
    }
    parameters.push(limit + 1);
    const limitParameter = `$${parameters.length}`;
    const result = await this.pool.query<{
      id: string;
      manifest: SessionManifest;
      status: SessionStatus;
      event_count: string;
      artifact_count: string;
      created_at: Date;
      verified_at: Date | null;
    }>(
      `
        SELECT s.id, s.manifest, s.status, s.event_count, s.created_at, s.verified_at,
               COUNT(a.id) AS artifact_count
        FROM capy_i2rt_sessions s
        LEFT JOIN capy_i2rt_artifacts a ON a.session_id = s.id
        ${cursorClause}
        GROUP BY s.id
        ORDER BY s.created_at DESC, s.id DESC
        LIMIT ${limitParameter}
      `,
      parameters,
    );
    const hasMore = result.rows.length > limit;
    const visible = hasMore ? result.rows.slice(0, limit) : result.rows;
    const sessions = visible.map((row) => ({
      sessionId: row.id,
      robotId: row.manifest.robotId,
      capabilityId: row.manifest.capabilityId,
      cameraFree: true as const,
      status: row.status,
      eventCount: Number(row.event_count),
      artifactCount: Number(row.artifact_count),
      startedAt: row.manifest.startedAt,
      endedAt: row.manifest.endedAt,
      createdAt: iso(row.created_at),
      verifiedAt: row.verified_at ? iso(row.verified_at) : null,
    }));
    const last = sessions.at(-1);
    return {
      sessions,
      nextCursor:
        hasMore && last ? { createdAt: last.createdAt, sessionId: last.sessionId } : null,
    };
  }

  private async loadSession(queryable: Queryable, sessionId: string): Promise<StoredSession | null> {
    const sessionResult = await queryable.query<SessionRow>(
      "SELECT * FROM capy_i2rt_sessions WHERE id = $1",
      [sessionId],
    );
    const row = sessionResult.rows[0];
    if (!row) return null;

    const artifactResult = await queryable.query<ArtifactRow>(
      `
        SELECT * FROM capy_i2rt_artifacts
        WHERE session_id = $1
        ORDER BY id ASC
      `,
      [sessionId],
    );
    return {
      sessionId: row.id,
      manifestSha256: row.manifest_sha256,
      manifest: row.manifest,
      status: row.status,
      createdAt: iso(row.created_at),
      verifiedAt: row.verified_at ? iso(row.verified_at) : null,
      artifacts: artifactResult.rows.map((artifact) => ({
        id: artifact.id,
        name: artifact.name,
        kind: artifact.kind,
        mediaType: artifact.media_type,
        byteLength: Number(artifact.expected_byte_length),
        sha256: artifact.expected_sha256,
        objectKey: artifact.object_key,
        actualByteLength:
          artifact.actual_byte_length === null ? null : Number(artifact.actual_byte_length),
        actualSha256: artifact.actual_sha256,
        verifiedAt: artifact.verified_at ? iso(artifact.verified_at) : null,
      })),
    };
  }
}
