/**
 * BullMQ worker entrypoint. Processes shopify-sync queue (syncOrdersIncomeV1 jobs).
 * Single-store: job has no shopId; processor reads shop_config.
 * Loads env from .env; see src/env.ts for required keys.
 */
import "dotenv/config";
import { ensureRequiredEnv } from "../env.js";
import { Worker } from "bullmq";
import { getRedisConnectionOptions } from "./redis.js";
import { syncOrdersIncomeV1 } from "./processors/syncOrdersIncomeV1.js";
import { logger } from "../logger.js";

ensureRequiredEnv();
const QUEUE_NAME = "shopify-sync";
const concurrency = parseInt(process.env.SHOPIFY_SYNC_CONCURRENCY ?? "1", 10);

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    if (job.name === "syncOrdersIncomeV1") {
      logger.info({ jobId: job.id }, "Starting syncOrdersIncomeV1");
      const result = await syncOrdersIncomeV1();
      logger.info({ jobId: job.id, ...result }, "Finished syncOrdersIncomeV1");
      return result;
    }
    throw new Error(`Unknown job name: ${job.name}`);
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency,
  }
);

worker.on("ready", () => {
  logger.info({ concurrency }, "Shopify sync worker ready");
});

worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, error: err?.message }, "Job failed");
});

worker.on("error", (err) => {
  logger.error({ err: err?.message }, "Worker error");
});

async function main() {
  logger.info("Worker process started");
}

main().catch((err) => {
  logger.error(err, "Worker startup failed");
  process.exit(1);
});
