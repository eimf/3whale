"use client";

import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from "chart.js";
import { Chart as ChartJS } from "chart.js";
import type { DashboardMetricKey } from "@/types/metrics";
import { formatMetricValue, formatTooltipTitle } from "@/lib/formatMetric";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip
);

export interface ChartSparklineProps {
  values: number[];
  /** X-axis labels (e.g. "MM-DD" or "HH:00") for tooltip title; same length as values. */
  labels?: string[];
  granularity?: "hour" | "day";
  metricKey: DashboardMetricKey;
  currencyCode: string;
  locale?: string;
}

/** Full-bleed Chart.js sparkline for metric tiles. Blue→green gradient, no axes/legend, tooltip with X label + value. */
export function ChartSparkline({
  values,
  labels,
  granularity,
  metricKey,
  currencyCode,
  locale = "en",
}: ChartSparklineProps) {
  const effective = values.length > 0 ? values : [0];
  const chartData = useMemo(
    () => ({
      labels: effective.map((_, i) => i),
      datasets: [
        {
          label: "",
          data: effective,
          borderColor: (context: {
            chart: {
              ctx: CanvasRenderingContext2D;
              chartArea: { top: number; bottom: number } | null;
            };
          }) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return "#3b82f6";
            const gradient = ctx.createLinearGradient(
              0,
              chartArea.top,
              0,
              chartArea.bottom
            );
            gradient.addColorStop(0, "#10b981");
            gradient.addColorStop(1, "#3b82f6");
            return gradient;
          },
          backgroundColor: "rgba(16, 185, 129, 0.08)",
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
      ],
    }),
    [effective]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 4, bottom: 4, left: 0, right: 0 } },
      scales: {
        x: { display: false },
        y: { display: false },
      },
      interaction: {
        mode: "index" as const,
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: "#18181b",
          titleColor: "#a1a1aa",
          bodyColor: "#fafafa",
          borderColor: "#27272a",
          borderWidth: 1,
          displayColors: false,
          padding: 8,
          caretSize: 4,
          callbacks: {
            title: (items: { dataIndex: number }[]) => {
              if (!labels?.length || !granularity || !items?.length)
                return "";
              const i = items[0].dataIndex;
              if (i == null || i < 0 || i >= labels.length) return "";
              return formatTooltipTitle({
                label: labels[i],
                granularity,
                locale,
              });
            },
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
    }),
    [metricKey, currencyCode, locale, labels, granularity]
  );

  return (
    <div className="flex-1 w-full h-full min-h-[22px] p-0 overflow-visible">
      <Line data={chartData} options={options} />
    </div>
  );
}
