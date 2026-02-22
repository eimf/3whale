/**
 * Internal income endpoints: orders list, order detail, reconcile.
 * Auth: x-internal-api-key (handled by internal routes preHandler).
 * Single source of truth: docs/metrics/income_v1_contract.md
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "../../db/index.js";
import { shopConfig, shopifyOrderRaw } from "../../db/schema.js";
import { parseLocalDateRangeToUtc } from "../../services/dateRange.js";
import {
  listOrders,
  getOrderByShopifyOrderId,
  getReconcile,
  type OrderIncomeRow,
} from "../../services/incomeQueries.js";
import { summarizeOrderPayload } from "../../services/orderPayloadSummary.js";
import {
  ordersListQuerySchema,
  orderDetailQuerySchema,
  reconcileQuerySchema,
} from "../schemas/internalIncomeSchemas.js";
import { logger } from "../../logger.js";

const TIMEZONE = "America/Mexico_City";

async function getTimezone(): Promise<string> {
  const [config] = await db
    .select({ timezoneIana: shopConfig.timezoneIana })
    .from(shopConfig)
    .where(eq(shopConfig.id, "singleton"))
    .limit(1);
  return config?.timezoneIana ?? TIMEZONE;
}

function toIsoDate(d: Date, tz: string): string {
  return DateTime.fromJSDate(d).setZone(tz).toISODate() ?? "";
}

function orderToJson(o: OrderIncomeRow) {
  return {
    shopifyOrderId: o.shopifyOrderId,
    processedAt: o.processedAt.toISOString(),
    currencyCode: o.currencyCode,
    excluded: o.excluded,
    excludedReason: o.excludedReason,
    lineItemsSubtotal: o.lineItemsSubtotal,
    shippingAmount: o.shippingAmount,
    taxAmount: o.taxAmount,
    discountAmount: o.discountAmount,
    incomeBruto: o.incomeBruto,
    refunds: o.refunds,
    incomeNeto: o.incomeNeto,
  };
}

export async function registerInternalIncomeRoutes(fastify: FastifyInstance) {
  /** GET /internal/income/orders */
  fastify.get<{
    Querystring: Record<string, string | undefined>;
  }>("/internal/income/orders", async (req, reply) => {
    const parsed = ordersListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid query",
        details: parsed.error.flatten(),
      });
    }
    const q = parsed.data;
    const tz = await getTimezone();
    let range: { startUtc: Date; endUtc: Date };
    try {
      range = parseLocalDateRangeToUtc(q.from, q.to, tz);
    } catch (e) {
      return reply.code(400).send({
        error: e instanceof Error ? e.message : "Invalid date range",
      });
    }
    const result = await listOrders({
      startUtc: range.startUtc,
      endUtc: range.endUtc,
      includeExcluded: q.includeExcluded,
      sort: q.sort,
      page: q.page,
      pageSize: q.pageSize,
    });
    return reply.send({
      range: {
        from: q.from,
        to: q.to,
        timezone: tz,
      },
      pagination: {
        page: q.page,
        pageSize: q.pageSize,
        total: result.total,
      },
      summary: {
        currencyCode: result.summary.currencyCode,
        incomeBruto: result.summary.incomeBruto,
        refunds: result.summary.refunds,
        incomeNeto: result.summary.incomeNeto,
        shippingAmount: result.summary.shippingAmount,
        taxAmount: result.summary.taxAmount,
        discountAmount: result.summary.discountAmount,
        ordersIncluded: result.summary.ordersIncluded,
        ordersExcludedInRange: result.summary.ordersExcludedInRange,
      },
      orders: result.orders.map(orderToJson),
    });
  });

  /** GET /internal/income/orders/:shopifyOrderId */
  fastify.get<{
    Params: { shopifyOrderId: string };
    Querystring: { raw?: string };
  }>("/internal/income/orders/:shopifyOrderId", async (req, reply) => {
    const { shopifyOrderId } = req.params;
    const parsed = orderDetailQuerySchema.safeParse(req.query);
    const rawMode = parsed.success ? parsed.data.raw : "summary";

    const income = await getOrderByShopifyOrderId(shopifyOrderId);
    if (!income) {
      return reply.code(404).send({ error: "Order not found" });
    }

    const tz = await getTimezone();
    const processedAtLocalDate = toIsoDate(income.processedAt, tz);

    const [rawRow] = await db
      .select({ payload: shopifyOrderRaw.payload })
      .from(shopifyOrderRaw)
      .where(eq(shopifyOrderRaw.shopifyOrderId, shopifyOrderId))
      .limit(1);

    let raw: unknown = null;
    if (rawRow?.payload) {
      if (rawMode === "full") {
        raw = rawRow.payload;
      } else {
        raw = summarizeOrderPayload(rawRow.payload);
      }
    } else {
      logger.warn({ shopifyOrderId }, "shopify_order_raw missing for order");
    }

    return reply.send({
      income: orderToJson(income),
      meta: {
        processedAtLocalDate,
        timezone: tz,
      },
      raw,
    });
  });

  /** GET /internal/income/reconcile */
  fastify.get<{
    Querystring: Record<string, string | undefined>;
  }>("/internal/income/reconcile", async (req, reply) => {
    const parsed = reconcileQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid query",
        details: parsed.error.flatten(),
      });
    }
    const q = parsed.data;
    const tz = await getTimezone();
    let range: { startUtc: Date; endUtc: Date };
    try {
      range = parseLocalDateRangeToUtc(q.from, q.to, tz);
    } catch (e) {
      return reply.code(400).send({
        error: e instanceof Error ? e.message : "Invalid date range",
      });
    }
    const result = await getReconcile({
      startUtc: range.startUtc,
      endUtc: range.endUtc,
      includeExcluded: q.includeExcluded,
    });
    return reply.send({
      range: { from: q.from, to: q.to, timezone: tz },
      totals: result.totals,
      counts: result.counts,
      qualitySignals: result.qualitySignals,
    });
  });
}
