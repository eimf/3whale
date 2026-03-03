import { describe, expect, it, vi, beforeEach } from "vitest";

const execute = vi.fn();

vi.mock("../../db/index.js", () => {
    return {
        db: {
            execute,
        },
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

describe("getShopifyCanonicalParity", () => {
    beforeEach(() => {
        execute.mockReset();
    });

    it("uses order processedAt attribution with cancelled-order exclusion for financials, and refund createdAt for returns", async () => {
        execute.mockResolvedValue({
            rows: [
                {
                    orders_processed_in_range: 1,
                    subtotal_total: "100.000000",
                    discounts_total: "10.000000",
                    shipping_total: "5.000000",
                    tax_total: "0.000000",
                    created_refund_events_count: 1,
                    created_line_items_amount: "2.000000",
                    created_line_items_gross: "2.000000",
                    created_line_items_tax: "0.000000",
                    created_shipping: "1.000000",
                    created_shipping_tax: "0.000000",
                    created_duties: "0.000000",
                    created_order_adjustments: "0.000000",
                    created_order_adjustments_tax: "0.000000",
                    total_base_gross_sales: "110.000000",
                    total_base_with_created_returns_net_sales: "98.000000",
                    total_base_shipping_charges: "4.000000",
                    total_base_taxes: "0.000000",
                    total_base_discounts_signed: "-10.000000",
                    created_returns_signed: "-2.000000",
                    created_return_fees: "0.000000",
                },
            ],
        });

        const { getShopifyCanonicalParity } = await import(
            "../incomeQueries.js"
        );

        await getShopifyCanonicalParity({
            startUtc: new Date("2026-02-28T06:00:00.000Z"),
            endUtc: new Date("2026-03-01T05:59:59.999Z"),
            includeExcluded: false,
        });

        const sqlText = sqlChunksToText(execute.mock.calls[0]?.[0]);
        expect(sqlText).toContain("oi.processed_at >=");
        expect(sqlText).toContain("oi.processed_at <=");
        expect(sqlText).toContain("excluded_reason = 'cancelled'");
        expect(sqlText).toContain("payload->>'cancelledAt'");
        expect(sqlText).toContain("payload->>'canceledAt'");
        expect(sqlText).toContain("= 'null'"); // treat string "null" as no cancellation
        expect(sqlText).toContain("payload->>'test'");
        expect(sqlText).toContain("rf.refund_created_at >=");
        expect(sqlText).toContain("rf.refund_created_at <=");
    });

    it("returns signed discounts/returns and totalSales formula aligned to Shopify semantics", async () => {
        execute.mockResolvedValue({
            rows: [
                {
                    orders_processed_in_range: 169,
                    subtotal_total: "299182.500000",
                    discounts_total: "126096.100000",
                    shipping_total: "13547.000000",
                    tax_total: "0.000000",
                    created_refund_events_count: 5,
                    created_line_items_amount: "9304.300000",
                    created_line_items_gross: "9304.300000",
                    created_line_items_tax: "0.000000",
                    created_shipping: "0.000000",
                    created_shipping_tax: "0.000000",
                    created_duties: "0.000000",
                    created_order_adjustments: "0.000000",
                    created_order_adjustments_tax: "0.000000",
                    total_base_gross_sales: "425278.600000",
                    total_base_with_created_returns_net_sales: "289878.200000",
                    total_base_shipping_charges: "13547.000000",
                    total_base_taxes: "0.000000",
                    total_base_discounts_signed: "-126096.100000",
                    created_returns_signed: "-9304.300000",
                    created_return_fees: "0.400000",
                },
            ],
        });

        const { getShopifyCanonicalParity } = await import(
            "../incomeQueries.js"
        );

        const result = await getShopifyCanonicalParity({
            startUtc: new Date("2026-02-28T06:00:00.000Z"),
            endUtc: new Date("2026-03-01T05:59:59.999Z"),
            includeExcluded: true,
        });

        expect(result.metrics.grossSales).toBe("425278.600000");
        expect(result.metrics.discounts).toBe("-126096.100000");
        expect(result.metrics.returns).toBe("-9304.300000");
        expect(result.metrics.netSales).toBe("289878.200000");
        expect(result.metrics.shippingCharges).toBe("13547.000000");
        expect(result.metrics.returnFees).toBe("0.400000");
        expect(result.metrics.taxes).toBe("0.000000");
        expect(result.metrics.totalSales).toBe("303425.600000");
    });
});
