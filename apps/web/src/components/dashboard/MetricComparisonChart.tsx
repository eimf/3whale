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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Legend,
  Tooltip
);

function formatAxisValue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

export interface MetricComparisonChartProps {
  currentSeries: BarSeriesPoint[];
  /** When empty or undefined, only current series is shown (solid cyan). */
  comparisonSeries?: BarSeriesPoint[];
  currentLabel?: string;
  comparisonLabel?: string;
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
}: MetricComparisonChartProps) {
  const hasComparison = Array.isArray(comparisonSeries) && comparisonSeries.length > 0;
  const chartData = useMemo(() => {
    const n = Math.max(currentSeries.length, comparisonSeries?.length ?? 0, 1);
    const labels = currentSeries.length >= n
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
  }, [currentSeries, comparisonSeries, currentLabel, comparisonLabel, hasComparison]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: { display: true, labels: { color: "#a1a1aa", font: { size: 12 } } },
        tooltip: {
          backgroundColor: "rgb(39, 39, 42)",
          titleColor: "#e4e4e7",
          bodyColor: "#a1a1aa",
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1,
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
              typeof value === "number" ? formatAxisValue(value) : String(value),
            font: { size: 11 },
          },
        },
      },
    }),
    []
  );

  return (
    <div className="min-h-[260px] w-full">
      <Line data={chartData} options={options} />
    </div>
  );
}
