import { describe, expect, it } from "vitest";
import { parseLocalDateRangeToUtc } from "../dateRange";
import {
    computeDeltaPercent,
    getPreviousPeriodLocalRange,
} from "../comparison";

const TZ = "America/Mexico_City";

describe("computeDeltaPercent", () => {
    it("returns 0 and flat when current and previous are both zero", () => {
        expect(computeDeltaPercent("0", "0")).toEqual({
            percentChange: 0,
            direction: "flat",
        });
    });

    it("returns null and up when previous is zero and current is positive", () => {
        expect(computeDeltaPercent("10", "0")).toEqual({
            percentChange: null,
            direction: "up",
        });
    });

    it("returns null and down when previous is zero and current is negative", () => {
        expect(computeDeltaPercent("-10", "0")).toEqual({
            percentChange: null,
            direction: "down",
        });
    });

    it("computes percent change with half-even rounding", () => {
        expect(computeDeltaPercent("101", "100")).toEqual({
            percentChange: 1,
            direction: "up",
        });
        expect(computeDeltaPercent("99", "100")).toEqual({
            percentChange: -1,
            direction: "down",
        });
        expect(computeDeltaPercent("100", "100")).toEqual({
            percentChange: 0,
            direction: "flat",
        });
    });
});

describe("getPreviousPeriodLocalRange", () => {
    it("today in Mexico maps to previous local day", () => {
        const prev = getPreviousPeriodLocalRange(
            "2026-02-28",
            "2026-02-28",
            TZ,
        );
        expect(prev).toEqual({ from: "2026-02-27", to: "2026-02-27" });

        const currentUtc = parseLocalDateRangeToUtc(
            "2026-02-28",
            "2026-02-28",
            TZ,
        );
        const previousUtc = parseLocalDateRangeToUtc(prev.from, prev.to, TZ);

        expect(currentUtc.startUtc.toISOString()).toBe(
            "2026-02-28T06:00:00.000Z",
        );
        expect(previousUtc.startUtc.toISOString()).toBe(
            "2026-02-27T06:00:00.000Z",
        );
    });

    it("keeps same span and immediate precedence across DST-adjacent dates", () => {
        const prev = getPreviousPeriodLocalRange(
            "2026-04-05",
            "2026-04-06",
            TZ,
        );
        expect(prev).toEqual({ from: "2026-04-03", to: "2026-04-04" });

        const currentUtc = parseLocalDateRangeToUtc(
            "2026-04-05",
            "2026-04-06",
            TZ,
        );
        const previousUtc = parseLocalDateRangeToUtc(prev.from, prev.to, TZ);

        expect(previousUtc.endUtc.getTime()).toBeLessThan(
            currentUtc.startUtc.getTime(),
        );
    });
});
