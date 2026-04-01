/**
 * Poll GET /api/sync/status until terminal success/failure or timeout (with jitter).
 */

import type { DailyV2Response, SummaryV2, SyncStatusResponse } from "@/types/income";
import { getNewTerminalOutcome } from "./syncStatusDerived";

/** Per-tab session flag: absent, "pending" (in flight), or "done" (attempt finished). */
export const DASHBOARD_AUTO_SYNC_SESSION_KEY = "3whale_dashboard_auto_sync_v1";

export const SYNC_POLL_INTERVAL_MS = 2000;
export const SYNC_POLL_JITTER_MS = 500;
export const SYNC_WAIT_TIMEOUT_MS = 180_000;

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

/** Base interval + random jitter to avoid synchronized polls. */
export async function sleepPollInterval(): Promise<void> {
    const jitter = Math.floor(Math.random() * (SYNC_POLL_JITTER_MS + 1));
    await sleep(SYNC_POLL_INTERVAL_MS + jitter);
}

export async function fetchSyncStatus(): Promise<SyncStatusResponse | null> {
    const res = await fetch("/api/sync/status", { cache: "no-store" });
    if (!res.ok) return null;
    return res.json() as Promise<SyncStatusResponse>;
}

export async function waitForSyncTerminal(args: {
    baselineFinishedAt: string | null;
    timeoutMs: number;
    isCancelled: () => boolean;
}): Promise<
    | { completed: true; success: boolean; status: SyncStatusResponse }
    | { completed: false; reason: "timeout" | "cancelled" }
> {
    const deadline = Date.now() + args.timeoutMs;
    while (Date.now() < deadline) {
        if (args.isCancelled()) {
            return { completed: false, reason: "cancelled" };
        }
        const status = await fetchSyncStatus();
        if (status?.syncState || status?.lastRunLogs?.length) {
            const outcome = getNewTerminalOutcome(status, args.baselineFinishedAt);
            if (outcome === "success") {
                return { completed: true, success: true, status };
            }
            if (outcome === "failure") {
                return { completed: true, success: false, status };
            }
        }
        await sleepPollInterval();
    }
    return { completed: false, reason: "timeout" };
}

export async function refetchDashboardIncome(args: {
    queryString: string;
}): Promise<{
    daily: DailyV2Response | null;
    summary: SummaryV2 | null;
    sync: SyncStatusResponse | null;
}> {
    const [dailyRes, summaryRes, syncRes] = await Promise.all([
        fetch(`/api/income/daily?${args.queryString}`, { cache: "no-store" }),
        fetch(`/api/income/summary?${args.queryString}`, { cache: "no-store" }),
        fetch("/api/sync/status", { cache: "no-store" }),
    ]);
    const daily = dailyRes.ok
        ? ((await dailyRes.json()) as DailyV2Response)
        : null;
    const summary = summaryRes.ok
        ? ((await summaryRes.json()) as SummaryV2)
        : null;
    const sync = syncRes.ok
        ? ((await syncRes.json()) as SyncStatusResponse)
        : null;
    return { daily, summary, sync };
}
