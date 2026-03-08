/**
 * Income v1 queries: list orders, single order, reconcile.
 * All money from DB as string (NUMERIC). Aggregations in SQL only.
 */

import { and, between, eq, desc, asc, sql, type SQL } from "drizzle-orm";
import { db } from "../db/index.js";
import { orderIncomeV1 } from "../db/schema.js";

const TIMEZONE = "America/Mexico_City";

export type SortOption =
    | "processedAt_desc"
    | "processedAt_asc"
    | "incomeNeto_desc"
    | "refunds_desc";

function orderByClause(sort: SortOption): SQL {
    switch (sort) {
        case "processedAt_asc":
            return asc(orderIncomeV1.processedAt);
        case "incomeNeto_desc":
            return desc(orderIncomeV1.incomeNeto);
        case "refunds_desc":
            return desc(orderIncomeV1.refunds);
        case "processedAt_desc":
        default:
            return desc(orderIncomeV1.processedAt);
    }
}

function toMoneyString(v: unknown): string {
    if (v === null || v === undefined) return "0.000000";
    const s = String(v);
    return s;
}

export interface OrderIncomeRow {
    shopifyOrderId: string;
    processedAt: Date;
    currencyCode: string;
    excluded: boolean;
    excludedReason: string | null;
    lineItemsSubtotal: string;
    shippingAmount: string;
    taxAmount: string;
    discountAmount: string;
    incomeBruto: string;
    refunds: string;
    incomeNeto: string;
}

function rowToOrderIncome(row: Record<string, unknown>): OrderIncomeRow {
    return {
        shopifyOrderId: String(row.shopifyOrderId ?? ""),
        processedAt:
            row.processedAt instanceof Date
                ? row.processedAt
                : new Date(String(row.processedAt)),
        currencyCode: String(row.currencyCode ?? ""),
        excluded: Boolean(row.excluded),
        excludedReason:
            row.excludedReason != null ? String(row.excludedReason) : null,
        lineItemsSubtotal: toMoneyString(row.lineItemsSubtotal),
        shippingAmount: toMoneyString(row.shippingAmount),
        taxAmount: toMoneyString(row.taxAmount),
        discountAmount: toMoneyString(row.discountAmount),
        incomeBruto: toMoneyString(row.incomeBruto),
        refunds: toMoneyString(row.refunds),
        incomeNeto: toMoneyString(row.incomeNeto),
    };
}

export interface ListOrdersResult {
    orders: OrderIncomeRow[];
    total: number;
    ordersExcludedInRange: number;
    summary: {
        currencyCode: string;
        lineItemsSubtotal: string;
        incomeBruto: string;
        refunds: string;
        incomeNeto: string;
        shippingAmount: string;
        taxAmount: string;
        discountAmount: string;
        ordersIncluded: number;
        ordersExcludedInRange: number;
        /** Triple Whale True AOV: sum(income_neto - shipping_amount) for orders with income_neto > 0 */
        incomeNetoProductOnly: string;
        /** Triple Whale True AOV: count of orders with income_neto > 0 */
        ordersWithPositiveRevenue: number;
    };
}

export async function listOrders(params: {
    startUtc: Date;
    endUtc: Date;
    includeExcluded: boolean;
    sort: SortOption;
    page: number;
    pageSize: number;
}): Promise<ListOrdersResult> {
    const { startUtc, endUtc, includeExcluded, sort, page, pageSize } = params;
    const rangeCondition = between(orderIncomeV1.processedAt, startUtc, endUtc);
    const whereIncluded = includeExcluded
        ? rangeCondition
        : and(rangeCondition, eq(orderIncomeV1.excluded, false));

    const offset = (page - 1) * pageSize;

    const [excludedCountResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(orderIncomeV1)
        .where(and(rangeCondition, eq(orderIncomeV1.excluded, true)));

    const ordersExcludedInRange = excludedCountResult?.count ?? 0;

    const [totalResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(orderIncomeV1)
        .where(whereIncluded);

    const total = totalResult?.count ?? 0;

    const rows = await db
        .select()
        .from(orderIncomeV1)
        .where(whereIncluded)
        .orderBy(orderByClause(sort), desc(orderIncomeV1.shopifyOrderId))
        .limit(pageSize)
        .offset(offset);

    const orders = rows.map((r) =>
        rowToOrderIncome({
            ...r,
            lineItemsSubtotal: r.lineItemsSubtotal,
            shippingAmount: r.shippingAmount,
            taxAmount: r.taxAmount,
            discountAmount: r.discountAmount,
            incomeBruto: r.incomeBruto,
            refunds: r.refunds,
            incomeNeto: r.incomeNeto,
        }),
    );

    const summaryResult = await db
        .select({
            currencyCode: sql<string>`MAX(${orderIncomeV1.currencyCode})`,
            lineItemsSubtotal: sql<string>`COALESCE(SUM(${orderIncomeV1.incomeNeto}), 0)::text`,
            incomeBruto: sql<string>`COALESCE(SUM(${orderIncomeV1.incomeBruto}), 0)::text`,
            refunds: sql<string>`COALESCE(SUM(${orderIncomeV1.refunds}), 0)::text`,
            incomeNeto: sql<string>`COALESCE(SUM(${orderIncomeV1.incomeNeto}), 0)::text`,
            shippingAmount: sql<string>`COALESCE(SUM(${orderIncomeV1.shippingAmount}), 0)::text`,
            taxAmount: sql<string>`COALESCE(SUM(${orderIncomeV1.taxAmount}), 0)::text`,
            discountAmount: sql<string>`COALESCE(SUM(${orderIncomeV1.discountAmount}), 0)::text`,
            incomeNetoProductOnly: sql<string>`COALESCE(SUM(${orderIncomeV1.incomeNeto} - ${orderIncomeV1.shippingAmount}) FILTER (WHERE ${orderIncomeV1.incomeNeto} > 0), 0)::text`,
            ordersWithPositiveRevenue: sql<number>`COUNT(*) FILTER (WHERE ${orderIncomeV1.incomeNeto} > 0)::int`,
        })
        .from(orderIncomeV1)
        .where(whereIncluded);

    const s = summaryResult[0];
    const currencyCode = s?.currencyCode ?? "MXN";

    return {
        orders,
        total,
        ordersExcludedInRange,
        summary: {
            currencyCode,
            lineItemsSubtotal: s
                ? toMoneyString(s.lineItemsSubtotal)
                : "0.000000",
            incomeBruto: s ? toMoneyString(s.incomeBruto) : "0.000000",
            refunds: s ? toMoneyString(s.refunds) : "0.000000",
            incomeNeto: s ? toMoneyString(s.incomeNeto) : "0.000000",
            shippingAmount: s ? toMoneyString(s.shippingAmount) : "0.000000",
            taxAmount: s ? toMoneyString(s.taxAmount) : "0.000000",
            discountAmount: s ? toMoneyString(s.discountAmount) : "0.000000",
            ordersIncluded: total,
            ordersExcludedInRange,
            incomeNetoProductOnly: s
                ? toMoneyString(s.incomeNetoProductOnly)
                : "0.000000",
            ordersWithPositiveRevenue: s?.ordersWithPositiveRevenue ?? 0,
        },
    };
}

export async function getOrderByShopifyOrderId(
    shopifyOrderId: string,
): Promise<OrderIncomeRow | null> {
    const [row] = await db
        .select()
        .from(orderIncomeV1)
        .where(eq(orderIncomeV1.shopifyOrderId, shopifyOrderId))
        .limit(1);
    if (!row) return null;
    return rowToOrderIncome({
        ...row,
        lineItemsSubtotal: row.lineItemsSubtotal,
        shippingAmount: row.shippingAmount,
        taxAmount: row.taxAmount,
        discountAmount: row.discountAmount,
        incomeBruto: row.incomeBruto,
        refunds: row.refunds,
        incomeNeto: row.incomeNeto,
    });
}

export interface ReconcileResult {
    totals: {
        incomeBruto: string;
        refunds: string;
        incomeNeto: string;
        shippingAmount: string;
        taxAmount: string;
        discountAmount: string;
        lineItemsSubtotal: string;
    };
    counts: {
        ordersTotalInRange: number;
        ordersExcludedInRange: number;
        ordersIncludedInRange: number;
    };
    qualitySignals: {
        ordersWithNetoNegative: number;
        ordersWithRefundsGtBruto: number;
        topRefundedOrders: Array<{
            shopifyOrderId: string;
            refunds: string;
            incomeBruto: string;
        }>;
    };
}

export async function getReconcile(params: {
    startUtc: Date;
    endUtc: Date;
    includeExcluded: boolean;
}): Promise<ReconcileResult> {
    const { startUtc, endUtc, includeExcluded } = params;
    const rangeCondition = between(orderIncomeV1.processedAt, startUtc, endUtc);
    const whereIncluded = includeExcluded
        ? rangeCondition
        : and(rangeCondition, eq(orderIncomeV1.excluded, false));

    const [totalsRow] = await db
        .select({
            incomeBruto: sql<string>`COALESCE(SUM(${orderIncomeV1.incomeBruto}), 0)::text`,
            refunds: sql<string>`COALESCE(SUM(${orderIncomeV1.refunds}), 0)::text`,
            incomeNeto: sql<string>`COALESCE(SUM(${orderIncomeV1.incomeNeto}), 0)::text`,
            shippingAmount: sql<string>`COALESCE(SUM(${orderIncomeV1.shippingAmount}), 0)::text`,
            taxAmount: sql<string>`COALESCE(SUM(${orderIncomeV1.taxAmount}), 0)::text`,
            discountAmount: sql<string>`COALESCE(SUM(${orderIncomeV1.discountAmount}), 0)::text`,
            lineItemsSubtotal: sql<string>`COALESCE(SUM(${orderIncomeV1.incomeNeto}), 0)::text`,
        })
        .from(orderIncomeV1)
        .where(whereIncluded);

    const [totalInRange] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(orderIncomeV1)
        .where(rangeCondition);

    const [excludedInRange] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(orderIncomeV1)
        .where(and(rangeCondition, eq(orderIncomeV1.excluded, true)));

    const [includedInRange] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(orderIncomeV1)
        .where(whereIncluded);

    const [netoNegative] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(orderIncomeV1)
        .where(and(whereIncluded, sql`${orderIncomeV1.incomeNeto} < 0`));

    const [refundsGtBruto] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(orderIncomeV1)
        .where(
            and(
                whereIncluded,
                sql`${orderIncomeV1.refunds} > ${orderIncomeV1.incomeBruto}`,
            ),
        );

    const topRefunded = await db
        .select({
            shopifyOrderId: orderIncomeV1.shopifyOrderId,
            refunds: orderIncomeV1.refunds,
            incomeBruto: orderIncomeV1.incomeBruto,
        })
        .from(orderIncomeV1)
        .where(whereIncluded)
        .orderBy(desc(orderIncomeV1.refunds))
        .limit(10);

    return {
        totals: {
            incomeBruto: totalsRow
                ? toMoneyString(totalsRow.incomeBruto)
                : "0.000000",
            refunds: totalsRow ? toMoneyString(totalsRow.refunds) : "0.000000",
            incomeNeto: totalsRow
                ? toMoneyString(totalsRow.incomeNeto)
                : "0.000000",
            shippingAmount: totalsRow
                ? toMoneyString(totalsRow.shippingAmount)
                : "0.000000",
            taxAmount: totalsRow
                ? toMoneyString(totalsRow.taxAmount)
                : "0.000000",
            discountAmount: totalsRow
                ? toMoneyString(totalsRow.discountAmount)
                : "0.000000",
            lineItemsSubtotal: totalsRow
                ? toMoneyString(totalsRow.lineItemsSubtotal)
                : "0.000000",
        },
        counts: {
            ordersTotalInRange: totalInRange?.count ?? 0,
            ordersExcludedInRange: excludedInRange?.count ?? 0,
            ordersIncludedInRange: includedInRange?.count ?? 0,
        },
        qualitySignals: {
            ordersWithNetoNegative: netoNegative?.count ?? 0,
            ordersWithRefundsGtBruto: refundsGtBruto?.count ?? 0,
            topRefundedOrders: topRefunded.map((r) => ({
                shopifyOrderId: String(r.shopifyOrderId),
                refunds: toMoneyString(r.refunds),
                incomeBruto: toMoneyString(r.incomeBruto),
            })),
        },
    };
}

export interface ReconcileParityRow {
    shopifyOrderId: string;
    processedInRange: boolean;
    refundsInRange: boolean;
    excluded: boolean;
    excludedReason: string | null;
    orderIncomeBruto: string;
    orderShippingAmount: string;
    orderTaxAmount: string;
    orderDiscountAmount: string;
    orderGrossSales: string;
    refundEventsCount: number;
    refundsEffective: string;
    refundsReported: string;
    refundsLineItemsAmount: string;
    refundsLineItemsGrossAmount: string;
    refundsLineItemsTaxAmount: string;
    refundsShippingAmount: string;
    refundsShippingTaxAmount: string;
    refundsDutiesAmount: string;
    refundsOrderAdjustmentsAmount: string;
    refundsOrderAdjustmentsTaxAmount: string;
    returnsUplift: string;
}

export interface ReconcileParityResult {
    totals: {
        processedOrdersCount: number;
        refundedOrdersCount: number;
        processedGrossSalesTotal: string;
        returnsNetTotal: string;
        returnsGrossTotal: string;
        returnsUpliftTotal: string;
    };
    rows: ReconcileParityRow[];
}

export async function getReconcileParity(params: {
    startUtc: Date;
    endUtc: Date;
    includeExcluded: boolean;
    limit: number;
}): Promise<ReconcileParityResult> {
    const { startUtc, endUtc, includeExcluded, limit } = params;
    const processedPredicate = includeExcluded
        ? sql`TRUE`
        : sql`oi.excluded = false`;
    const refundsPredicate = includeExcluded
        ? sql`TRUE`
        : sql`oi.excluded = false`;

    const rowsResult = await db.execute(sql`
        WITH processed AS (
            SELECT
                oi.shopify_order_id,
                oi.excluded,
                oi.excluded_reason,
                oi.income_bruto::numeric AS order_income_bruto,
                oi.shipping_amount::numeric AS order_shipping_amount,
                oi.tax_amount::numeric AS order_tax_amount,
                oi.discount_amount::numeric AS order_discount_amount,
                (oi.income_bruto - oi.shipping_amount + oi.discount_amount)::numeric AS order_gross_sales
            FROM order_income_v1 oi
            WHERE ${processedPredicate}
                AND oi.processed_at >= ${startUtc}
                AND oi.processed_at <= ${endUtc}
        ),
        refunds AS (
            SELECT
                rf.shopify_order_id,
                COUNT(*)::int AS refund_events_count,
                COALESCE(SUM(rf.refund_effective_amount), 0)::numeric AS refunds_effective,
                COALESCE(SUM(rf.refund_reported_amount), 0)::numeric AS refunds_reported,
                COALESCE(SUM(rf.refund_line_items_amount), 0)::numeric AS refunds_line_items_amount,
                COALESCE(SUM(rf.refund_line_items_gross_amount), 0)::numeric AS refunds_line_items_gross_amount,
                COALESCE(SUM(rf.refund_line_items_tax_amount), 0)::numeric AS refunds_line_items_tax_amount,
                COALESCE(SUM(rf.refund_shipping_amount), 0)::numeric AS refunds_shipping_amount,
                COALESCE(SUM(rf.refund_shipping_tax_amount), 0)::numeric AS refunds_shipping_tax_amount,
                COALESCE(SUM(rf.refund_duties_amount), 0)::numeric AS refunds_duties_amount,
                COALESCE(SUM(rf.refund_order_adjustments_amount), 0)::numeric AS refunds_order_adjustments_amount,
                COALESCE(SUM(rf.refund_order_adjustments_tax_amount), 0)::numeric AS refunds_order_adjustments_tax_amount
            FROM order_refund_event_v1 rf
            INNER JOIN order_income_v1 oi ON oi.shopify_order_id = rf.shopify_order_id
            WHERE ${refundsPredicate}
                AND rf.refund_created_at >= ${startUtc}
                AND rf.refund_created_at <= ${endUtc}
            GROUP BY rf.shopify_order_id
        )
        SELECT
            COALESCE(p.shopify_order_id, r.shopify_order_id)::text AS shopify_order_id,
            (p.shopify_order_id IS NOT NULL) AS processed_in_range,
            (r.shopify_order_id IS NOT NULL) AS refunds_in_range,
            COALESCE(p.excluded, false) AS excluded,
            p.excluded_reason,
            COALESCE(p.order_income_bruto, 0)::text AS order_income_bruto,
            COALESCE(p.order_shipping_amount, 0)::text AS order_shipping_amount,
            COALESCE(p.order_tax_amount, 0)::text AS order_tax_amount,
            COALESCE(p.order_discount_amount, 0)::text AS order_discount_amount,
            COALESCE(p.order_gross_sales, 0)::text AS order_gross_sales,
            COALESCE(r.refund_events_count, 0)::int AS refund_events_count,
            COALESCE(r.refunds_effective, 0)::text AS refunds_effective,
            COALESCE(r.refunds_reported, 0)::text AS refunds_reported,
            COALESCE(r.refunds_line_items_amount, 0)::text AS refunds_line_items_amount,
            COALESCE(r.refunds_line_items_gross_amount, 0)::text AS refunds_line_items_gross_amount,
            COALESCE(r.refunds_line_items_tax_amount, 0)::text AS refunds_line_items_tax_amount,
            COALESCE(r.refunds_shipping_amount, 0)::text AS refunds_shipping_amount,
            COALESCE(r.refunds_shipping_tax_amount, 0)::text AS refunds_shipping_tax_amount,
            COALESCE(r.refunds_duties_amount, 0)::text AS refunds_duties_amount,
            COALESCE(r.refunds_order_adjustments_amount, 0)::text AS refunds_order_adjustments_amount,
            COALESCE(r.refunds_order_adjustments_tax_amount, 0)::text AS refunds_order_adjustments_tax_amount,
            (COALESCE(r.refunds_line_items_gross_amount, 0) - COALESCE(r.refunds_line_items_amount, 0))::text AS returns_uplift
        FROM processed p
        FULL OUTER JOIN refunds r ON r.shopify_order_id = p.shopify_order_id
        ORDER BY
            (COALESCE(r.refunds_line_items_gross_amount, 0) - COALESCE(r.refunds_line_items_amount, 0)) DESC,
            COALESCE(r.refunds_line_items_gross_amount, 0) DESC,
            COALESCE(p.shopify_order_id, r.shopify_order_id) ASC
        LIMIT ${limit}
    `);

    const totalsResult = await db.execute(sql`
        WITH processed AS (
            SELECT
                oi.shopify_order_id,
                (oi.income_bruto - oi.shipping_amount + oi.discount_amount)::numeric AS order_gross_sales
            FROM order_income_v1 oi
            WHERE ${processedPredicate}
                AND oi.processed_at >= ${startUtc}
                AND oi.processed_at <= ${endUtc}
        ),
        refunds AS (
            SELECT
                rf.shopify_order_id,
                COALESCE(SUM(rf.refund_line_items_amount), 0)::numeric AS refunds_line_items_amount,
                COALESCE(SUM(rf.refund_line_items_gross_amount), 0)::numeric AS refunds_line_items_gross_amount
            FROM order_refund_event_v1 rf
            INNER JOIN order_income_v1 oi ON oi.shopify_order_id = rf.shopify_order_id
            WHERE ${refundsPredicate}
                AND rf.refund_created_at >= ${startUtc}
                AND rf.refund_created_at <= ${endUtc}
            GROUP BY rf.shopify_order_id
        )
        SELECT
            COUNT(*) FILTER (WHERE p.shopify_order_id IS NOT NULL)::int AS processed_orders_count,
            COUNT(*) FILTER (WHERE r.shopify_order_id IS NOT NULL)::int AS refunded_orders_count,
            COALESCE(SUM(COALESCE(p.order_gross_sales, 0)), 0)::text AS processed_gross_sales_total,
            COALESCE(SUM(COALESCE(r.refunds_line_items_amount, 0)), 0)::text AS returns_net_total,
            COALESCE(SUM(COALESCE(r.refunds_line_items_gross_amount, 0)), 0)::text AS returns_gross_total,
            COALESCE(SUM(COALESCE(r.refunds_line_items_gross_amount, 0) - COALESCE(r.refunds_line_items_amount, 0)), 0)::text AS returns_uplift_total
        FROM processed p
        FULL OUTER JOIN refunds r ON r.shopify_order_id = p.shopify_order_id
    `);

    const rows =
        (rowsResult as { rows: Record<string, unknown>[] }).rows?.map((r) => ({
            shopifyOrderId: String(r.shopify_order_id ?? ""),
            processedInRange: Boolean(r.processed_in_range),
            refundsInRange: Boolean(r.refunds_in_range),
            excluded: Boolean(r.excluded),
            excludedReason:
                r.excluded_reason == null ? null : String(r.excluded_reason),
            orderIncomeBruto: toMoneyString(r.order_income_bruto),
            orderShippingAmount: toMoneyString(r.order_shipping_amount),
            orderTaxAmount: toMoneyString(r.order_tax_amount),
            orderDiscountAmount: toMoneyString(r.order_discount_amount),
            orderGrossSales: toMoneyString(r.order_gross_sales),
            refundEventsCount: Number(r.refund_events_count ?? 0),
            refundsEffective: toMoneyString(r.refunds_effective),
            refundsReported: toMoneyString(r.refunds_reported),
            refundsLineItemsAmount: toMoneyString(r.refunds_line_items_amount),
            refundsLineItemsGrossAmount: toMoneyString(
                r.refunds_line_items_gross_amount,
            ),
            refundsLineItemsTaxAmount: toMoneyString(
                r.refunds_line_items_tax_amount,
            ),
            refundsShippingAmount: toMoneyString(r.refunds_shipping_amount),
            refundsShippingTaxAmount: toMoneyString(
                r.refunds_shipping_tax_amount,
            ),
            refundsDutiesAmount: toMoneyString(r.refunds_duties_amount),
            refundsOrderAdjustmentsAmount: toMoneyString(
                r.refunds_order_adjustments_amount,
            ),
            refundsOrderAdjustmentsTaxAmount: toMoneyString(
                r.refunds_order_adjustments_tax_amount,
            ),
            returnsUplift: toMoneyString(r.returns_uplift),
        })) ?? [];

    const totalsRow =
        (totalsResult as { rows: Record<string, unknown>[] }).rows?.[0] ?? {};

    return {
        totals: {
            processedOrdersCount: Number(totalsRow.processed_orders_count ?? 0),
            refundedOrdersCount: Number(totalsRow.refunded_orders_count ?? 0),
            processedGrossSalesTotal: toMoneyString(
                totalsRow.processed_gross_sales_total,
            ),
            returnsNetTotal: toMoneyString(totalsRow.returns_net_total),
            returnsGrossTotal: toMoneyString(totalsRow.returns_gross_total),
            returnsUpliftTotal: toMoneyString(totalsRow.returns_uplift_total),
        },
        rows,
    };
}

export interface ShopifyCanonicalParityResult {
    ordersCreatedInRange: number;
    orderMoney: {
        subtotalTotal: string;
        discountsTotal: string;
        shippingTotal: string;
        taxTotal: string;
    };
    createdRefundsInRange: {
        refundEventsCount: number;
        lineItemsAmount: string;
        lineItemsGross: string;
        lineItemsTax: string;
        shipping: string;
        shippingTax: string;
        duties: string;
        orderAdjustments: string;
        orderAdjustmentsTax: string;
    };
    metrics: {
        grossSales: string;
        discounts: string;
        returns: string;
        netSales: string;
        shippingCharges: string;
        returnFees: string;
        taxes: string;
        totalSales: string;
    };
}

export async function getShopifyCanonicalParity(params: {
    startUtc: Date;
    endUtc: Date;
    includeExcluded: boolean;
    shopifyqlMetrics?: {
        orders: number;
        grossSales: number;
        discounts: number;
        returns: number;
        netSales: number;
        shippingCharges: number;
        taxes: number;
        totalSales: number;
    } | null;
}): Promise<ShopifyCanonicalParityResult> {
    const { startUtc, endUtc, includeExcluded, shopifyqlMetrics } = params;
    // Order count: include cancelled, exclude only test (and deleted if present). When includeExcluded=true, count all in range.
    const orderCountPredicate = includeExcluded
        ? sql`TRUE`
        : sql`(excluded = false OR excluded_reason = 'cancelled' OR excluded_reason = 'fully_refunded')`;
    const refundOrderPredicate = includeExcluded
        ? sql`TRUE`
        : sql`(oi_rf.excluded_reason IS DISTINCT FROM 'test')`;
    // Financial metrics: only non-cancelled, non-test (match Shopify Analytics: do NOT exclude fully_refunded).
    // So we do not filter by excluded here — only by cancelled and test from payload.
    const notCancelledPredicate = sql`(
        (payload->>'cancelledAt' IS NULL OR TRIM(COALESCE(payload->>'cancelledAt', '')) = '' OR LOWER(TRIM(COALESCE(payload->>'cancelledAt', ''))) = 'null')
        AND (payload->>'canceledAt' IS NULL OR TRIM(COALESCE(payload->>'canceledAt', '')) = '' OR LOWER(TRIM(COALESCE(payload->>'canceledAt', ''))) = 'null')
    )`;
    const result = await db.execute(sql`
        WITH processed_orders AS (
            SELECT
                raw.payload,
                oi.excluded,
                oi.excluded_reason
            FROM order_income_v1 oi
            INNER JOIN shopify_order_raw raw ON raw.shopify_order_id = oi.shopify_order_id
            WHERE oi.processed_at >= ${startUtc}
                AND oi.processed_at <= ${endUtc}
        ),
        order_counts AS (
            SELECT
                COUNT(*) FILTER (WHERE ${orderCountPredicate})::int AS orders_processed_in_range
            FROM processed_orders
        ),
        financial_orders AS (
            SELECT
                payload
            FROM processed_orders
            WHERE ${notCancelledPredicate}
            AND (payload->>'test' IS NULL OR payload->>'test' = 'false')
        ),
        order_money AS (
            SELECT
                COALESCE(SUM(COALESCE(NULLIF(payload->'currentSubtotalPriceSet'->'shopMoney'->>'amount', ''), '0')::numeric), 0)::text AS subtotal_total,
                COALESCE(SUM(COALESCE(NULLIF(payload->'currentTotalDiscountsSet'->'shopMoney'->>'amount', ''), '0')::numeric), 0)::text AS discounts_total,
                COALESCE(SUM(COALESCE(NULLIF(payload->'currentShippingPriceSet'->'shopMoney'->>'amount', ''), '0')::numeric), 0)::text AS shipping_total,
                COALESCE(SUM(COALESCE(NULLIF(payload->'currentTotalTaxSet'->'shopMoney'->>'amount', ''), '0')::numeric), 0)::text AS tax_total
            FROM financial_orders
        ),
        created_refunds AS (
            SELECT
                COUNT(*)::int AS refund_events_count,
                COALESCE(SUM(rf.refund_line_items_amount), 0)::text AS line_items_amount,
                COALESCE(SUM(rf.refund_line_items_gross_amount), 0)::text AS line_items_gross,
                COALESCE(SUM(rf.refund_effective_amount), 0)::text AS effective_total,
                COALESCE(SUM(rf.refund_line_items_tax_amount), 0)::text AS line_items_tax,
                COALESCE(SUM(rf.refund_shipping_amount), 0)::text AS shipping,
                COALESCE(SUM(rf.refund_shipping_tax_amount), 0)::text AS shipping_tax,
                COALESCE(SUM(rf.refund_duties_amount), 0)::text AS duties,
                COALESCE(SUM(rf.refund_order_adjustments_amount), 0)::text AS order_adjustments,
                COALESCE(SUM(rf.refund_order_adjustments_tax_amount), 0)::text AS order_adjustments_tax
            FROM order_refund_event_v1 rf
            INNER JOIN order_income_v1 oi_rf ON oi_rf.shopify_order_id = rf.shopify_order_id
            WHERE ${refundOrderPredicate}
                AND rf.refund_created_at >= ${startUtc}
                AND rf.refund_created_at <= ${endUtc}
        )
        SELECT
            oc.orders_processed_in_range,
            om.subtotal_total,
            om.discounts_total,
            om.shipping_total,
            om.tax_total,

            cr.refund_events_count AS created_refund_events_count,
            cr.line_items_amount AS created_line_items_amount,
            cr.line_items_gross AS created_line_items_gross,
            cr.effective_total AS created_effective_total,
            cr.line_items_tax AS created_line_items_tax,
            cr.shipping AS created_shipping,
            cr.shipping_tax AS created_shipping_tax,
            cr.duties AS created_duties,
            cr.order_adjustments AS created_order_adjustments,
            cr.order_adjustments_tax AS created_order_adjustments_tax,

            (COALESCE(om.subtotal_total::numeric, 0) + COALESCE(om.discounts_total::numeric, 0))::text AS total_base_gross_sales,
            (COALESCE(om.subtotal_total::numeric, 0) - COALESCE(cr.line_items_amount::numeric, 0))::text AS total_base_with_created_returns_net_sales,
            (COALESCE(om.shipping_total::numeric, 0) - COALESCE(cr.shipping::numeric, 0))::text AS total_base_shipping_charges,
            (COALESCE(om.tax_total::numeric, 0)
                - COALESCE(cr.line_items_tax::numeric, 0)
                - COALESCE(cr.shipping_tax::numeric, 0)
                - COALESCE(cr.duties::numeric, 0)
                - COALESCE(cr.order_adjustments_tax::numeric, 0))::text AS total_base_taxes,

            (0 - COALESCE(om.discounts_total::numeric, 0))::text AS total_base_discounts_signed,
            (0 - COALESCE(cr.line_items_amount::numeric, 0))::text AS created_returns_signed,
            GREATEST(COALESCE(cr.order_adjustments::numeric, 0), 0)::text AS created_return_fees
        FROM order_counts oc
        CROSS JOIN order_money om
        CROSS JOIN created_refunds cr
    `);

    const row = (result as { rows: Record<string, unknown>[] }).rows?.[0] ?? {};

    const sumToFixed6 = (...vals: unknown[]): string => {
        const total = vals.reduce<number>(
            (acc, v) => acc + Number(v ?? 0),
            0,
        );
        return total.toFixed(6);
    };

    const useShopifyQL = shopifyqlMetrics != null;

    const grossSales = useShopifyQL
        ? shopifyqlMetrics.grossSales.toFixed(6)
        : toMoneyString(row.total_base_gross_sales);
    const discounts = useShopifyQL
        ? shopifyqlMetrics.discounts.toFixed(6)
        : toMoneyString(row.total_base_discounts_signed);
    const returns = useShopifyQL
        ? shopifyqlMetrics.returns.toFixed(6)
        : toMoneyString(row.created_returns_signed);
    const shippingCharges = useShopifyQL
        ? shopifyqlMetrics.shippingCharges.toFixed(6)
        : toMoneyString(row.total_base_shipping_charges);
    const taxes = useShopifyQL
        ? shopifyqlMetrics.taxes.toFixed(6)
        : toMoneyString(row.total_base_taxes);
    const netSales = useShopifyQL
        ? shopifyqlMetrics.netSales.toFixed(6)
        : toMoneyString(row.total_base_with_created_returns_net_sales);
    const totalSales = useShopifyQL
        ? shopifyqlMetrics.totalSales.toFixed(6)
        : sumToFixed6(netSales, shippingCharges, taxes);

    const metrics = {
        grossSales,
        discounts,
        returns,
        netSales,
        shippingCharges,
        returnFees: toMoneyString(row.created_return_fees),
        taxes,
        totalSales,
    };

    return {
        ordersCreatedInRange: useShopifyQL
            ? shopifyqlMetrics.orders
            : Number(row.orders_processed_in_range ?? 0),
        orderMoney: {
            subtotalTotal: toMoneyString(row.subtotal_total),
            discountsTotal: toMoneyString(row.discounts_total),
            shippingTotal: toMoneyString(row.shipping_total),
            taxTotal: toMoneyString(row.tax_total),
        },
        createdRefundsInRange: {
            refundEventsCount: Number(row.created_refund_events_count ?? 0),
            lineItemsAmount: toMoneyString(row.created_line_items_amount),
            lineItemsGross: toMoneyString(row.created_line_items_gross),
            lineItemsTax: toMoneyString(row.created_line_items_tax),
            shipping: toMoneyString(row.created_shipping),
            shippingTax: toMoneyString(row.created_shipping_tax),
            duties: toMoneyString(row.created_duties),
            orderAdjustments: toMoneyString(row.created_order_adjustments),
            orderAdjustmentsTax: toMoneyString(row.created_order_adjustments_tax),
        },
        metrics,
    };
}
