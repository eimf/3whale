/**
 * Today-window logic used by summary-v2 and daily-v2 when days=1.
 * Ensures "today" is computed in shop timezone (Mexico), not UTC.
 */

import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";

const MEXICO_TZ = "America/Mexico_City";

function computeTodayWindowUtc(now: DateTime, tz: string) {
  const end = now.setZone(tz);
  const start = end.startOf("day").minus({ days: 0 });
  return {
    startUtc: start.toUTC().toJSDate(),
    endUtc: end.toUTC().toJSDate(),
    from: start.toISODate() ?? "",
    to: end.toISODate() ?? "",
  };
}

describe("today window (days=1) in shop timezone", () => {
  it("when it is 14:00 in Mexico, window is start of that day Mexico to 14:00 Mexico", () => {
    // 2025-02-22 14:00 in Mexico City
    const now = DateTime.fromISO("2025-02-22T14:00:00", { zone: MEXICO_TZ });
    const { startUtc, endUtc, from, to } = computeTodayWindowUtc(now, MEXICO_TZ);
    expect(from).toBe("2025-02-22");
    expect(to).toBe("2025-02-22");
    // Start of day Mexico = 06:00 UTC (Mexico UTC-6)
    expect(startUtc.toISOString()).toMatch(/^2025-02-22T06:00:00\.000Z$/);
    // 14:00 Mexico = 20:00 UTC
    expect(endUtc.toISOString()).toMatch(/^2025-02-22T20:00:00\.000Z$/);
  });

  it("midnight in Mexico: window is that day 00:00 to 00:00 (same instant)", () => {
    const now = DateTime.fromISO("2025-02-22T00:00:00", { zone: MEXICO_TZ });
    const { startUtc, endUtc } = computeTodayWindowUtc(now, MEXICO_TZ);
    expect(startUtc.getTime()).toBe(endUtc.getTime());
    expect(startUtc.toISOString()).toMatch(/^2025-02-22T06:00:00\.000Z$/);
  });
});
