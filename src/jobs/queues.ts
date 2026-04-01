/**
 * BullMQ queue for Shopify sync jobs. Queue name: shopify-sync.
 * Single-store: no shopId in job data.
 */

import { Queue } from "bullmq";
import { getRedisConnectionOptions } from "./redis.js";

const QUEUE_NAME = "shopify-sync";

/** Single-store: job carries no payload; processor reads shop_config. */
export type SyncOrdersIncomeV1JobData = Record<string, never>;

let queue: Queue<SyncOrdersIncomeV1JobData> | null = null;

export function getSyncQueue(): Queue<SyncOrdersIncomeV1JobData> {
  if (!queue) {
    queue = new Queue<SyncOrdersIncomeV1JobData>(QUEUE_NAME, {
      connection: getRedisConnectionOptions(),
    });
  }
  return queue;
}

export const JOB_NAME_SYNC_ORDERS_INCOME_V1 = "syncOrdersIncomeV1";
