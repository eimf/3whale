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
  comparison?: SummaryV2Comparison | null;
  comparisonRange?: { from: string; to: string };
  deltas?: SummaryV2Deltas | null;
};

export type SummaryV2Comparison = {
  incomeBruto: MoneyValue;
  refunds: MoneyValue;
  incomeNeto: MoneyValue;
  shippingAmount: MoneyValue;
  taxAmount: MoneyValue;
  discountAmount: MoneyValue;
  ordersIncluded: number;
  aovNeto: MoneyValue;
};

export type DeltaItem = { percentChange: number; direction: "up" | "down" | "flat" };

export type SummaryV2Deltas = {
  incomeBruto: DeltaItem;
  refunds: DeltaItem;
  incomeNeto: DeltaItem;
  shippingAmount: DeltaItem;
  taxAmount: DeltaItem;
  discountAmount: DeltaItem;
  ordersIncluded: DeltaItem;
  aovNeto: DeltaItem;
};

export type DailyV2Response = {
  range: { from: string; to: string; timezone: string };
  granularity: "hour" | "day";
  data: DailyPointV2[];
  comparison?: DailyPointV2[];
  comparisonRange?: { from: string; to: string };
};

export type SyncStatusResponse = {
  shopConfig?: { timezoneIana?: string };
  syncState: {
    lastSyncFinishedAt: string | null;
    lastSyncStatus: string | null;
    lastSyncStartedAt: string | null;
  } | null;
};
