/**
 * API entrypoint: start Fastify on PORT (default 3000).
 * Loads env from .env; see src/env.ts for required keys.
 */
import "dotenv/config";
import { ensureRequiredEnv } from "../env.js";
import { buildServer } from "./server.js";
import { logger } from "../logger.js";

ensureRequiredEnv();
const PORT = parseInt(process.env.PORT ?? "3000", 10);

async function main() {
  const server = await buildServer();
  await server.listen({ port: PORT, host: "0.0.0.0" });
  logger.info({ port: PORT }, "API listening");
}

main().catch((err) => {
  logger.error(err, "API startup failed");
  process.exit(1);
});
