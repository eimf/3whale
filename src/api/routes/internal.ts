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
import {
    getSyncQueue,
    JOB_NAME_SYNC_ORDERS_INCOME_V1,
} from "../../jobs/queues.js";
import { toMoneyValue } from "../../metrics/moneyValue.js";
import { listOrders } from "../../services/incomeQueries.js";
import { parseLocalDateRangeToUtc } from "../../services/dateRange.js";
import {
    computeDeltaPercent,
    getPreviousPeriodLocalRange,
} from "../../services/comparison.js";
import { ensureContinuousHourlyBuckets } from "../../services/hourlyBuckets.js";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY?.trim() ?? "";

const allowedDays = [1, 2, 3, 7, 14, 30, 90, 365] as const;
const daysSchema = z
    .number()
    .int()
    .refine((n) => (allowedDays as readonly number[]).includes(n), {
        message: `days must be one of: ${allowedDays.join(", ")}`,
    });

function requireInternalApiKey(
    req: FastifyRequest,
    reply: FastifyReply,
    done: () => void,
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
        if (
            path === "/internal/health" ||
            path === "/" ||
            path.startsWith("/auth/")
        )
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
                error: "Missing env: SHOPIFY_SHOP_DOMAIN, SHOP_TIMEZONE_IANA, SHOP_CURRENCY_CODE",
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
                rawDays === undefined ? 7 : Number(rawDays),
            );
            if (!parsed.success) {
                return reply.code(400).send({
                    error:
                        parsed.error.errors[0]?.message ??
                        `days must be one of: ${allowedDays.join(", ")}`,
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
            const rows =
                (result as { rows: Record<string, unknown>[] }).rows ?? [];

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
        },
    );

    /** Daily income series v2: same as daily but every money field is MoneyValue { raw, display }.
     * Canonical contract: docs/metrics/income_daily_v2_contract.md
     * Query: days= or from=&to= (like summary-v2). Optional granularity=hour|day (default: hour if range ≤2 days, else day).
     * In hour mode, data[] keys are shop-local naive bucket strings (serialized in data[].date), zero-filled/continuous by hour.
     * Consumer rule: do not parse bucket keys via JS Date/browser timezone semantics.
     * Optional compare=1 returns comparison series for the immediately preceding period of same length. */
    fastify.get<{ Querystring: Record<string, string | undefined> }>(
        "/internal/income/daily-v2",
        async (req, reply) => {
            const dailyV2Schema = z.object({
                days: z.coerce
                    .number()
                    .int()
                    .refine((n) =>
                        (allowedDays as readonly number[]).includes(n),
                    )
                    .optional(),
                from: z
                    .string()
                    .regex(/^\d{4}-\d{2}-\d{2}$/)
                    .optional(),
                to: z
                    .string()
                    .regex(/^\d{4}-\d{2}-\d{2}$/)
                    .optional(),
                granularity: z.enum(["hour", "day"]).optional(),
                includeExcluded: z
                    .string()
                    .optional()
                    .default("false")
                    .transform((v) => v === "true" || v === "1"),
                compare: z
                    .string()
                    .optional()
                    .transform((v) => v === "1" || v === "true"),
            });
            const parsed = dailyV2Schema.safeParse(req.query);
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
                        error:
                            e instanceof Error
                                ? e.message
                                : "Invalid date range",
                    });
                }
            } else {
                return reply.code(400).send({
                    error: "Provide either days or both from and to",
                });
            }

            const startLocal = DateTime.fromJSDate(startUtc).setZone(tz);
            const endLocal = DateTime.fromJSDate(endUtc).setZone(tz);
            const rangeDays =
                Math.ceil(endLocal.diff(startLocal, "days").days) + 1;
            const useHour = rangeDays <= 2;
            const granularity = q.granularity ?? (useHour ? "hour" : "day");

            async function runDailyAgg(
                sUtc: Date,
                eUtc: Date,
                fromLocal: string,
                toLocal: string,
                includeExcluded: boolean,
            ): Promise<
                Array<{
                    date: string;
                    ordersCount: number;
                    orderRevenue: ReturnType<typeof toMoneyValue>;
                    incomeBruto: ReturnType<typeof toMoneyValue>;
                    refunds: ReturnType<typeof toMoneyValue>;
                    incomeNeto: ReturnType<typeof toMoneyValue>;
                    shippingAmount: ReturnType<typeof toMoneyValue>;
                    taxAmount: ReturnType<typeof toMoneyValue>;
                    discountAmount: ReturnType<typeof toMoneyValue>;
                }>
            > {
                const exclusionPredicate = includeExcluded
                    ? sql`TRUE`
                    : sql`excluded = false`;
                const refundAmountExpr = sql`
                    CASE
                        WHEN COALESCE(NULLIF(refund_obj->'totalRefundedSet'->'shopMoney'->>'amount', ''), '0')::numeric > 0
                            THEN COALESCE(NULLIF(refund_obj->'totalRefundedSet'->'shopMoney'->>'amount', ''), '0')::numeric
                        ELSE COALESCE((
                            SELECT SUM(
                                COALESCE(NULLIF(edge->'node'->'subtotalSet'->'shopMoney'->>'amount', ''), '0')::numeric
                            )
                            FROM jsonb_array_elements(
                                CASE
                                    WHEN jsonb_typeof(refund_obj->'refundLineItems'->'edges') = 'array'
                                        THEN refund_obj->'refundLineItems'->'edges'
                                    ELSE '[]'::jsonb
                                END
                            ) edge
                        ), 0)
                    END
                `;

                if (granularity === "hour") {
                    const result = await db.execute(sql`
                        WITH buckets AS (
                            SELECT generate_series(
                                date_trunc('hour', timezone(${tz}, ${sUtc}::timestamptz)),
                                date_trunc('hour', timezone(${tz}, ${eUtc}::timestamptz)),
                                interval '1 hour'
                            ) AS bucket_local
                        ),
                        agg AS (
                            SELECT
                                date_trunc('hour', (processed_at AT TIME ZONE ${tz})) AS bucket_local,
                                COUNT(*)::int AS orders_count,
                                SUM(income_neto)::text AS line_items_subtotal,
                                SUM(income_bruto)::text AS income_bruto,
                                SUM(income_neto)::text AS income_neto,
                                SUM(shipping_amount)::text AS shipping_amount,
                                SUM(tax_amount)::text AS tax_amount,
                                SUM(discount_amount)::text AS discount_amount
                            FROM order_income_v1
                            WHERE ${exclusionPredicate}
                                AND processed_at >= ${sUtc}
                                AND processed_at <= ${eUtc}
                            GROUP BY bucket_local
                        ),
                        refund_rows AS (
                            SELECT
                                date_trunc('hour', ((refund_obj->>'createdAt')::timestamptz AT TIME ZONE ${tz})) AS bucket_local,
                                ${refundAmountExpr} AS refund_amount
                            FROM shopify_order_raw raw
                            INNER JOIN order_income_v1 oi ON oi.shopify_order_id = raw.shopify_order_id
                            CROSS JOIN LATERAL jsonb_array_elements(
                                CASE
                                    WHEN jsonb_typeof(raw.payload->'refunds') = 'array'
                                        THEN raw.payload->'refunds'
                                    ELSE '[]'::jsonb
                                END
                            ) refund_obj
                            WHERE ${exclusionPredicate}
                                AND (refund_obj->>'createdAt')::timestamptz >= ${sUtc}
                                AND (refund_obj->>'createdAt')::timestamptz <= ${eUtc}
                        ),
                        refunds_agg AS (
                            SELECT
                                bucket_local,
                                SUM(refund_amount)::text AS refunds
                            FROM refund_rows
                            GROUP BY bucket_local
                        )
                        SELECT
                            to_char(b.bucket_local, 'YYYY-MM-DD"T"HH24:MI:SS') AS date,
                            COALESCE(a.orders_count, 0)::int AS orders_count,
                            COALESCE(a.line_items_subtotal, '0')::text AS line_items_subtotal,
                            COALESCE(a.income_bruto, '0')::text AS income_bruto,
                            COALESCE(rf.refunds, '0')::text AS refunds,
                            COALESCE(a.income_neto, '0')::text AS income_neto,
                            COALESCE(a.shipping_amount, '0')::text AS shipping_amount,
                            COALESCE(a.tax_amount, '0')::text AS tax_amount,
                            COALESCE(a.discount_amount, '0')::text AS discount_amount
                        FROM buckets b
                        LEFT JOIN agg a ON a.bucket_local = b.bucket_local
                        LEFT JOIN refunds_agg rf ON rf.bucket_local = b.bucket_local
                        ORDER BY b.bucket_local ASC
          `);
                    const rows =
                        (result as { rows: Record<string, unknown>[] }).rows ??
                        [];
                    const points = rows.map((r) => {
                        return {
                            date: String(r.date ?? ""),
                            ordersCount: Number(r.orders_count ?? 0),
                            orderRevenue: toMoneyValue(
                                String(r.line_items_subtotal ?? "0"),
                            ),
                            incomeBruto: toMoneyValue(
                                String(r.income_bruto ?? "0"),
                            ),
                            refunds: toMoneyValue(String(r.refunds ?? "0")),
                            incomeNeto: toMoneyValue(
                                String(r.income_neto ?? "0"),
                            ),
                            shippingAmount: toMoneyValue(
                                String(r.shipping_amount ?? "0"),
                            ),
                            taxAmount: toMoneyValue(
                                String(r.tax_amount ?? "0"),
                            ),
                            discountAmount: toMoneyValue(
                                String(r.discount_amount ?? "0"),
                            ),
                        };
                    });

                    return ensureContinuousHourlyBuckets(
                        points,
                        sUtc,
                        eUtc,
                        tz,
                        (bucketKey) => ({
                            date: bucketKey,
                            ordersCount: 0,
                            orderRevenue: toMoneyValue("0"),
                            incomeBruto: toMoneyValue("0"),
                            refunds: toMoneyValue("0"),
                            incomeNeto: toMoneyValue("0"),
                            shippingAmount: toMoneyValue("0"),
                            taxAmount: toMoneyValue("0"),
                            discountAmount: toMoneyValue("0"),
                        }),
                    );
                }
                const result = await db.execute(sql`
                    WITH buckets AS (
                        SELECT generate_series(
                            ${fromLocal}::date,
                            ${toLocal}::date,
                            interval '1 day'
                        )::date AS bucket_local_day
                    ),
                    agg AS (
                        SELECT
                            (processed_at AT TIME ZONE ${tz})::date AS bucket_local_day,
                            COUNT(*)::int AS orders_count,
                            SUM(income_neto)::text AS line_items_subtotal,
                            SUM(income_bruto)::text AS income_bruto,
                            SUM(income_neto)::text AS income_neto,
                            SUM(shipping_amount)::text AS shipping_amount,
                            SUM(tax_amount)::text AS tax_amount,
                            SUM(discount_amount)::text AS discount_amount
                        FROM order_income_v1
                        WHERE ${exclusionPredicate}
                            AND processed_at >= ${sUtc}
                            AND processed_at <= ${eUtc}
                        GROUP BY bucket_local_day
                    ),
                    refund_rows AS (
                        SELECT
                            ((refund_obj->>'createdAt')::timestamptz AT TIME ZONE ${tz})::date AS bucket_local_day,
                            ${refundAmountExpr} AS refund_amount
                        FROM shopify_order_raw raw
                        INNER JOIN order_income_v1 oi ON oi.shopify_order_id = raw.shopify_order_id
                        CROSS JOIN LATERAL jsonb_array_elements(
                            CASE
                                WHEN jsonb_typeof(raw.payload->'refunds') = 'array'
                                    THEN raw.payload->'refunds'
                                ELSE '[]'::jsonb
                            END
                        ) refund_obj
                        WHERE ${exclusionPredicate}
                            AND (refund_obj->>'createdAt')::timestamptz >= ${sUtc}
                            AND (refund_obj->>'createdAt')::timestamptz <= ${eUtc}
                    ),
                    refunds_agg AS (
                        SELECT
                            bucket_local_day,
                            SUM(refund_amount)::text AS refunds
                        FROM refund_rows
                        GROUP BY bucket_local_day
                    )
                    SELECT
                        to_char(b.bucket_local_day, 'YYYY-MM-DD') AS date,
                        COALESCE(a.orders_count, 0)::int AS orders_count,
                        COALESCE(a.line_items_subtotal, '0')::text AS line_items_subtotal,
                        COALESCE(a.income_bruto, '0')::text AS income_bruto,
                        COALESCE(rf.refunds, '0')::text AS refunds,
                        COALESCE(a.income_neto, '0')::text AS income_neto,
                        COALESCE(a.shipping_amount, '0')::text AS shipping_amount,
                        COALESCE(a.tax_amount, '0')::text AS tax_amount,
                        COALESCE(a.discount_amount, '0')::text AS discount_amount
                    FROM buckets b
                    LEFT JOIN agg a ON a.bucket_local_day = b.bucket_local_day
                    LEFT JOIN refunds_agg rf ON rf.bucket_local_day = b.bucket_local_day
                    ORDER BY b.bucket_local_day ASC
        `);
                const rows =
                    (result as { rows: Record<string, unknown>[] }).rows ?? [];
                return rows.map((r) => ({
                    date: String(r.date ?? ""),
                    ordersCount: Number(r.orders_count ?? 0),
                    orderRevenue: toMoneyValue(
                        String(r.line_items_subtotal ?? "0"),
                    ),
                    incomeBruto: toMoneyValue(String(r.income_bruto ?? "0")),
                    refunds: toMoneyValue(String(r.refunds ?? "0")),
                    incomeNeto: toMoneyValue(String(r.income_neto ?? "0")),
                    shippingAmount: toMoneyValue(
                        String(r.shipping_amount ?? "0"),
                    ),
                    taxAmount: toMoneyValue(String(r.tax_amount ?? "0")),
                    discountAmount: toMoneyValue(
                        String(r.discount_amount ?? "0"),
                    ),
                }));
            }

            const results = await runDailyAgg(
                startUtc,
                endUtc,
                from,
                to,
                q.includeExcluded,
            );

            const payload: Record<string, unknown> = {
                range: { from, to, timezone: tz },
                granularity,
                data: results,
            };

            if (q.compare) {
                const prevRange = getPreviousPeriodLocalRange(from, to, tz);
                const fromPrev = prevRange.from;
                const toPrev = prevRange.to;
                try {
                    const rangePrev = parseLocalDateRangeToUtc(
                        fromPrev,
                        toPrev,
                        tz,
                    );
                    const comparisonResults = await runDailyAgg(
                        rangePrev.startUtc,
                        rangePrev.endUtc,
                        fromPrev,
                        toPrev,
                        q.includeExcluded,
                    );
                    payload.comparisonRange = { from: fromPrev, to: toPrev };
                    payload.comparison = comparisonResults;
                } catch {
                    payload.comparisonRange = { from: fromPrev, to: toPrev };
                    payload.comparison = [];
                }
            }

            return reply.send(payload);
        },
    );

    const summaryV2QuerySchema = z.object({
        days: z.coerce
            .number()
            .int()
            .refine((n) => (allowedDays as readonly number[]).includes(n))
            .optional(),
        from: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        to: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        includeExcluded: z
            .string()
            .optional()
            .default("false")
            .transform((v) => v === "true" || v === "1"),
        compare: z
            .string()
            .optional()
            .transform((v) => v === "1" || v === "true"),
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
                        error:
                            e instanceof Error
                                ? e.message
                                : "Invalid date range",
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

            async function getRefundsByCreatedAt(
                sUtc: Date,
                eUtc: Date,
                includeExcluded: boolean,
            ): Promise<string> {
                const exclusionPredicate = includeExcluded
                    ? sql`TRUE`
                    : sql`oi.excluded = false`;
                const resultRefunds = await db.execute(sql`
                    WITH refund_rows AS (
                        SELECT
                            CASE
                                WHEN COALESCE(NULLIF(refund_obj->'totalRefundedSet'->'shopMoney'->>'amount', ''), '0')::numeric > 0
                                    THEN COALESCE(NULLIF(refund_obj->'totalRefundedSet'->'shopMoney'->>'amount', ''), '0')::numeric
                                ELSE COALESCE((
                                    SELECT SUM(
                                        COALESCE(NULLIF(edge->'node'->'subtotalSet'->'shopMoney'->>'amount', ''), '0')::numeric
                                    )
                                    FROM jsonb_array_elements(
                                        CASE
                                            WHEN jsonb_typeof(refund_obj->'refundLineItems'->'edges') = 'array'
                                                THEN refund_obj->'refundLineItems'->'edges'
                                            ELSE '[]'::jsonb
                                        END
                                    ) edge
                                ), 0)
                            END AS refund_amount
                        FROM shopify_order_raw raw
                        INNER JOIN order_income_v1 oi ON oi.shopify_order_id = raw.shopify_order_id
                        CROSS JOIN LATERAL jsonb_array_elements(
                            CASE
                                WHEN jsonb_typeof(raw.payload->'refunds') = 'array'
                                    THEN raw.payload->'refunds'
                                ELSE '[]'::jsonb
                            END
                        ) refund_obj
                        WHERE ${exclusionPredicate}
                            AND (refund_obj->>'createdAt')::timestamptz >= ${sUtc}
                            AND (refund_obj->>'createdAt')::timestamptz <= ${eUtc}
                    )
                    SELECT COALESCE(SUM(refund_amount), 0)::text AS refunds_total
                    FROM refund_rows
                `);
                const rows =
                    (resultRefunds as { rows: Record<string, unknown>[] })
                        .rows ?? [];
                return String(rows[0]?.refunds_total ?? "0");
            }

            const s = result.summary;
            const refundsCurrentStr = await getRefundsByCreatedAt(
                startUtc,
                endUtc,
                q.includeExcluded,
            );
            const ordersIncluded = s.ordersIncluded;
            const incomeNetoStr = s.incomeNeto;
            const aovNetoStr =
                ordersIncluded > 0
                    ? new Decimal(incomeNetoStr).div(ordersIncluded).toFixed(6)
                    : "0.000000";

            const payload: Record<string, unknown> = {
                range: { from, to, timezone: tz },
                currencyCode: s.currencyCode,
                orderRevenue: toMoneyValue(s.lineItemsSubtotal),
                incomeBruto: toMoneyValue(s.incomeBruto),
                refunds: toMoneyValue(refundsCurrentStr),
                incomeNeto: toMoneyValue(s.incomeNeto),
                shippingAmount: toMoneyValue(s.shippingAmount),
                taxAmount: toMoneyValue(s.taxAmount),
                discountAmount: toMoneyValue(s.discountAmount),
                ordersIncluded: s.ordersIncluded,
                ordersExcludedInRange: s.ordersExcludedInRange,
                aovNeto: toMoneyValue(aovNetoStr),
            };

            if (q.compare) {
                const prevRange = getPreviousPeriodLocalRange(from, to, tz);
                const fromPrev = prevRange.from;
                const toPrev = prevRange.to;
                try {
                    const rangePrev = parseLocalDateRangeToUtc(
                        fromPrev,
                        toPrev,
                        tz,
                    );
                    const resultPrev = await listOrders({
                        startUtc: rangePrev.startUtc,
                        endUtc: rangePrev.endUtc,
                        includeExcluded: q.includeExcluded,
                        sort: "processedAt_desc",
                        page: 1,
                        pageSize: 1,
                    });
                    const sp = resultPrev.summary;
                    const refundsPrevStr = await getRefundsByCreatedAt(
                        rangePrev.startUtc,
                        rangePrev.endUtc,
                        q.includeExcluded,
                    );
                    const aovPrevStr =
                        sp.ordersIncluded > 0
                            ? new Decimal(sp.incomeNeto)
                                  .div(sp.ordersIncluded)
                                  .toFixed(6)
                            : "0.000000";

                    payload.comparisonRange = { from: fromPrev, to: toPrev };
                    payload.comparison = {
                        orderRevenue: toMoneyValue(sp.lineItemsSubtotal),
                        incomeBruto: toMoneyValue(sp.incomeBruto),
                        refunds: toMoneyValue(refundsPrevStr),
                        incomeNeto: toMoneyValue(sp.incomeNeto),
                        shippingAmount: toMoneyValue(sp.shippingAmount),
                        taxAmount: toMoneyValue(sp.taxAmount),
                        discountAmount: toMoneyValue(sp.discountAmount),
                        ordersIncluded: sp.ordersIncluded,
                        aovNeto: toMoneyValue(aovPrevStr),
                    };

                    payload.deltas = {
                        orderRevenue: computeDeltaPercent(
                            s.lineItemsSubtotal,
                            sp.lineItemsSubtotal,
                        ),
                        incomeBruto: computeDeltaPercent(
                            s.incomeBruto,
                            sp.incomeBruto,
                        ),
                        refunds: computeDeltaPercent(
                            refundsCurrentStr,
                            refundsPrevStr,
                        ),
                        incomeNeto: computeDeltaPercent(
                            s.incomeNeto,
                            sp.incomeNeto,
                        ),
                        shippingAmount: computeDeltaPercent(
                            s.shippingAmount,
                            sp.shippingAmount,
                        ),
                        taxAmount: computeDeltaPercent(
                            s.taxAmount,
                            sp.taxAmount,
                        ),
                        discountAmount: computeDeltaPercent(
                            s.discountAmount,
                            sp.discountAmount,
                        ),
                        ordersIncluded: computeDeltaPercent(
                            s.ordersIncluded,
                            sp.ordersIncluded,
                        ),
                        aovNeto: computeDeltaPercent(aovNetoStr, aovPrevStr),
                    };
                } catch (e) {
                    payload.comparisonRange = { from: fromPrev, to: toPrev };
                    payload.comparison = null;
                    payload.deltas = null;
                }
            }

            if (q.debug) {
                payload.window_utc = {
                    start: startUtc.toISOString(),
                    end: endUtc.toISOString(),
                };
            }
            return reply.send(payload);
        },
    );
}
