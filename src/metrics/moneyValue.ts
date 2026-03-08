/**
 * Standardized money shape for UI and charting.
 * MoneyValue = { raw: string (6dp), display: string (2dp) } with bankers rounding (half-even) for display.
 * No JS floats; uses Decimal for rounding.
 */

import Decimal from "decimal.js";

export type MoneyValue = { raw: string; display: string };

const RAW_DECIMALS = 6;
const DISPLAY_DECIMALS = 2;

/**
 * Round a decimal string to the given number of decimal places using banker's rounding (half-even).
 * Used for True AOV to match Triple Whale.
 */
export function roundToDecimalsHalfEven(value: string, decimals: number): string {
  const s = String(value).trim() || "0";
  let d: Decimal;
  try {
    d = new Decimal(s);
  } catch {
    return decimals <= 0 ? "0" : "0." + "0".repeat(decimals);
  }
  if (!d.isFinite()) return decimals <= 0 ? "0" : "0." + "0".repeat(decimals);
  return d.toDecimalPlaces(decimals, Decimal.ROUND_HALF_EVEN).toFixed(decimals);
}

/**
 * Normalize a decimal string to exactly 6 decimal places (canonical raw).
 * Handles invalid input by treating as "0".
 */
function toRaw6(value: string): string {
  const s = String(value).trim() || "0";
  let d: Decimal;
  try {
    d = new Decimal(s);
  } catch {
    return "0.000000";
  }
  if (!d.isFinite()) return "0.000000";
  return d.toFixed(RAW_DECIMALS);
}

/**
 * Round to 2 decimals using half-even (bankers) rounding.
 * display always has exactly 2 decimal places.
 */
export function toMoneyValue(raw6: string): MoneyValue {
  const raw = toRaw6(raw6);
  const d = new Decimal(raw);
  const display = d.toDecimalPlaces(
    DISPLAY_DECIMALS,
    Decimal.ROUND_HALF_EVEN
  ).toFixed(DISPLAY_DECIMALS);
  return { raw, display };
}
