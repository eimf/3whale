import { describe, expect, it } from "vitest";
import { formatBucketLabel } from "../hourLabel";

describe("formatBucketLabel", () => {
    it("formats hourly labels from backend local timestamp strings", () => {
        expect(formatBucketLabel("2026-02-28T00:00:00", "hour")).toBe("00:00");
        expect(formatBucketLabel("2026-02-28T23:00:00", "hour")).toBe("23:00");
    });

    it("formats daily labels as MM-DD", () => {
        expect(formatBucketLabel("2026-02-28", "day")).toBe("02-28");
    });
});
