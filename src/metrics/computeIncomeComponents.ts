/**
 * Income components computation (v1). Per docs/metrics/income_v1_contract.md.
 * - income_bruto = lineItemsSubtotal + shippingAmount (tax excluded by design; subtotal already after discounts).
 * - income_neto = income_bruto − refunds.
 * - Tax is reported but excluded from income. Currency = shop currency only; no FX.
 */

import {
    addMoney,
    subMoney,
    zeroMoney,
    assertSameCurrency,
    cmpMoney,
    type Money,
} from "./money";
import {
    ShopifyOrderNormalizedSchema,
    ShopifyRefundNormalizedSchema,
    type ShopifyOrderNormalized,
    type ShopifyRefundNormalized,
} from "./shopifyOrderTypes";

export type IncomeComponents = {
    currencyCode: string;
    line_items_subtotal: Money;
    shipping_amount: Money;
    tax_amount: Money;
    discount_amount: Money;
    income_bruto: Money;
    refunds: Money;
    income_neto: Money;
};

/**
 * Validates order and refunds with Zod, asserts all Money share the same currency,
 * then computes components. lineItemsSubtotal is net-of-discount; taxes are excluded from income_bruto.
 */
export function computeIncomeComponents(
    order: ShopifyOrderNormalized,
    refunds: ShopifyRefundNormalized[],
): IncomeComponents {
    const parsedOrder = ShopifyOrderNormalizedSchema.parse(order);
    const parsedRefunds = refunds.map((r) =>
        ShopifyRefundNormalizedSchema.parse(r),
    );

    const currencyCode = parsedOrder.currencyCode;
    const orderMoneyFields: Money[] = [
        parsedOrder.lineItemsSubtotal,
        parsedOrder.shippingAmount,
        parsedOrder.taxAmount,
        parsedOrder.discountAmount,
    ];
    for (const m of orderMoneyFields) {
        assertSameCurrency(m, { amount: "0", currencyCode });
    }
    for (const r of parsedRefunds) {
        assertSameCurrency(r.amount, { amount: "0", currencyCode });
    }

    const refundsSum =
        parsedRefunds.length === 0
            ? zeroMoney(currencyCode)
            : parsedRefunds.reduce(
                  (acc, r) => addMoney(acc, r.amount),
                  zeroMoney(currencyCode),
              );

    // income_bruto = subtotal (after discounts) + shipping; tax excluded by design
    const income_bruto = addMoney(
        parsedOrder.lineItemsSubtotal,
        parsedOrder.shippingAmount,
    );
    const income_neto = subMoney(income_bruto, refundsSum);

    return {
        currencyCode,
        // Canonical order revenue used by API/UI is aligned to Shopify-like net sales behavior.
        line_items_subtotal: income_neto,
        shipping_amount: parsedOrder.shippingAmount,
        tax_amount: parsedOrder.taxAmount,
        discount_amount: parsedOrder.discountAmount,
        income_bruto,
        refunds: refundsSum,
        income_neto,
    };
}

export function shouldExcludeOrderV1(
    order: ShopifyOrderNormalized,
    refunds: ShopifyRefundNormalized[],
): { exclude: boolean; reason?: "cancelled" | "test" | "fully_refunded" } {
    if (order.cancelledAt != null && order.cancelledAt !== "") {
        return { exclude: true, reason: "cancelled" };
    }
    if (order.isTest === true) {
        return { exclude: true, reason: "test" };
    }
    const components = computeIncomeComponents(order, refunds);
    if (cmpMoney(components.refunds, components.income_bruto) >= 0) {
        return { exclude: true, reason: "fully_refunded" };
    }
    return { exclude: false };
}
