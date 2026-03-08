"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { useRouter } from "next/navigation";

const LOCALE_COOKIE = "NEXT_LOCALE";
const COOKIE_MAX_AGE = 31536000; // 1 year

const LOCALES = [
  { value: "es-MX", label: "Español", icon: "🇲🇽" },
  { value: "en", label: "English", icon: "🇺🇸" },
] as const;

type LocaleValue = (typeof LOCALES)[number]["value"];

export function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
  const router = useRouter();
  const current = LOCALES.find((l) => l.value === currentLocale) ?? LOCALES[0];

  function setLocale(locale: LocaleValue) {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    router.refresh();
  }

  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700/80 focus:outline-none focus:ring-2 focus:ring-zinc-500 data-[state=open]:bg-zinc-700/80 data-[state=open]:ring-2 data-[state=open]:ring-zinc-500"
          aria-label="Select language"
        >
          <span aria-hidden className="text-base shrink-0">
            {current.icon}
          </span>
          <span className="shrink-0">{current.label}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="opacity-70"
            aria-hidden
          >
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          className="min-w-[10rem] rounded-lg border border-zinc-600 bg-zinc-800 py-1 shadow-xl data-[side=bottom]:translate-y-1 data-[side=top]:translate-y-[-4px]"
          sideOffset={6}
          align="end"
        >
          {LOCALES.map(({ value, label, icon }) => (
            <Dropdown.Item
              key={value}
              className="cursor-pointer px-3 py-2 text-sm text-zinc-200 outline-none hover:bg-zinc-700 focus:bg-zinc-700 data-[highlighted]:bg-zinc-700 flex items-center gap-2"
              onSelect={() => setLocale(value)}
            >
              <span aria-hidden className="text-base">{icon}</span>
              {label}
            </Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
