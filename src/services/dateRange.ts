/**
 * Local date range → UTC bounds for DB filtering.
 * TZ: America/Mexico_City (or config). from = start of day, to = end of day local.
 */

import { DateTime } from "luxon";

export interface LocalDateRangeUtc {
  startUtc: Date;
  endUtc: Date;
}

/**
 * Parse from (YYYY-MM-DD) and to (YYYY-MM-DD) as local dates in the given IANA timezone.
 * Returns UTC timestamps: from = start of day local, to = end of day local (inclusive).
 */
export function parseLocalDateRangeToUtc(
  from: string,
  to: string,
  timezone: string
): LocalDateRangeUtc {
  const startLocal = DateTime.fromISO(from, { zone: timezone }).startOf("day");
  const endLocal = DateTime.fromISO(to, { zone: timezone }).endOf("day");
  if (!startLocal.isValid || !endLocal.isValid) {
    throw new Error(
      `Invalid date range: from=${from} to=${to} in ${timezone}. ${startLocal.invalidReason ?? ""} ${endLocal.invalidReason ?? ""}`
    );
  }
  if (startLocal > endLocal) {
    throw new Error(`from (${from}) must be <= to (${to})`);
  }
  return {
    startUtc: startLocal.toUTC().toJSDate(),
    endUtc: endLocal.toUTC().toJSDate(),
  };
}
