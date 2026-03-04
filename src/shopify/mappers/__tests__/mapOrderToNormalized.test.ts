/**
 * End-to-end: fixture → mapOrderToNormalized → computeIncomeComponents.
 * Validates Shopify field mapping for income v1 (no DB, no network).
 * Single source of truth: docs/metrics/income_v1_contract.md and Step 2 calculator.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { mapOrderToNormalized } from "../mapOrderToNormalized";
import { computeIncomeComponents } from "../../../metrics/computeIncomeComponents";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "../../fixtures");

function loadFixture(name: string): unknown {
    const raw = readFileSync(path.join(FIXTURES_DIR, name), "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (Array.isArray(parsed.refunds)) return parsed;
    const refundsConnection = parsed.refunds as
        | { nodes?: unknown[] }
        | undefined;
    return {
        ...parsed,
        refunds: Array.isArray(refundsConnection?.nodes)
            ? refundsConnection.nodes
            : [],
    };
}

describe("mapOrderToNormalized + computeIncomeComponents (fixtures)", () => {
    it("normal order: subtotal 1000, shipping 100, tax 160, discount 0, refunds [] → income_bruto 1100, refunds 0, income_neto 1100 MXN", () => {
        const fixture = loadFixture("order_normal.graphql.json");
        const { order, refunds } = mapOrderToNormalized(fixture);
        const c = computeIncomeComponents(order, refunds);

        expect(order.lineItemsSubtotal.amount).toBe("1000");
        expect(order.shippingAmount.amount).toBe("100");
        expect(order.taxAmount.amount).toBe("160");
        expect(order.discountAmount.amount).toBe("0");
        expect(refunds).toHaveLength(0);

        expect(c.income_bruto.amount).toBe("1100");
        expect(c.refunds.amount).toBe("0");
        expect(c.income_neto.amount).toBe("1100");
        expect(c.currencyCode).toBe("MXN");
    });

    it("discount order: subtotal 900 (net), shipping 100, tax 160, discount 100, refunds [] → income_bruto 1000, income_neto 1000 MXN", () => {
        const fixture = loadFixture("order_discount.graphql.json");
        const { order, refunds } = mapOrderToNormalized(fixture);
        const c = computeIncomeComponents(order, refunds);

        expect(order.lineItemsSubtotal.amount).toBe("900");
        expect(order.shippingAmount.amount).toBe("100");
        expect(order.taxAmount.amount).toBe("160");
        expect(order.discountAmount.amount).toBe("100");
        expect(refunds).toHaveLength(0);

        expect(c.income_bruto.amount).toBe("1000");
        expect(c.refunds.amount).toBe("0");
        expect(c.income_neto.amount).toBe("1000");
        expect(c.currencyCode).toBe("MXN");
    });

    it("partial refund: subtotal 1000, shipping 100, tax 160, discount 0, refunds [200] → income_bruto 1100, refunds 200, income_neto 900 MXN", () => {
        const fixture = loadFixture("order_partial_refund.graphql.json");
        const { order, refunds } = mapOrderToNormalized(fixture);
        const c = computeIncomeComponents(order, refunds);

        expect(order.lineItemsSubtotal.amount).toBe("1000");
        expect(order.shippingAmount.amount).toBe("100");
        expect(order.taxAmount.amount).toBe("160");
        expect(order.discountAmount.amount).toBe("0");
        expect(refunds).toHaveLength(1);
        expect(refunds[0].amount.amount).toBe("200");

        expect(c.income_bruto.amount).toBe("1100");
        expect(c.refunds.amount).toBe("200");
        expect(c.income_neto.amount).toBe("900");
        expect(c.currencyCode).toBe("MXN");
    });
});

describe("mapOrderToNormalized currency mismatch", () => {
    it("throws a clear error when order has mixed currencies (e.g. shipping in USD)", () => {
        const fixture = loadFixture("order_normal.graphql.json") as Record<
            string,
            unknown
        >;
        // Override shipping to USD to simulate mixed-currency payload
        fixture.currentShippingPriceSet = {
            shopMoney: { amount: "100.00", currencyCode: "USD" },
        };

        expect(() => mapOrderToNormalized(fixture)).toThrow(
            /Currency mismatch.*expected MXN.*got USD|Never mix currencies/,
        );
    });
});

describe("mapOrderToNormalized refund fallback", () => {
    it("uses refundLineItems subtotalSet when totalRefundedSet is zero", () => {
        const fixture = loadFixture(
            "order_partial_refund.graphql.json",
        ) as Record<string, unknown>;

        fixture.refunds = [
            {
                id: "gid://shopify/Refund/fallback-1",
                createdAt: "2026-02-28T17:37:02Z",
                totalRefundedSet: {
                    shopMoney: { amount: "0.0", currencyCode: "MXN" },
                },
                refundLineItems: {
                    edges: [
                        {
                            node: {
                                quantity: 1,
                                subtotalSet: {
                                    shopMoney: {
                                        amount: "599.0",
                                        currencyCode: "MXN",
                                    },
                                },
                            },
                        },
                    ],
                },
            },
        ];

        const { refunds } = mapOrderToNormalized(fixture);
        expect(refunds).toHaveLength(1);
        expect(refunds[0].amount.amount).toBe("599");
    });

    it("uses successful REFUND transactions when reported/components are zero", () => {
        const fixture = loadFixture(
            "order_partial_refund.graphql.json",
        ) as Record<string, unknown>;

        fixture.refunds = [
            {
                id: "gid://shopify/Refund/tx-fallback-1",
                createdAt: "2026-02-28T17:37:02Z",
                totalRefundedSet: {
                    shopMoney: { amount: "0.0", currencyCode: "MXN" },
                },
                refundLineItems: { edges: [] },
                refundShippingLines: { edges: [] },
                orderAdjustments: { edges: [] },
                duties: [],
                transactions: {
                    edges: [
                        {
                            node: {
                                id: "gid://shopify/OrderTransaction/1",
                                kind: "REFUND",
                                status: "SUCCESS",
                                amountSet: {
                                    shopMoney: {
                                        amount: "700.0",
                                        currencyCode: "MXN",
                                    },
                                },
                            },
                        },
                        {
                            node: {
                                id: "gid://shopify/OrderTransaction/2",
                                kind: "REFUND",
                                status: "PENDING",
                                amountSet: {
                                    shopMoney: {
                                        amount: "90.0",
                                        currencyCode: "MXN",
                                    },
                                },
                            },
                        },
                    ],
                },
            },
        ];

        const { refunds } = mapOrderToNormalized(fixture);
        expect(refunds).toHaveLength(1);
        expect(refunds[0].transactionsAmount.amount).toBe("700");
        expect(refunds[0].amount.amount).toBe("700");
    });

    it("computes gross line-items refund from original line item total, pro-rated by refunded quantity", () => {
        const fixture = loadFixture(
            "order_partial_refund.graphql.json",
        ) as Record<string, unknown>;

        fixture.refunds = [
            {
                id: "gid://shopify/Refund/gross-1",
                createdAt: "2026-02-28T17:37:02Z",
                totalRefundedSet: {
                    shopMoney: { amount: "500.0", currencyCode: "MXN" },
                },
                refundLineItems: {
                    edges: [
                        {
                            node: {
                                quantity: 1,
                                subtotalSet: {
                                    shopMoney: {
                                        amount: "500.0",
                                        currencyCode: "MXN",
                                    },
                                },
                                lineItem: {
                                    id: "gid://shopify/LineItem/1",
                                    quantity: 2,
                                    originalTotalSet: {
                                        shopMoney: {
                                            amount: "1200.0",
                                            currencyCode: "MXN",
                                        },
                                    },
                                },
                            },
                        },
                    ],
                },
            },
        ];

        const { refunds } = mapOrderToNormalized(fixture);
        expect(refunds).toHaveLength(1);
        expect(refunds[0].lineItemsAmount.amount).toBe("500");
        expect(refunds[0].lineItemsGrossAmount?.amount).toBe("600");
    });
});
