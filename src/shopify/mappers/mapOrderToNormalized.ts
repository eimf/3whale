/**
 * Maps Shopify Admin GraphQL Order node (ordersForIncomeV1 shape) to normalized types
 * for Step 2 calculator. Single source of truth: docs/metrics/income_v1_contract.md.
 *
 * In v1 we assume currentSubtotalPriceSet is already net-of-discounts. discountAmount
 * is exposed for breakdown and reconciliation only—do not subtract it again in the calculator.
 */

import Decimal from "decimal.js";
import type { Money } from "../../metrics/money";
import type {
    ShopifyOrderNormalized,
    ShopifyRefundNormalized,
} from "../../metrics/shopifyOrderTypes";
import {
    OrderNodeForIncomeV1Schema,
    type MoneySet,
    type RefundNode,
} from "./shopifyAdminGraphqlSchemas";

const DECIMAL_STRING_REGEX = /^-?\d+(\.\d+)?$/;
const INTERNAL_DECIMALS = 20;

/** Canonical decimal string: no floats; no scientific notation; trim trailing zeros. */
function toCanonicalDecimalString(value: string): string {
    const trimmed = value.trim();
    if (!DECIMAL_STRING_REGEX.test(trimmed)) {
        throw new Error(`Invalid decimal amount: "${value}"`);
    }
    const d = new Decimal(trimmed);
    const fixed = d.toFixed(INTERNAL_DECIMALS);
    if (fixed.includes(".")) {
        return fixed.replace(/\.?0+$/, "") || "0";
    }
    return fixed;
}

function shopMoneyToMoney(
    set: MoneySet | null | undefined,
    currencyCode: string,
): Money {
    if (!set?.shopMoney) {
        return { amount: "0", currencyCode };
    }
    const { amount, currencyCode: code } = set.shopMoney;
    if (code !== currencyCode) {
        throw new Error(
            `Currency mismatch: expected ${currencyCode}, got ${code} (amount: ${amount}). Never mix currencies in a sum.`,
        );
    }
    return { amount: toCanonicalDecimalString(amount), currencyCode };
}

function zeroMoney(currencyCode: string): Money {
    return { amount: "0", currencyCode };
}

function addMoneyAmounts(left: Money, right: Money): Money {
    if (left.currencyCode !== right.currencyCode) {
        throw new Error(
            `Currency mismatch: expected ${left.currencyCode}, got ${right.currencyCode}. Never mix currencies in a sum.`,
        );
    }
    return {
        amount: toCanonicalDecimalString(
            new Decimal(left.amount).plus(right.amount).toString(),
        ),
        currencyCode: left.currencyCode,
    };
}

function refundLineItemsSubtotalAmount(
    refundNode: RefundNode,
    currencyCode: string,
): Money {
    const edges = refundNode.refundLineItems?.edges ?? [];
    if (edges.length === 0) {
        return zeroMoney(currencyCode);
    }
    return edges.reduce((acc, edge) => {
        const subtotal = shopMoneyToMoney(edge.node.subtotalSet, currencyCode);
        return addMoneyAmounts(acc, subtotal);
    }, zeroMoney(currencyCode));
}

/**
 * Validates orderNode with OrderNodeForIncomeV1Schema, maps to Money (decimal strings only),
 * asserts all order and refund amounts use the same currency, then returns normalized order + refunds.
 */
export function mapOrderToNormalized(orderNode: unknown): {
    order: ShopifyOrderNormalized;
    refunds: ShopifyRefundNormalized[];
} {
    const order = OrderNodeForIncomeV1Schema.parse(orderNode);

    if (!order.processedAt) {
        throw new Error(
            "Order is missing processedAt (paid-day timestamp for v1).",
        );
    }

    const subtotalSet = order.currentSubtotalPriceSet;
    if (!subtotalSet?.shopMoney) {
        throw new Error(
            "Order is missing currentSubtotalPriceSet.shopMoney (required for lineItemsSubtotal).",
        );
    }

    const currencyCode = subtotalSet.shopMoney.currencyCode;
    const lineItemsSubtotal = shopMoneyToMoney(
        order.currentSubtotalPriceSet,
        currencyCode,
    );
    const shippingAmount = shopMoneyToMoney(
        order.currentShippingPriceSet,
        currencyCode,
    );
    const taxAmount = shopMoneyToMoney(order.currentTotalTaxSet, currencyCode);
    const discountAmount = shopMoneyToMoney(
        order.currentTotalDiscountsSet,
        currencyCode,
    );

    const refunds: ShopifyRefundNormalized[] = (order.refunds ?? []).map(
        (node: RefundNode) => {
            const totalRefunded = shopMoneyToMoney(
                node.totalRefundedSet,
                currencyCode,
            );
            const refundLineItemsSubtotal = refundLineItemsSubtotalAmount(
                node,
                currencyCode,
            );
            const amount =
                new Decimal(totalRefunded.amount).eq(0) &&
                new Decimal(refundLineItemsSubtotal.amount).gt(0)
                    ? refundLineItemsSubtotal
                    : totalRefunded;
            return {
                id: node.id,
                createdAt: node.createdAt,
                amount,
            };
        },
    );

    const normalizedOrder: ShopifyOrderNormalized = {
        id: order.id,
        processedAt: order.processedAt,
        currencyCode,
        isTest: order.test ?? false,
        cancelledAt: order.cancelledAt ?? undefined,
        lineItemsSubtotal,
        shippingAmount,
        taxAmount,
        discountAmount,
    };

    return { order: normalizedOrder, refunds };
}
