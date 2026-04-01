/**
 * Pure helpers for interpreting GET /api/sync/status (syncState + lastRunLogs).
 */

import type { SyncStatusResponse } from "@/types/income";

/**
 * Treat successful syncs older than this window as stale so dashboard login
 * can enqueue/poll a fresh incremental sync.
 */
const SYNC_FRESHNESS_WINDOW_MS = 5 * 60 * 1000;

function isSyncRunningFromState(
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

/** In progress if sync_state says so, or latest run log row is still running. */
export function isSyncRunning(status: SyncStatusResponse): boolean {
    if (isSyncRunningFromState(status.syncState)) return true;
    const log = status.lastRunLogs?.[0];
    if (log?.status === "running" && !log.finishedAt) return true;
    return false;
}

function terminalFromSyncState(
    syncState: SyncStatusResponse["syncState"],
    baselineFinishedAt: string | null,
): "success" | "failure" | null {
    const s = syncState;
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

function terminalFromLatestLog(
    status: SyncStatusResponse,
    baselineFinishedAt: string | null,
): "success" | "failure" | null {
    if (baselineFinishedAt === null) return null;
    const log = status.lastRunLogs?.[0];
    if (!log?.finishedAt) return null;
    if (log.status !== "success" && log.status !== "failure") return null;
    const logT = Date.parse(log.finishedAt);
    const baseT = Date.parse(baselineFinishedAt);
    if (!Number.isNaN(logT) && !Number.isNaN(baseT) && logT > baseT) {
        return log.status as "success" | "failure";
    }
    if (Number.isNaN(logT) || Number.isNaN(baseT)) {
        if (log.finishedAt !== baselineFinishedAt) {
            return log.status as "success" | "failure";
        }
    }
    return null;
}

/** A completed run newer than baselineFinishedAt (or first completion in state when baseline is null). */
export function getNewTerminalOutcome(
    status: SyncStatusResponse,
    baselineFinishedAt: string | null,
): "success" | "failure" | null {
    const fromState = terminalFromSyncState(status.syncState, baselineFinishedAt);
    if (fromState) return fromState;
    return terminalFromLatestLog(status, baselineFinishedAt);
}

export function isDashboardSyncStale(
    syncState: SyncStatusResponse["syncState"],
): boolean {
    if (!syncState) return true;
    if (!syncState.lastSyncFinishedAt) return true;
    if (syncState.lastSyncStatus === "failure") return true;
    const finishedAtMs = Date.parse(syncState.lastSyncFinishedAt);
    if (Number.isNaN(finishedAtMs)) return true;
    return Date.now() - finishedAtMs > SYNC_FRESHNESS_WINDOW_MS;
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
