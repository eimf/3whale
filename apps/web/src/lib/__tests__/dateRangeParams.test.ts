import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTodayInTz, getYesterdayInTz } from "../dateRangeParams";

describe("dateRangeParams timezone helpers", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("computes yesterday correctly across timezones", () => {
        vi.setSystemTime(new Date("2026-03-01T01:00:00.000Z"));

        expect(getTodayInTz("UTC")).toBe("2026-03-01");
        expect(getYesterdayInTz("UTC")).toBe("2026-02-28");

        expect(getTodayInTz("America/Mexico_City")).toBe("2026-02-28");
        expect(getYesterdayInTz("America/Mexico_City")).toBe("2026-02-27");

        expect(getTodayInTz("Asia/Tokyo")).toBe("2026-03-01");
        expect(getYesterdayInTz("Asia/Tokyo")).toBe("2026-02-28");
    });
});
