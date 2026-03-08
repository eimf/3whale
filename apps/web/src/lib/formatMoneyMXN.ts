/**
 * Display-only currency formatting. Per income_v1_contract: half-up to 2 decimals.
 * Uses narrowSymbol for consistent prefix (e.g. MX$). Do not use for business logic.
 */

const defaultLocale = "es-MX";
const defaultCurrency = "MXN";

export function formatMoneyMXN(amountStr: string): string {
  const n = Number(amountStr);
  if (Number.isNaN(n)) {
    return new Intl.NumberFormat(defaultLocale, {
      style: "currency",
      currency: defaultCurrency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(0);
  }
  return new Intl.NumberFormat(defaultLocale, {
    style: "currency",
    currency: defaultCurrency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
