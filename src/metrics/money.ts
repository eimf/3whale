/**
 * Finance-safe money toolkit.
 * Per income_v1_contract.md: no floats; all amounts as decimal strings; decimal.js for arithmetic.
 * Internal results are stored unrounded; roundMoney() is for display only (half-up, 2 decimals).
 */

import Decimal from "decimal.js";

export type CurrencyCode = string;
export type DecimalString = string;
export type Money = { amount: DecimalString; currencyCode: CurrencyCode };

/** Max decimal places for internal canonical strings (no scientific notation). */
const INTERNAL_DECIMALS = 20;

/** Canonical decimal string: no scientific notation; trim trailing zeros. */
function toCanonical(d: Decimal): DecimalString {
  const fixed = d.toFixed(INTERNAL_DECIMALS);
  if (fixed.includes(".")) {
    return fixed.replace(/\.?0+$/, "") || "0";
  }
  return fixed;
}

/** Throws if currencies differ. */
export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currencyCode !== b.currencyCode) {
    throw new Error(`Currency mismatch: ${a.currencyCode} vs ${b.currencyCode}`);
  }
}

export function zeroMoney(currencyCode: CurrencyCode): Money {
  return { amount: "0", currencyCode };
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  const sum = new Decimal(a.amount).plus(b.amount);
  return { amount: toCanonical(sum), currencyCode: a.currencyCode };
}

export function subMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  const diff = new Decimal(a.amount).minus(b.amount);
  return { amount: toCanonical(diff), currencyCode: a.currencyCode };
}

/** Returns -1 if a < b, 0 if a === b, 1 if a > b. */
export function cmpMoney(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  const cmp = new Decimal(a.amount).comparedTo(b.amount);
  if (cmp < 0) return -1;
  if (cmp > 0) return 1;
  return 0;
}

export function maxMoney(a: Money, b: Money): Money {
  return cmpMoney(a, b) >= 0 ? a : b;
}

/** For display only. Half-up rounding to `decimals` places. Internal storage remains unrounded. */
export function roundMoney(m: Money, decimals = 2): Money {
  const rounded = new Decimal(m.amount).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
  return { amount: rounded.toFixed(decimals), currencyCode: m.currencyCode };
}
