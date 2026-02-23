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

type DailyRow = {
  date: string;
  ordersCount?: number;
  incomeBruto: string;
  refunds: string;
  incomeNeto: string;
  shippingAmount?: string;
  taxAmount?: string;
  discountAmount?: string;
};

export default function DashboardPage() {
  const t = useTranslations();
  const dispatch = useDispatch();
  const rangeDays = useSelector((s: RootState) => s.dashboard.rangeDays);
  const selectedDay = useSelector((s: RootState) => s.dashboard.selectedDay);

  const [data, setData] = useState<DailyRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
    });
    fetch(`/api/income/daily?days=${rangeDays}`)
      .then((res) => {
        if (!res.ok) return res.json().then((b) => Promise.reject(b));
        return res.json();
      })
      .then((json: DailyRow[]) => {
        if (!cancelled) setData(Array.isArray(json) ? json : []);
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

  // Period totals (sum over selected range) — so changing range changes the numbers
  const periodTotals = useMemo(() => {
    if (!data || data.length === 0)
      return {
        incomeBruto: "0",
        refunds: "0",
        incomeNeto: "0",
        shippingAmount: "0",
        totalOrders: 0,
      };
    let incomeBruto = 0;
    let refunds = 0;
    let incomeNeto = 0;
    let shippingAmount = 0;
    let totalOrders = 0;
    for (const r of data) {
      incomeBruto += Number(r.incomeBruto);
      refunds += Number(r.refunds);
      incomeNeto += Number(r.incomeNeto);
      shippingAmount += Number(r.shippingAmount ?? "0");
      totalOrders += r.ordersCount ?? 0;
    }
    return {
      incomeBruto: String(incomeBruto),
      refunds: String(refunds),
      incomeNeto: String(incomeNeto),
      shippingAmount: String(shippingAmount),
      totalOrders,
    };
  }, [data]);

  const dateRangeLabel = useMemo(() => {
    if (!data || data.length === 0) return "";
    const first = data[0].date;
    const last = data[data.length - 1].date;
    return `${first} → ${last}`;
  }, [data]);

  const profitMarginPct = useMemo(() => {
    const rev = Number(periodTotals.incomeBruto);
    const net = Number(periodTotals.incomeNeto);
    if (rev <= 0) return null;
    return ((net / rev) * 100).toFixed(1);
  }, [periodTotals]);

  const aov = useMemo(() => {
    const rev = Number(periodTotals.incomeBruto);
    const orders = periodTotals.totalOrders;
    if (orders <= 0) return null;
    return (rev / orders).toFixed(0);
  }, [periodTotals]);

  // Chart: convert money strings to numbers for plotting only.
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;
    const labels = data.map((r) => r.date);
    return {
      labels,
      datasets: [
        {
          label: t("metrics.incomeNeto"),
          data: data.map((r) => Number(r.incomeNeto)),
          borderColor: "rgb(34, 197, 94)",
          backgroundColor: "rgba(34, 197, 94, 0.1)",
          fill: true,
        },
        {
          label: t("metrics.incomeBruto"),
          data: data.map((r) => Number(r.incomeBruto)),
          borderColor: "rgb(59, 130, 246)",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          fill: true,
        },
        {
          label: t("metrics.refunds"),
          data: data.map((r) => Number(r.refunds)),
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
    const rev = data.map((r) => Number(r.incomeBruto));
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
    const net = data.map((r) => Number(r.incomeNeto));
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
  if (!data || data.length === 0) {
    return (
      <div className="p-6 text-zinc-400">
        {t("state.noData")}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header: title left, range + date right (wireframe) */}
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

      {/* Metric cards: period totals from API (range changes the numbers) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t("metrics.revenue")}</div>
          <div className="text-xl font-semibold text-zinc-100 mt-1">
            {formatMoneyMXN(periodTotals.incomeBruto)} MXN
          </div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t("metrics.returns")}</div>
          <div className="text-xl font-semibold text-zinc-100 mt-1">
            {formatMoneyMXN(periodTotals.refunds)} MXN
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
            {formatMoneyMXN(periodTotals.shippingAmount)} MXN
          </div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t("metrics.totalOrders")}</div>
          <div className="text-xl font-semibold text-zinc-100 mt-1">{periodTotals.totalOrders.toLocaleString()}</div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t("metrics.grossProfit")}</div>
          <div className="text-xl font-semibold text-zinc-100 mt-1">—</div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t("metrics.netProfit")}</div>
          <div className="text-xl font-semibold text-zinc-100 mt-1">
            {formatMoneyMXN(periodTotals.incomeNeto)} MXN
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
            {aov != null ? `$${aov}` : "—"}
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
