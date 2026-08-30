import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

function tokenDigest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function constantTimeTokenEqual(candidate: string, expected: string): boolean {
  return timingSafeEqual(tokenDigest(candidate), tokenDigest(expected));
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const match = /^Bearer ([^\s]+)$/i.exec(header);
  return match?.[1] ?? null;
}

export function requireBearer(expectedToken: string) {
  return async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    const candidate = bearerToken(request);
    if (!candidate || !constantTimeTokenEqual(candidate, expectedToken)) {
      reply.header("www-authenticate", "Bearer");
      return reply.code(401).send({
        error: {
          code: "unauthorized",
          message: "a valid bearer token is required",
        },
      });
    }
  };
}
