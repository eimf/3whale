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

      {/* Metric cards: from summary API (MoneyValue.display); no client-side totals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t("metrics.orderRevenue")}</div>
          <div className="text-xl font-semibold text-zinc-100 mt-1">
            {formatMoneyMXN(summary.incomeNeto.display)} MXN
          </div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t("metrics.returns")}</div>
          <div className="text-xl font-semibold text-zinc-100 mt-1">
            {formatMoneyMXN(summary.refunds.display)} MXN
          </div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t("metrics.cogs")}</div>
          <div className="text-xl font-semibold text-zinc-100 mt-1">—</div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t("metrics.adSpend")}</div>
          <div className="text-xl font-semibold text-zinc-100 mt-1">—</div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t("metrics.shippingCost")}</div>
          <div className="text-xl font-semibold text-zinc-100 mt-1">
            {formatMoneyMXN(summary.shippingAmount.display)} MXN
          </div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t("metrics.totalOrders")}</div>
          <div className="text-xl font-semibold text-zinc-100 mt-1">{summary.ordersIncluded.toLocaleString()}</div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t("metrics.grossProfit")}</div>
          <div className="text-xl font-semibold text-zinc-100 mt-1">—</div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t("metrics.netProfit")}</div>
          <div className="text-xl font-semibold text-zinc-100 mt-1">
            {formatMoneyMXN(summary.incomeNeto.display)} MXN
          </div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t("metrics.profitMargin")}</div>
          <div className="text-xl font-semibold text-zinc-100 mt-1">
            {profitMarginPct != null ? `${profitMarginPct}%` : "—"}
          </div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t("metrics.blendedRoas")}</div>
          <div className="text-xl font-semibold text-zinc-100 mt-1">—</div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t("metrics.aov")}</div>
          <div className="text-xl font-semibold text-zinc-100 mt-1">
            {summary.ordersIncluded > 0 ? `$${formatMoneyMXN(summary.aovNeto.display)}` : "—"}
          </div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t("metrics.cac")}</div>
          <div className="text-xl font-semibold text-zinc-100 mt-1">—</div>
        </div>
      </div>

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
