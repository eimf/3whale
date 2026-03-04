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

function subMoneyAmounts(left: Money, right: Money): Money {
    if (left.currencyCode !== right.currencyCode) {
        throw new Error(
            `Currency mismatch: expected ${left.currencyCode}, got ${right.currencyCode}. Never mix currencies in a sum.`,
        );
    }
    return {
        amount: toCanonicalDecimalString(
            new Decimal(left.amount).minus(right.amount).toString(),
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

function refundLineItemsTaxAmount(
    refundNode: RefundNode,
    currencyCode: string,
): Money {
    const edges = refundNode.refundLineItems?.edges ?? [];
    if (edges.length === 0) {
        return zeroMoney(currencyCode);
    }
    return edges.reduce((acc, edge) => {
        const tax = shopMoneyToMoney(edge.node.totalTaxSet, currencyCode);
        return addMoneyAmounts(acc, tax);
    }, zeroMoney(currencyCode));
}

function refundLineItemsGrossAmount(
    refundNode: RefundNode,
    currencyCode: string,
): Money {
    const edges = refundNode.refundLineItems?.edges ?? [];
    if (edges.length === 0) {
        return zeroMoney(currencyCode);
    }

    return edges.reduce((acc, edge) => {
        const refundQty = edge.node.quantity ?? 0;
        const lineItemQty = edge.node.lineItem?.quantity ?? refundQty;
        const originalTotal = shopMoneyToMoney(
            edge.node.lineItem?.originalTotalSet,
            currencyCode,
        );
        const fallbackNet = shopMoneyToMoney(
            edge.node.subtotalSet,
            currencyCode,
        );

        if (
            lineItemQty <= 0 ||
            refundQty <= 0 ||
            new Decimal(originalTotal.amount).eq(0)
        ) {
            return addMoneyAmounts(acc, fallbackNet);
        }

        const proratedOriginal = new Decimal(originalTotal.amount)
            .mul(refundQty)
            .div(lineItemQty)
            .toString();

        return addMoneyAmounts(acc, {
            amount: toCanonicalDecimalString(proratedOriginal),
            currencyCode,
        });
    }, zeroMoney(currencyCode));
}

function refundShippingSubtotalAmount(
    refundNode: RefundNode,
    currencyCode: string,
): Money {
    const edges = refundNode.refundShippingLines?.edges ?? [];
    if (edges.length === 0) {
        return zeroMoney(currencyCode);
    }
    return edges.reduce((acc, edge) => {
        // Shopify Analytics uses amountSet for "shipping refund" (amount refunded).
        // Prefer amountSet when present for parity; fall back to subtotalAmountSet.
        const amountSet = edge.node.amountSet;
        const subtotalSet = edge.node.subtotalAmountSet;
        const set = amountSet ?? subtotalSet;
        const amount = shopMoneyToMoney(set, currencyCode);
        return addMoneyAmounts(acc, amount);
    }, zeroMoney(currencyCode));
}

function refundShippingTaxAmount(
    refundNode: RefundNode,
    currencyCode: string,
): Money {
    const edges = refundNode.refundShippingLines?.edges ?? [];
    if (edges.length === 0) {
        return zeroMoney(currencyCode);
    }
    return edges.reduce((acc, edge) => {
        const tax = shopMoneyToMoney(edge.node.taxAmountSet, currencyCode);
        return addMoneyAmounts(acc, tax);
    }, zeroMoney(currencyCode));
}

function refundOrderAdjustmentsAmount(
    refundNode: RefundNode,
    currencyCode: string,
): Money {
    const edges = refundNode.orderAdjustments?.edges ?? [];
    if (edges.length === 0) {
        return zeroMoney(currencyCode);
    }
    return edges.reduce((acc, edge) => {
        const amount = shopMoneyToMoney(edge.node.amountSet, currencyCode);
        return addMoneyAmounts(acc, amount);
    }, zeroMoney(currencyCode));
}

function refundOrderAdjustmentsTaxAmount(
    refundNode: RefundNode,
    currencyCode: string,
): Money {
    const edges = refundNode.orderAdjustments?.edges ?? [];
    if (edges.length === 0) {
        return zeroMoney(currencyCode);
    }
    return edges.reduce((acc, edge) => {
        const tax = shopMoneyToMoney(edge.node.taxAmountSet, currencyCode);
        return addMoneyAmounts(acc, tax);
    }, zeroMoney(currencyCode));
}

function refundDutiesAmount(
    refundNode: RefundNode,
    currencyCode: string,
): Money {
    const duties = refundNode.duties ?? [];
    if (duties.length === 0) {
        return zeroMoney(currencyCode);
    }
    return duties.reduce((acc, duty) => {
        const amount = shopMoneyToMoney(duty.amountSet, currencyCode);
        return addMoneyAmounts(acc, amount);
    }, zeroMoney(currencyCode));
}

function refundTransactionsAmount(
    refundNode: RefundNode,
    currencyCode: string,
): Money {
    const edges = refundNode.transactions?.edges ?? [];
    if (edges.length === 0) {
        return zeroMoney(currencyCode);
    }

    return edges.reduce((acc, edge) => {
        const kind = (edge.node.kind ?? "").toUpperCase();
        const status = (edge.node.status ?? "").toUpperCase();
        if (kind !== "REFUND" || status !== "SUCCESS") {
            return acc;
        }
        const amount = shopMoneyToMoney(edge.node.amountSet, currencyCode);
        if (new Decimal(amount.amount).lte(0)) {
            return acc;
        }
        return addMoneyAmounts(acc, amount);
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
            const reportedAmount = shopMoneyToMoney(
                node.totalRefundedSet,
                currencyCode,
            );
            const lineItemsAmount = refundLineItemsSubtotalAmount(
                node,
                currencyCode,
            );
            const lineItemsGrossAmount = refundLineItemsGrossAmount(
                node,
                currencyCode,
            );
            const lineItemsTaxAmount = refundLineItemsTaxAmount(
                node,
                currencyCode,
            );
            const shippingAmount = refundShippingSubtotalAmount(
                node,
                currencyCode,
            );
            const shippingTaxAmount = refundShippingTaxAmount(
                node,
                currencyCode,
            );
            const dutiesAmount = refundDutiesAmount(node, currencyCode);
            const orderAdjustmentsAmount = refundOrderAdjustmentsAmount(
                node,
                currencyCode,
            );
            const orderAdjustmentsTaxAmount = refundOrderAdjustmentsTaxAmount(
                node,
                currencyCode,
            );
            const transactionsAmount = refundTransactionsAmount(
                node,
                currencyCode,
            );
            const adjustmentAmount = subMoneyAmounts(
                reportedAmount,
                lineItemsAmount,
            );
            const componentsAmount = [
                lineItemsAmount,
                lineItemsTaxAmount,
                shippingAmount,
                shippingTaxAmount,
                dutiesAmount,
                orderAdjustmentsAmount,
                orderAdjustmentsTaxAmount,
            ].reduce(
                (acc, m) => addMoneyAmounts(acc, m),
                zeroMoney(currencyCode),
            );

            const amount = new Decimal(reportedAmount.amount).gt(0)
                ? reportedAmount
                : new Decimal(componentsAmount.amount).gt(0)
                  ? componentsAmount
                  : new Decimal(transactionsAmount.amount).gt(0)
                    ? transactionsAmount
                    : reportedAmount;

            const totalTaxRefund = [
                lineItemsTaxAmount,
                shippingTaxAmount,
                dutiesAmount,
                orderAdjustmentsTaxAmount,
            ].reduce(
                (acc, m) => addMoneyAmounts(acc, m),
                zeroMoney(currencyCode),
            );
            const returnsKpiAmount =
                new Decimal(reportedAmount.amount).gt(0)
                    ? subMoneyAmounts(
                          subMoneyAmounts(reportedAmount, shippingAmount),
                          totalTaxRefund,
                      )
                    : addMoneyAmounts(
                          lineItemsAmount,
                          orderAdjustmentsAmount,
                      );

            return {
                id: node.id,
                createdAt: node.createdAt,
                reportedAmount,
                lineItemsAmount,
                lineItemsGrossAmount,
                lineItemsTaxAmount,
                shippingAmount,
                shippingTaxAmount,
                dutiesAmount,
                orderAdjustmentsAmount,
                orderAdjustmentsTaxAmount,
                transactionsAmount,
                adjustmentAmount,
                amount,
                returnsKpiAmount,
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
