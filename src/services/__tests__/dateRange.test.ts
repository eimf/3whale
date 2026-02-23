/**
 * Tests for local date range → UTC conversion.
 * Ensures "today" in shop timezone (e.g. America/Mexico_City) produces correct UTC bounds.
 */

import { describe, it, expect } from "vitest";
import { parseLocalDateRangeToUtc } from "../dateRange";

const MEXICO_TZ = "America/Mexico_City";

describe("parseLocalDateRangeToUtc", () => {
  it("same day in Mexico: start = 00:00 local, end = 23:59:59.999 local", () => {
    const from = "2025-02-22";
    const to = "2025-02-22";
    const { startUtc, endUtc } = parseLocalDateRangeToUtc(from, to, MEXICO_TZ);
    // Mexico City UTC-6 (no DST since 2022): 2025-02-22 00:00 local = 2025-02-22 06:00 UTC
    expect(startUtc.toISOString()).toMatch(/^2025-02-22T06:00:00\.000Z$/);
    // 2025-02-22 23:59:59.999 local = 2025-02-23 05:59:59.999 UTC
    expect(endUtc.toISOString()).toMatch(/^2025-02-23T05:59:59\.999Z$/);
  });

  it("from > to throws", () => {
    expect(() =>
      parseLocalDateRangeToUtc("2025-02-23", "2025-02-22", MEXICO_TZ)
    ).toThrow(/from.*must be <= to/);
  });

  it("invalid date throws", () => {
    expect(() =>
      parseLocalDateRangeToUtc("2025-13-01", "2025-02-22", MEXICO_TZ)
    ).toThrow(/Invalid date range/);
  });

  it("multi-day range: start of first day to end of last day in Mexico", () => {
    const { startUtc, endUtc } = parseLocalDateRangeToUtc(
      "2025-02-20",
      "2025-02-22",
      MEXICO_TZ
    );
    expect(startUtc.toISOString()).toMatch(/^2025-02-20T06:00:00\.000Z$/);
    expect(endUtc.toISOString()).toMatch(/^2025-02-23T05:59:59\.999Z$/);
  });
});
