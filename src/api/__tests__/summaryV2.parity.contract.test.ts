import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const limit = vi.fn();
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const execute = vi.fn();

    const listOrders = vi.fn();
    const getShopifyCanonicalParity = vi.fn();

    return {
        limit,
        where,
        from,
        select,
        execute,
        listOrders,
        getShopifyCanonicalParity,
    };
});

vi.mock("../../db/index.js", () => {
    return {
        db: {
            select: mocks.select,
            execute: mocks.execute,
        },
        shopConfig: { id: "id" },
        syncState: { id: "id" },
        shopifyOrderRaw: { id: "id" },
        orderIncomeV1: { id: "id" },
        orderRefundEventV1: { id: "id" },
        syncRunLog: { id: "id" },
    };
});

vi.mock("../../services/incomeQueries.js", () => {
    return {
        listOrders: mocks.listOrders,
        getShopifyCanonicalParity: mocks.getShopifyCanonicalParity,
    };
});

describe("GET /internal/income/summary-v2 parity invariants", () => {
    beforeEach(() => {
        vi.resetModules();
        mocks.select.mockClear();
        mocks.from.mockClear();
        mocks.where.mockClear();
        mocks.limit.mockClear();
        mocks.execute.mockClear();
        mocks.listOrders.mockClear();
        mocks.getShopifyCanonicalParity.mockClear();

        mocks.limit.mockResolvedValue([
            {
                id: "singleton",
                timezoneIana: "America/Mexico_City",
                currencyCode: "MXN",
            },
        ]);

        mocks.execute.mockResolvedValue({
            rows: [
                {
                    refunds_total: "0.000000",
                    refunds_reported: "0.000000",
                    refunds_from_line_items: "0.000000",
                    refunds_from_line_items_gross: "0.000000",
                    refunds_adjustments: "0.000000",
                    refunds_line_items_tax: "0.000000",
                    refunds_shipping: "0.000000",
                    refunds_shipping_tax: "0.000000",
                    refunds_duties: "0.000000",
                    refunds_order_adjustments: "0.000000",
                    refunds_order_adjustments_tax: "0.000000",
                },
            ],
        });

        mocks.listOrders.mockResolvedValue({
            summary: {
                lineItemsSubtotal: "100.000000",
                incomeBruto: "100.000000",
                incomeNeto: "100.000000",
                shippingAmount: "0.000000",
                taxAmount: "0.000000",
                discountAmount: "0.000000",
                ordersIncluded: 1,
                ordersExcludedInRange: 0,
                currencyCode: "MXN",
            },
        });

        mocks.getShopifyCanonicalParity.mockResolvedValue({
            ordersCreatedInRange: 1,
            orderMoney: {
                subtotalTotal: "100.000000",
                discountsTotal: "0.000000",
                shippingTotal: "0.000000",
                taxTotal: "0.000000",
            },
            createdRefundsInRange: {
                refundEventsCount: 0,
                lineItemsAmount: "0.000000",
                lineItemsGross: "0.000000",
                lineItemsTax: "0.000000",
                shipping: "0.000000",
                shippingTax: "0.000000",
                duties: "0.000000",
                orderAdjustments: "0.000000",
                orderAdjustmentsTax: "0.000000",
            },
            metrics: {
                grossSales: "33.000000",
                discounts: "-3.000000",
                returns: "-3.000000",
                netSales: "30.000000",
                shippingCharges: "0.000000",
                returnFees: "0.000000",
                taxes: "0.000000",
                totalSales: "30.000000",
            },
        });
    });

    afterEach(() => {
        delete process.env.INTERNAL_API_KEY;
    });

    it("rejects unknown summary-v2 query keys", async () => {
        process.env.INTERNAL_API_KEY = "test-internal-key";
        const { registerInternalRoutes } =
            await import("../routes/internal.js");
        const app = Fastify();
        await registerInternalRoutes(app);

        const response = await app.inject({
            method: "GET",
            url: "/internal/income/summary-v2?from=2026-02-28&to=2026-02-28&parityModel=legacy",
            headers: {
                "x-internal-api-key": "test-internal-key",
            },
        });

        expect(response.statusCode).toBe(400);
        const payload = response.json() as { error?: string };
        expect(payload.error).toBe("Invalid query");

        await app.close();
    });

    it("always returns canonical Shopify parity model and canonical signed parity values", async () => {
        process.env.INTERNAL_API_KEY = "test-internal-key";
        const { registerInternalRoutes } =
            await import("../routes/internal.js");
        const app = Fastify();
        await registerInternalRoutes(app);

        const response = await app.inject({
            method: "GET",
            url: "/internal/income/summary-v2?from=2026-02-28&to=2026-02-28&includeExcluded=true",
            headers: {
                "x-internal-api-key": "test-internal-key",
            },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as {
            shopifyParityModel?: string;
            shopifyParity?: {
                totalSales?: { raw?: string };
                discounts?: { raw?: string };
                returns?: { raw?: string };
            };
            shopifyParityCandidates?: unknown;
        };

        expect(payload.shopifyParityModel).toBe("total_base_created_returns");
        expect(payload.shopifyParity?.totalSales?.raw).toBe("30.000000");
        expect(payload.shopifyParity?.discounts?.raw).toBe("-3.000000");
        expect(payload.shopifyParity?.returns?.raw).toBe("-3.000000");
        expect(payload.shopifyParityCandidates).toBeUndefined();

        await app.close();
    });
});
