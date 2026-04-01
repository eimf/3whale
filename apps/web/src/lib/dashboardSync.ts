/**
 * Dashboard sync: detect in-flight runs from sync_state, poll until terminal, refetch income.
 */

import type { DailyV2Response, SummaryV2, SyncStatusResponse } from "@/types/income";

/** Per-tab session flag: absent, "pending" (in flight), or "done" (attempt finished). */
export const DASHBOARD_AUTO_SYNC_SESSION_KEY = "3whale_dashboard_auto_sync_v1";

export const SYNC_POLL_INTERVAL_MS = 2000;
export const SYNC_WAIT_TIMEOUT_MS = 180_000;

export function isSyncRunning(
    syncState: SyncStatusResponse["syncState"],
): boolean {
    if (!syncState?.lastSyncStartedAt) return false;
    const started = Date.parse(syncState.lastSyncStartedAt);
    if (Number.isNaN(started)) return false;
    const finished = syncState.lastSyncFinishedAt
        ? Date.parse(syncState.lastSyncFinishedAt)
        : 0;
    if (Number.isNaN(finished)) return true;
    return started > finished;
}

/** True when a completed run is newer than baselineFinishedAt (or first-ever completion if baseline is null). */
export function getNewTerminalOutcome(
    status: SyncStatusResponse,
    baselineFinishedAt: string | null,
): "success" | "failure" | null {
    const s = status.syncState;
    if (!s?.lastSyncFinishedAt) return null;
    if (s.lastSyncStatus !== "success" && s.lastSyncStatus !== "failure")
        return null;
    if (baselineFinishedAt === null) {
        return s.lastSyncStatus as "success" | "failure";
    }
    if (s.lastSyncFinishedAt !== baselineFinishedAt) {
        return s.lastSyncStatus as "success" | "failure";
    }
    return null;
}

export function isDashboardSyncStale(
    syncState: SyncStatusResponse["syncState"],
): boolean {
    if (!syncState) return true;
    if (!syncState.lastSyncFinishedAt) return true;
    return syncState.lastSyncStatus === "failure";
}

export async function fetchSyncStatus(): Promise<SyncStatusResponse | null> {
    const res = await fetch("/api/sync/status");
    if (!res.ok) return null;
    return res.json() as Promise<SyncStatusResponse>;
}

export async function waitForSyncTerminal(args: {
    baselineFinishedAt: string | null;
    pollIntervalMs: number;
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
        if (status?.syncState) {
            const outcome = getNewTerminalOutcome(status, args.baselineFinishedAt);
            if (outcome === "success") {
                return { completed: true, success: true, status };
            }
            if (outcome === "failure") {
                return { completed: true, success: false, status };
            }
        }
        await new Promise((r) => setTimeout(r, args.pollIntervalMs));
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
        fetch(`/api/income/daily?${args.queryString}`),
        fetch(`/api/income/summary?${args.queryString}`),
        fetch("/api/sync/status"),
    ]);
    const daily = dailyRes.ok
        ? ((await dailyRes.json()) as DailyV2Response)
        : null;
    const summary = summaryRes.ok
        ? ((await summaryRes.json()) as SummaryV2)
        : null;
    const sync = syncRes.ok ? ((await syncRes.json()) as SyncStatusResponse) : null;
    return { daily, summary, sync };
}

export function shouldCooldownEnqueue(
    syncState: SyncStatusResponse["syncState"],
    cooldownMs: number,
): boolean {
    if (!syncState?.lastSyncStartedAt) return false;
    const started = Date.parse(syncState.lastSyncStartedAt);
    if (Number.isNaN(started)) return false;
    if (syncState.lastSyncStatus === "failure") return false;
    return Date.now() - started < cooldownMs;
}
