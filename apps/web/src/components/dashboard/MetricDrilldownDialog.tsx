"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogPortal,
  DialogOverlay,
} from "@/components/ui/dialog";
import { MetricBarsChart, type BarSeriesPoint } from "./MetricBarsChart";
import { MetricComparisonChart } from "./MetricComparisonChart";

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

/** Display-only summary for latest/previous period (e.g. "Feb 23" / "Feb 22"); values from backend .display only. */
export type SummaryItem = { label: string; displayValue: string };

function formatRangeLabel(from: string, to: string): string {
  const a = new Date(from + "T12:00:00");
  const b = new Date(to + "T12:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (from === to) return a.toLocaleDateString(undefined, opts);
  return `${a.toLocaleDateString(undefined, opts)} - ${b.toLocaleDateString(undefined, opts)}`;
}

export interface MetricDrilldownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metricKey: DashboardMetricKey;
  title: string;
  barsSeries?: BarSeriesPoint[];
  summaryItems?: SummaryItem[];
  granularity?: "hour" | "day";
  /** When false, comparison tab shows only current series and hides previous column. */
  isComparing?: boolean;
  comparisonSeries?: BarSeriesPoint[];
  currentRange?: { from: string; to: string };
  comparisonRange?: { from: string; to: string };
  currentTotal?: string;
  comparisonTotal?: string;
}

/**
 * Metric Drilldown modal: header (title + close), tabs Bars / Comparison.
 * Bars tab shows MetricBarsChart when barsSeries has data, else "No data yet".
 * Comparison tab is placeholder. Dark-theme compatible.
 */
export function MetricDrilldownDialog({
  open,
  onOpenChange,
  metricKey: _metricKey,
  title,
  barsSeries,
  summaryItems,
  granularity = "day",
  isComparing = false,
  comparisonSeries,
  currentRange,
  comparisonRange,
  currentTotal,
  comparisonTotal,
}: MetricDrilldownDialogProps) {
  const t = useTranslations("drilldown");
  const hasBars = Array.isArray(barsSeries) && barsSeries.length > 0;
  const hasSummary = Array.isArray(summaryItems) && summaryItems.length > 0;
  const hasComparison = isComparing && Array.isArray(comparisonSeries) && comparisonSeries.length > 0 && hasBars;
  const currentRangeLabel = currentRange ? formatRangeLabel(currentRange.from, currentRange.to) : null;
  const comparisonRangeLabel = isComparing && comparisonRange ? formatRangeLabel(comparisonRange.from, comparisonRange.to) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className="gap-5">
          <DialogHeader className="flex flex-row items-center justify-between gap-4 border-b border-zinc-700/80 pb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400" aria-hidden>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                  <path d="M3 6h18" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
              </span>
              <DialogTitle className="text-xl">{title}</DialogTitle>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                aria-label="Close"
                className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </DialogClose>
          </DialogHeader>

          <Tabs.Root defaultValue="bars" className="w-full">
            <Tabs.List
              className="inline-flex gap-0 rounded-lg border border-zinc-700 bg-zinc-800/50 p-0.5"
              aria-label="Drilldown views"
            >
              <Tabs.Trigger
                value="bars"
                className="rounded-md px-4 py-2 text-sm font-medium text-zinc-400 transition-colors data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
              >
                {t("tabs.bars")}
              </Tabs.Trigger>
              <Tabs.Trigger
                value="comparison"
                className="rounded-md px-4 py-2 text-sm font-medium text-zinc-400 transition-colors data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
              >
                {t("tabs.comparison")}
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="bars" className="mt-4 focus:outline-none">
              {hasSummary && summaryItems && (
                <div className="flex flex-wrap gap-4 rounded-lg border border-zinc-700/60 bg-zinc-800/50 p-4">
                  {summaryItems.map((item) => (
                    <div key={item.label} className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{item.label}</span>
                      <span className="text-lg font-semibold text-zinc-100">{item.displayValue}</span>
                    </div>
                  ))}
                </div>
              )}
              {hasBars ? (
                <MetricBarsChart series={barsSeries!} label={title} />
              ) : (
                <div className="flex min-h-[240px] items-center justify-center rounded border border-zinc-700/50 bg-zinc-800/50 p-6">
                  <p className="text-sm text-zinc-500">{t("noData")}</p>
                </div>
              )}
            </Tabs.Content>

            <Tabs.Content value="comparison" className="mt-4 focus:outline-none">
              {(currentRangeLabel != null || currentTotal != null) && (
                <div className="flex flex-wrap gap-6 rounded-lg border border-zinc-700/60 bg-zinc-800/50 p-4 mb-4">
                  {currentRangeLabel != null && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{currentRangeLabel}</span>
                      <span className="text-lg font-semibold text-zinc-100">{currentTotal ?? "—"}</span>
                    </div>
                  )}
                  {isComparing && comparisonRangeLabel != null && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{comparisonRangeLabel}</span>
                      <span className="text-lg font-semibold text-zinc-400">{comparisonTotal ?? "—"}</span>
                    </div>
                  )}
                </div>
              )}
              {hasComparison && barsSeries && comparisonSeries ? (
                <MetricComparisonChart
                  currentSeries={barsSeries}
                  comparisonSeries={comparisonSeries}
                  currentLabel={currentRangeLabel ?? "Current"}
                  comparisonLabel={comparisonRangeLabel ?? "Previous"}
                />
              ) : hasBars && barsSeries ? (
                <MetricComparisonChart
                  currentSeries={barsSeries}
                  currentLabel={currentRangeLabel ?? "Current"}
                />
              ) : (
                <div className="flex min-h-[240px] items-center justify-center rounded border border-zinc-700/50 bg-zinc-800/50 p-6">
                  <p className="text-sm text-zinc-500">{t("noData")}</p>
                </div>
              )}
            </Tabs.Content>
          </Tabs.Root>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
