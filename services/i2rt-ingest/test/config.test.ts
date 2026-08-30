import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

function environment(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/capy",
    AWS_ENDPOINT_URL: "https://bucket.example.com",
    AWS_DEFAULT_REGION: "auto",
    BUCKET: "capy-i2rt",
    AWS_ACCESS_KEY_ID: "access",
    AWS_SECRET_ACCESS_KEY: "secret",
    INGEST_TOKEN: "ingest-token-that-is-at-least-32-chars",
    CONTROL_PLANE_TOKEN: "control-token-that-is-at-least-32-chars",
    ...overrides,
  };
}

describe("environment configuration", () => {
  it("accepts railway-style s3 aliases and normalizes exact cors origins", () => {
    const config = loadConfig(
      environment({ CORS_ALLOWED_ORIGINS: "https://app.example.com/path, http://localhost:3000" }),
    );
    expect(config.s3).toMatchObject({
      endpoint: "https://bucket.example.com",
      bucket: "capy-i2rt",
      accessKeyId: "access",
    });
    expect([...config.corsAllowedOrigins]).toEqual([
      "https://app.example.com",
      "http://localhost:3000",
    ]);
  });

  it("rejects wildcard cors, shared tokens, and non-postgres database urls", () => {
    expect(() => loadConfig(environment({ CORS_ALLOWED_ORIGINS: "*" }))).toThrow(
      "CORS_ALLOWED_ORIGINS cannot contain a wildcard",
    );
    expect(() =>
      loadConfig(
        environment({ CONTROL_PLANE_TOKEN: "ingest-token-that-is-at-least-32-chars" }),
      ),
    ).toThrow();
    expect(() => loadConfig(environment({ DATABASE_URL: "https://database.example.com" }))).toThrow();
  });
});
