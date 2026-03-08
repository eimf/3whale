import type { DashboardMetricKey } from "@/types/metrics";
import { metricsMeta } from "@/lib/metricsMeta";

export interface FormatMetricValueParams {
  metricKey: DashboardMetricKey;
  value: number | null | undefined;
  currencyCode: string;
  locale?: string;
}

/**
 * Format a metric value for display (tiles, drilldown summary, chart tooltips).
 * Uses metricsMeta[metricKey].format: money → currency, number → grouped integer, percent → percent.
 */
export function formatMetricValue({
  metricKey,
  value,
  currencyCode,
  locale = "en",
}: FormatMetricValueParams): string {
  if (value == null || Number.isNaN(value)) return "—";
  const meta = metricsMeta[metricKey];
  const format = meta?.format ?? "number";

  switch (format) {
    case "money": {
      const n = Number(value);
      const hasDecimals = n !== Math.round(n);
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currencyCode,
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: hasDecimals ? 2 : 0,
        maximumFractionDigits: hasDecimals ? 2 : 0,
      }).format(n);
    }
    case "percent": {
      const n = Number(value);
      return new Intl.NumberFormat(locale, {
        style: "percent",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(n / 100);
    }
    case "number":
    default:
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Number(value));
  }
}

export interface FormatTooltipTitleParams {
  label: string;
  granularity: "hour" | "day";
  locale?: string;
}

/**
 * Format chart tooltip title from X label.
 * - hour: label is "HH:00" → display "HH:mm" (e.g. "10:00"), zero-padded.
 * - day: label is "MM-DD" → parse with dummy year 2000, display "MMM d" (e.g. "Mar 7").
 * No timezone conversions; labels are pre-formatted strings.
 */
export function formatTooltipTitle({
  label,
  granularity,
  locale = "en",
}: FormatTooltipTitleParams): string {
  if (granularity === "hour") {
    const match = label.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const h = match[1].padStart(2, "0");
      const m = match[2].padStart(2, "0");
      return `${h}:${m}`;
    }
    return label;
  }
  if (granularity === "day") {
    const match = label.match(/^(\d{1,2})-(\d{1,2})$/);
    if (match) {
      const monthIndex = parseInt(match[1], 10) - 1;
      const day = parseInt(match[2], 10);
      if (monthIndex >= 0 && monthIndex <= 11 && day >= 1 && day <= 31) {
        const d = new Date(2000, monthIndex, day);
        return d.toLocaleDateString(locale, {
          month: "short",
          day: "numeric",
        });
      }
    }
    return label;
  }
  return label;
}

export interface FormatAxisTickParams {
  metricKey: DashboardMetricKey;
  value: unknown;
  currencyCode: string;
  locale?: string;
}

/**
 * Format value-axis tick for Chart.js. Converts value to number and uses formatMetricValue.
 * Returns empty string if value is not numeric.
 */
export function formatAxisTick({
  metricKey,
  value,
  currencyCode,
  locale = "en",
}: FormatAxisTickParams): string {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return "";
  return formatMetricValue({ metricKey, value: n, currencyCode, locale });
}
