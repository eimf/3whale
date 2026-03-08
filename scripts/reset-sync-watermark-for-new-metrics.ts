/**
 * One-time: reset sync watermark so the next sync re-fetches orders with the new
 * GraphQL fields (customer, lineItems, totalShippingPriceSet, totalTaxSet) and
 * populates units_sold, customer_id, is_new_customer, shipping_total, tax_total.
 *
 * Run once, then trigger sync (dashboard "Sync now" or POST /internal/sync/run).
 * Usage: npx tsx scripts/reset-sync-watermark-for-new-metrics.ts
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, syncState } from "../src/db/index.js";

async function main() {
    const result = await db
        .update(syncState)
        .set({ watermarkProcessedAt: null })
        .where(eq(syncState.id, "singleton"))
        .returning({ watermarkProcessedAt: syncState.watermarkProcessedAt });

    console.log("Sync watermark reset to null.");
    console.log(
        "Next sync will re-fetch the last",
        process.env.SHOPIFY_INITIAL_BACKFILL_DAYS ?? "30",
        "days of orders with the new fields."
    );
    console.log(
        "Then run Sync now in the dashboard (or POST /internal/sync/run) to populate units sold, new customers, etc."
    );
    if (result.length > 0) {
        console.log(
            "Previous watermark was:",
            result[0]?.watermarkProcessedAt ?? "null"
        );
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
