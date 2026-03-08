/**
 * Run the orders/income sync once (same as the worker job).
 * Use when you don't have the API/worker running: npx tsx scripts/run-sync-once.ts
 *
 * Requires: .env with DATABASE_URL, SHOPIFY_ADMIN_ACCESS_TOKEN, shop env vars.
 */
import "dotenv/config";
import { syncOrdersIncomeV1 } from "../src/jobs/processors/syncOrdersIncomeV1.js";
import { pool } from "../src/db/index.js";

async function main() {
  console.log("Starting sync...\n");
  const result = await syncOrdersIncomeV1();
  console.log("Sync finished:", result);
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
