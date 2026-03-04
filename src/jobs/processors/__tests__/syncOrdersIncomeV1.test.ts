/**
 * Minimal test for syncOrdersIncomeV1: mocked Shopify response; optional local Postgres.
 * Run with DATABASE_URL set to test against a real DB (e.g. docker compose up then db:migrate).
 */

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { mapOrderToNormalized } from "../../../shopify/mappers/mapOrderToNormalized.js";
import {
    computeIncomeComponents,
    shouldExcludeOrderV1,
} from "../../../metrics/computeIncomeComponents.js";

const orderFixture = {
    id: "gid://shopify/Order/1001",
    processedAt: "2024-01-15T12:00:00-06:00",
    cancelledAt: null,
    test: false,
    currentSubtotalPriceSet: {
        shopMoney: { amount: "1000.00", currencyCode: "MXN" },
    },
    currentShippingPriceSet: {
        shopMoney: { amount: "100.00", currencyCode: "MXN" },
    },
    currentTotalTaxSet: {
        shopMoney: { amount: "160.00", currencyCode: "MXN" },
    },
    currentTotalDiscountsSet: {
        shopMoney: { amount: "0.00", currencyCode: "MXN" },
    },
    refunds: [],
};

describe("syncOrdersIncomeV1 (unit: mapper + calculator)", () => {
    it("computes income components from normalized order", () => {
        const { order, refunds } = mapOrderToNormalized(orderFixture);
        expect(order.currencyCode).toBe("MXN");
        const components = computeIncomeComponents(order, refunds);
        expect(components.income_bruto.amount).toBe("1100"); // 1000 + 100
        expect(components.refunds.amount).toBe("0");
        expect(components.income_neto.amount).toBe("1100");
        const exclusion = shouldExcludeOrderV1(order, refunds);
        expect(exclusion.exclude).toBe(false);
    });

    it("aggregates canonical order revenue as sum(lineItemsSubtotal) for included orders", () => {
        const fixtureA = {
            ...orderFixture,
            id: "gid://shopify/Order/2001",
            currentSubtotalPriceSet: {
                shopMoney: { amount: "900.00", currencyCode: "MXN" },
            },
            currentShippingPriceSet: {
                shopMoney: { amount: "100.00", currencyCode: "MXN" },
            },
            currentTotalTaxSet: {
                shopMoney: { amount: "160.00", currencyCode: "MXN" },
            },
            currentTotalDiscountsSet: {
                shopMoney: { amount: "100.00", currencyCode: "MXN" },
            },
        };
        const fixtureB = {
            ...orderFixture,
            id: "gid://shopify/Order/2002",
            currentSubtotalPriceSet: {
                shopMoney: { amount: "500.00", currencyCode: "MXN" },
            },
            currentShippingPriceSet: {
                shopMoney: { amount: "50.00", currencyCode: "MXN" },
            },
            currentTotalTaxSet: {
                shopMoney: { amount: "88.00", currencyCode: "MXN" },
            },
            currentTotalDiscountsSet: {
                shopMoney: { amount: "0.00", currencyCode: "MXN" },
            },
        };

        const mapped = [fixtureA, fixtureB].map((fixture) =>
            mapOrderToNormalized(fixture),
        );
        const totalOrderRevenue = mapped
            .map(({ order, refunds }) => {
                expect(shouldExcludeOrderV1(order, refunds).exclude).toBe(
                    false,
                );
                return computeIncomeComponents(order, refunds)
                    .line_items_subtotal.amount;
            })
            .reduce((acc, amount) => acc.plus(amount), new Decimal(0));

        expect(totalOrderRevenue.toString()).toBe("1550");
    });
});
