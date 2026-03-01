/**
 * Build API query params for income/daily and income/summary from dashboard range state.
 * Presets "today"/"yesterday"/"lastMonth" require timezone to compute from/to.
 */

import type { RangePreset } from "@/store/dashboardSlice";

export type RangeApiParams = { days: number } | { from: string; to: string };

/** Today's date (YYYY-MM-DD) in the given IANA timezone. */
export function getTodayInTz(timezone: string): string {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    return formatter.format(new Date());
}

/** Yesterday's date (YYYY-MM-DD) in the given IANA timezone. */
export function getYesterdayInTz(timezone: string): string {
    const today = getTodayInTz(timezone);
    const d = new Date(today + "T12:00:00");
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
}

/** First and last day of previous month in the given IANA timezone. */
export function getLastMonthInTz(timezone: string): {
    from: string;
    to: string;
} {
    const now = new Date();
    const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastPrev = new Date(firstThisMonth.getTime() - 1);
    const firstPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
        from: `${firstPrev.getFullYear()}-${pad(firstPrev.getMonth() + 1)}-${pad(firstPrev.getDate())}`,
        to: `${lastPrev.getFullYear()}-${pad(lastPrev.getMonth() + 1)}-${pad(lastPrev.getDate())}`,
    };
}

export function getRangeApiParams(
    rangePreset: RangePreset | null,
    rangeCustom: { from: string; to: string } | null,
    timezoneIana: string | null,
): RangeApiParams | null {
    if (rangeCustom) {
        return { from: rangeCustom.from, to: rangeCustom.to };
    }
    if (!rangePreset) return null;
    const tz = timezoneIana ?? "America/Mexico_City";
    switch (rangePreset) {
        case "today": {
            const today = getTodayInTz(tz);
            return { from: today, to: today };
        }
        case "yesterday": {
            const yesterday = getYesterdayInTz(tz);
            return { from: yesterday, to: yesterday };
        }
        case "last7":
            return { days: 7 };
        case "last14":
            return { days: 14 };
        case "last30":
            return { days: 30 };
        case "last90":
            return { days: 90 };
        case "last365":
            return { days: 365 };
        case "lastMonth": {
            const { from, to } = getLastMonthInTz(tz);
            return { from, to };
        }
        default:
            return null;
    }
}

/** Build query string for /api/income/daily and /api/income/summary. */
export function buildRangeQueryString(
    params: RangeApiParams | null,
    compare: boolean,
): string {
    if (!params) return "days=7&includeExcluded=1";
    const sp = new URLSearchParams();
    if ("days" in params) {
        sp.set("days", String(params.days));
    } else {
        sp.set("from", params.from);
        sp.set("to", params.to);
    }
    if (compare) sp.set("compare", "1");
    sp.set("includeExcluded", "1");
    return sp.toString();
}

/**
 * Single canonical function: build request query string for summary and daily from dashboard state.
 * Use this as the only source for both /api/income/summary and /api/income/daily.
 */
export function getRequestQueryString(
    rangePreset: RangePreset | null,
    rangeCustom: { from: string; to: string } | null,
    timezoneIana: string | null,
    isComparing: boolean,
): string {
    const params = getRangeApiParams(rangePreset, rangeCustom, timezoneIana);
    return buildRangeQueryString(params, isComparing);
}
