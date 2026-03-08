"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";

const ROUTE_TITLE_KEYS: Record<string, string> = {
  "/dashboard": "summary",
};

type TopBarProps = {
  currentLocale: string;
  onMenuClick: () => void;
};

export function TopBar({ currentLocale, onMenuClick }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");

  const titleKey = ROUTE_TITLE_KEYS[pathname] ?? "summary";
  const title = t(titleKey as "summary");

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-500 md:hidden"
          aria-label="Open menu"
        >
          <HamburgerIcon />
        </button>
        <h1 className="text-sm font-semibold text-zinc-200 truncate">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <LanguageSwitcher currentLocale={currentLocale} />
        <button
          type="button"
          onClick={handleLogout}
          className="rounded px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          Logout
        </button>
      </div>
    </header>
  );
}

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
