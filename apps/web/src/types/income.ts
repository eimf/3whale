/**
 * Types for income API v2 (MoneyValue shape).
 * Cards use .display; charts use .raw (string→number for visualization only).
 */

export type MoneyValue = { raw: string; display: string };

export type ShopifyParityMetrics = {
    grossSales: MoneyValue;
    discounts: MoneyValue;
    returns: MoneyValue;
    netSales: MoneyValue;
    shippingCharges: MoneyValue;
    returnFees: MoneyValue;
    taxes: MoneyValue;
    totalSales: MoneyValue;
};

export type ShopifyParityModel = "total_base_created_returns";

export type DailyPointV2 = {
    date: string;
    ordersCount: number;
    orderRevenue: MoneyValue;
    incomeBruto: MoneyValue;
    refunds: MoneyValue;
    refundReportedAmount: MoneyValue;
    refundLineItemsAmount: MoneyValue;
    refundAdjustmentAmount: MoneyValue;
    incomeNeto: MoneyValue;
    shippingAmount: MoneyValue;
    taxAmount: MoneyValue;
    discountAmount: MoneyValue;
    unitsSold?: number;
    newCustomers?: number;
    returningCustomers?: number;
    newCustomerOrders?: number;
    newCustomerRevenue?: MoneyValue;
    returningCustomerRevenue?: MoneyValue;
};

export type SummaryV2 = {
    range: { from: string; to: string; timezone: string };
    currencyCode: string;
    /** Order count for parity (includes cancelled; excludes only test/deleted). Use for "Orders #" in canonical 8-metric view. */
    ordersCountParity?: number;
    orderRevenue: MoneyValue;
    unitsSold?: number;
    newCustomers?: number;
    returningCustomers?: number;
    newCustomerOrders?: number;
    newCustomerRevenue?: MoneyValue;
    returningCustomerRevenue?: MoneyValue;
    incomeBruto: MoneyValue;
    refunds: MoneyValue;
    refundsReportedAmount: MoneyValue;
    refundsLineItemsAmount: MoneyValue;
    refundsLineItemsGrossAmount: MoneyValue;
    refundsAdjustmentsAmount: MoneyValue;
    refundsLineItemsTaxAmount: MoneyValue;
    refundsShippingAmount: MoneyValue;
    refundsShippingTaxAmount: MoneyValue;
    refundsDutiesAmount: MoneyValue;
    refundsOrderAdjustmentsAmount: MoneyValue;
    refundsOrderAdjustmentsTaxAmount: MoneyValue;
    incomeNeto: MoneyValue;
    shippingAmount: MoneyValue;
    taxAmount: MoneyValue;
    discountAmount: MoneyValue;
    ordersIncluded: number;
    ordersExcludedInRange: number;
    /** True AOV numerator: product revenue only (income_neto − shipping for orders with revenue > 0) */
    incomeNetoProductOnly?: MoneyValue;
    /** True AOV denominator: count of orders with income_neto > 0 */
    ordersWithPositiveRevenue?: number;
    aovNeto: MoneyValue;
    /** Average Order Value including $0 orders: (product revenue all orders) / total orders */
    averageOrderValueAmount?: MoneyValue;
    shopifyParityModel?: ShopifyParityModel;
    shopifyParity?: ShopifyParityMetrics;
    comparison?: SummaryV2Comparison | null;
    comparisonRange?: { from: string; to: string };
    deltas?: SummaryV2Deltas | null;
};

export type SummaryV2Comparison = {
    orderRevenue: MoneyValue;
    unitsSold?: number;
    newCustomers?: number;
    returningCustomers?: number;
    newCustomerOrders?: number;
    newCustomerRevenue?: MoneyValue;
    returningCustomerRevenue?: MoneyValue;
    incomeBruto: MoneyValue;
    refunds: MoneyValue;
    refundsReportedAmount: MoneyValue;
    refundsLineItemsAmount: MoneyValue;
    refundsLineItemsGrossAmount: MoneyValue;
    refundsAdjustmentsAmount: MoneyValue;
    refundsLineItemsTaxAmount: MoneyValue;
    refundsShippingAmount: MoneyValue;
    refundsShippingTaxAmount: MoneyValue;
    refundsDutiesAmount: MoneyValue;
    refundsOrderAdjustmentsAmount: MoneyValue;
    refundsOrderAdjustmentsTaxAmount: MoneyValue;
    incomeNeto: MoneyValue;
    shippingAmount: MoneyValue;
    taxAmount: MoneyValue;
    discountAmount: MoneyValue;
    ordersIncluded: number;
    aovNeto: MoneyValue;
    averageOrderValueAmount?: MoneyValue;
    incomeNetoProductOnly?: MoneyValue;
    ordersWithPositiveRevenue?: number;
    shopifyParity?: ShopifyParityMetrics;
};

export type DeltaItem = {
    percentChange: number | null;
    direction: "up" | "down" | "flat";
};

export type SummaryV2Deltas = {
    orderRevenue: DeltaItem;
    unitsSold?: DeltaItem;
    newCustomers?: DeltaItem;
    returningCustomers?: DeltaItem;
    newCustomerOrders?: DeltaItem;
    newCustomerRevenue?: DeltaItem;
    returningCustomerRevenue?: DeltaItem;
    incomeBruto: DeltaItem;
    refunds: DeltaItem;
    refundsReportedAmount: DeltaItem;
    refundsLineItemsAmount: DeltaItem;
    refundsLineItemsGrossAmount: DeltaItem;
    refundsAdjustmentsAmount: DeltaItem;
    refundsLineItemsTaxAmount: DeltaItem;
    refundsShippingAmount: DeltaItem;
    refundsShippingTaxAmount: DeltaItem;
    refundsDutiesAmount: DeltaItem;
    refundsOrderAdjustmentsAmount: DeltaItem;
    refundsOrderAdjustmentsTaxAmount: DeltaItem;
    incomeNeto: DeltaItem;
    shippingAmount: DeltaItem;
    taxAmount: DeltaItem;
    discountAmount: DeltaItem;
    ordersIncluded: DeltaItem;
    aovNeto: DeltaItem;
    averageOrderValue?: DeltaItem;
    shopifyParity?: {
        grossSales: DeltaItem;
        discounts: DeltaItem;
        returns: DeltaItem;
        netSales: DeltaItem;
        shippingCharges: DeltaItem;
        returnFees: DeltaItem;
        taxes: DeltaItem;
        totalSales: DeltaItem;
    };
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
