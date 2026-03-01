import Decimal from "decimal.js";

export type DeltaDirection = "up" | "down" | "flat";

export type DeltaItem = {
    percentChange: number | null;
    direction: DeltaDirection;
};

export function computeDeltaPercent(
    current: string | number,
    previous: string | number,
): DeltaItem {
    const c = new Decimal(current);
    const p = new Decimal(previous);

    if (p.isZero()) {
        if (c.isZero()) return { percentChange: 0, direction: "flat" };
        return {
            percentChange: null,
            direction: c.gt(0) ? "up" : "down",
        };
    }

    const percent = c
        .minus(p)
        .div(p)
        .times(100)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);

    return {
        percentChange: percent.toNumber(),
        direction: percent.gt(0) ? "up" : percent.lt(0) ? "down" : "flat",
    };
}

export function getPreviousPeriodLocalRange(
    from: string,
    to: string,
    _timezone: string,
): { from: string; to: string } {
    const parseDate = (value: string): Date => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            throw new Error(`Invalid local date: ${value}`);
        }
        const d = new Date(`${value}T00:00:00.000Z`);
        if (
            Number.isNaN(d.getTime()) ||
            d.toISOString().slice(0, 10) !== value
        ) {
            throw new Error(`Invalid local date: ${value}`);
        }
        return d;
    };

    const dayMs = 24 * 60 * 60 * 1000;
    const startDt = parseDate(from);
    const endDt = parseDate(to);

    if (endDt.getTime() < startDt.getTime()) {
        throw new Error(`Invalid local range order: from=${from} to=${to}`);
    }

    const spanDays =
        Math.floor((endDt.getTime() - startDt.getTime()) / dayMs) + 1;
    const endPrev = new Date(startDt.getTime() - dayMs);
    const startPrev = new Date(endPrev.getTime() - (spanDays - 1) * dayMs);

    return {
        from: startPrev.toISOString().slice(0, 10),
        to: endPrev.toISOString().slice(0, 10),
    };
}
