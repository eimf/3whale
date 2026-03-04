/**
 * Drizzle schema for income v1 sync (single-store).
 * Finance-safe: money as NUMERIC(20,6); raw payloads in JSONB.
 * Single source of truth: docs/metrics/income_v1_contract.md
 */

import {
    pgTable,
    uuid,
    text,
    timestamp,
    integer,
    boolean,
    jsonb,
    numeric,
    index,
} from "drizzle-orm/pg-core";

const SINGLETON_ID = "singleton";

/** timestamp with time zone (Postgres timestamptz) */
const timestamptz = (name: string) => timestamp(name, { withTimezone: true });
const numeric20_6 = { precision: 20, scale: 6 };

export const shopConfig = pgTable("shop_config", {
    id: text("id").primaryKey().default(SINGLETON_ID),
    shopDomain: text("shop_domain").notNull(),
    timezoneIana: text("timezone_iana").notNull(),
    currencyCode: text("currency_code").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

export const syncState = pgTable("sync_state", {
    id: text("id").primaryKey().default(SINGLETON_ID),
    watermarkProcessedAt: timestamptz("watermark_processed_at"),
    lastSyncStartedAt: timestamptz("last_sync_started_at"),
    lastSyncFinishedAt: timestamptz("last_sync_finished_at"),
    lastSyncStatus: text("last_sync_status"),
    lastSyncError: text("last_sync_error"),
});

export const shopifyOrderRaw = pgTable(
    "shopify_order_raw",
    {
        shopifyOrderId: text("shopify_order_id").primaryKey(),
        processedAt: timestamptz("processed_at").notNull(),
        payload: jsonb("payload").notNull(),
        createdAt: timestamptz("created_at").notNull().defaultNow(),
    },
    (t) => [index("shopify_order_raw_processed_at").on(t.processedAt)],
);

export const orderRefundEventV1 = pgTable(
    "order_refund_event_v1",
    {
        shopifyRefundId: text("shopify_refund_id").primaryKey(),
        shopifyOrderId: text("shopify_order_id").notNull(),
        refundCreatedAt: timestamptz("refund_created_at").notNull(),
        processedAt: timestamptz("processed_at").notNull(),
        currencyCode: text("currency_code").notNull(),
        refundReportedAmount: numeric(
            "refund_reported_amount",
            numeric20_6,
        ).notNull(),
        refundLineItemsAmount: numeric(
            "refund_line_items_amount",
            numeric20_6,
        ).notNull(),
        refundLineItemsGrossAmount: numeric(
            "refund_line_items_gross_amount",
            numeric20_6,
        ).notNull(),
        refundLineItemsTaxAmount: numeric(
            "refund_line_items_tax_amount",
            numeric20_6,
        ).notNull(),
        refundShippingAmount: numeric(
            "refund_shipping_amount",
            numeric20_6,
        ).notNull(),
        refundShippingTaxAmount: numeric(
            "refund_shipping_tax_amount",
            numeric20_6,
        ).notNull(),
        refundDutiesAmount: numeric(
            "refund_duties_amount",
            numeric20_6,
        ).notNull(),
        refundOrderAdjustmentsAmount: numeric(
            "refund_order_adjustments_amount",
            numeric20_6,
        ).notNull(),
        refundOrderAdjustmentsTaxAmount: numeric(
            "refund_order_adjustments_tax_amount",
            numeric20_6,
        ).notNull(),
        refundEffectiveAmount: numeric(
            "refund_effective_amount",
            numeric20_6,
        ).notNull(),
        refundAdjustmentAmount: numeric(
            "refund_adjustment_amount",
            numeric20_6,
        ).notNull(),
        payload: jsonb("payload").notNull(),
        createdAt: timestamptz("created_at").notNull().defaultNow(),
        updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    },
    (t) => [
        index("order_refund_event_v1_refund_created_at").on(t.refundCreatedAt),
        index("order_refund_event_v1_processed_at").on(t.processedAt),
        index("order_refund_event_v1_shopify_order_id").on(t.shopifyOrderId),
    ],
);

export const orderIncomeV1 = pgTable(
    "order_income_v1",
    {
        shopifyOrderId: text("shopify_order_id").primaryKey(),
        currencyCode: text("currency_code").notNull(),
        processedAt: timestamptz("processed_at").notNull(),
        lineItemsSubtotal: numeric(
            "line_items_subtotal",
            numeric20_6,
        ).notNull(),
        shippingAmount: numeric("shipping_amount", numeric20_6).notNull(),
        taxAmount: numeric("tax_amount", numeric20_6).notNull(),
        discountAmount: numeric("discount_amount", numeric20_6).notNull(),
        incomeBruto: numeric("income_bruto", numeric20_6).notNull(),
        refunds: numeric("refunds", numeric20_6).notNull(),
        incomeNeto: numeric("income_neto", numeric20_6).notNull(),
        excluded: boolean("excluded").notNull().default(false),
        excludedReason: text("excluded_reason"),
        computedAt: timestamptz("computed_at").notNull().defaultNow(),
    },
    (t) => [
        index("order_income_v1_processed_at").on(t.processedAt),
        index("order_income_v1_excluded").on(t.excluded),
    ],
);

export const syncRunLog = pgTable("sync_run_log", {
    id: uuid("id").primaryKey().defaultRandom(),
    startedAt: timestamptz("started_at").notNull(),
    finishedAt: timestamptz("finished_at"),
    status: text("status").notNull(),
    ordersFetched: integer("orders_fetched").notNull().default(0),
    ordersUpserted: integer("orders_upserted").notNull().default(0),
    ordersExcluded: integer("orders_excluded").notNull().default(0),
    lastCursor: text("last_cursor"),
    error: text("error"),
});
