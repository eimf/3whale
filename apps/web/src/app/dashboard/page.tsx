"use client";

import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslations } from "next-intl";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Legend,
  Tooltip,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { setRangeDays, setSelectedDay, DASHBOARD_RANGE_DAYS } from "@/store/dashboardSlice";
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Legend,
  Tooltip
);


export default function DashboardPage() {
  const t = useTranslations();
  const dispatch = useDispatch();
  const rangeDays = useSelector((s: RootState) => s.dashboard.rangeDays);
  const selectedDay = useSelector((s: RootState) => s.dashboard.selectedDay);

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

  // Display-only: profit margin from server summary (no client-side totals).
  const profitMarginPct = useMemo(() => {
    if (!summary) return null;
    const rev = Number(summary.incomeBruto.display);
    const net = Number(summary.incomeNeto.display);
    if (rev <= 0) return null;
    return ((net / rev) * 100).toFixed(1);
  }, [summary]);

  // Chart: plot from .raw; string→number for visualization only (no client-side money calc).
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;
    const labels = data.map((r) => r.date);
    return {
      labels,
      datasets: [
        {
          label: t("metrics.incomeNeto"),
          data: data.map((r) => Number(r.incomeNeto.raw)),
          borderColor: "rgb(34, 197, 94)",
          backgroundColor: "rgba(34, 197, 94, 0.1)",
          fill: true,
        },
        {
          label: t("metrics.incomeBruto"),
          data: data.map((r) => Number(r.incomeBruto.raw)),
          borderColor: "rgb(59, 130, 246)",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          fill: true,
        },
        {
          label: t("metrics.refunds"),
          data: data.map((r) => Number(r.refunds.raw)),
          borderColor: "rgb(239, 68, 68)",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          fill: true,
        },
      ],
    };
  }, [data, t]);

  const revenueChartData = useMemo(() => {
    if (!data || data.length === 0) return null;
    const labels = data.map((r) => r.date.slice(5));
    const rev = data.map((r) => Number(r.incomeBruto.raw));
    return {
      labels,
      datasets: [
        { label: t("metrics.revenue"), data: rev, borderColor: "rgb(255,255,255)", backgroundColor: "rgba(255,255,255,0.1)", fill: true },
      ],
    };
  }, [data, t]);

  const ordersPerDayData = useMemo(() => {
    if (!data || data.length === 0) return null;
    const labels = data.map((r) => r.date.slice(5));
    const counts = data.map((r) => r.ordersCount ?? 0);
    return {
      labels,
      datasets: [{ label: t("metrics.ordersPerDay"), data: counts, backgroundColor: "rgba(113, 113, 122, 0.8)" }],
    };
  }, [data, t]);

  const netProfitChartData = useMemo(() => {
    if (!data || data.length === 0) return null;
    const labels = data.map((r) => r.date.slice(5));
    const net = data.map((r) => Number(r.incomeNeto.raw));
    return {
      labels,
      datasets: [
        { label: t("metrics.netProfitChart"), data: net, borderColor: "rgb(34, 197, 94)", backgroundColor: "rgba(34, 197, 94, 0.1)", fill: true },
      ],
    };
  }, [data, t]);

  const options = useMemo(
    () => ({
      responsive: true,
      onClick: (_: unknown, elements: { index: number }[], chart: { config?: { data?: { labels?: unknown[] } } }) => {
        if (elements.length === 0) return;
        const idx = elements[0].index;
        const label = chart?.config?.data?.labels?.[idx];
        if (typeof label === "string" && /^\d{4}-\d{2}-\d{2}$/.test(label)) {
          dispatch(setSelectedDay(label));
        }
      },
    }),
    [dispatch]
  );

  const barOptions = useMemo(() => ({ responsive: true }), []);

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

  /** 15 metrics in screenshot order: icon + title + value + sparkline on every tile. */
  const tileConfigs: { metricKey: DashboardMetricKey; titleKey: keyof typeof tileTitleKeys }[] = [
    { metricKey: "orderRevenue", titleKey: "orderRevenue" },
    { metricKey: "totalOrders", titleKey: "totalOrders" },
    { metricKey: "returns", titleKey: "returns" },
    { metricKey: "taxes", titleKey: "taxes" },
    { metricKey: "trueAov", titleKey: "trueAov" },
    { metricKey: "averageOrderValue", titleKey: "averageOrderValue" },
    { metricKey: "newCustomers", titleKey: "newCustomers" },
    { metricKey: "grossSales", titleKey: "grossSales" },
    { metricKey: "returningCustomers", titleKey: "returningCustomers" },
    { metricKey: "ordersOverZero", titleKey: "ordersOverZero" },
    { metricKey: "newCustomerOrders", titleKey: "newCustomerOrders" },
    { metricKey: "unitsSold", titleKey: "unitsSold" },
    { metricKey: "newCustomerRevenue", titleKey: "newCustomerRevenue" },
    { metricKey: "returningCustomerRevenue", titleKey: "returningCustomerRevenue" },
    { metricKey: "discounts", titleKey: "discounts" },
  ];
  const tileTitleKeys = {
    orderRevenue: "metrics.orderRevenue",
    totalOrders: "metrics.totalOrders",
    returns: "metrics.returns",
    taxes: "metrics.taxes",
    trueAov: "metrics.trueAov",
    averageOrderValue: "metrics.averageOrderValue",
    newCustomers: "metrics.newCustomers",
    grossSales: "metrics.grossSales",
    returningCustomers: "metrics.returningCustomers",
    ordersOverZero: "metrics.ordersOverZero",
    newCustomerOrders: "metrics.newCustomerOrders",
    unitsSold: "metrics.unitsSold",
    newCustomerRevenue: "metrics.newCustomerRevenue",
    returningCustomerRevenue: "metrics.returningCustomerRevenue",
    discounts: "metrics.discounts",
  } as const;

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

      {/* Metric cards: 15 tiles from screenshot. Icon + title + value + sparkline; each opens drilldown. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tileConfigs.map((config) => {
          const title = t(tileTitleKeys[config.titleKey]);
          const value = getTileValue(config.metricKey);
          const sparklineValues = getSparklineValues(config.metricKey, data);
          return (
            <button
              key={config.metricKey}
              type="button"
              onClick={() => openDrilldown(config.metricKey, title)}
              className="bg-zinc-800 rounded-lg p-4 border border-zinc-700 text-left w-full hover:bg-zinc-700/90 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950 flex flex-col"
            >
              <div className="flex items-center gap-2">
                <ShoppingBagIcon />
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{title}</span>
              </div>
              <div className="text-xl font-semibold text-zinc-100 mt-1">{value}</div>
              <div className="mt-2 flex items-end justify-start min-h-[36px]">
                <TileSparkline values={sparklineValues} />
              </div>
            </button>
          );
        })}
      </div>

      <MetricDrilldownDialog
        open={drilldownOpen}
        onOpenChange={setDrilldownOpen}
        metricKey={selectedMetricKey}
        title={selectedMetricTitle}
        barsSeries={drilldownBarsSeries}
        summaryItems={drilldownSummaryItems}
      />

      {/* Charts: all from API /api/income/daily */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700 min-h-[280px]">
          <h3 className="text-sm font-medium text-zinc-400 mb-2">{t("metrics.revenue")}</h3>
          {revenueChartData && <Line data={revenueChartData} options={barOptions} />}
        </div>
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700 min-h-[280px]">
          <h3 className="text-sm font-medium text-zinc-400 mb-2">{t("metrics.netProfitChart")}</h3>
          {netProfitChartData && <Line data={netProfitChartData} options={barOptions} />}
        </div>
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700 min-h-[280px]">
          <h3 className="text-sm font-medium text-zinc-400 mb-2">{t("metrics.ordersPerDay")}</h3>
          {ordersPerDayData && <Bar data={ordersPerDayData} options={barOptions} />}
        </div>
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700 min-h-[280px]">
          <h3 className="text-sm font-medium text-zinc-400 mb-2">{t("dashboard.incomeOverview")}</h3>
          {chartData && <Line data={chartData} options={options} />}
        </div>
      </div>

      <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
        <h2 className="text-sm font-medium text-zinc-400 mb-2">{t("drilldown.selectDay")}</h2>
        {selectedDay ? (
          <p className="text-zinc-200">
            {t("drilldown.ordersForDay", { date: selectedDay })}
            <span className="ml-2 text-zinc-500">(Próximamente: listado de órdenes)</span>
          </p>
        ) : (
          <p className="text-zinc-500">Selecciona un día en la gráfica para ver el detalle.</p>
        )}
      </div>
    </div>
  );
}
