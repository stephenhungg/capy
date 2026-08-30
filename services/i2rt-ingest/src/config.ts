import { z } from "zod";

const integerFromEnv = (fallback: number, min: number, max: number) =>
  z.preprocess(
    (value) => (value === undefined || value === "" ? fallback : Number(value)),
    z.number().int().min(min).max(max),
  );

const booleanFromEnv = (fallback: boolean) =>
  z.preprocess((value) => {
    if (value === undefined || value === "") return fallback;
    if (typeof value === "boolean") return value;
    return value === "true" || value === "1";
  }, z.boolean());

const EnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().refine(
      (value) => {
        try {
          return ["postgres:", "postgresql:"].includes(new URL(value).protocol);
        } catch {
          return false;
        }
      },
      { message: "DATABASE_URL must be a postgres connection url" },
    ),
    S3_ENDPOINT: z.string().url(),
    S3_REGION: z.string().min(1).default("auto"),
    S3_BUCKET: z.string().min(1).max(255),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_FORCE_PATH_STYLE: booleanFromEnv(true),
    INGEST_TOKEN: z.string().min(32).max(512).regex(/^\S+$/),
    CONTROL_PLANE_TOKEN: z.string().min(32).max(512).regex(/^\S+$/),
    CORS_ALLOWED_ORIGINS: z.string().default(""),
    UPLOAD_URL_TTL_SECONDS: integerFromEnv(600, 60, 900),
    DOWNLOAD_URL_TTL_SECONDS: integerFromEnv(300, 60, 900),
    PORT: integerFromEnv(8080, 1, 65_535),
    HOST: z.string().min(1).default("0.0.0.0"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
  })
  .superRefine((value, context) => {
    if (value.INGEST_TOKEN === value.CONTROL_PLANE_TOKEN) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CONTROL_PLANE_TOKEN"],
        message: "control-plane and ingest tokens must be different",
      });
    }
  });

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  databaseUrl: string;
  s3: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
  };
  ingestToken: string;
  controlPlaneToken: string;
  corsAllowedOrigins: ReadonlySet<string>;
  uploadUrlTtlSeconds: number;
  downloadUrlTtlSeconds: number;
  port: number;
  host: string;
  logLevel: string;
};

function resolveAliases(environment: NodeJS.ProcessEnv): Record<string, string | undefined> {
  return {
    ...environment,
    S3_ENDPOINT: environment.S3_ENDPOINT ?? environment.AWS_ENDPOINT_URL,
    S3_REGION:
      environment.S3_REGION ?? environment.AWS_REGION ?? environment.AWS_DEFAULT_REGION,
    S3_BUCKET: environment.S3_BUCKET ?? environment.BUCKET,
    S3_ACCESS_KEY_ID: environment.S3_ACCESS_KEY_ID ?? environment.AWS_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY:
      environment.S3_SECRET_ACCESS_KEY ?? environment.AWS_SECRET_ACCESS_KEY,
  };
}

function parseOrigins(raw: string): ReadonlySet<string> {
  const configured = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured.includes("*")) {
    throw new Error("CORS_ALLOWED_ORIGINS cannot contain a wildcard");
  }

  return new Set(
    configured.map((origin) => {
      const parsed = new URL(origin);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("CORS_ALLOWED_ORIGINS entries must use http or https");
      }
      return parsed.origin;
    }),
  );
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvironmentSchema.parse(resolveAliases(environment));

  return {
    nodeEnv: parsed.NODE_ENV,
    databaseUrl: parsed.DATABASE_URL,
    s3: {
      endpoint: parsed.S3_ENDPOINT,
      region: parsed.S3_REGION,
      bucket: parsed.S3_BUCKET,
      accessKeyId: parsed.S3_ACCESS_KEY_ID,
      secretAccessKey: parsed.S3_SECRET_ACCESS_KEY,
      forcePathStyle: parsed.S3_FORCE_PATH_STYLE,
    },
    ingestToken: parsed.INGEST_TOKEN,
    controlPlaneToken: parsed.CONTROL_PLANE_TOKEN,
    corsAllowedOrigins: parseOrigins(parsed.CORS_ALLOWED_ORIGINS),
    uploadUrlTtlSeconds: parsed.UPLOAD_URL_TTL_SECONDS,
    downloadUrlTtlSeconds: parsed.DOWNLOAD_URL_TTL_SECONDS,
    port: parsed.PORT,
    host: parsed.HOST,
    logLevel: parsed.LOG_LEVEL,
  };
}
