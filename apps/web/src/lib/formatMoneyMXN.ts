/**
 * Display-only formatting. Per income_v1_contract: half-up to 2 decimals.
 * Do not use for any business logic or calculations.
 */

export function formatMoneyMXN(amountStr: string): string {
  const n = Number(amountStr);
  if (Number.isNaN(n)) return "0.00";
  return n.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
