/**
 * Diagnose order counts by day to verify why "yesterday" or comparison values look off.
 *
 * Run from repo root: npx tsx scripts/diagnose-order-counts.ts
 * Optional: npx tsx scripts/diagnose-order-counts.ts --days 5
 *
 * Prints for each day (in shop timezone):
 *   - ordersIncluded (excluded = false) — this is what the dashboard shows for "Orders"
 *   - ordersTotal (all orders in range, includeExcluded=true)
 *   - ordersExcluded
 *
 * Also shows how the "previous period" is computed when compare=1, so you can see
 * which range is used as "yesterday" in the delta.
 *
 * Requires: .env with DATABASE_URL. Uses shop_config timezone.
 */
import "dotenv/config";
import { DateTime } from "luxon";
import { and, between, desc, eq, sql } from "drizzle-orm";
import { db, pool, shopConfig, orderIncomeV1, syncState, syncRunLog } from "../src/db/index.js";
import { getPreviousPeriodLocalRange } from "../src/services/comparison.js";
import { parseLocalDateRangeToUtc } from "../src/services/dateRange.js";

async function main() {
  const daysArg = process.argv.includes("--days")
    ? parseInt(process.argv[process.argv.indexOf("--days") + 1], 10)
    : 5;
  const days = Math.min(Math.max(1, daysArg), 31);

  console.log("=== Order count diagnosis (dashboard uses ordersIncluded) ===\n");

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
  console.log("Shop timezone:", tz);
  console.log("");

  const todayLocal = DateTime.now().setZone(tz).startOf("day");
  const table: Array<{ date: string; included: number; total: number; excluded: number }> = [];

  for (let i = 0; i < days; i++) {
    const dayStart = todayLocal.minus({ days: i });
    const dayEnd = dayStart.endOf("day");
    const dateStr = dayStart.toISODate() ?? "";
    const startUtc = dayStart.toUTC().toJSDate();
    const endUtc = dayEnd.toUTC().toJSDate();

    const rangeCondition = between(orderIncomeV1.processedAt, startUtc, endUtc);

    const [includedRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orderIncomeV1)
      .where(and(rangeCondition, eq(orderIncomeV1.excluded, false)));
    const [totalRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orderIncomeV1)
      .where(rangeCondition);
    const [excludedRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orderIncomeV1)
      .where(and(rangeCondition, eq(orderIncomeV1.excluded, true)));

    const included = includedRow?.count ?? 0;
    const total = totalRow?.count ?? 0;
    const excluded = excludedRow?.count ?? 0;

    table.push({ date: dateStr, included, total, excluded });
  }

  console.log("Date       | ordersIncluded (excluded=false) | ordersTotal | excluded");
  console.log("-----------|----------------------------------|-------------|--------");
  for (const row of table) {
    const suffix = row.date === todayLocal.toISODate() ? " (today)" : "";
    console.log(
      `${row.date}${suffix.padEnd(8)} | ${String(row.included).padStart(30)} | ${String(row.total).padStart(11)} | ${row.excluded}`
    );
  }

  console.log("\n  → The dashboard 'Orders' tile shows ordersIncluded. Delta % is current vs previous period.\n");

  // Show how "previous period" is computed for today and yesterday
  const todayStr = todayLocal.toISODate() ?? "";
  const yesterdayStr = todayLocal.minus({ days: 1 }).toISODate() ?? "";

  console.log("=== Comparison period (when compare=1) ===\n");
  for (const [label, from, to] of [
    ["If range is Today (from=to=same day):", todayStr, todayStr],
    ["If range is Yesterday:", yesterdayStr, yesterdayStr],
    ["If range is Last 7 days: previous = 7 days before that.", "-", "-"],
  ] as const) {
    console.log(label);
    if (from !== "-") {
      try {
        const prev = getPreviousPeriodLocalRange(from, to, tz);
        const range = parseLocalDateRangeToUtc(prev.from, prev.to, tz);
        console.log(`  Current: ${from} → ${to}`);
        console.log(`  Previous period: ${prev.from} → ${prev.to}`);
        console.log(`  (UTC: ${range.startUtc.toISOString()} → ${range.endUtc.toISOString()})\n`);
      } catch (e) {
        console.log("  Error:", e instanceof Error ? e.message : e, "\n");
      }
    } else {
      console.log("  (previous = same length, immediately before the range)\n");
    }
  }

  console.log("=== Tips ===\n");
  console.log("• If you selected 'Today', current = today so far, previous = full yesterday.");
  console.log("• If ordersIncluded for yesterday looks wrong, run sync: POST /internal/sync/run");
  console.log("• Check sync_state.watermark_processed_at to see how far the sync has run.\n");

  // --- Sync status: are we missing synchronization? ---
  console.log("=== Sync status (are we missing synchronization?) ===\n");
  const [state] = await db.select().from(syncState).where(eq(syncState.id, "singleton")).limit(1);
  const [latestOrder] = await db
    .select({ processedAt: orderIncomeV1.processedAt })
    .from(orderIncomeV1)
    .orderBy(desc(orderIncomeV1.processedAt))
    .limit(1);
  const runLogs = await db
    .select({
      startedAt: syncRunLog.startedAt,
      finishedAt: syncRunLog.finishedAt,
      status: syncRunLog.status,
      ordersFetched: syncRunLog.ordersFetched,
      ordersUpserted: syncRunLog.ordersUpserted,
      error: syncRunLog.error,
    })
    .from(syncRunLog)
    .orderBy(desc(syncRunLog.startedAt))
    .limit(5);

  const watermark = state?.watermarkProcessedAt ?? null;
  const lastFinished = state?.lastSyncFinishedAt ?? null;
  const lastError = state?.lastSyncError ?? null;
  const latestProcessedAt = latestOrder?.processedAt ?? null;

  console.log("  watermark_processed_at:  ", watermark?.toISOString() ?? "null (no sync yet)");
  console.log("  last_sync_finished_at:  ", lastFinished?.toISOString() ?? "null");
  console.log("  last_sync_status:       ", state?.lastSyncStatus ?? "null");
  if (lastError) console.log("  last_sync_error:        ", lastError);
  console.log("  latest order in DB:      ", latestProcessedAt?.toISOString() ?? "none");

  const now = new Date();
  const watermarkAgeHours = watermark ? (now.getTime() - watermark.getTime()) / (60 * 60 * 1000) : null;
  if (watermarkAgeHours != null) {
    if (watermarkAgeHours > 48) {
      console.log("\n  ⚠ Sync is likely behind: watermark is " + Math.round(watermarkAgeHours) + " hours ago.");
      console.log("    Run POST /internal/sync/run to catch up.");
    } else if (watermarkAgeHours > 24) {
      console.log("\n  ⚠ Sync may be behind: watermark is " + Math.round(watermarkAgeHours) + " hours ago.");
    } else {
      console.log("\n  ✓ Watermark is within the last " + Math.round(watermarkAgeHours) + " hours.");
    }
  } else {
    console.log("\n  ⚠ No watermark yet. Run sync at least once: POST /internal/sync/run");
  }

  console.log("\n  Last 5 sync runs:");
  for (const log of runLogs) {
    const dur = log.finishedAt && log.startedAt
      ? ((new Date(log.finishedAt).getTime() - new Date(log.startedAt).getTime()) / 1000).toFixed(1) + "s"
      : "—";
    const err = log.error ? `  error: ${log.error.slice(0, 60)}...` : "";
    console.log(
      "    " + log.startedAt.toISOString() + "  " + log.status + "  fetched=" + (log.ordersFetched ?? 0) + " upserted=" + (log.ordersUpserted ?? 0) + "  " + dur + err
    );
  }
  console.log("");

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
