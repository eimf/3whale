"use client";

import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Legend,
  Tooltip,
} from "chart.js";
import { Chart as ChartJS } from "chart.js";
import type { BarSeriesPoint } from "./MetricBarsChart";
import type { DashboardMetricKey } from "@/types/metrics";
import {
  formatTooltipTitle,
  formatMetricValue,
  formatAxisTick,
} from "@/lib/formatMetric";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Legend,
  Tooltip
);

export interface MetricComparisonChartProps {
  currentSeries: BarSeriesPoint[];
  /** When empty or undefined, only current series is shown (solid cyan). */
  comparisonSeries?: BarSeriesPoint[];
  currentLabel?: string;
  comparisonLabel?: string;
  metricKey: DashboardMetricKey;
  granularity: "hour" | "day";
  currencyCode: string;
  locale?: string;
}

/**
 * Overlay line chart: solid cyan (current) + optional dotted grey (previous).
 * When comparisonSeries is empty/undefined, only current series is rendered.
 * X-axis normalized so both series align by index when comparison is present.
 */
export function MetricComparisonChart({
  currentSeries,
  comparisonSeries = [],
  currentLabel = "Current",
  comparisonLabel = "Previous",
  metricKey,
  granularity,
  currencyCode,
  locale = "en",
}: MetricComparisonChartProps) {
  const hasComparison =
    Array.isArray(comparisonSeries) && comparisonSeries.length > 0;
  const chartData = useMemo(() => {
    const n = Math.max(
      currentSeries.length,
      comparisonSeries?.length ?? 0,
      1
    );
    const labels =
      currentSeries.length >= n
        ? currentSeries.map((p) => p.x)
        : (comparisonSeries?.length ?? 0) >= n
          ? comparisonSeries!.map((p) => p.x)
          : Array.from({ length: n }, (_, i) => String(i));
    const currentValues = Array(n).fill(null);
    currentSeries.forEach((p, i) => {
      currentValues[i] = p.y;
    });
    const datasets: {
      label: string;
      data: (number | null)[];
      borderColor: string;
      backgroundColor: string;
      fill: boolean;
      tension: number;
      borderWidth: number;
      pointRadius: number;
      pointBackgroundColor: string;
      borderDash?: number[];
    }[] = [
      {
        label: currentLabel,
        data: currentValues,
        borderColor: "rgb(34, 211, 238)",
        backgroundColor: "rgba(34, 211, 238, 0.15)",
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 2,
        pointBackgroundColor: "rgb(34, 211, 238)",
      },
    ];
    if (hasComparison && comparisonSeries) {
      const comparisonValues = Array(n).fill(null);
      comparisonSeries.forEach((p, i) => {
        comparisonValues[i] = p.y;
      });
      datasets.push({
        label: comparisonLabel,
        data: comparisonValues,
        borderColor: "rgba(148, 163, 184, 0.9)",
        backgroundColor: "transparent",
        fill: false,
        borderDash: [6, 4],
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 2,
        pointBackgroundColor: "rgba(148, 163, 184, 0.9)",
      });
    }
    return { labels, datasets };
  }, [
    currentSeries,
    comparisonSeries,
    currentLabel,
    comparisonLabel,
    hasComparison,
  ]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: { color: "#a1a1aa", font: { size: 12 } },
        },
        tooltip: {
          backgroundColor: "rgb(39, 39, 42)",
          titleColor: "#e4e4e7",
          bodyColor: "#a1a1aa",
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1,
          callbacks: {
            title: (items: { label: string }[]) =>
              items.length > 0
                ? formatTooltipTitle({
                    label: items[0].label,
                    granularity,
                    locale,
                  })
                : "",
            label: (ctx: { raw: unknown }) =>
              formatMetricValue({
                metricKey,
                value:
                  typeof ctx.raw === "number" ? ctx.raw : Number(ctx.raw),
                currencyCode,
                locale,
              }),
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.06)", drawBorder: false },
          ticks: { color: "#a1a1aa", maxRotation: 45, font: { size: 11 } },
        },
        y: {
          grid: { color: "rgba(255,255,255,0.06)", drawBorder: false },
          ticks: {
            color: "#a1a1aa",
            callback: (value: number | string): string =>
              formatAxisTick({
                metricKey,
                value,
                currencyCode,
                locale,
              }),
            font: { size: 11 },
          },
        },
      },
    }),
    [metricKey, granularity, currencyCode, locale]
  );

  return (
    <div className="min-h-[260px] w-full">
      <Line data={chartData} options={options} />
    </div>
  );
}
