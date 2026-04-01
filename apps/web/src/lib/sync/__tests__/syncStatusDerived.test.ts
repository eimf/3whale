import { describe, expect, it } from "vitest";
import {
    getNewTerminalOutcome,
    isDashboardSyncStale,
    isSyncRunning,
    shouldCooldownEnqueue,
} from "../syncStatusDerived";
import type { SyncStatusResponse } from "../../../types/income";

function status(partial: Partial<SyncStatusResponse>): SyncStatusResponse {
    return {
        syncState: null,
        ...partial,
    };
}

describe("syncStatusDerived", () => {
    it("isSyncRunning: started after finished", () => {
        const s = status({
            syncState: {
                lastSyncStartedAt: "2026-03-01T12:00:00.000Z",
                lastSyncFinishedAt: "2026-03-01T11:00:00.000Z",
                lastSyncStatus: null,
            },
        });
        expect(isSyncRunning(s)).toBe(true);
    });

    it("isSyncRunning: respects latest run log row", () => {
        const s = status({
            syncState: {
                lastSyncStartedAt: "2026-03-01T10:00:00.000Z",
                lastSyncFinishedAt: "2026-03-01T11:00:00.000Z",
                lastSyncStatus: "success",
            },
            lastRunLogs: [
                {
                    startedAt: "2026-03-01T12:00:00.000Z",
                    finishedAt: null,
                    status: "running",
                },
            ],
        });
        expect(isSyncRunning(s)).toBe(true);
    });

    it("getNewTerminalOutcome: new success vs baseline", () => {
        const s = status({
            syncState: {
                lastSyncStartedAt: "2026-03-01T12:00:00.000Z",
                lastSyncFinishedAt: "2026-03-01T12:05:00.000Z",
                lastSyncStatus: "success",
            },
        });
        expect(
            getNewTerminalOutcome(s, "2026-03-01T11:00:00.000Z"),
        ).toBe("success");
        expect(getNewTerminalOutcome(s, "2026-03-01T12:05:00.000Z")).toBeNull();
    });

    it("getNewTerminalOutcome: log fallback when baseline set and log is newer", () => {
        const s = status({
            syncState: {
                lastSyncStartedAt: "2026-03-01T12:00:00.000Z",
                lastSyncFinishedAt: "2026-03-01T11:00:00.000Z",
                lastSyncStatus: "success",
            },
            lastRunLogs: [
                {
                    startedAt: "2026-03-01T12:00:00.000Z",
                    finishedAt: "2026-03-01T12:05:00.000Z",
                    status: "success",
                },
            ],
        });
        expect(getNewTerminalOutcome(s, "2026-03-01T11:00:00.000Z")).toBe(
            "success",
        );
    });

    it("isDashboardSyncStale", () => {
        expect(isDashboardSyncStale(null)).toBe(true);
        expect(
            isDashboardSyncStale({
                lastSyncStartedAt: null,
                lastSyncFinishedAt: null,
                lastSyncStatus: null,
            }),
        ).toBe(true);
        expect(
            isDashboardSyncStale({
                lastSyncStartedAt: "2026-03-01T12:00:00.000Z",
                lastSyncFinishedAt: "2026-03-01T12:01:00.000Z",
                lastSyncStatus: "failure",
            }),
        ).toBe(true);
        expect(
            isDashboardSyncStale({
                lastSyncStartedAt: "2026-03-01T12:00:00.000Z",
                lastSyncFinishedAt: "2026-03-01T12:01:00.000Z",
                lastSyncStatus: "success",
            }),
        ).toBe(false);
    });

    it("shouldCooldownEnqueue skips after recent start unless failure", () => {
        const recent = new Date(Date.now() - 30_000).toISOString();
        expect(
            shouldCooldownEnqueue(
                {
                    lastSyncStartedAt: recent,
                    lastSyncFinishedAt: recent,
                    lastSyncStatus: "success",
                },
                120_000,
            ),
        ).toBe(true);
        expect(
            shouldCooldownEnqueue(
                {
                    lastSyncStartedAt: recent,
                    lastSyncFinishedAt: recent,
                    lastSyncStatus: "failure",
                },
                120_000,
            ),
        ).toBe(false);
    });
});
