"use client";

import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import {
  CategoryScale,
  LinearScale,
  BarElement,
  Legend,
  Tooltip,
} from "chart.js";
import { Chart as ChartJS } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Legend, Tooltip);

/**
 * Bar series point: real shape used by dashboard (from DailyPointV2).
 * Values converted to number for rendering only; no client-side money logic.
 */
export type BarSeriesPoint = { x: string; y: number };

interface MetricBarsChartProps {
  /** Real series from state (e.g. mapped from data). Do not pass mock data. */
  series: BarSeriesPoint[];
  /** Dataset label for legend */
  label?: string;
}

/** Format Y-axis as compact numbers (e.g. 30K, 60K) for readability. */
function formatAxisValue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

/**
 * Renders a Chart.js bar chart only when real series data exists and has length > 0.
 * Otherwise shows "No data yet". No mock data, no empty chart with fake zeros.
 * Styled with blue-to-emerald gradient bars and compact Y-axis (K/M).
 */
export function MetricBarsChart({ series, label = "Value" }: MetricBarsChartProps) {
  const chartData = useMemo(() => {
    if (!series || series.length === 0) return null;
    return {
      labels: series.map((p) => p.x),
      datasets: [
        {
          label,
          data: series.map((p) => p.y),
          backgroundColor: (ctx: { chart: { ctx: CanvasRenderingContext2D; height: number } }) => {
            const { chart } = ctx;
            const g = chart.ctx.createLinearGradient(0, 0, 0, chart.height);
            g.addColorStop(0, "rgba(52, 211, 153, 0.9)");
            g.addColorStop(0.5, "rgba(34, 197, 94, 0.85)");
            g.addColorStop(1, "rgba(59, 130, 246, 0.8)");
            return g;
          },
          borderColor: "rgba(52, 211, 153, 0.6)",
          borderWidth: 1,
        },
      ],
    };
  }, [series, label]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: true,
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

  if (!series || series.length === 0) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-6">
        <p className="text-sm text-zinc-500">No data yet</p>
      </div>
    );
  }

  return (
    <div className="min-h-[260px] w-full">
      <Bar data={chartData!} options={options} />
    </div>
  );
}
