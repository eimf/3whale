"use client";

import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslations } from "next-intl";
import { setComparing, setTimezoneIana } from "@/store/dashboardSlice";
import type { RootState } from "@/store/store";
import { formatMoneyMXN } from "@/lib/formatMoneyMXN";
import type {
    DailyPointV2,
    SummaryV2,
    SyncStatusResponse,
} from "@/types/income";
import type { DailyV2Response } from "@/types/income";
import {
    MetricDrilldownDialog,
    type DashboardMetricKey,
    type SummaryItem,
} from "@/components/dashboard/MetricDrilldownDialog";
import type { BarSeriesPoint } from "@/components/dashboard/MetricBarsChart";
import { ShoppingBagIcon } from "@/components/dashboard/ShoppingBagIcon";
import { TileSparkline } from "@/components/dashboard/TileSparkline";
import {
    RangeSelectorPopover,
    getRangeTriggerLabel,
} from "@/components/dashboard/RangeSelectorPopover";
import { SyncControls } from "@/components/dashboard/SyncControls";
import { getRequestQueryString } from "@/lib/dateRangeParams";
import { formatBucketLabel } from "@/lib/hourLabel";
import {
    metricsMeta,
    TILE_METRIC_KEYS,
    TILE_TO_DELTA_KEY,
    NEGATIVE_DELTA_METRICS,
} from "@/lib/metricsMeta";
import {
    TooltipProvider,
    TooltipRoot,
    TooltipTrigger,
    TooltipPortal,
    TooltipContent,
} from "@/components/ui/tooltip";

function ShareIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
    );
}
function KebabMenuIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
        </svg>
    );
}
function FiltersIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
    );
}
function GridIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <rect width="7" height="7" x="3" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="14" rx="1" />
            <rect width="7" height="7" x="3" y="14" rx="1" />
        </svg>
    );
}

/**
 * Bar series from daily/hourly data. date can be "YYYY-MM-DD" (day) or "YYYY-MM-DDTHH:00:00" (hour).
 * For hour we use "HH:00" as x label; for day we use "MM-DD".
 */
function getBarsSeriesForMetric(
    metricKey: DashboardMetricKey,
    data: DailyPointV2[] | null,
    granularity: "hour" | "day",
): BarSeriesPoint[] | undefined {
    if (!data || data.length === 0) return undefined;
    const label = (r: DailyPointV2) => formatBucketLabel(r.date, granularity);
    if (metricKey === "orderRevenue") {
        return data.map((r) => ({
            x: label(r),
            y: Number(r.orderRevenue.raw),
        }));
    }
    if (metricKey === "netProfit") {
        return data.map((r) => ({ x: label(r), y: Number(r.incomeNeto.raw) }));
    }
    if (metricKey === "returns") {
        return data.map((r) => ({ x: label(r), y: Number(r.refunds.raw) }));
    }
    if (metricKey === "shippingCost") {
        return data.map((r) => ({
            x: label(r),
            y: Number(r.shippingAmount.raw),
        }));
    }
    if (metricKey === "totalOrders" || metricKey === "ordersOverZero") {
        return data.map((r) => ({ x: label(r), y: r.ordersCount ?? 0 }));
    }
    if (metricKey === "grossSales") {
        return data.map((r) => ({ x: label(r), y: Number(r.incomeBruto.raw) }));
    }
    if (metricKey === "taxes") {
        return data.map((r) => ({ x: label(r), y: Number(r.taxAmount.raw) }));
    }
    if (metricKey === "discounts") {
        return data.map((r) => ({
            x: label(r),
            y: Number(r.discountAmount.raw),
        }));
    }
    return undefined;
}

/** Summary items for drilldown header; label from date (MM-DD or HH:00 for hourly). */
function getSummaryItemsForMetric(
    metricKey: DashboardMetricKey,
    data: DailyPointV2[] | null,
    granularity: "hour" | "day",
): SummaryItem[] | undefined {
    if (!data || data.length === 0) return undefined;
    const slice = data.slice(-2);
    if (slice.length === 0) return undefined;
    const label = (d: string) => formatBucketLabel(d, granularity);
    const items: SummaryItem[] = [];
    for (const r of slice) {
        const displayValue = getSummaryItemDisplayValue(metricKey, r);
        if (displayValue != null)
            items.push({ label: label(r.date), displayValue });
    }
    return items.length > 0 ? items : undefined;
}

function getSummaryItemDisplayValue(
    metricKey: DashboardMetricKey,
    r: DailyPointV2,
): string | null {
    switch (metricKey) {
        case "orderRevenue":
            return `${formatMoneyMXN(r.orderRevenue.display)} MXN`;
        case "netProfit":
            return `${formatMoneyMXN(r.incomeNeto.display)} MXN`;
        case "returns":
            return `${formatMoneyMXN(r.refunds.display)} MXN`;
        case "shippingCost":
            return `${formatMoneyMXN(r.shippingAmount.display)} MXN`;
        case "totalOrders":
        case "ordersOverZero":
            return String(r.ordersCount ?? 0);
        case "grossSales":
            return `${formatMoneyMXN(r.incomeBruto.display)} MXN`;
        case "taxes":
            return `${formatMoneyMXN(r.taxAmount.display)} MXN`;
        case "discounts":
            return `${formatMoneyMXN(r.discountAmount.display)} MXN`;
        default:
            return null;
    }
}

/** Sparkline values from daily data (number for viz only). Empty array = show flat line. */
function getSparklineValues(
    metricKey: DashboardMetricKey,
    data: DailyPointV2[] | null,
): number[] {
    if (!data || data.length === 0) return [];
    if (metricKey === "orderRevenue") {
        return data.map((r) => Number(r.orderRevenue.raw));
    }
    if (metricKey === "netProfit") {
        return data.map((r) => Number(r.incomeNeto.raw));
    }
    if (metricKey === "returns") return data.map((r) => Number(r.refunds.raw));
    if (metricKey === "shippingCost")
        return data.map((r) => Number(r.shippingAmount.raw));
    if (metricKey === "totalOrders" || metricKey === "ordersOverZero") {
        return data.map((r) => r.ordersCount ?? 0);
    }
    if (metricKey === "grossSales")
        return data.map((r) => Number(r.incomeBruto.raw));
    if (metricKey === "taxes") return data.map((r) => Number(r.taxAmount.raw));
    if (metricKey === "discounts")
        return data.map((r) => Number(r.discountAmount.raw));
    return [];
}

export default function DashboardPage() {
    const t = useTranslations();
    const tRange = useTranslations("dashboard.range");
    const dispatch = useDispatch();
    const rangePreset = useSelector((s: RootState) => s.dashboard.rangePreset);
    const rangeCustom = useSelector((s: RootState) => s.dashboard.rangeCustom);
    const isComparing = useSelector((s: RootState) => s.dashboard.isComparing);
    const timezoneIana = useSelector(
        (s: RootState) => s.dashboard.timezoneIana,
    );

    const [dailyResponse, setDailyResponse] = useState<DailyV2Response | null>(
        null,
    );
    const [summary, setSummary] = useState<SummaryV2 | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(
        null,
    );
    const [syncing, setSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [drilldownOpen, setDrilldownOpen] = useState(false);
    const [selectedMetricKey, setSelectedMetricKey] =
        useState<DashboardMetricKey>("orderRevenue");
    const [selectedMetricTitle, setSelectedMetricTitle] = useState("");

    const rangeParams = useMemo(
        () =>
            getRequestQueryString(
                rangePreset,
                rangeCustom,
                timezoneIana,
                isComparing,
            ),
        [rangePreset, rangeCustom, timezoneIana, isComparing],
    );
    const queryString = rangeParams;

    useEffect(() => {
        let cancelled = false;
        if (process.env.NODE_ENV === "development") {
            // eslint-disable-next-line no-console
            console.log("[dashboard] summary request params:", queryString);
            // eslint-disable-next-line no-console
            console.log("[dashboard] daily request params:", queryString);
        }
        queueMicrotask(() => {
            if (!cancelled) {
                setLoading(true);
                setError(null);
            }
        });
        Promise.all([
            fetch(`/api/income/daily?${queryString}`).then((res) => {
                if (!res.ok) return res.json().then((b) => Promise.reject(b));
                return res.json() as Promise<DailyV2Response>;
            }),
            fetch(`/api/income/summary?${queryString}`).then((res) => {
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
                    setDailyResponse(dailyJson);
                    setSummary(summaryJson);
                    if (syncJson) {
                        setSyncStatus(syncJson);
                        const tz = syncJson.shopConfig?.timezoneIana ?? null;
                        if (tz) dispatch(setTimezoneIana(tz));
                    }
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
    }, [queryString, dispatch]);

    useEffect(() => {
        const tz = syncStatus?.shopConfig?.timezoneIana ?? null;
        if (tz) dispatch(setTimezoneIana(tz));
    }, [syncStatus, dispatch]);

    const data = dailyResponse?.data ?? null;
    const granularity = dailyResponse?.granularity ?? "day";
    const comparisonData = dailyResponse?.comparison ?? null;
    const comparisonRange =
        dailyResponse?.comparisonRange ?? summary?.comparisonRange ?? null;

    const triggerLabel = useMemo(
        () =>
            getRangeTriggerLabel(
                rangePreset,
                rangeCustom,
                summary?.range
                    ? { from: summary.range.from, to: summary.range.to }
                    : undefined,
                (k) => tRange(k),
            ),
        [rangePreset, rangeCustom, summary?.range, tRange],
    );

    const lastSyncLabel = useMemo(() => {
        if (!syncStatus?.syncState?.lastSyncFinishedAt)
            return t("sync.lastSyncedNever");
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
        setSyncError(null);
        try {
            const res = await fetch("/api/sync/run", { method: "POST" });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                setSyncError(body?.error ?? "Error");
                return;
            }
            setSyncMessage(t("sync.syncStarted"));
            setTimeout(() => {
                fetch("/api/sync/status")
                    .then((r) => (r.ok ? r.json() : null))
                    .then(
                        (s: SyncStatusResponse | null) => s && setSyncStatus(s),
                    );
                fetch(`/api/income/daily?${queryString}`)
                    .then((r) => (r.ok ? r.json() : null))
                    .then(
                        (d: DailyV2Response | null) => d && setDailyResponse(d),
                    );
                fetch(`/api/income/summary?${queryString}`)
                    .then((r) => (r.ok ? r.json() : null))
                    .then((s: SummaryV2 | null) => s && setSummary(s));
                setSyncMessage(null);
            }, 4000);
        } finally {
            setSyncing(false);
        }
    }

    const drilldownBarsSeries = useMemo(
        () => getBarsSeriesForMetric(selectedMetricKey, data, granularity),
        [selectedMetricKey, data, granularity],
    );

    const drilldownSummaryItems = useMemo(
        () => getSummaryItemsForMetric(selectedMetricKey, data, granularity),
        [selectedMetricKey, data, granularity],
    );

    function openDrilldown(metricKey: DashboardMetricKey, title: string) {
        setSelectedMetricKey(metricKey);
        setSelectedMetricTitle(title);
        setDrilldownOpen(true);
    }

    /** Delta for a tile: percentChange + direction; finance-aware color (negative metrics = red when up). */
    function getTileDelta(metricKey: DashboardMetricKey): {
        percentChange: number | null;
        direction: "up" | "down" | "flat";
        isNegative: boolean;
    } | null {
        const deltas = summary?.deltas;
        if (!deltas) return null;
        const deltaKey = TILE_TO_DELTA_KEY[metricKey];
        if (!deltaKey) return null;
        const d = deltas[deltaKey];
        if (!d) return null;
        return {
            percentChange: d.percentChange,
            direction: d.direction,
            isNegative: NEGATIVE_DELTA_METRICS.has(metricKey),
        };
    }

    const tileConfigs = TILE_METRIC_KEYS.map((metricKey) => ({ metricKey }));

    function getTileValue(metricKey: DashboardMetricKey): string {
        if (!summary) return "—";
        switch (metricKey) {
            case "orderRevenue":
                return `${formatMoneyMXN(summary.orderRevenue.display)} MXN`;
            case "netProfit":
                return `${formatMoneyMXN(summary.incomeNeto.display)} MXN`;
            case "returns":
                return `${formatMoneyMXN(summary.refunds.display)} MXN`;
            case "taxes":
                return `${formatMoneyMXN(summary.taxAmount.display)} MXN`;
            case "trueAov":
            case "averageOrderValue":
            case "aov":
                return summary.ordersIncluded > 0
                    ? `$${formatMoneyMXN(summary.aovNeto.display)}`
                    : "—";
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

    function getComparisonTotalForMetric(
        metricKey: DashboardMetricKey,
        s: SummaryV2,
    ): string | undefined {
        const comp = s.comparison;
        if (!comp) return undefined;
        switch (metricKey) {
            case "orderRevenue":
                return `${formatMoneyMXN(comp.orderRevenue.display)} MXN`;
            case "netProfit":
                return `${formatMoneyMXN(comp.incomeNeto.display)} MXN`;
            case "returns":
                return `${formatMoneyMXN(comp.refunds.display)} MXN`;
            case "taxes":
                return `${formatMoneyMXN(comp.taxAmount.display)} MXN`;
            case "trueAov":
            case "averageOrderValue":
            case "aov":
                return comp.ordersIncluded > 0
                    ? `$${formatMoneyMXN(comp.aovNeto.display)}`
                    : "—";
            case "totalOrders":
            case "ordersOverZero":
                return comp.ordersIncluded.toLocaleString();
            case "grossSales":
                return `${formatMoneyMXN(comp.incomeBruto.display)} MXN`;
            case "shippingCost":
                return `${formatMoneyMXN(comp.shippingAmount.display)} MXN`;
            case "discounts":
                return `${formatMoneyMXN(comp.discountAmount.display)} MXN`;
            default:
                return undefined;
        }
    }

    if (loading) {
        return <div className="p-6 text-zinc-400">{t("state.loading")}</div>;
    }
    if (error) {
        return (
            <div className="p-6 text-red-400">
                {t("state.errorLoading")}: {error}
            </div>
        );
    }
    if (!data || !summary) {
        return <div className="p-6 text-zinc-400">{t("state.noData")}</div>;
    }

    return (
        <div className="p-6 space-y-6">
            {/* Toolbar: single row — left: title + range + comparison; right: sync controls */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1">
                    <h1 className="text-2xl font-semibold text-zinc-100 tracking-wide shrink-0">
                        {t("dashboard.title")}
                    </h1>
                    <RangeSelectorPopover
                        triggerLabel={triggerLabel}
                        timezoneIana={timezoneIana ?? "America/Mexico_City"}
                    />
                    <button
                        type="button"
                        onClick={() => dispatch(setComparing(!isComparing))}
                        className={`rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shrink-0 ${
                            isComparing
                                ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                                : "border-zinc-600 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                        }`}
                    >
                        {isComparing
                            ? tRange("previousPeriod")
                            : tRange("noComparison")}
                    </button>
                </div>
                <div className="shrink-0">
                    <SyncControls
                        lastSyncLabel={lastSyncLabel}
                        syncing={syncing}
                        syncMessage={syncMessage}
                        syncError={syncError}
                        onRefresh={handleSyncNow}
                    />
                </div>
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
                            const sparklineValues = getSparklineValues(
                                config.metricKey,
                                data,
                            );
                            const delta = isComparing
                                ? getTileDelta(config.metricKey)
                                : null;
                            const description = t(meta.tooltipDescriptionKey);
                            const formula = meta.tooltipFormulaKey
                                ? t(meta.tooltipFormulaKey)
                                : null;
                            const note = meta.tooltipNoteKey
                                ? t(meta.tooltipNoteKey)
                                : null;
                            const deltaColor =
                                delta == null
                                    ? ""
                                    : delta.direction === "flat"
                                      ? "text-zinc-500"
                                      : delta.isNegative
                                        ? delta.direction === "up"
                                            ? "text-red-400"
                                            : "text-emerald-400"
                                        : delta.direction === "up"
                                          ? "text-emerald-400"
                                          : "text-red-400";
                            const deltaLabel =
                                delta == null
                                    ? null
                                    : delta.percentChange == null
                                      ? delta.direction === "up"
                                          ? "↑ —"
                                          : delta.direction === "down"
                                            ? "↓ —"
                                            : "—"
                                      : delta.direction === "up"
                                        ? `↑ ${delta.percentChange.toFixed(2)}%`
                                        : delta.direction === "down"
                                          ? `↓ ${Math.abs(delta.percentChange).toFixed(2)}%`
                                          : "—";
                            return (
                                <button
                                    key={config.metricKey}
                                    type="button"
                                    onClick={() =>
                                        openDrilldown(config.metricKey, title)
                                    }
                                    className="bg-zinc-800 rounded-lg p-4 border border-zinc-700 text-left w-full hover:bg-zinc-700/90 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950 flex flex-col"
                                >
                                    <div className="flex items-center gap-2 flex-wrap">
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
                                                    {formula && (
                                                        <p className="mt-1.5 text-zinc-400 font-mono text-xs">
                                                            {formula}
                                                        </p>
                                                    )}
                                                    {note && (
                                                        <p className="mt-1 text-amber-200/90 text-xs">
                                                            {note}
                                                        </p>
                                                    )}
                                                </TooltipContent>
                                            </TooltipPortal>
                                        </TooltipRoot>
                                        {deltaLabel != null && (
                                            <span
                                                className={`text-xs font-medium ${deltaColor}`}
                                            >
                                                {deltaLabel}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xl font-semibold text-zinc-100 mt-1">
                                        {value}
                                    </div>
                                    <div className="mt-2 flex items-end justify-start min-h-[36px]">
                                        <TileSparkline
                                            values={sparklineValues}
                                        />
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
                granularity={granularity}
                isComparing={isComparing}
                comparisonSeries={
                    isComparing && comparisonData
                        ? getBarsSeriesForMetric(
                              selectedMetricKey,
                              comparisonData,
                              granularity,
                          )
                        : undefined
                }
                currentRange={
                    summary?.range
                        ? { from: summary.range.from, to: summary.range.to }
                        : undefined
                }
                comparisonRange={
                    isComparing ? (comparisonRange ?? undefined) : undefined
                }
                currentTotal={
                    summary ? getTileValue(selectedMetricKey) : undefined
                }
                comparisonTotal={
                    isComparing && summary?.comparison
                        ? getComparisonTotalForMetric(
                              selectedMetricKey,
                              summary,
                          )
                        : undefined
                }
            />
        </div>
    );
}
