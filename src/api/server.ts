/**
 * Fastify server: auth callback (OAuth), health + internal routes.
 */

import Fastify from "fastify";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerInternalRoutes } from "./routes/internal.js";
import { registerInternalIncomeRoutes } from "./routes/internalIncome.js";

const isDev = process.env.NODE_ENV !== "production";

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
      ...(isDev
        ? { transport: { target: "pino-pretty", options: { colorize: true } } }
        : {}),
    },
  });
  await registerAuthRoutes(fastify);
  await registerInternalRoutes(fastify);
  await registerInternalIncomeRoutes(fastify);
  return fastify;
}
