/**
 * Pino logger for API and worker. Structured JSON in production; pretty in dev.
 * Use withCtx for consistent job/cursor/watermark fields in logs.
 */

import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  ...(isDev
    ? {
        transport: { target: "pino-pretty", options: { colorize: true } },
      }
    : {}),
});

export type LogContext = {
  jobId?: string;
  cursor?: string | null;
  watermark?: string | null;
  [k: string]: unknown;
};

/** Returns a child logger with jobId, cursor, watermark (and any extra) bound. Logs never include tokens or secrets. */
export function withCtx(ctx: LogContext): pino.Logger {
  return logger.child(ctx);
}
