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
    processedAt: row.processedAt instanceof Date ? row.processedAt : new Date(String(row.processedAt)),
    currencyCode: String(row.currencyCode ?? ""),
    excluded: Boolean(row.excluded),
    excludedReason: row.excludedReason != null ? String(row.excludedReason) : null,
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
    incomeBruto: string;
    refunds: string;
    incomeNeto: string;
    shippingAmount: string;
    taxAmount: string;
    discountAmount: string;
    ordersIncluded: number;
    ordersExcludedInRange: number;
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
    })
  );

  const summaryResult = await db
    .select({
      currencyCode: sql<string>`MAX(${orderIncomeV1.currencyCode})`,
      incomeBruto: sql<string>`COALESCE(SUM(${orderIncomeV1.incomeBruto}), 0)::text`,
      refunds: sql<string>`COALESCE(SUM(${orderIncomeV1.refunds}), 0)::text`,
      incomeNeto: sql<string>`COALESCE(SUM(${orderIncomeV1.incomeNeto}), 0)::text`,
      shippingAmount: sql<string>`COALESCE(SUM(${orderIncomeV1.shippingAmount}), 0)::text`,
      taxAmount: sql<string>`COALESCE(SUM(${orderIncomeV1.taxAmount}), 0)::text`,
      discountAmount: sql<string>`COALESCE(SUM(${orderIncomeV1.discountAmount}), 0)::text`,
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
      incomeBruto: s ? toMoneyString(s.incomeBruto) : "0.000000",
      refunds: s ? toMoneyString(s.refunds) : "0.000000",
      incomeNeto: s ? toMoneyString(s.incomeNeto) : "0.000000",
      shippingAmount: s ? toMoneyString(s.shippingAmount) : "0.000000",
      taxAmount: s ? toMoneyString(s.taxAmount) : "0.000000",
      discountAmount: s ? toMoneyString(s.discountAmount) : "0.000000",
      ordersIncluded: total,
      ordersExcludedInRange,
    },
  };
}

export async function getOrderByShopifyOrderId(
  shopifyOrderId: string
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
    topRefundedOrders: Array<{ shopifyOrderId: string; refunds: string; incomeBruto: string }>;
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
      lineItemsSubtotal: sql<string>`COALESCE(SUM(${orderIncomeV1.lineItemsSubtotal}), 0)::text`,
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
    .where(and(whereIncluded, sql`${orderIncomeV1.refunds} > ${orderIncomeV1.incomeBruto}`));

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
      incomeBruto: totalsRow ? toMoneyString(totalsRow.incomeBruto) : "0.000000",
      refunds: totalsRow ? toMoneyString(totalsRow.refunds) : "0.000000",
      incomeNeto: totalsRow ? toMoneyString(totalsRow.incomeNeto) : "0.000000",
      shippingAmount: totalsRow ? toMoneyString(totalsRow.shippingAmount) : "0.000000",
      taxAmount: totalsRow ? toMoneyString(totalsRow.taxAmount) : "0.000000",
      discountAmount: totalsRow ? toMoneyString(totalsRow.discountAmount) : "0.000000",
      lineItemsSubtotal: totalsRow ? toMoneyString(totalsRow.lineItemsSubtotal) : "0.000000",
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
