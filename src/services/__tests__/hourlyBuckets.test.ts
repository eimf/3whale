import { describe, expect, it } from "vitest";
import { ensureContinuousHourlyBuckets } from "../hourlyBuckets";

const TZ = "America/Mexico_City";

describe("ensureContinuousHourlyBuckets", () => {
    it("returns 24 buckets for a single local day with first T00:00:00 and last T23:00:00", () => {
        const startUtc = new Date("2026-02-28T06:00:00.000Z");
        const endUtc = new Date("2026-03-01T05:59:59.999Z");

        const points = ensureContinuousHourlyBuckets(
            [],
            startUtc,
            endUtc,
            TZ,
            (bucketKey) => ({
                date: bucketKey,
                ordersCount: 0,
                orderRevenue: { raw: "0.000000", display: "0.00" },
                incomeBruto: { raw: "0.000000", display: "0.00" },
                refunds: { raw: "0.000000", display: "0.00" },
                incomeNeto: { raw: "0.000000", display: "0.00" },
                shippingAmount: { raw: "0.000000", display: "0.00" },
                taxAmount: { raw: "0.000000", display: "0.00" },
                discountAmount: { raw: "0.000000", display: "0.00" },
            }),
        );

        expect(points).toHaveLength(24);
        expect(points[0]?.date).toBe("2026-02-28T00:00:00");
        expect(points[23]?.date).toBe("2026-02-28T23:00:00");
    });

    it("preserves existing buckets and zero-fills gaps", () => {
        const startUtc = new Date("2026-02-28T06:00:00.000Z");
        const endUtc = new Date("2026-03-01T05:59:59.999Z");

        const points = ensureContinuousHourlyBuckets(
            [
                {
                    date: "2026-02-28T03:00:00",
                    ordersCount: 2,
                    orderRevenue: { raw: "10.000000", display: "10.00" },
                    incomeBruto: { raw: "10.000000", display: "10.00" },
                    refunds: { raw: "0.000000", display: "0.00" },
                    incomeNeto: { raw: "10.000000", display: "10.00" },
                    shippingAmount: { raw: "0.000000", display: "0.00" },
                    taxAmount: { raw: "0.000000", display: "0.00" },
                    discountAmount: { raw: "0.000000", display: "0.00" },
                },
            ],
            startUtc,
            endUtc,
            TZ,
            (bucketKey) => ({
                date: bucketKey,
                ordersCount: 0,
                orderRevenue: { raw: "0.000000", display: "0.00" },
                incomeBruto: { raw: "0.000000", display: "0.00" },
                refunds: { raw: "0.000000", display: "0.00" },
                incomeNeto: { raw: "0.000000", display: "0.00" },
                shippingAmount: { raw: "0.000000", display: "0.00" },
                taxAmount: { raw: "0.000000", display: "0.00" },
                discountAmount: { raw: "0.000000", display: "0.00" },
            }),
        );

        expect(points[3]?.date).toBe("2026-02-28T03:00:00");
        expect(points[3]?.ordersCount).toBe(2);
        expect(points[4]?.date).toBe("2026-02-28T04:00:00");
        expect(points[4]?.ordersCount).toBe(0);
    });
});
