import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { PostgresSessionRepository } from "./repository.js";
import { S3ObjectStorage } from "./storage.js";

const config = loadConfig();
const repository = new PostgresSessionRepository(config.databaseUrl);
await repository.initialize();
const storage = new S3ObjectStorage(config.s3);
const app = await buildApp({ config, repository, storage });

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, "shutting down");
  await app.close();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.fatal({ err: error }, "service startup failed");
  await app.close();
  process.exitCode = 1;
}
