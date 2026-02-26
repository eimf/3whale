"use client";

import { useTranslations } from "next-intl";

function RefreshIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 21h5v-5" />
    </svg>
  );
}

export interface SyncControlsProps {
  lastSyncLabel: string;
  syncing: boolean;
  syncMessage: string | null;
  syncError: string | null;
  onRefresh: () => void;
}

export function SyncControls({
  lastSyncLabel,
  syncing,
  syncMessage,
  syncError,
  onRefresh,
}: SyncControlsProps) {
  const t = useTranslations();

  function handleRefreshClick() {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[SyncControls] refresh clicked:", syncing ? "sync already in progress" : "starting sync / refetch status");
    }
    onRefresh();
  }

  return (
    <div className="flex flex-col items-end gap-1.5 min-w-0">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-zinc-500 shrink-0">
          {t("sync.lastSynced")}: <span className="text-zinc-400">{lastSyncLabel}</span>
        </span>
        <button
          type="button"
          onClick={handleRefreshClick}
          disabled={syncing}
          aria-busy={syncing}
          aria-label={syncing ? t("sync.syncing") : t("sync.syncNow")}
          className="shrink-0 rounded-lg border border-zinc-600 bg-zinc-800 p-2 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
          title={syncing ? t("sync.syncing") : t("sync.syncNow")}
        >
          <span className={`inline-block ${syncing ? "animate-spin" : ""}`}>
            <RefreshIcon />
          </span>
        </button>
      </div>
      {/* Progress bar: visible while syncing */}
      {syncing && (
        <div
          className="h-1 w-24 rounded-full bg-zinc-700 overflow-hidden"
          role="progressbar"
          aria-busy="true"
          aria-label={t("sync.syncing")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={t("sync.syncing")}
        >
          <div className="h-full w-16 animate-pulse rounded-full bg-emerald-500/70" />
        </div>
      )}
      {/* Status message or error */}
      {(syncMessage || syncError) && (
        <span className={`text-sm ${syncError ? "text-red-400" : "text-emerald-400"}`}>
          {syncError ?? syncMessage}
        </span>
      )}
    </div>
  );
}
