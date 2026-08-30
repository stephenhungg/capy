import { env } from 'cloudflare:workers';

type I2rtPublicStatus = {
  state: 'ready' | 'degraded';
  cameraFree: true;
  cameraStreams: 0;
  sessions: {
    total: number;
    verified: number;
  };
  artifacts: {
    verified: number;
  };
  lastIngestedAt: string | null;
};

export type I2rtIngestProbe = {
  state: 'ready' | 'degraded' | 'not_connected';
  detail: string;
  status: I2rtPublicStatus | null;
};

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function parsePublicStatus(value: unknown): I2rtPublicStatus | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const sessions = record.sessions as Record<string, unknown> | undefined;
  const artifacts = record.artifacts as Record<string, unknown> | undefined;
  const lastIngestedAt = record.lastIngestedAt;

  if (
    (record.state !== 'ready' && record.state !== 'degraded') ||
    record.cameraFree !== true ||
    record.cameraStreams !== 0 ||
    !sessions ||
    !isCount(sessions.total) ||
    !isCount(sessions.verified) ||
    !artifacts ||
    !isCount(artifacts.verified) ||
    (lastIngestedAt !== null && typeof lastIngestedAt !== 'string')
  ) {
    return null;
  }

  return {
    state: record.state,
    cameraFree: true,
    cameraStreams: 0,
    sessions: { total: sessions.total, verified: sessions.verified },
    artifacts: { verified: artifacts.verified },
    lastIngestedAt,
  };
}

export async function probeI2rtIngest(): Promise<I2rtIngestProbe> {
  const baseUrl = env.I2RT_INGEST_URL?.trim();
  if (!baseUrl) {
    return {
      state: 'not_connected',
      detail: 'camera-free I2RT ingress is not configured',
      status: null,
    };
  }

  try {
    const response = await fetch(new URL('/v1/public/status', `${baseUrl.replace(/\/$/, '')}/`), {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(2_500),
    });
    if (!response.ok) throw new Error('ingress returned a non-success response');

    const status = parsePublicStatus(await response.json());
    if (!status) throw new Error('ingress returned an invalid camera-free status');

    return {
      state: status.state,
      detail: `${status.sessions.verified} integrity-verified sessions · ${status.artifacts.verified} stored artifacts · 0 cameras`,
      status,
    };
  } catch {
    return {
      state: 'degraded',
      detail: 'camera-free I2RT ingress is unreachable',
      status: null,
    };
  }
}
