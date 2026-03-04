/**
 * Normalized input types for Shopify orders and refunds (v1).
 * Not a full mirror of Shopify GraphQL schema — only fields needed for income computation.
 *
 * Modeling choice (income_v1_contract.md):
 * - lineItemsSubtotal represents the subtotal AFTER discounts (net). Income is "after discounts";
 *   we use this net subtotal so income_bruto = lineItemsSubtotal + shippingAmount (tax excluded).
 * - discountAmount is still provided as a component for breakdown/reporting, even though it is
 *   already reflected in lineItemsSubtotal.
 */

import { z } from "zod";
import type { Money } from "./money";

const isoDatetime = z.string().datetime({ offset: true });
const decimalString = z
    .string()
    .regex(
        /^-?\d+(\.\d+)?$/,
        "amount must be a decimal string (optional minus, digits, optional decimal part)",
    );
const currencyCode = z.string().min(1, "currencyCode must be non-empty");

const moneySchema = z.object({
    amount: decimalString,
    currencyCode,
});

/** Normalized order: all monetary components in shop currency. */
export type ShopifyOrderNormalized = {
    id: string;
    processedAt: string;
    currencyCode: string;
    isTest?: boolean;
    cancelledAt?: string | null;
    lineItemsSubtotal: Money;
    shippingAmount: Money;
    taxAmount: Money;
    discountAmount: Money;
};

export const ShopifyOrderNormalizedSchema = z.object({
    id: z.string(),
    processedAt: isoDatetime,
    currencyCode,
    isTest: z.boolean().optional(),
    cancelledAt: z.string().datetime({ offset: true }).nullable().optional(),
    lineItemsSubtotal: moneySchema,
    shippingAmount: moneySchema,
    taxAmount: moneySchema,
    discountAmount: moneySchema,
});

/** Normalized refund: amount in shop currency. Amount may be positive (refund) or negative if we ever need adjustments; v1 treats as positive refund. */
export type ShopifyRefundNormalized = {
    id: string;
    createdAt: string;
    reportedAmount: Money;
    lineItemsAmount: Money;
    lineItemsGrossAmount?: Money;
    lineItemsTaxAmount: Money;
    shippingAmount: Money;
    shippingTaxAmount: Money;
    dutiesAmount: Money;
    orderAdjustmentsAmount: Money;
    orderAdjustmentsTaxAmount: Money;
    transactionsAmount?: Money;
    adjustmentAmount: Money;
    amount: Money;
    /** For Returns KPI: totalRefunded - shipping - tax when reported > 0, else lineItems + orderAdjustments. Used as refund_effective_amount. */
    returnsKpiAmount?: Money;
};

export const ShopifyRefundNormalizedSchema = z.object({
    id: z.string(),
    createdAt: isoDatetime,
    reportedAmount: moneySchema,
    lineItemsAmount: moneySchema,
    lineItemsGrossAmount: moneySchema.optional(),
    lineItemsTaxAmount: moneySchema,
    shippingAmount: moneySchema,
    shippingTaxAmount: moneySchema,
    dutiesAmount: moneySchema,
    orderAdjustmentsAmount: moneySchema,
    orderAdjustmentsTaxAmount: moneySchema,
    transactionsAmount: moneySchema.optional(),
    adjustmentAmount: moneySchema,
    amount: moneySchema,
    returnsKpiAmount: moneySchema.optional(),
});
