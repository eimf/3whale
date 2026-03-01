import { DateTime } from "luxon";

export type HourlyBucketPoint = {
    date: string;
    ordersCount: number;
    orderRevenue: { raw: string; display: string };
    incomeBruto: { raw: string; display: string };
    refunds: { raw: string; display: string };
    incomeNeto: { raw: string; display: string };
    shippingAmount: { raw: string; display: string };
    taxAmount: { raw: string; display: string };
    discountAmount: { raw: string; display: string };
};

export function ensureContinuousHourlyBuckets(
    points: HourlyBucketPoint[],
    startUtc: Date,
    endUtc: Date,
    timezone: string,
    makeZeroPoint: (bucketKey: string) => HourlyBucketPoint,
): HourlyBucketPoint[] {
    const startLocal = DateTime.fromJSDate(startUtc)
        .setZone(timezone)
        .startOf("hour");
    const endLocal = DateTime.fromJSDate(endUtc)
        .setZone(timezone)
        .startOf("hour");

    const byBucket = new Map<string, HourlyBucketPoint>(
        points.map((p) => [p.date.slice(0, 19), p]),
    );

    const output: HourlyBucketPoint[] = [];
    for (
        let cursor = startLocal;
        cursor <= endLocal;
        cursor = cursor.plus({ hours: 1 })
    ) {
        const bucketKey = cursor.toFormat("yyyy-LL-dd'T'HH:00:00");
        output.push(byBucket.get(bucketKey) ?? makeZeroPoint(bucketKey));
    }

    return output;
}
