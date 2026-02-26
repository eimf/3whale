"use client";

import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslations } from "next-intl";
import { setRangeDays, DASHBOARD_RANGE_DAYS } from "@/store/dashboardSlice";
import type { RootState } from "@/store/store";
import type { RangeDays } from "@/store/dashboardSlice";
import { formatMoneyMXN } from "@/lib/formatMoneyMXN";
import type { DailyPointV2, SummaryV2, SyncStatusResponse } from "@/types/income";
import {
  MetricDrilldownDialog,
  type DashboardMetricKey,
  type SummaryItem,
} from "@/components/dashboard/MetricDrilldownDialog";
import type { BarSeriesPoint } from "@/components/dashboard/MetricBarsChart";
import { ShoppingBagIcon } from "@/components/dashboard/ShoppingBagIcon";
import { TileSparkline } from "@/components/dashboard/TileSparkline";
import { metricsMeta, TILE_METRIC_KEYS } from "@/lib/metricsMeta";
import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipPortal,
  TooltipContent,
} from "@/components/ui/tooltip";

function ShareIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
function KebabMenuIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}
function FiltersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}

/**
 * Pre-flight discovery (metric drilldown):
 * - KPI tiles: this page, grid at "Metric cards" (grid grid-cols-1 sm:grid-cols-2 ...).
 * - Metric values: local state `data` (DailyPointV2[]) and `summary` (SummaryV2) from
 *   /api/income/daily and /api/income/summary. Redux only has rangeDays/selectedDay.
 * - Bar/timeseries: same `data` (DailyPointV2[]). Revenue/Net Profit/Orders charts use
 *   chartData, revenueChartData, ordersPerDayData, netProfitChartData (all from data).
 *   Bar-series shape: labels = date (r.date.slice(5)), values from .raw (number for viz only).
 */
function getBarsSeriesForMetric(
  metricKey: DashboardMetricKey,
  data: DailyPointV2[] | null
): BarSeriesPoint[] | undefined {
  if (!data || data.length === 0) return undefined;
  if (metricKey === "orderRevenue" || metricKey === "netProfit") {
    return data.map((r) => ({ x: r.date.slice(5), y: Number(r.incomeNeto.raw) }));
  }
  if (metricKey === "returns") {
    return data.map((r) => ({ x: r.date.slice(5), y: Number(r.refunds.raw) }));
  }
  if (metricKey === "shippingCost") {
    return data.map((r) => ({ x: r.date.slice(5), y: Number(r.shippingAmount.raw) }));
  }
  if (metricKey === "totalOrders" || metricKey === "ordersOverZero") {
    return data.map((r) => ({ x: r.date.slice(5), y: r.ordersCount ?? 0 }));
  }
  if (metricKey === "grossSales") {
    return data.map((r) => ({ x: r.date.slice(5), y: Number(r.incomeBruto.raw) }));
  }
  if (metricKey === "taxes") {
    return data.map((r) => ({ x: r.date.slice(5), y: Number(r.taxAmount.raw) }));
  }
  if (metricKey === "discounts") {
    return data.map((r) => ({ x: r.date.slice(5), y: Number(r.discountAmount.raw) }));
  }
  return undefined;
}

/** Last 2 days summary for drilldown modal; display-only (backend .display / formatMoneyMXN). No client money calc. */
function getSummaryItemsForMetric(
  metricKey: DashboardMetricKey,
  data: DailyPointV2[] | null
): SummaryItem[] | undefined {
  if (!data || data.length === 0) return undefined;
  const slice = data.slice(-2);
  if (slice.length === 0) return undefined;
  const items: SummaryItem[] = [];
  for (const r of slice) {
    const label = r.date.slice(5);
    let displayValue: string;
    if (metricKey === "orderRevenue" || metricKey === "netProfit") {
      displayValue = `${formatMoneyMXN(r.incomeNeto.display)} MXN`;
    } else if (metricKey === "returns") {
      displayValue = `${formatMoneyMXN(r.refunds.display)} MXN`;
    } else if (metricKey === "shippingCost") {
      displayValue = `${formatMoneyMXN(r.shippingAmount.display)} MXN`;
    } else if (metricKey === "totalOrders" || metricKey === "ordersOverZero") {
      displayValue = String(r.ordersCount ?? 0);
    } else if (metricKey === "grossSales") {
      displayValue = `${formatMoneyMXN(r.incomeBruto.display)} MXN`;
    } else if (metricKey === "taxes") {
      displayValue = `${formatMoneyMXN(r.taxAmount.display)} MXN`;
    } else if (metricKey === "discounts") {
      displayValue = `${formatMoneyMXN(r.discountAmount.display)} MXN`;
    } else {
      continue;
    }
    items.push({ label, displayValue });
  }
  return items.length > 0 ? items : undefined;
}

/** Sparkline values from daily data (number for viz only). Empty array = show flat line. */
function getSparklineValues(
  metricKey: DashboardMetricKey,
  data: DailyPointV2[] | null
): number[] {
  if (!data || data.length === 0) return [];
  if (metricKey === "orderRevenue" || metricKey === "netProfit") {
    return data.map((r) => Number(r.incomeNeto.raw));
  }
  if (metricKey === "returns") return data.map((r) => Number(r.refunds.raw));
  if (metricKey === "shippingCost") return data.map((r) => Number(r.shippingAmount.raw));
  if (metricKey === "totalOrders" || metricKey === "ordersOverZero") {
    return data.map((r) => r.ordersCount ?? 0);
  }
  if (metricKey === "grossSales") return data.map((r) => Number(r.incomeBruto.raw));
  if (metricKey === "taxes") return data.map((r) => Number(r.taxAmount.raw));
  if (metricKey === "discounts") return data.map((r) => Number(r.discountAmount.raw));
  return [];
}

export default function DashboardPage() {
  const t = useTranslations();
  const dispatch = useDispatch();
  const rangeDays = useSelector((s: RootState) => s.dashboard.rangeDays);

  const [data, setData] = useState<DailyPointV2[] | null>(null);
  const [summary, setSummary] = useState<SummaryV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [selectedMetricKey, setSelectedMetricKey] = useState<DashboardMetricKey>("orderRevenue");
  const [selectedMetricTitle, setSelectedMetricTitle] = useState("");

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
    });
    Promise.all([
      fetch(`/api/income/daily?days=${rangeDays}`).then((res) => {
        if (!res.ok) return res.json().then((b) => Promise.reject(b));
        return res.json() as Promise<DailyPointV2[]>;
      }),
      fetch(`/api/income/summary?days=${rangeDays}`).then((res) => {
        if (!res.ok) return res.json().then((b) => Promise.reject(b));
        return res.json() as Promise<SummaryV2>;
      }),
      fetch("/api/sync/status").then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<SyncStatusResponse>;
      }),
    ])
      .then(([dailyJson, summaryJson, syncJson]) => {
        if (!cancelled) {
          setData(Array.isArray(dailyJson) ? dailyJson : []);
          setSummary(summaryJson);
          if (syncJson) setSyncStatus(syncJson);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.error ?? String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rangeDays]);

  const dateRangeLabel = useMemo(() => {
    if (!summary?.range) return "";
    return `${summary.range.from} → ${summary.range.to}`;
  }, [summary]);

  const lastSyncLabel = useMemo(() => {
    if (!syncStatus?.syncState?.lastSyncFinishedAt) return t("sync.lastSyncedNever");
    const date = new Date(syncStatus.syncState.lastSyncFinishedAt);
    return date.toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [syncStatus, t]);

  async function handleSyncNow() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/sync/run", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncMessage(body?.error ?? "Error");
        return;
      }
      setSyncMessage(t("sync.syncStarted"));
      setTimeout(() => {
        fetch("/api/sync/status")
          .then((r) => (r.ok ? r.json() : null))
          .then((s: SyncStatusResponse | null) => s && setSyncStatus(s));
        fetch(`/api/income/daily?days=${rangeDays}`)
          .then((r) => (r.ok ? r.json() : []))
          .then((d) => setData(Array.isArray(d) ? d : []));
        fetch(`/api/income/summary?days=${rangeDays}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((s) => s && setSummary(s));
        setSyncMessage(null);
      }, 4000);
    } finally {
      setSyncing(false);
    }
  }

  const drilldownBarsSeries = useMemo(
    () => getBarsSeriesForMetric(selectedMetricKey, data),
    [selectedMetricKey, data]
  );

  const drilldownSummaryItems = useMemo(
    () => getSummaryItemsForMetric(selectedMetricKey, data),
    [selectedMetricKey, data]
  );

  function openDrilldown(metricKey: DashboardMetricKey, title: string) {
    setSelectedMetricKey(metricKey);
    setSelectedMetricTitle(title);
    setDrilldownOpen(true);
  }

  /** 15 metrics: icon + title + value + sparkline; titles/tooltips from metricsMeta + i18n. */
  const tileConfigs = TILE_METRIC_KEYS.map((metricKey) => ({ metricKey }));

  function getTileValue(metricKey: DashboardMetricKey): string {
    if (!summary) return "—";
    switch (metricKey) {
      case "orderRevenue":
      case "netProfit":
        return `${formatMoneyMXN(summary.incomeNeto.display)} MXN`;
      case "returns":
        return `${formatMoneyMXN(summary.refunds.display)} MXN`;
      case "taxes":
        return `${formatMoneyMXN(summary.taxAmount.display)} MXN`;
      case "trueAov":
      case "averageOrderValue":
      case "aov":
        return summary.ordersIncluded > 0 ? `$${formatMoneyMXN(summary.aovNeto.display)}` : "—";
      case "totalOrders":
      case "ordersOverZero":
        return summary.ordersIncluded.toLocaleString();
      case "grossSales":
        return `${formatMoneyMXN(summary.incomeBruto.display)} MXN`;
      case "shippingCost":
        return `${formatMoneyMXN(summary.shippingAmount.display)} MXN`;
      case "discounts":
        return `${formatMoneyMXN(summary.discountAmount.display)} MXN`;
      default:
        return "—";
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-zinc-400">
        {t("state.loading")}
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-6 text-red-400">
        {t("state.errorLoading")}: {error}
      </div>
    );
  }
  if (!data || !summary) {
    return (
      <div className="p-6 text-zinc-400">
        {t("state.noData")}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header: title left, range + date right */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-wide">
            {t("dashboard.title")}
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={rangeDays}
            onChange={(e) => dispatch(setRangeDays(Number(e.target.value) as RangeDays))}
            className="bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {DASHBOARD_RANGE_DAYS.map((d) => (
              <option key={d} value={d}>
                {t("dashboard.range.days", { days: d })}
              </option>
            ))}
          </select>
          <span className="text-sm text-zinc-500">{dateRangeLabel}</span>
        </div>
      </div>
      {/* Sync: last synced + Sync now button */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-zinc-500">
          {t("sync.lastSynced")}: <span className="text-zinc-400">{lastSyncLabel}</span>
        </span>
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={syncing}
          className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-600 rounded px-3 py-1.5 text-zinc-200 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {syncing ? t("sync.syncing") : t("sync.syncNow")}
        </button>
        {syncMessage && (
          <span className="text-emerald-400 text-sm">{syncMessage}</span>
        )}
      </div>

      {/* Tienda section: header + KPI tiles */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
            <ShoppingBagIcon />
            {t("dashboard.tienda")}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={t("tiendaHeader.share")}
              className="rounded p-2 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              <ShareIcon />
            </button>
            <button
              type="button"
              aria-label={t("tiendaHeader.menu")}
              className="rounded p-2 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              <KebabMenuIcon />
            </button>
            <button
              type="button"
              aria-label={t("tiendaHeader.filters")}
              className="rounded p-2 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              <FiltersIcon />
            </button>
            <button
              type="button"
              aria-label={t("tiendaHeader.grid")}
              className="rounded p-2 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              <GridIcon />
            </button>
          </div>
        </div>

        <TooltipProvider delayDuration={300}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tileConfigs.map((config) => {
          const meta = metricsMeta[config.metricKey];
          const title = t(meta.titleKey);
          const value = getTileValue(config.metricKey);
          const sparklineValues = getSparklineValues(config.metricKey, data);
          const description = t(meta.tooltipDescriptionKey);
          const formula = meta.tooltipFormulaKey ? t(meta.tooltipFormulaKey) : null;
          const note = meta.tooltipNoteKey ? t(meta.tooltipNoteKey) : null;
          return (
            <button
              key={config.metricKey}
              type="button"
              onClick={() => openDrilldown(config.metricKey, title)}
              className="bg-zinc-800 rounded-lg p-4 border border-zinc-700 text-left w-full hover:bg-zinc-700/90 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950 flex flex-col"
            >
              <div className="flex items-center gap-2">
                <ShoppingBagIcon />
                <TooltipRoot>
                  <TooltipTrigger asChild>
                    <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-help focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 rounded">
                      {title}
                    </span>
                  </TooltipTrigger>
                  <TooltipPortal>
                    <TooltipContent>
                      <p>{description}</p>
                      {formula && <p className="mt-1.5 text-zinc-400 font-mono text-xs">{formula}</p>}
                      {note && <p className="mt-1 text-amber-200/90 text-xs">{note}</p>}
                    </TooltipContent>
                  </TooltipPortal>
                </TooltipRoot>
              </div>
              <div className="text-xl font-semibold text-zinc-100 mt-1">{value}</div>
              <div className="mt-2 flex items-end justify-start min-h-[36px]">
                <TileSparkline values={sparklineValues} />
              </div>
            </button>
          );
        })}
      </div>
        </TooltipProvider>
      </section>

      <MetricDrilldownDialog
        open={drilldownOpen}
        onOpenChange={setDrilldownOpen}
        metricKey={selectedMetricKey}
        title={selectedMetricTitle}
        barsSeries={drilldownBarsSeries}
        summaryItems={drilldownSummaryItems}
      />
    </div>
  );
}
