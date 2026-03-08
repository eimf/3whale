/**
 * Canonical union of all dashboard metric keys.
 * Used by metricsMeta, formatMetric, and dashboard components.
 */
export type DashboardMetricKey =
  | "orderRevenue"
  | "returns"
  | "cogs"
  | "adSpend"
  | "shippingCost"
  | "totalOrders"
  | "grossProfit"
  | "netProfit"
  | "profitMargin"
  | "blendedRoas"
  | "aov"
  | "cac"
  | "taxes"
  | "grossSales"
  | "discounts"
  | "trueAov"
  | "averageOrderValue"
  | "newCustomers"
  | "returningCustomers"
  | "ordersOverZero"
  | "newCustomerOrders"
  | "unitsSold"
  | "newCustomerRevenue"
  | "returningCustomerRevenue";
