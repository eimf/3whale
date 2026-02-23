/**
 * Types for income API v2 (MoneyValue shape).
 * Cards use .display; charts use .raw (string→number for visualization only).
 */

export type MoneyValue = { raw: string; display: string };

export type DailyPointV2 = {
  date: string;
  ordersCount: number;
  incomeBruto: MoneyValue;
  refunds: MoneyValue;
  incomeNeto: MoneyValue;
  shippingAmount: MoneyValue;
  taxAmount: MoneyValue;
  discountAmount: MoneyValue;
};

export type SummaryV2 = {
  range: { from: string; to: string; timezone: string };
  currencyCode: string;
  incomeBruto: MoneyValue;
  refunds: MoneyValue;
  incomeNeto: MoneyValue;
  shippingAmount: MoneyValue;
  taxAmount: MoneyValue;
  discountAmount: MoneyValue;
  ordersIncluded: number;
  ordersExcludedInRange: number;
  aovNeto: MoneyValue;
};

export type SyncStatusResponse = {
  syncState: {
    lastSyncFinishedAt: string | null;
    lastSyncStatus: string | null;
    lastSyncStartedAt: string | null;
  } | null;
};
