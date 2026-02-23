/**
 * Internal API: bootstrap, manual sync trigger, sync status, daily income series.
 * Auth: x-internal-api-key header. Single source of truth: docs/metrics/income_v1_contract.md
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, desc, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { z } from "zod";
import Decimal from "decimal.js";
import {
  db,
  shopConfig,
  syncState,
  shopifyOrderRaw,
  orderIncomeV1,
  syncRunLog,
} from "../../db/index.js";
import { getSyncQueue, JOB_NAME_SYNC_ORDERS_INCOME_V1 } from "../../jobs/queues.js";
import { toMoneyValue } from "../../metrics/moneyValue.js";
import { listOrders } from "../../services/incomeQueries.js";
import { parseLocalDateRangeToUtc } from "../../services/dateRange.js";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY?.trim() ?? "";

const allowedDays = [1, 2, 3, 7, 30] as const;
const daysSchema = z
  .number()
  .int()
  .refine((n) => (allowedDays as readonly number[]).includes(n), {
    message: `days must be one of: ${allowedDays.join(", ")}`,
  });

function requireInternalApiKey(
  req: FastifyRequest,
  reply: FastifyReply,
  done: () => void
) {
  const raw = req.headers["x-internal-api-key"];
  const key = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  if (!INTERNAL_API_KEY || key !== INTERNAL_API_KEY) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }
  done();
}

export async function registerInternalRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", (req, reply, done) => {
    const path = req.url?.split("?")[0] ?? "";
    if (path === "/internal/health" || path === "/" || path.startsWith("/auth/"))
      return done();
    requireInternalApiKey(req, reply, done);
  });

  fastify.get("/internal/health", async (_req, reply) => {
    return reply.send({ ok: true });
  });

  /** Insert/update shop_config from env; create sync_state if not exists. */
  fastify.post("/internal/bootstrap", async (_req, reply) => {
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
    const timezoneIana = process.env.SHOP_TIMEZONE_IANA;
    const currencyCode = process.env.SHOP_CURRENCY_CODE;
    if (!shopDomain || !timezoneIana || !currencyCode) {
      return reply.code(400).send({
        error:
          "Missing env: SHOPIFY_SHOP_DOMAIN, SHOP_TIMEZONE_IANA, SHOP_CURRENCY_CODE",
      });
    }
    const now = new Date();
    const [config] = await db
      .insert(shopConfig)
      .values({
        id: "singleton",
        shopDomain,
        timezoneIana,
        currencyCode,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: shopConfig.id,
        set: {
          shopDomain,
          timezoneIana,
          currencyCode,
          updatedAt: now,
        },
      })
      .returning();
    await db
      .insert(syncState)
      .values({ id: "singleton" })
      .onConflictDoNothing();
    return reply.send(config);
  });

  /** Enqueue sync job (single-store). */
  fastify.post("/internal/sync/run", async (_req, reply) => {
    const queue = getSyncQueue();
    const job = await queue.add(JOB_NAME_SYNC_ORDERS_INCOME_V1, {});
    return reply.send({ jobId: job.id });
  });

  /** Sync status: shop_config, sync_state, last 10 run logs, counts. */
  fastify.get("/internal/sync-status", async (_req, reply) => {
    const [config] = await db
      .select()
      .from(shopConfig)
      .where(eq(shopConfig.id, "singleton"))
      .limit(1);
    const [state] = await db
      .select()
      .from(syncState)
      .where(eq(syncState.id, "singleton"))
      .limit(1);
    const runLogs = await db
      .select()
      .from(syncRunLog)
      .orderBy(desc(syncRunLog.startedAt))
      .limit(10);
    const [rawCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(shopifyOrderRaw);
    const [incomeCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orderIncomeV1);
    return reply.send({
      shopConfig: config ?? null,
      syncState: state ?? null,
      lastRunLogs: runLogs,
      counts: {
        shopifyOrderRaw: rawCount?.count ?? 0,
        orderIncomeV1: incomeCount?.count ?? 0,
      },
    });
  });

  /** Daily income series. days ∈ {1,2,3,7,30}. Sums as strings; excluded orders not included. */
  fastify.get<{ Querystring: { days?: string } }>(
    "/internal/income/daily",
    async (req, reply) => {
      const rawDays = req.query.days;
      const parsed = daysSchema.safeParse(
        rawDays === undefined ? 7 : Number(rawDays)
      );
      if (!parsed.success) {
        return reply.code(400).send({
          error: parsed.error.errors[0]?.message ?? `days must be one of: ${allowedDays.join(", ")}`,
        });
      }
      const days = parsed.data;

      const [config] = await db
        .select()
        .from(shopConfig)
        .where(eq(shopConfig.id, "singleton"))
        .limit(1);
      if (!config) {
        return reply.code(503).send({
          error: "shop_config not found. Call POST /internal/bootstrap first.",
        });
      }
      const tz = config.timezoneIana;
      const end = DateTime.now().setZone(tz);
      const start = end.startOf("day").minus({ days: days - 1 });
      const startUtc = start.toUTC().toJSDate();
      const endUtc = end.toUTC().toJSDate();

      // Group by local day (processedAt in shop tz), SUM components + order count, excluded = false only.
      const result = await db.execute(sql`
        SELECT
          day::text AS date,
          COUNT(*)::int AS orders_count,
          SUM(income_bruto)::text AS income_bruto,
          SUM(refunds)::text AS refunds,
          SUM(income_neto)::text AS income_neto,
          SUM(shipping_amount)::text AS shipping_amount,
          SUM(tax_amount)::text AS tax_amount,
          SUM(discount_amount)::text AS discount_amount
        FROM (
          SELECT
            (processed_at AT TIME ZONE ${tz})::date AS day,
            income_bruto,
            refunds,
            income_neto,
            shipping_amount,
            tax_amount,
            discount_amount
          FROM order_income_v1
          WHERE excluded = false
            AND processed_at >= ${startUtc}
            AND processed_at <= ${endUtc}
        ) sub
        GROUP BY day
        ORDER BY day ASC
      `);
      const rows = (result as { rows: Record<string, unknown>[] }).rows ?? [];

      const results = rows.map((r) => ({
        date: String(r.date ?? ""),
        ordersCount: Number(r.orders_count ?? 0),
        incomeBruto: String(r.income_bruto ?? "0"),
        refunds: String(r.refunds ?? "0"),
        incomeNeto: String(r.income_neto ?? "0"),
        shippingAmount: String(r.shipping_amount ?? "0"),
        taxAmount: String(r.tax_amount ?? "0"),
        discountAmount: String(r.discount_amount ?? "0"),
      }));
      return reply.send(results);
    }
  );

  /** Daily income series v2: same as daily but every money field is MoneyValue { raw, display }. */
  fastify.get<{ Querystring: { days?: string } }>(
    "/internal/income/daily-v2",
    async (req, reply) => {
      const rawDays = req.query.days;
      const parsed = daysSchema.safeParse(
        rawDays === undefined ? 7 : Number(rawDays)
      );
      if (!parsed.success) {
        return reply.code(400).send({
          error: parsed.error.errors[0]?.message ?? `days must be one of: ${allowedDays.join(", ")}`,
        });
      }
      const days = parsed.data;

      const [config] = await db
        .select()
        .from(shopConfig)
        .where(eq(shopConfig.id, "singleton"))
        .limit(1);
      if (!config) {
        return reply.code(503).send({
          error: "shop_config not found. Call POST /internal/bootstrap first.",
        });
      }
      const tz = config.timezoneIana;
      const end = DateTime.now().setZone(tz);
      const start = end.startOf("day").minus({ days: days - 1 });
      const startUtc = start.toUTC().toJSDate();
      const endUtc = end.toUTC().toJSDate();

      const result = await db.execute(sql`
        SELECT
          day::text AS date,
          COUNT(*)::int AS orders_count,
          SUM(income_bruto)::text AS income_bruto,
          SUM(refunds)::text AS refunds,
          SUM(income_neto)::text AS income_neto,
          SUM(shipping_amount)::text AS shipping_amount,
          SUM(tax_amount)::text AS tax_amount,
          SUM(discount_amount)::text AS discount_amount
        FROM (
          SELECT
            (processed_at AT TIME ZONE ${tz})::date AS day,
            income_bruto,
            refunds,
            income_neto,
            shipping_amount,
            tax_amount,
            discount_amount
          FROM order_income_v1
          WHERE excluded = false
            AND processed_at >= ${startUtc}
            AND processed_at <= ${endUtc}
        ) sub
        GROUP BY day
        ORDER BY day ASC
      `);
      const rows = (result as { rows: Record<string, unknown>[] }).rows ?? [];

      const results = rows.map((r) => ({
        date: String(r.date ?? ""),
        ordersCount: Number(r.orders_count ?? 0),
        incomeBruto: toMoneyValue(String(r.income_bruto ?? "0")),
        refunds: toMoneyValue(String(r.refunds ?? "0")),
        incomeNeto: toMoneyValue(String(r.income_neto ?? "0")),
        shippingAmount: toMoneyValue(String(r.shipping_amount ?? "0")),
        taxAmount: toMoneyValue(String(r.tax_amount ?? "0")),
        discountAmount: toMoneyValue(String(r.discount_amount ?? "0")),
      }));
      return reply.send(results);
    }
  );

  const summaryV2QuerySchema = z.object({
    days: z.coerce
      .number()
      .int()
      .refine((n) => (allowedDays as readonly number[]).includes(n))
      .optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    includeExcluded: z
      .string()
      .optional()
      .default("false")
      .transform((v) => v === "true" || v === "1"),
    debug: z
      .string()
      .optional()
      .transform((v) => v === "1" || v === "true"),
  });

  /** Summary v2: totals + aovNeto as MoneyValue. Use ?days= or ?from=&to= (same filtering/timezone as v1). */
  fastify.get<{ Querystring: Record<string, string | undefined> }>(
    "/internal/income/summary-v2",
    async (req, reply) => {
      const parsed = summaryV2QuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Invalid query",
          details: parsed.error.flatten(),
        });
      }
      const q = parsed.data;

      const [config] = await db
        .select()
        .from(shopConfig)
        .where(eq(shopConfig.id, "singleton"))
        .limit(1);
      if (!config) {
        return reply.code(503).send({
          error: "shop_config not found. Call POST /internal/bootstrap first.",
        });
      }
      const tz = config.timezoneIana;

      let startUtc: Date;
      let endUtc: Date;
      let from: string;
      let to: string;

      if (q.days !== undefined) {
        const end = DateTime.now().setZone(tz);
        const start = end.startOf("day").minus({ days: q.days - 1 });
        startUtc = start.toUTC().toJSDate();
        endUtc = end.toUTC().toJSDate();
        from = start.toISODate() ?? "";
        to = end.toISODate() ?? "";
      } else if (q.from !== undefined && q.to !== undefined) {
        try {
          const range = parseLocalDateRangeToUtc(q.from, q.to, tz);
          startUtc = range.startUtc;
          endUtc = range.endUtc;
          from = q.from;
          to = q.to;
        } catch (e) {
          return reply.code(400).send({
            error: e instanceof Error ? e.message : "Invalid date range",
          });
        }
      } else {
        return reply.code(400).send({
          error: "Provide either days or both from and to",
        });
      }

      const result = await listOrders({
        startUtc,
        endUtc,
        includeExcluded: q.includeExcluded,
        sort: "processedAt_desc",
        page: 1,
        pageSize: 1,
      });

      const s = result.summary;
      const ordersIncluded = s.ordersIncluded;
      const incomeNetoStr = s.incomeNeto;
      const aovNetoStr =
        ordersIncluded > 0
          ? new Decimal(incomeNetoStr).div(ordersIncluded).toFixed(6)
          : "0.000000";

      const payload: Record<string, unknown> = {
        range: { from, to, timezone: tz },
        currencyCode: s.currencyCode,
        incomeBruto: toMoneyValue(s.incomeBruto),
        refunds: toMoneyValue(s.refunds),
        incomeNeto: toMoneyValue(s.incomeNeto),
        shippingAmount: toMoneyValue(s.shippingAmount),
        taxAmount: toMoneyValue(s.taxAmount),
        discountAmount: toMoneyValue(s.discountAmount),
        ordersIncluded: s.ordersIncluded,
        ordersExcludedInRange: s.ordersExcludedInRange,
        aovNeto: toMoneyValue(aovNetoStr),
      };
      if (q.debug) {
        payload.window_utc = {
          start: startUtc.toISOString(),
          end: endUtc.toISOString(),
        };
      }
      return reply.send(payload);
    }
  );
}
