import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { requireBearer } from "./auth.js";
import type { AppConfig } from "./config.js";
import { parseManifest } from "./domain.js";
import { AppError, InputError } from "./errors.js";
import type { SessionRepository } from "./repository.js";
import { IngestionService } from "./service.js";
import type { ObjectStorage } from "./storage.js";

const sessionIdSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).max(1_024).optional(),
});

export type BuildAppOptions = {
  config: AppConfig;
  repository: SessionRepository;
  storage: ObjectStorage;
  logger?: boolean;
};

function parseSessionId(value: unknown): string {
  const result = sessionIdSchema.safeParse(value);
  if (!result.success) throw new InputError("session id is invalid");
  return result.data;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    trustProxy: true,
    bodyLimit: 1024 * 1024,
    requestTimeout: 60_000,
    logger:
      options.logger === false
        ? false
        : {
            level: options.config.logLevel,
            redact: {
              paths: ["req.headers.authorization", "request.headers.authorization"],
              censor: "[redacted]",
            },
          },
  });
  const service = new IngestionService(options.repository, options.storage, {
    uploadUrlTtlSeconds: options.config.uploadUrlTtlSeconds,
    downloadUrlTtlSeconds: options.config.downloadUrlTtlSeconds,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    credentials: false,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["authorization", "content-type"],
    maxAge: 600,
    origin(origin, callback) {
      callback(null, !origin || options.config.corsAllowedOrigins.has(origin));
    },
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.ip,
  });

  const ingestAuth = requireBearer(options.config.ingestToken);
  const controlAuth = requireBearer(options.config.controlPlaneToken);

  app.get("/health", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (_request, reply) => {
    try {
      await Promise.all([options.repository.ping(), options.storage.ping()]);
      return { ok: true, service: "capy-i2rt-ingest" };
    } catch (error) {
      app.log.error({ err: error }, "health check failed");
      return reply.code(503).send({ ok: false, service: "capy-i2rt-ingest" });
    }
  });

  const publicStatusHandler = async (_request: unknown, reply: { code: (statusCode: number) => { send: (body: unknown) => unknown } }) => {
    try {
      return await service.publicStatus();
    } catch (error) {
      app.log.error({ err: error }, "public status failed");
      return reply.code(503).send({ state: "unavailable" });
    }
  };
  app.get("/v1/public/status", publicStatusHandler);
  app.get("/v1/status", publicStatusHandler);

  app.post(
    "/v1/sessions",
    {
      preHandler: ingestAuth,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const manifest = parseManifest(request.body);
      const registration = await service.register(manifest);
      return reply.code(registration.created ? 201 : 200).send(registration);
    },
  );

  app.post(
    "/v1/sessions/:sessionId/finalize",
    {
      preHandler: ingestAuth,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (request) => {
      const parameters = request.params as { sessionId?: unknown };
      return service.finalize(parseSessionId(parameters.sessionId));
    },
  );

  app.get(
    "/v1/sessions",
    { preHandler: controlAuth },
    async (request) => {
      const result = listQuerySchema.safeParse(request.query);
      if (!result.success) throw new InputError("session list query is invalid");
      return service.list(result.data.limit, result.data.cursor);
    },
  );

  app.get(
    "/v1/sessions/:sessionId",
    { preHandler: controlAuth },
    async (request) => {
      const parameters = request.params as { sessionId?: unknown };
      return service.detail(parseSessionId(parameters.sessionId));
    },
  );

  app.setNotFoundHandler(async (_request, reply) =>
    reply.code(404).send({ error: { code: "not_found", message: "route not found" } }),
  );

  app.setErrorHandler(async (error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
          requestId: request.id,
        },
      });
    }
    request.log.error({ err: error }, "unhandled request error");
    return reply.code(500).send({
      error: {
        code: "internal_error",
        message: "the request could not be completed",
        requestId: request.id,
      },
    });
  });

  app.addHook("onClose", async () => {
    options.storage.close();
    await options.repository.close();
  });

  return app;
}
