"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipPortal, TooltipContent } from "@/components/ui/tooltip";

const STORAGE_KEY = "sidebar-collapsed";

type SidebarProps = {
  isCollapsed: boolean;
  onCollapsedChange: (value: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export function Sidebar({ isCollapsed, onCollapsedChange, mobileOpen, onMobileClose }: SidebarProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      onCollapsedChange(stored === "true");
    }
  }, [mounted, onCollapsedChange]);

  const handleToggleCollapsed = () => {
    const next = !isCollapsed;
    onCollapsedChange(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(next));
    }
  };

  const isSummaryActive = pathname === "/" || pathname === "/dashboard";

  const summaryLink = (
    <Link
      href="/"
      onClick={mobileOpen ? onMobileClose : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        isSummaryActive
          ? "bg-zinc-700/80 text-zinc-100"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
      } ${isCollapsed ? "justify-center" : ""}`}
      aria-current={isSummaryActive ? "page" : undefined}
    >
      <span className="shrink-0" aria-hidden>
        <SummaryIcon />
      </span>
      {!isCollapsed && <span>{t("summary")}</span>}
    </Link>
  );

  return (
    <TooltipProvider delayDuration={300}>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex md:flex-col md:shrink-0 border-r border-zinc-800 bg-zinc-900/90 transition-[width] duration-200 ${
          mounted && isCollapsed ? "md:w-16" : "md:w-56"
        }`}
        style={!mounted ? { width: "14rem" } : undefined}
      >
        <div className="flex h-12 items-center justify-between border-b border-zinc-800 px-3">
          {!isCollapsed && (
            <span className="text-sm font-medium text-zinc-400">Menu</span>
          )}
          <button
            type="button"
            onClick={handleToggleCollapsed}
            className="rounded p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <CollapseIcon collapsed={isCollapsed} />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {isCollapsed ? (
            <TooltipRoot>
              <TooltipTrigger asChild>{summaryLink}</TooltipTrigger>
              <TooltipPortal>
                <TooltipContent side="right">{t("summary")}</TooltipContent>
              </TooltipPortal>
            </TooltipRoot>
          ) : (
            summaryLink
          )}
        </nav>
      </aside>

      {/* Mobile overlay + drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onMobileClose}
          aria-hidden
        />
      )}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-56 flex-col border-r border-zinc-800 bg-zinc-900/95 shadow-xl transition-transform duration-200 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-12 items-center justify-end border-b border-zinc-800 px-3">
          <button
            type="button"
            onClick={onMobileClose}
            className="rounded p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>
        <nav className="flex flex-col gap-1 p-2">{summaryLink}</nav>
      </aside>
    </TooltipProvider>
  );
}

function SummaryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={collapsed ? "rotate-180" : ""}
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
