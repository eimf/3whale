/**
 * Sync processor: fetch Shopify orders for income v1, persist raw + computed.
 * Single-store: reads shop_config (bootstrap first); no shopId.
 * Finance-safe: no floats; money as decimal strings → NUMERIC(20,6).
 * Single source of truth: docs/metrics/income_v1_contract.md
 */

import { eq } from "drizzle-orm";
import {
  db,
  shopConfig,
  syncState,
  shopifyOrderRaw,
  orderIncomeV1,
  syncRunLog,
} from "../../db/index.js";
import { shopifyGraphqlRequest } from "../../shopify/client/shopifyGraphqlClient.js";
import { getOrdersForIncomeV1Query } from "../../shopify/client/ordersForIncomeV1Query.js";
import { mapOrderToNormalized } from "../../shopify/mappers/mapOrderToNormalized.js";
import {
  computeIncomeComponents,
  shouldExcludeOrderV1,
} from "../../metrics/computeIncomeComponents.js";
import { withCtx } from "../../logger.js";

const PAGE_SIZE = parseInt(process.env.SHOPIFY_SYNC_PAGE_SIZE ?? "100", 10);
const OVERLAP_DAYS = parseInt(process.env.SHOPIFY_SYNC_OVERLAP_DAYS ?? "2", 10);
const INITIAL_BACKFILL_DAYS = parseInt(
  process.env.SHOPIFY_INITIAL_BACKFILL_DAYS ?? "30",
  10
);

function getAccessToken(): string {
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!token) throw new Error("SHOPIFY_ADMIN_ACCESS_TOKEN is required");
  return token;
}

interface OrdersForIncomeV1Response {
  orders: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: unknown[];
  };
}

export interface SyncOrdersIncomeV1Result {
  ordersFetched: number;
  ordersUpserted: number;
  ordersExcluded: number;
}

/**
 * Run sync for single store: watermark-based pagination, raw JSONB + normalized NUMERIC rows.
 * Idempotent: overlap days avoid duplicates (upsert by shopifyOrderId).
 */
export async function syncOrdersIncomeV1(): Promise<SyncOrdersIncomeV1Result> {
  const [config] = await db
    .select()
    .from(shopConfig)
    .where(eq(shopConfig.id, "singleton"))
    .limit(1);
  if (!config) {
    throw new Error(
      "shop_config not found. Call POST /internal/bootstrap first."
    );
  }

  const [state] = await db
    .select()
    .from(syncState)
    .where(eq(syncState.id, "singleton"))
    .limit(1);
  if (!state) {
    await db.insert(syncState).values({ id: "singleton" });
  }

  const now = new Date();
  const watermark =
    state?.watermarkProcessedAt ?? null;
  const effectiveWatermark = watermark
    ? new Date(
        watermark.getTime() - OVERLAP_DAYS * 24 * 60 * 60 * 1000
      )
    : new Date(
        now.getTime() - INITIAL_BACKFILL_DAYS * 24 * 60 * 60 * 1000
      );
  const searchQuery = `processed_at:>=${effectiveWatermark.toISOString()}`;
  const accessToken = getAccessToken();

  await db
    .update(syncState)
    .set({
      lastSyncStartedAt: now,
      lastSyncStatus: null,
      lastSyncError: null,
    })
    .where(eq(syncState.id, "singleton"));

  const [runLog] = await db
    .insert(syncRunLog)
    .values({
      startedAt: now,
      status: "running",
    })
    .returning({ id: syncRunLog.id });
  const runLogId = runLog!.id;

  let ordersFetched = 0;
  let ordersUpserted = 0;
  let ordersExcluded = 0;
  let lastCursor: string | null = null;
  let maxProcessedAtSeen: Date | null = null;
  const queryText = getOrdersForIncomeV1Query();
  const log = withCtx({ watermark: effectiveWatermark.toISOString() });

  try {
    let after: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const variables: { first: number; after: string | null; query: string } =
        {
          first: PAGE_SIZE,
          after,
          query: searchQuery,
        };
      const data = await shopifyGraphqlRequest<OrdersForIncomeV1Response>({
        shopDomain: config.shopDomain,
        accessToken,
        query: queryText,
        variables,
      });

      const { pageInfo, nodes } = data.orders;
      ordersFetched += nodes.length;
      lastCursor = pageInfo.endCursor ?? null;
      hasNextPage = pageInfo.hasNextPage;
      log.debug({ cursor: lastCursor, pageSize: nodes.length }, "Fetched page");

      for (const node of nodes) {
        const orderNode = node as {
          id: string;
          processedAt: string | null;
          [k: string]: unknown;
        };
        const processedAtStr = orderNode.processedAt;
        if (!processedAtStr) continue;
        const processedAt = new Date(processedAtStr);
        if (
          maxProcessedAtSeen === null ||
          processedAt > maxProcessedAtSeen
        ) {
          maxProcessedAtSeen = processedAt;
        }

        // 1) Raw first (audit order)
        await db
          .insert(shopifyOrderRaw)
          .values({
            shopifyOrderId: orderNode.id,
            processedAt,
            payload: orderNode as object,
          })
          .onConflictDoUpdate({
            target: shopifyOrderRaw.shopifyOrderId,
            set: {
              processedAt,
              payload: orderNode as object,
            },
          });

        let normalized;
        try {
          normalized = mapOrderToNormalized(orderNode);
        } catch (err) {
          log.warn(
            { err, shopifyOrderId: orderNode.id },
            "mapOrderToNormalized failed; failing job to avoid corrupt data"
          );
          throw err;
        }

        const components = computeIncomeComponents(
          normalized.order,
          normalized.refunds
        );
        const exclusion = shouldExcludeOrderV1(
          normalized.order,
          normalized.refunds
        );

        if (components.currencyCode !== config.currencyCode) {
          throw new Error(
            `Currency mismatch: order ${components.currencyCode} vs shop ${config.currencyCode}. Failing job to avoid partial incorrect data.`
          );
        }

        const excluded = exclusion.exclude;
        if (excluded) ordersExcluded += 1;
        else ordersUpserted += 1;

        await db
          .insert(orderIncomeV1)
          .values({
            shopifyOrderId: normalized.order.id,
            currencyCode: config.currencyCode,
            processedAt,
            lineItemsSubtotal: components.line_items_subtotal.amount,
            shippingAmount: components.shipping_amount.amount,
            taxAmount: components.tax_amount.amount,
            discountAmount: components.discount_amount.amount,
            incomeBruto: components.income_bruto.amount,
            refunds: components.refunds.amount,
            incomeNeto: components.income_neto.amount,
            excluded,
            excludedReason: exclusion.reason ?? null,
          })
          .onConflictDoUpdate({
            target: orderIncomeV1.shopifyOrderId,
            set: {
              currencyCode: config.currencyCode,
              processedAt,
              lineItemsSubtotal: components.line_items_subtotal.amount,
              shippingAmount: components.shipping_amount.amount,
              taxAmount: components.tax_amount.amount,
              discountAmount: components.discount_amount.amount,
              incomeBruto: components.income_bruto.amount,
              refunds: components.refunds.amount,
              incomeNeto: components.income_neto.amount,
              excluded,
              excludedReason: exclusion.reason ?? null,
              computedAt: new Date(),
            },
          });
      }

      after = lastCursor;
    }

    const finishedAt = new Date();
    await db
      .update(syncState)
      .set({
        watermarkProcessedAt: maxProcessedAtSeen,
        lastSyncFinishedAt: finishedAt,
        lastSyncStatus: "success",
        lastSyncError: null,
      })
      .where(eq(syncState.id, "singleton"));

    await db
      .update(syncRunLog)
      .set({
        finishedAt,
        status: "success",
        ordersFetched,
        ordersUpserted,
        ordersExcluded,
        lastCursor,
        error: null,
      })
      .where(eq(syncRunLog.id, runLogId));

    return { ordersFetched, ordersUpserted, ordersExcluded };
  } catch (err) {
    const finishedAt = new Date();
    const errorMessage = err instanceof Error ? err.message : String(err);
    await db
      .update(syncState)
      .set({
        lastSyncFinishedAt: finishedAt,
        lastSyncStatus: "failure",
        lastSyncError: errorMessage,
      })
      .where(eq(syncState.id, "singleton"));

    await db
      .update(syncRunLog)
      .set({
        finishedAt,
        status: "failure",
        ordersFetched,
        ordersUpserted,
        ordersExcluded,
        lastCursor,
        error: errorMessage,
      })
      .where(eq(syncRunLog.id, runLogId));

    throw err;
  }
}
