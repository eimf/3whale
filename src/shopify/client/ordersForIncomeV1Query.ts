/**
 * Load OrdersForIncomeV1 GraphQL query text from the .graphql file.
 * Strategy: read from fs at runtime (works with tsx/Node without bundler; for bundlers
 * use import raw or inject at build time). Cached after first load.
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let cached: string | null = null;

export function getOrdersForIncomeV1Query(): string {
  if (cached) return cached;
  const filePath = path.join(__dirname, "../graphql/ordersForIncomeV1.graphql");
  cached = readFileSync(filePath, "utf-8");
  return cached;
}

/** Query string for OrdersForIncomeV1 (same as getOrdersForIncomeV1Query(); use when you need a string export). */
export const ordersForIncomeV1QueryText = getOrdersForIncomeV1Query();
