/**
 * Tests for v1 income components. See docs/metrics/income_v1_contract.md.
 * All fixtures in MXN. lineItemsSubtotal is net-of-discount; tax reported but excluded from income.
 */

import { describe, it, expect } from "vitest";
import { addMoney } from "../money";
import {
    computeIncomeComponents,
    shouldExcludeOrderV1,
} from "../computeIncomeComponents";
import type {
    ShopifyOrderNormalized,
    ShopifyRefundNormalized,
} from "../shopifyOrderTypes";

const MXN = "MXN";
const iso = "2024-01-15T12:00:00.000Z";

function order(
    overrides: Partial<ShopifyOrderNormalized>,
): ShopifyOrderNormalized {
    return {
        id: "gid://shopify/Order/1",
        processedAt: iso,
        currencyCode: MXN,
        lineItemsSubtotal: { amount: "0", currencyCode: MXN },
        shippingAmount: { amount: "0", currencyCode: MXN },
        taxAmount: { amount: "0", currencyCode: MXN },
        discountAmount: { amount: "0", currencyCode: MXN },
        ...overrides,
    };
}

function refund(amount: string, id = "r1"): ShopifyRefundNormalized {
    return {
        id: `gid://shopify/Refund/${id}`,
        createdAt: iso,
        amount: { amount, currencyCode: MXN },
    };
}

describe("computeIncomeComponents", () => {
    it("normal order: bruto = subtotal + shipping, neto = bruto, tax reported", () => {
        const o = order({
            lineItemsSubtotal: { amount: "1000", currencyCode: MXN },
            shippingAmount: { amount: "100", currencyCode: MXN },
            taxAmount: { amount: "160", currencyCode: MXN },
            discountAmount: { amount: "0", currencyCode: MXN },
        });
        const c = computeIncomeComponents(o, []);
        expect(c.income_bruto.amount).toBe("1100");
        expect(c.income_neto.amount).toBe("1100");
        expect(c.refunds.amount).toBe("0");
        expect(c.tax_amount.amount).toBe("160");
    });

    it("discounted order (subtotal already net of discount): bruto 1000, neto 1000", () => {
        const o = order({
            lineItemsSubtotal: { amount: "900", currencyCode: MXN },
            shippingAmount: { amount: "100", currencyCode: MXN },
            taxAmount: { amount: "160", currencyCode: MXN },
            discountAmount: { amount: "100", currencyCode: MXN },
        });
        const c = computeIncomeComponents(o, []);
        expect(c.income_bruto.amount).toBe("1000");
        expect(c.income_neto.amount).toBe("1000");
    });

    it("partial refund: bruto 1100, refunds 200, neto 900", () => {
        const o = order({
            lineItemsSubtotal: { amount: "1000", currencyCode: MXN },
            shippingAmount: { amount: "100", currencyCode: MXN },
            taxAmount: { amount: "160", currencyCode: MXN },
            discountAmount: { amount: "0", currencyCode: MXN },
        });
        const c = computeIncomeComponents(o, [refund("200")]);
        expect(c.income_bruto.amount).toBe("1100");
        expect(c.refunds.amount).toBe("200");
        expect(c.income_neto.amount).toBe("900");
    });

    it("order revenue canonical component is line_items_subtotal aligned to income_neto", () => {
        const o = order({
            lineItemsSubtotal: { amount: "850", currencyCode: MXN },
            shippingAmount: { amount: "150", currencyCode: MXN },
            taxAmount: { amount: "160", currencyCode: MXN },
            discountAmount: { amount: "50", currencyCode: MXN },
        });
        const c = computeIncomeComponents(o, [refund("100")]);

        expect(c.line_items_subtotal.amount).toBe("900");
        expect(c.income_neto.amount).toBe("900");
        expect(c.shipping_amount.amount).toBe("150");
        expect(c.tax_amount.amount).toBe("160");
        expect(c.refunds.amount).toBe("100");
    });

    it("order revenue includes shipping and subtracts refunds (Shopify-aligned)", () => {
        const o = order({
            lineItemsSubtotal: { amount: "850", currencyCode: MXN },
            shippingAmount: { amount: "150", currencyCode: MXN },
            taxAmount: { amount: "160", currencyCode: MXN },
            discountAmount: { amount: "50", currencyCode: MXN },
        });

        const c = computeIncomeComponents(o, [refund("100")]);
        expect(c.line_items_subtotal.amount).toBe("900");
        expect(c.refunds.amount).toBe("100");
    });

    it("refunds change canonical order revenue (line_items_subtotal)", () => {
        const o = order({
            lineItemsSubtotal: { amount: "1000", currencyCode: MXN },
            shippingAmount: { amount: "100", currencyCode: MXN },
            taxAmount: { amount: "160", currencyCode: MXN },
            discountAmount: { amount: "40", currencyCode: MXN },
        });

        const noRefund = computeIncomeComponents(o, []);
        const withRefund = computeIncomeComponents(o, [refund("250")]);

        expect(noRefund.line_items_subtotal.amount).toBe("1100");
        expect(withRefund.line_items_subtotal.amount).toBe("850");
        expect(withRefund.income_neto.amount).toBe("850");
    });

    it("currency mismatch throws", () => {
        const o = order({
            currencyCode: "USD",
            lineItemsSubtotal: { amount: "1000", currencyCode: "USD" },
            shippingAmount: { amount: "100", currencyCode: "USD" },
            taxAmount: { amount: "160", currencyCode: "USD" },
            discountAmount: { amount: "0", currencyCode: "USD" },
        });
        // refund("200") is MXN; order is USD
        expect(() => computeIncomeComponents(o, [refund("200")])).toThrow(
            /Currency mismatch/,
        );
    });
});

describe("shouldExcludeOrderV1", () => {
    it("excludes when cancelled", () => {
        const o = order({ cancelledAt: "2024-01-16T00:00:00.000Z" });
        expect(shouldExcludeOrderV1(o, [])).toEqual({
            exclude: true,
            reason: "cancelled",
        });
    });

    it("excludes when test", () => {
        const o = order({ isTest: true });
        expect(shouldExcludeOrderV1(o, [])).toEqual({
            exclude: true,
            reason: "test",
        });
    });

    it("excludes when fully refunded (refunds = bruto)", () => {
        const o = order({
            lineItemsSubtotal: { amount: "1000", currencyCode: MXN },
            shippingAmount: { amount: "100", currencyCode: MXN },
            taxAmount: { amount: "0", currencyCode: MXN },
            discountAmount: { amount: "0", currencyCode: MXN },
        });
        const refs = [refund("1100")];
        expect(shouldExcludeOrderV1(o, refs)).toEqual({
            exclude: true,
            reason: "fully_refunded",
        });
    });

    it("does not exclude when partial refund", () => {
        const o = order({
            lineItemsSubtotal: { amount: "1000", currencyCode: MXN },
            shippingAmount: { amount: "100", currencyCode: MXN },
            taxAmount: { amount: "0", currencyCode: MXN },
            discountAmount: { amount: "0", currencyCode: MXN },
        });
        expect(shouldExcludeOrderV1(o, [refund("100")])).toEqual({
            exclude: false,
        });
    });
});

describe("decimal library (no float trap)", () => {
    it("addMoney(0.1, 0.2) equals 0.3 exactly (decimal string)", () => {
        const a = { amount: "0.1", currencyCode: MXN };
        const b = { amount: "0.2", currencyCode: MXN };
        const sum = addMoney(a, b);
        expect(sum.amount).toBe("0.3");
    });
});
