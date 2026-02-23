/**
 * Step-by-step debug: "Today" income pipeline.
 * Run from repo root: npx tsx scripts/debug-today-income.ts
 * Requires: .env with DATABASE_URL (and optional SHOP_TIMEZONE_IANA for Step 0).
 *
 * Compares: shop config → date window → DB counts/sums → sync state.
 * Use output to find where the number diverges from Shopify.
 */
import "dotenv/config";
import { DateTime } from "luxon";
import { and, between, eq, desc, sql } from "drizzle-orm";
import { db, pool, shopConfig, orderIncomeV1, syncState } from "../src/db/index.js";

async function main() {
  console.log("=== Step 1: Shop config (timezone for 'today') ===\n");
  const [config] = await db
    .select()
    .from(shopConfig)
    .where(eq(shopConfig.id, "singleton"))
    .limit(1);
  if (!config) {
    console.log("FAIL: No shop_config. Run POST /internal/bootstrap first.\n");
    process.exit(1);
  }
  const tz = config.timezoneIana;
  console.log("  timezone_iana:", tz);
  console.log("  currency_code:", config.currencyCode);
  console.log("  shop_domain:", config.shopDomain);

  console.log("\n=== Step 2: Date window for 'today' (days=1, same as API) ===\n");
  const end = DateTime.now().setZone(tz);
  const start = end.startOf("day").minus({ days: 0 });
  const startUtc = start.toUTC().toJSDate();
  const endUtc = end.toUTC().toJSDate();
  console.log("  'Now' in shop TZ:", end.toISO());
  console.log("  Window (shop TZ):", start.toISODate(), "00:00:00 →", end.toFormat("HH:mm:ss"));
  console.log("  window_utc.start:", startUtc.toISOString());
  console.log("  window_utc.end:  ", endUtc.toISOString());

  console.log("\n=== Step 3: DB — orders in window (excluded = false) ===\n");
  const rangeCondition = between(orderIncomeV1.processedAt, startUtc, endUtc);
  const whereIncluded = and(rangeCondition, eq(orderIncomeV1.excluded, false));

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orderIncomeV1)
    .where(whereIncluded);
  const ordersIncluded = countRow?.count ?? 0;

  const [excludedRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orderIncomeV1)
    .where(and(rangeCondition, eq(orderIncomeV1.excluded, true)));
  const ordersExcludedInRange = excludedRow?.count ?? 0;

  const [sumRow] = await db
    .select({
      incomeBruto: sql<string>`COALESCE(SUM(${orderIncomeV1.incomeBruto}), 0)::text`,
      refunds: sql<string>`COALESCE(SUM(${orderIncomeV1.refunds}), 0)::text`,
      incomeNeto: sql<string>`COALESCE(SUM(${orderIncomeV1.incomeNeto}), 0)::text`,
    })
    .from(orderIncomeV1)
    .where(whereIncluded);

  console.log("  ordersIncluded (excluded=false in window):", ordersIncluded);
  console.log("  ordersExcludedInRange (excluded=true in window):", ordersExcludedInRange);
  console.log("  SUM(income_bruto):", sumRow?.incomeBruto ?? "0");
  console.log("  SUM(refunds):     ", sumRow?.refunds ?? "0");
  console.log("  SUM(income_neto):", sumRow?.incomeNeto ?? "0");

  console.log("\n=== Step 4: Sync state ===\n");
  const [state] = await db.select().from(syncState).where(eq(syncState.id, "singleton")).limit(1);
  console.log("  last_sync_finished_at:", state?.lastSyncFinishedAt?.toISOString() ?? "null");
  console.log("  last_sync_status:     ", state?.lastSyncStatus ?? "null");
  console.log("  watermark_processed_at:", state?.watermarkProcessedAt?.toISOString() ?? "null");

  console.log("\n=== Step 5: Sample order IDs in window (first 5) ===\n");
  const sample = await db
    .select({
      shopifyOrderId: orderIncomeV1.shopifyOrderId,
      processedAt: orderIncomeV1.processedAt,
      incomeNeto: orderIncomeV1.incomeNeto,
      excluded: orderIncomeV1.excluded,
    })
    .from(orderIncomeV1)
    .where(rangeCondition)
    .orderBy(desc(orderIncomeV1.processedAt))
    .limit(5);
  sample.forEach((r) => {
    console.log("  ", r.shopifyOrderId, r.processedAt.toISOString(), "income_neto:", r.incomeNeto, "excluded:", r.excluded);
  });

  console.log("\n--- Next: compare SUM(income_neto) above to Shopify Order Revenue for same date/timezone. ---");
  console.log("--- If order count or sum is 0, run sync: POST /internal/sync/run then re-run this script. ---\n");
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
