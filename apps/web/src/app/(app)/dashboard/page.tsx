"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslations, useLocale } from "next-intl";
import { setComparing, setTimezoneIana } from "@/store/dashboardSlice";
import type { RootState } from "@/store/store";
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
import { ChartSparkline } from "@/components/dashboard/ChartSparkline";
import {
    RangeSelectorPopover,
    getRangeTriggerLabel,
} from "@/components/dashboard/RangeSelectorPopover";
import { SyncControls } from "@/components/dashboard/SyncControls";
import { getRequestQueryString } from "@/lib/dateRangeParams";
import { formatBucketLabel } from "@/lib/hourLabel";
import { formatMetricValue } from "@/lib/formatMetric";
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
import {
    DASHBOARD_AUTO_SYNC_SESSION_KEY,
    SYNC_POLL_INTERVAL_MS,
    SYNC_WAIT_TIMEOUT_MS,
    fetchSyncStatus,
    isDashboardSyncStale,
    isSyncRunning,
    refetchDashboardIncome,
    shouldCooldownEnqueue,
    waitForSyncTerminal,
} from "@/lib/dashboardSync";

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
    if (metricKey === "unitsSold") {
        return data.map((r) => ({
            x: label(r),
            y: r.unitsSold ?? 0,
        }));
    }
    if (metricKey === "newCustomers") {
        return data.map((r) => ({
            x: label(r),
            y: r.newCustomers ?? 0,
        }));
    }
    if (metricKey === "returningCustomers") {
        return data.map((r) => ({
            x: label(r),
            y: r.returningCustomers ?? 0,
        }));
    }
    if (metricKey === "newCustomerOrders") {
        return data.map((r) => ({
            x: label(r),
            y: r.newCustomerOrders ?? 0,
        }));
    }
    if (metricKey === "newCustomerRevenue") {
        return data.map((r) => ({
            x: label(r),
            y: Number(r.newCustomerRevenue?.raw ?? "0"),
        }));
    }
    if (metricKey === "returningCustomerRevenue") {
        return data.map((r) => ({
            x: label(r),
            y: Number(r.returningCustomerRevenue?.raw ?? "0"),
        }));
    }
    if (metricKey === "trueAov" || metricKey === "averageOrderValue" || metricKey === "aov") {
        return data.map((r) => {
            const orders = r.ordersCount ?? 0;
            const productRevenue =
                Number(r.incomeNeto.raw) - Number(r.shippingAmount.raw);
            const y = orders > 0 ? productRevenue / orders : 0;
            return { x: label(r), y };
        });
    }
    return undefined;
}

/** Summary items for drilldown header; label from date (MM-DD or HH:00 for hourly). */
function getSummaryItemsForMetric(
    metricKey: DashboardMetricKey,
    data: DailyPointV2[] | null,
    granularity: "hour" | "day",
    currencyCode: string,
    locale: string,
): SummaryItem[] | undefined {
    if (!data || data.length === 0) return undefined;
    const slice = data.slice(-2);
    if (slice.length === 0) return undefined;
    const label = (d: string) => formatBucketLabel(d, granularity);
    const items: SummaryItem[] = [];
    for (const r of slice) {
        const displayValue = getSummaryItemDisplayValue(
            metricKey,
            r,
            currencyCode,
            locale,
        );
        if (displayValue != null)
            items.push({ label: label(r.date), displayValue });
    }
    return items.length > 0 ? items : undefined;
}

function getSummaryItemDisplayValue(
    metricKey: DashboardMetricKey,
    r: DailyPointV2,
    currencyCode: string,
    locale: string,
): string | null {
    const raw = (): number | null => {
        switch (metricKey) {
            case "orderRevenue":
                return Number(r.orderRevenue.raw);
            case "netProfit":
                return Number(r.incomeNeto.raw);
            case "returns":
                return Number(r.refunds.raw);
            case "shippingCost":
                return Number(r.shippingAmount.raw);
            case "totalOrders":
            case "ordersOverZero":
                return r.ordersCount ?? null;
            case "grossSales":
                return Number(r.incomeBruto.raw);
            case "taxes":
                return Number(r.taxAmount.raw);
            case "discounts":
                return Number(r.discountAmount.raw);
            case "unitsSold":
                return r.unitsSold ?? null;
            case "newCustomers":
                return r.newCustomers ?? null;
            case "returningCustomers":
                return r.returningCustomers ?? null;
            case "newCustomerOrders":
                return r.newCustomerOrders ?? null;
            case "newCustomerRevenue":
                return Number(r.newCustomerRevenue?.raw ?? "0");
            case "returningCustomerRevenue":
                return Number(r.returningCustomerRevenue?.raw ?? "0");
            case "trueAov":
            case "averageOrderValue":
            case "aov": {
                const orders = r.ordersCount ?? 0;
                if (orders <= 0) return null;
                const productRevenue =
                    Number(r.incomeNeto.raw) - Number(r.shippingAmount.raw);
                return productRevenue / orders;
            }
            default:
                return null;
        }
    };
    const v = raw();
    if (v == null) return null;
    return formatMetricValue({
        metricKey,
        value: v,
        currencyCode,
        locale,
    });
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
    if (metricKey === "unitsSold")
        return data.map((r) => r.unitsSold ?? 0);
    if (metricKey === "newCustomers")
        return data.map((r) => r.newCustomers ?? 0);
    if (metricKey === "returningCustomers")
        return data.map((r) => r.returningCustomers ?? 0);
    if (metricKey === "newCustomerOrders")
        return data.map((r) => r.newCustomerOrders ?? 0);
    if (metricKey === "newCustomerRevenue")
        return data.map((r) => Number(r.newCustomerRevenue?.raw ?? "0"));
    if (metricKey === "returningCustomerRevenue")
        return data.map((r) => Number(r.returningCustomerRevenue?.raw ?? "0"));
    if (metricKey === "trueAov" || metricKey === "averageOrderValue" || metricKey === "aov") {
        return data.map((r) => {
            const orders = r.ordersCount ?? 0;
            if (orders <= 0) return 0;
            const productRevenue =
                Number(r.incomeNeto.raw) - Number(r.shippingAmount.raw);
            return productRevenue / orders;
        });
    }
    return [];
}

export default function DashboardPage() {
    const t = useTranslations();
    const tRange = useTranslations("dashboard.range");
    const locale = useLocale();
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
    const dashboardUnmountRef = useRef(false);
    const syncStatusRef = useRef(syncStatus);
    syncStatusRef.current = syncStatus;

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
        dashboardUnmountRef.current = false;
        return () => {
            dashboardUnmountRef.current = true;
        };
    }, []);

    useEffect(() => {
        const tz = syncStatus?.shopConfig?.timezoneIana ?? null;
        if (tz) dispatch(setTimezoneIana(tz));
    }, [syncStatus, dispatch]);

    const runSyncUntilRefresh = useCallback(
        async (args: {
            skipPost: boolean;
            baselineFinishedAt: string | null;
            isCancelled: () => boolean;
            startMessage?: string | null;
        }): Promise<void> => {
            setSyncing(true);
            setSyncError(null);
            if (args.startMessage !== null) {
                setSyncMessage(
                    args.startMessage ?? t("sync.syncStarted"),
                );
            }
            const baseline = args.baselineFinishedAt;

            if (!args.skipPost) {
                const res = await fetch("/api/sync/run", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) {
                    setSyncError(
                        typeof body?.error === "string"
                            ? body.error
                            : "Error",
                    );
                    setSyncMessage(null);
                    setSyncing(false);
                    return;
                }
            }

            const waitResult = await waitForSyncTerminal({
                baselineFinishedAt: baseline,
                pollIntervalMs: SYNC_POLL_INTERVAL_MS,
                timeoutMs: SYNC_WAIT_TIMEOUT_MS,
                isCancelled: args.isCancelled,
            });

            if (!waitResult.completed) {
                if (waitResult.reason === "cancelled") {
                    setSyncMessage(null);
                    setSyncing(false);
                    return;
                }
                setSyncError(t("sync.timeout"));
                setSyncMessage(null);
                setSyncing(false);
                return;
            }

            setSyncStatus(waitResult.status);
            if (!waitResult.success) {
                const err =
                    waitResult.status.syncState?.lastSyncError ??
                    t("sync.failedGeneric");
                setSyncError(err);
                setSyncMessage(null);
                setSyncing(false);
                return;
            }

            const refreshed = await refetchDashboardIncome({
                queryString,
            });
            if (refreshed.daily) setDailyResponse(refreshed.daily);
            if (refreshed.summary) setSummary(refreshed.summary);
            if (refreshed.sync) {
                setSyncStatus(refreshed.sync);
                const tz = refreshed.sync.shopConfig?.timezoneIana ?? null;
                if (tz) dispatch(setTimezoneIana(tz));
            }

            setSyncMessage(null);
            setSyncing(false);
        },
        [dispatch, queryString, t],
    );

    useEffect(() => {
        if (loading || error) return;
        const statusSnapshot = syncStatusRef.current;
        if (!statusSnapshot) return;
        if (typeof sessionStorage === "undefined") return;
        if (
            sessionStorage.getItem(DASHBOARD_AUTO_SYNC_SESSION_KEY) === "done"
        ) {
            return;
        }
        if (
            sessionStorage.getItem(DASHBOARD_AUTO_SYNC_SESSION_KEY) ===
            "pending"
        ) {
            return;
        }

        const state = statusSnapshot.syncState;
        const running = isSyncRunning(state);
        const stale = isDashboardSyncStale(state);

        if (!stale && !running) return;

        if (
            !running &&
            stale &&
            shouldCooldownEnqueue(state, 120_000)
        ) {
            return;
        }

        sessionStorage.setItem(DASHBOARD_AUTO_SYNC_SESSION_KEY, "pending");

        let cancelled = false;
        const baseline = state?.lastSyncFinishedAt ?? null;
        void (async () => {
            try {
                await runSyncUntilRefresh({
                    skipPost: running,
                    baselineFinishedAt: baseline,
                    isCancelled: () =>
                        cancelled || dashboardUnmountRef.current,
                    startMessage: t("sync.autoSyncInProgress"),
                });
            } finally {
                if (!cancelled) {
                    sessionStorage.setItem(
                        DASHBOARD_AUTO_SYNC_SESSION_KEY,
                        "done",
                    );
                }
            }
        })();

        return () => {
            cancelled = true;
            if (
                sessionStorage.getItem(DASHBOARD_AUTO_SYNC_SESSION_KEY) ===
                "pending"
            ) {
                sessionStorage.removeItem(DASHBOARD_AUTO_SYNC_SESSION_KEY);
            }
        };
    }, [loading, error, t, runSyncUntilRefresh]);

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
        const baseline =
            syncStatus?.syncState?.lastSyncFinishedAt ??
            (await fetchSyncStatus())?.syncState?.lastSyncFinishedAt ??
            null;
        await runSyncUntilRefresh({
            skipPost: false,
            baselineFinishedAt: baseline,
            isCancelled: () => dashboardUnmountRef.current,
        });
    }

    const drilldownBarsSeries = useMemo(
        () => getBarsSeriesForMetric(selectedMetricKey, data, granularity),
        [selectedMetricKey, data, granularity],
    );

    const drilldownSummaryItems = useMemo(
        () =>
            summary && data
                ? getSummaryItemsForMetric(
                      selectedMetricKey,
                      data,
                      granularity,
                      summary.currencyCode ?? "MXN",
                      locale,
                  )
                : undefined,
        [selectedMetricKey, data, granularity, summary, locale],
    );

    const drilldownBreakdownRows = useMemo((): Array<{ labelKey: string; value: string }> | undefined => {
        if (!summary || (selectedMetricKey !== "trueAov" && selectedMetricKey !== "averageOrderValue")) return undefined;
        const productOnly = summary.incomeNetoProductOnly;
        const ordersPos = summary.ordersWithPositiveRevenue ?? 0;
        const aov = summary.aovNeto;
        if (productOnly == null || aov == null) return undefined;
        const currencyCode = summary.currencyCode ?? "MXN";
        const prefix = currencyCode === "MXN" ? "MX$" : `${currencyCode} `;
        return [
            { labelKey: "breakdown.netSalesOrdersValue", value: `${prefix}${productOnly.display ?? productOnly.raw}` },
            { labelKey: "breakdown.ordersOverZero", value: String(ordersPos) },
            { labelKey: "breakdown.trueAov", value: `${prefix}${aov.display ?? aov.raw}` },
        ];
    }, [selectedMetricKey, summary]);

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

        const parityDeltaMap: Partial<
            Record<
                DashboardMetricKey,
                | "grossSales"
                | "returns"
                | "taxes"
                | "shippingCharges"
                | "discounts"
                | "netSales"
            >
        > = {
            grossSales: "grossSales",
            returns: "returns",
            taxes: "taxes",
            shippingCost: "shippingCharges",
            discounts: "discounts",
            netProfit: "netSales",
        };

        const parityKey = parityDeltaMap[metricKey];
        if (parityKey && deltas.shopifyParity?.[parityKey]) {
            const d = deltas.shopifyParity[parityKey];
            return {
                percentChange: d.percentChange,
                direction: d.direction,
                isNegative: NEGATIVE_DELTA_METRICS.has(metricKey),
            };
        }

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
        const currencyCode = summary.currencyCode ?? "MXN";
        const parity = summary.shopifyParity;
        let value: number | null = null;
        switch (metricKey) {
            case "orderRevenue":
                value = Number(
                    summary.orderRevenue?.raw ??
                        summary.incomeNeto?.raw ??
                        "0",
                );
                break;
            case "netProfit":
                value = parity
                    ? Number(parity.netSales.raw)
                    : Number(summary.incomeNeto.raw);
                break;
            case "returns":
                value = parity
                    ? Number(parity.returns.raw)
                    : Number(summary.refunds.raw);
                break;
            case "taxes": {
                const parityTax = parity ? Number(parity.taxes.raw) : 0;
                value =
                    parityTax !== 0
                        ? parityTax
                        : Number(summary.taxAmount.raw);
                break;
            }
            case "trueAov":
            case "aov":
                value =
                    (summary.ordersWithPositiveRevenue ?? summary.ordersIncluded) > 0
                        ? Number(summary.aovNeto.raw)
                        : null;
                break;
            case "averageOrderValue":
                value =
                    summary.ordersIncluded > 0
                        ? Number(
                              summary.averageOrderValueAmount?.raw ??
                                  summary.aovNeto.raw,
                          )
                        : null;
                break;
            case "totalOrders":
                value = summary.ordersIncluded;
                break;
            case "ordersOverZero":
                value = summary.ordersWithPositiveRevenue ?? summary.ordersIncluded;
                break;
            case "grossSales":
                value = parity
                    ? Number(parity.grossSales.raw)
                    : Number(summary.incomeBruto.raw);
                break;
            case "shippingCost":
                value = parity
                    ? Number(parity.shippingCharges.raw)
                    : Number(summary.shippingAmount.raw);
                break;
            case "discounts":
                value = parity
                    ? Number(parity.discounts.raw)
                    : Number(summary.discountAmount.raw);
                break;
            case "unitsSold":
                value = summary.unitsSold ?? 0;
                break;
            case "newCustomers":
                value = summary.newCustomers ?? 0;
                break;
            case "returningCustomers":
                value = summary.returningCustomers ?? 0;
                break;
            case "newCustomerOrders":
                value = summary.newCustomerOrders ?? 0;
                break;
            case "newCustomerRevenue":
                value = Number(summary.newCustomerRevenue?.raw ?? "0");
                break;
            case "returningCustomerRevenue":
                value = Number(
                    summary.returningCustomerRevenue?.raw ?? "0",
                );
                break;
            default:
                return "—";
        }
        return formatMetricValue({
            metricKey,
            value,
            currencyCode,
            locale,
        });
    }

    function getComparisonTotalForMetric(
        metricKey: DashboardMetricKey,
        s: SummaryV2,
    ): string | undefined {
        const comp = s.comparison;
        if (!comp) return undefined;
        const currencyCode = s.currencyCode ?? "MXN";
        const parity = comp.shopifyParity;
        let value: number | null = null;
        switch (metricKey) {
            case "orderRevenue":
                value = Number(
                    comp.orderRevenue?.raw ?? comp.incomeNeto?.raw ?? "0",
                );
                break;
            case "netProfit":
                value = parity
                    ? Number(parity.netSales.raw)
                    : Number(comp.incomeNeto.raw);
                break;
            case "returns":
                value = parity
                    ? Number(parity.returns.raw)
                    : Number(comp.refunds.raw);
                break;
            case "taxes": {
                const compParityTax = parity ? Number(parity.taxes.raw) : 0;
                value =
                    compParityTax !== 0
                        ? compParityTax
                        : Number(comp.taxAmount.raw);
                break;
            }
            case "trueAov":
            case "aov":
                value =
                    (comp.ordersWithPositiveRevenue ?? comp.ordersIncluded) > 0
                        ? Number(comp.aovNeto.raw)
                        : null;
                break;
            case "averageOrderValue":
                value =
                    comp.ordersIncluded > 0
                        ? Number(
                              comp.averageOrderValueAmount?.raw ??
                                  comp.aovNeto.raw,
                          )
                        : null;
                break;
            case "totalOrders":
                value = comp.ordersIncluded;
                break;
            case "ordersOverZero":
                value = comp.ordersWithPositiveRevenue ?? comp.ordersIncluded;
                break;
            case "grossSales":
                value = parity
                    ? Number(parity.grossSales.raw)
                    : Number(comp.incomeBruto.raw);
                break;
            case "shippingCost":
                value = parity
                    ? Number(parity.shippingCharges.raw)
                    : Number(comp.shippingAmount.raw);
                break;
            case "discounts":
                value = parity
                    ? Number(parity.discounts.raw)
                    : Number(comp.discountAmount.raw);
                break;
            case "unitsSold":
                value = comp.unitsSold ?? 0;
                break;
            case "newCustomers":
                value = comp.newCustomers ?? 0;
                break;
            case "returningCustomers":
                value = comp.returningCustomers ?? 0;
                break;
            case "newCustomerOrders":
                value = comp.newCustomerOrders ?? 0;
                break;
            case "newCustomerRevenue":
                value = Number(comp.newCustomerRevenue?.raw ?? "0");
                break;
            case "returningCustomerRevenue":
                value = Number(
                    comp.returningCustomerRevenue?.raw ?? "0",
                );
                break;
            default:
                return undefined;
        }
        return formatMetricValue({
            metricKey,
            value,
            currencyCode,
            locale,
        });
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
            {/* Toolbar: single row — range + comparison; right: sync controls */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1">
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
                        onRefresh={() => void handleSyncNow()}
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                        {tileConfigs.map((config) => {
                            const meta = metricsMeta[config.metricKey];
                            const title = t(meta.titleKey);
                            const value = getTileValue(config.metricKey);
                            const sparklineValues = getSparklineValues(
                                config.metricKey,
                                data,
                            );
                            const sparklineLabels =
                                data?.map((r) =>
                                    formatBucketLabel(r.date, granularity),
                                ) ?? [];
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
                                    className="flex flex-col rounded-xl bg-zinc-900 border border-zinc-800/50 p-2 sm:p-2.5 shadow-sm min-h-[88px] transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/50 hover:border-zinc-700 text-left w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950 overflow-visible"
                                >
                                    {/* Header */}
                                    <div className="flex items-center gap-2">
                                        <div className="shrink-0">
                                            <ShoppingBagIcon />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <TooltipRoot>
                                                <TooltipTrigger asChild>
                                                    <div className="text-sm text-zinc-300 font-medium truncate cursor-help focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 rounded">
                                                        {title}
                                                    </div>
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
                                        </div>
                                        <div className="shrink-0">
                                            {deltaLabel != null && (
                                                <span
                                                    className={`text-[11px] lg:text-xs font-medium ${deltaColor}`}
                                                >
                                                    {deltaLabel}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Value */}
                                    <div className="mt-0.5 text-xl sm:text-2xl font-semibold text-zinc-50 truncate leading-none">
                                        {value}
                                    </div>
                                    {/* Chart */}
                                    <div className="mt-1 flex-1 w-full min-h-[22px] relative overflow-visible">
                                        <ChartSparkline
                                            values={sparklineValues}
                                            labels={sparklineLabels}
                                            granularity={granularity}
                                            metricKey={config.metricKey}
                                            currencyCode={
                                                summary.currencyCode ?? "MXN"
                                            }
                                            locale={locale}
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
                currencyCode={summary?.currencyCode ?? "MXN"}
                locale={locale}
                breakdownRows={drilldownBreakdownRows}
            />
        </div>
    );
}
