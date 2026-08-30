const DEFAULT_I2RT_INGEST_URL = "https://capy-i2rt-production.up.railway.app";

export type I2rtPublicStatus = {
  state: "ready";
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

export type I2rtProbe = {
  state: "ready" | "degraded" | "not_connected";
  detail: string;
  status: I2rtPublicStatus | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isI2rtPublicStatus(value: unknown): value is I2rtPublicStatus {
  if (!isRecord(value) || !isRecord(value.sessions) || !isRecord(value.artifacts)) {
    return false;
  }

  return (
    value.state === "ready" &&
    value.cameraFree === true &&
    value.cameraStreams === 0 &&
    isNonNegativeInteger(value.sessions.total) &&
    isNonNegativeInteger(value.sessions.verified) &&
    isNonNegativeInteger(value.artifacts.verified) &&
    (value.lastIngestedAt === null || typeof value.lastIngestedAt === "string")
  );
}

export async function probeI2rtIngest(): Promise<I2rtProbe> {
  const configuredUrl = process.env.I2RT_INGEST_URL?.trim() || DEFAULT_I2RT_INGEST_URL;
  let statusUrl: URL;

  try {
    statusUrl = new URL("/v1/public/status", configuredUrl);
  } catch {
    return {
      state: "not_connected",
      detail: "ingress url is invalid",
      status: null,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);

  try {
    const response = await fetch(statusUrl, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      return {
        state: "degraded",
        detail: `ingress returned http ${response.status}`,
        status: null,
      };
    }

    const body: unknown = await response.json();
    if (!isI2rtPublicStatus(body)) {
      return {
        state: "degraded",
        detail: "ingress returned an unsafe or invalid camera profile",
        status: null,
      };
    }

    return {
      state: "ready",
      detail: `${body.sessions.verified} verified session${body.sessions.verified === 1 ? "" : "s"} · ${body.artifacts.verified} stored artifacts · 0 cameras`,
      status: body,
    };
  } catch (error) {
    return {
      state: "degraded",
      detail: error instanceof Error && error.name === "AbortError" ? "ingress timed out" : "ingress is unreachable",
      status: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}
