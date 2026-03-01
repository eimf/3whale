import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const limit = vi.fn();
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const execute = vi.fn();
    return { limit, where, from, select, execute };
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
        syncRunLog: { id: "id" },
    };
});

function sqlChunksToText(value: unknown): string {
    const walk = (node: unknown): string => {
        if (node == null) return "";
        if (typeof node === "string" || typeof node === "number") {
            return String(node);
        }
        if (Array.isArray(node)) {
            return node.map(walk).join("");
        }
        if (typeof node === "object") {
            const maybeQueryChunks = (node as { queryChunks?: unknown })
                .queryChunks;
            if (maybeQueryChunks !== undefined) {
                return walk(maybeQueryChunks);
            }
            const maybeValue = (node as { value?: unknown }).value;
            if (maybeValue !== undefined) {
                return walk(maybeValue);
            }
        }
        return "";
    };

    return walk(value).replace(/\s+/g, " ").trim();
}

describe("GET /internal/income/daily-v2 contract (hour buckets)", () => {
    beforeEach(() => {
        vi.resetModules();
        mocks.select.mockClear();
        mocks.from.mockClear();
        mocks.where.mockClear();
        mocks.limit.mockClear();
        mocks.execute.mockClear();

        mocks.limit.mockResolvedValue([
            {
                id: "singleton",
                timezoneIana: "America/Mexico_City",
            },
        ]);

        mocks.execute.mockResolvedValue({ rows: [] });
    });

    afterEach(() => {
        delete process.env.INTERNAL_API_KEY;
    });

    it("returns 24 sorted shop-local naive hourly buckets for a single local day", async () => {
        process.env.INTERNAL_API_KEY = "test-internal-key";

        const { registerInternalRoutes } =
            await import("../routes/internal.js");
        const app = Fastify();
        await registerInternalRoutes(app);

        const response = await app.inject({
            method: "GET",
            url: "/internal/income/daily-v2?from=2026-02-28&to=2026-02-28",
            headers: {
                "x-internal-api-key": "test-internal-key",
            },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as {
            granularity: string;
            data: Array<{ date: string }>;
        };

        expect(payload.granularity).toBe("hour");
        expect(payload.data.length).toBe(24);

        const bucketKeys = payload.data.map((point) => point.date);

        expect(bucketKeys[0]).toMatch(/T00:00:00$/);
        expect(bucketKeys[bucketKeys.length - 1]).toMatch(/T23:00:00$/);

        for (const bucketKey of bucketKeys) {
            expect(bucketKey).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00$/);
            expect(bucketKey).not.toContain("Z");
            expect(bucketKey).not.toContain("+");
            expect(bucketKey).not.toMatch(/[+-]\d{2}:\d{2}$/);
        }

        const sorted = [...bucketKeys].sort((a, b) => a.localeCompare(b));
        expect(bucketKeys).toEqual(sorted);

        await app.close();
    });

    it("returns continuous zero-filled local day buckets and continuous comparison buckets", async () => {
        process.env.INTERNAL_API_KEY = "test-internal-key";

        mocks.execute
            .mockResolvedValueOnce({
                rows: [
                    {
                        date: "2026-02-25",
                        orders_count: 1,
                        line_items_subtotal: "100.000000",
                        income_bruto: "90.000000",
                        refunds: "0",
                        income_neto: "90.000000",
                        shipping_amount: "10.000000",
                        tax_amount: "0",
                        discount_amount: "0",
                    },
                    {
                        date: "2026-02-26",
                        orders_count: 0,
                        line_items_subtotal: "0",
                        income_bruto: "0",
                        refunds: "0",
                        income_neto: "0",
                        shipping_amount: "0",
                        tax_amount: "0",
                        discount_amount: "0",
                    },
                    {
                        date: "2026-02-27",
                        orders_count: 0,
                        line_items_subtotal: "0",
                        income_bruto: "0",
                        refunds: "0",
                        income_neto: "0",
                        shipping_amount: "0",
                        tax_amount: "0",
                        discount_amount: "0",
                    },
                    {
                        date: "2026-02-28",
                        orders_count: 0,
                        line_items_subtotal: "0",
                        income_bruto: "0",
                        refunds: "0",
                        income_neto: "0",
                        shipping_amount: "0",
                        tax_amount: "0",
                        discount_amount: "0",
                    },
                ],
            })
            .mockResolvedValueOnce({
                rows: [
                    {
                        date: "2026-02-21",
                        orders_count: 0,
                        line_items_subtotal: "0",
                        income_bruto: "0",
                        refunds: "0",
                        income_neto: "0",
                        shipping_amount: "0",
                        tax_amount: "0",
                        discount_amount: "0",
                    },
                    {
                        date: "2026-02-22",
                        orders_count: 0,
                        line_items_subtotal: "0",
                        income_bruto: "0",
                        refunds: "0",
                        income_neto: "0",
                        shipping_amount: "0",
                        tax_amount: "0",
                        discount_amount: "0",
                    },
                    {
                        date: "2026-02-23",
                        orders_count: 0,
                        line_items_subtotal: "0",
                        income_bruto: "0",
                        refunds: "0",
                        income_neto: "0",
                        shipping_amount: "0",
                        tax_amount: "0",
                        discount_amount: "0",
                    },
                    {
                        date: "2026-02-24",
                        orders_count: 0,
                        line_items_subtotal: "0",
                        income_bruto: "0",
                        refunds: "0",
                        income_neto: "0",
                        shipping_amount: "0",
                        tax_amount: "0",
                        discount_amount: "0",
                    },
                ],
            });

        const { registerInternalRoutes } =
            await import("../routes/internal.js");
        const app = Fastify();
        await registerInternalRoutes(app);

        const response = await app.inject({
            method: "GET",
            url: "/internal/income/daily-v2?from=2026-02-25&to=2026-02-28&compare=1",
            headers: {
                "x-internal-api-key": "test-internal-key",
            },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as {
            granularity: string;
            data: Array<{
                date: string;
                ordersCount: number;
                orderRevenue: { raw: string };
                incomeBruto: { raw: string };
                refunds: { raw: string };
                incomeNeto: { raw: string };
                shippingAmount: { raw: string };
                taxAmount: { raw: string };
                discountAmount: { raw: string };
            }>;
            comparison?: Array<{ date: string }>;
        };

        expect(payload.granularity).toBe("day");
        expect(payload.data.length).toBe(4);

        const dayKeys = payload.data.map((point) => point.date);
        expect(dayKeys).toEqual([
            "2026-02-25",
            "2026-02-26",
            "2026-02-27",
            "2026-02-28",
        ]);

        for (const dayKey of dayKeys) {
            expect(dayKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(dayKey).not.toContain("T");
            expect(dayKey).not.toContain("Z");
            expect(dayKey).not.toMatch(/[+-]\d{2}:\d{2}$/);
        }

        const missingDays = payload.data.slice(1);
        for (const point of missingDays) {
            expect(point.ordersCount).toBe(0);
            expect(point.orderRevenue.raw).toMatch(/^0(?:\.0+)?$/);
            expect(point.incomeBruto.raw).toMatch(/^0(?:\.0+)?$/);
            expect(point.refunds.raw).toMatch(/^0(?:\.0+)?$/);
            expect(point.incomeNeto.raw).toMatch(/^0(?:\.0+)?$/);
            expect(point.shippingAmount.raw).toMatch(/^0(?:\.0+)?$/);
            expect(point.taxAmount.raw).toMatch(/^0(?:\.0+)?$/);
            expect(point.discountAmount.raw).toMatch(/^0(?:\.0+)?$/);
        }

        expect(payload.comparison).toBeDefined();
        expect(payload.comparison?.map((point) => point.date)).toEqual([
            "2026-02-21",
            "2026-02-22",
            "2026-02-23",
            "2026-02-24",
        ]);

        await app.close();
    });

    it("respects includeExcluded query param in aggregation filter", async () => {
        process.env.INTERNAL_API_KEY = "test-internal-key";

        const { registerInternalRoutes } =
            await import("../routes/internal.js");
        const app = Fastify();
        await registerInternalRoutes(app);

        mocks.execute.mockClear();
        await app.inject({
            method: "GET",
            url: "/internal/income/daily-v2?from=2026-02-28&to=2026-02-28",
            headers: {
                "x-internal-api-key": "test-internal-key",
            },
        });

        const defaultSqlText = sqlChunksToText(
            mocks.execute.mock.calls[0]?.[0],
        );
        expect(defaultSqlText).toContain("excluded = false");

        mocks.execute.mockClear();
        await app.inject({
            method: "GET",
            url: "/internal/income/daily-v2?from=2026-02-28&to=2026-02-28&includeExcluded=true",
            headers: {
                "x-internal-api-key": "test-internal-key",
            },
        });

        const includeExcludedSqlText = sqlChunksToText(
            mocks.execute.mock.calls[0]?.[0],
        );
        expect(includeExcludedSqlText).not.toContain("excluded = false");
        expect(includeExcludedSqlText).toContain("WHERE TRUE");

        await app.close();
    });
});
