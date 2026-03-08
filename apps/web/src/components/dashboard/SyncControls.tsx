"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogPortal,
  DialogOverlay,
} from "@/components/ui/dialog";

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
  onRefresh: (fullSync?: boolean) => void;
}

export function SyncControls({
  lastSyncLabel,
  syncing,
  syncMessage,
  syncError,
  onRefresh,
}: SyncControlsProps) {
  const t = useTranslations();
  const [showFullSyncModal, setShowFullSyncModal] = useState(false);

  function handleRefreshClick(fullSync?: boolean) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[SyncControls] refresh clicked:", fullSync ? "full sync" : "incremental", syncing ? "sync already in progress" : "starting");
    }
    if (fullSync) {
      setShowFullSyncModal(true);
      return;
    }
    onRefresh(false);
  }

  function handleConfirmFullSync() {
    setShowFullSyncModal(false);
    onRefresh(true);
  }

  return (
    <div className="flex flex-col items-end gap-1.5 min-w-0">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-zinc-500 shrink-0">
          {t("sync.lastSynced")}: <span className="text-zinc-400">{lastSyncLabel}</span>
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => handleRefreshClick(false)}
            disabled={syncing}
            aria-busy={syncing}
            aria-label={syncing ? t("sync.syncing") : t("sync.syncNow")}
            className="rounded-lg border border-zinc-600 bg-zinc-800 p-2 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title={syncing ? t("sync.syncing") : t("sync.syncNow")}
          >
            <span className={`inline-block ${syncing ? "animate-spin" : ""}`}>
              <RefreshIcon />
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleRefreshClick(true)}
            disabled={syncing}
            aria-label={t("sync.fullSync")}
            title={t("sync.fullSyncTitle")}
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-2.5 py-2 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("sync.fullSync")}
          </button>
        </div>
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

      {/* Full sync confirmation modal */}
      <Dialog open={showFullSyncModal} onOpenChange={setShowFullSyncModal}>
        <DialogPortal>
          <DialogOverlay />
          <DialogContent className="max-w-md gap-5">
            <DialogHeader>
              <DialogTitle>{t("sync.fullSyncModal.title")}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 text-sm text-zinc-300">
              <div>
                <p className="font-medium text-zinc-200 mb-1.5">{t("sync.fullSyncModal.whatItDoes")}</p>
                <ul className="list-disc list-inside space-y-1 text-zinc-400">
                  <li>{t("sync.fullSyncModal.whatItDoesBullet1")}</li>
                  <li>{t("sync.fullSyncModal.whatItDoesBullet2")}</li>
                  <li>{t("sync.fullSyncModal.whatItDoesBullet3")}</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-zinc-200 mb-1.5">{t("sync.fullSyncModal.whatToExpect")}</p>
                <ul className="list-disc list-inside space-y-1 text-zinc-400">
                  <li>{t("sync.fullSyncModal.whatToExpectBullet1")}</li>
                  <li>{t("sync.fullSyncModal.whatToExpectBullet2")}</li>
                  <li>{t("sync.fullSyncModal.whatToExpectBullet3")}</li>
                </ul>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <button
                  type="button"
                  className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {t("sync.fullSyncModal.cancel")}
                </button>
              </DialogClose>
              <button
                type="button"
                onClick={handleConfirmFullSync}
                disabled={syncing}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              >
                {t("sync.fullSyncModal.confirm")}
              </button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  );
}
