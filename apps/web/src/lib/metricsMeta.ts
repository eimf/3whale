import type { DashboardMetricKey } from "@/types/metrics";

/**
 * Centralized metric metadata for KPI tiles.
 * Title and tooltip copy come from i18n (next-intl); this registry holds only translation keys.
 * Single source of truth for tile label + tooltip content.
 */
export interface MetricMeta {
    /** next-intl key for display label (e.g. "metrics.ingresos") */
    titleKey: string;
    /** next-intl key for tooltip description */
    tooltipDescriptionKey: string;
    /** next-intl key for optional formula line(s) */
    tooltipFormulaKey?: string;
    /** next-intl key for optional note (e.g. returns caveat) */
    tooltipNoteKey?: string;
    /** How to format values: money (currency), number (integer), percent */
    format: "money" | "number" | "percent";
}

/** Metric id → metadata (i18n keys only). Used by dashboard tiles and drilldown. */
export const metricsMeta: Record<DashboardMetricKey, MetricMeta> = {
    orderRevenue: {
        titleKey: "metrics.ingresos",
        tooltipDescriptionKey: "metrics.tooltips.ingresos.description",
        tooltipFormulaKey: "metrics.tooltips.ingresos.formula",
        format: "money",
    },
    totalOrders: {
        titleKey: "metrics.ordenes",
        tooltipDescriptionKey: "metrics.tooltips.ordenes.description",
        format: "number",
    },
    returns: {
        titleKey: "metrics.reembolsos",
        tooltipDescriptionKey: "metrics.tooltips.reembolsos.description",
        tooltipNoteKey: "metrics.tooltips.reembolsos.note",
        format: "money",
    },
    taxes: {
        titleKey: "metrics.impuestosVentas",
        tooltipDescriptionKey: "metrics.tooltips.impuestosVentas.description",
        format: "money",
    },
    trueAov: {
        titleKey: "metrics.trueAov",
        tooltipDescriptionKey: "metrics.tooltips.trueAov.description",
        tooltipFormulaKey: "metrics.tooltips.trueAov.formula",
        format: "money",
    },
    averageOrderValue: {
        titleKey: "metrics.averageOrderValue",
        tooltipDescriptionKey: "metrics.tooltips.averageOrderValue.description",
        tooltipFormulaKey: "metrics.tooltips.averageOrderValue.formula",
        format: "money",
    },
    newCustomers: {
        titleKey: "metrics.newCustomers",
        tooltipDescriptionKey: "metrics.tooltips.newCustomers.description",
        tooltipFormulaKey: "metrics.tooltips.newCustomers.formula",
        format: "number",
    },
    grossSales: {
        titleKey: "metrics.grossSales",
        tooltipDescriptionKey: "metrics.tooltips.grossSales.description",
        tooltipFormulaKey: "metrics.tooltips.grossSales.formula",
        format: "money",
    },
    returningCustomers: {
        titleKey: "metrics.returningCustomers",
        tooltipDescriptionKey:
            "metrics.tooltips.returningCustomers.description",
        tooltipFormulaKey: "metrics.tooltips.returningCustomers.formula",
        format: "number",
    },
    ordersOverZero: {
        titleKey: "metrics.ordersOverZero",
        tooltipDescriptionKey: "metrics.tooltips.ordersOverZero.description",
        tooltipFormulaKey: "metrics.tooltips.ordersOverZero.formula",
        format: "number",
    },
    newCustomerOrders: {
        titleKey: "metrics.newCustomerOrders",
        tooltipDescriptionKey: "metrics.tooltips.newCustomerOrders.description",
        format: "number",
    },
    unitsSold: {
        titleKey: "metrics.unitsSold",
        tooltipDescriptionKey: "metrics.tooltips.unitsSold.description",
        format: "number",
    },
    newCustomerRevenue: {
        titleKey: "metrics.newCustomerRevenue",
        tooltipDescriptionKey:
            "metrics.tooltips.newCustomerRevenue.description",
        format: "money",
    },
    returningCustomerRevenue: {
        titleKey: "metrics.returningCustomerRevenue",
        tooltipDescriptionKey:
            "metrics.tooltips.returningCustomerRevenue.description",
        format: "money",
    },
    discounts: {
        titleKey: "metrics.discounts",
        tooltipDescriptionKey: "metrics.tooltips.discounts.description",
        format: "money",
    },
    // Tiles not in grid but may appear in drilldown / future
    netProfit: {
        titleKey: "metrics.netProfit",
        tooltipDescriptionKey: "metrics.tooltips.netProfit.description",
        format: "money",
    },
    cogs: {
        titleKey: "metrics.cogs",
        tooltipDescriptionKey: "metrics.tooltips.cogs.description",
        format: "money",
    },
    adSpend: {
        titleKey: "metrics.adSpend",
        tooltipDescriptionKey: "metrics.tooltips.adSpend.description",
        format: "money",
    },
    shippingCost: {
        titleKey: "metrics.shippingCost",
        tooltipDescriptionKey: "metrics.tooltips.shippingCost.description",
        format: "money",
    },
    grossProfit: {
        titleKey: "metrics.grossProfit",
        tooltipDescriptionKey: "metrics.tooltips.grossProfit.description",
        format: "money",
    },
    profitMargin: {
        titleKey: "metrics.profitMargin",
        tooltipDescriptionKey: "metrics.tooltips.profitMargin.description",
        format: "percent",
    },
    blendedRoas: {
        titleKey: "metrics.blendedRoas",
        tooltipDescriptionKey: "metrics.tooltips.blendedRoas.description",
        format: "percent",
    },
    aov: {
        titleKey: "metrics.aov",
        tooltipDescriptionKey: "metrics.tooltips.aov.description",
        format: "money",
    },
    cac: {
        titleKey: "metrics.cac",
        tooltipDescriptionKey: "metrics.tooltips.cac.description",
        format: "money",
    },
};

/** Keys that are shown as KPI tiles (subset of DashboardMetricKey). */
export const TILE_METRIC_KEYS: DashboardMetricKey[] = [
    "orderRevenue",
    "totalOrders",
    "returns",
    "taxes",
    "trueAov",
    "averageOrderValue",
    "newCustomers",
    "grossSales",
    "returningCustomers",
    "ordersOverZero",
    "newCustomerOrders",
    "unitsSold",
    "newCustomerRevenue",
    "returningCustomerRevenue",
    "discounts",
];

/** Map tile metric to summary delta key (for comparison %). "Negative" = red when up (returns, taxes, discounts). */
export const TILE_TO_DELTA_KEY: Partial<
    Record<
        DashboardMetricKey,
        | "orderRevenue"
        | "incomeNeto"
        | "refunds"
        | "taxAmount"
        | "ordersIncluded"
        | "incomeBruto"
        | "shippingAmount"
        | "discountAmount"
        | "aovNeto"
        | "averageOrderValue"
        | "unitsSold"
        | "newCustomers"
        | "returningCustomers"
        | "newCustomerOrders"
        | "newCustomerRevenue"
        | "returningCustomerRevenue"
    >
> = {
    orderRevenue: "orderRevenue",
    netProfit: "incomeNeto",
    returns: "refunds",
    taxes: "taxAmount",
    totalOrders: "ordersIncluded",
    ordersOverZero: "ordersIncluded",
    grossSales: "incomeBruto",
    shippingCost: "shippingAmount",
    discounts: "discountAmount",
    trueAov: "aovNeto",
    averageOrderValue: "averageOrderValue",
    aov: "aovNeto",
    unitsSold: "unitsSold",
    newCustomers: "newCustomers",
    returningCustomers: "returningCustomers",
    newCustomerOrders: "newCustomerOrders",
    newCustomerRevenue: "newCustomerRevenue",
    returningCustomerRevenue: "returningCustomerRevenue",
};

export const NEGATIVE_DELTA_METRICS: Set<DashboardMetricKey> = new Set([
    "returns",
    "taxes",
    "discounts",
]);
