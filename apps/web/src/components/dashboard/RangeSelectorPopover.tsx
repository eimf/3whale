"use client";

import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { useTranslations } from "next-intl";
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
} from "@floating-ui/react-dom";
import {
  setRangePreset,
  setRangeCustom,
  type RangePreset as RangePresetType,
} from "@/store/dashboardSlice";
import type { RootState } from "@/store/store";
import { getTodayInTz } from "@/lib/dateRangeParams";

const PRESETS: RangePresetType[] = [
  "today",
  "yesterday",
  "last7",
  "last14",
  "last30",
  "last90",
  "last365",
  "lastMonth",
];

function CalendarIcon() {
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
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** Format YYYY-MM-DD to "Mon DD" or "Mon DD - Mon DD" for range. */
function formatRangeLabel(from: string, to: string): string {
  const a = new Date(from + "T12:00:00");
  const b = new Date(to + "T12:00:00");
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  if (from === to) return a.toLocaleDateString(undefined, opts);
  return `${a.toLocaleDateString(undefined, opts)} - ${b.toLocaleDateString(undefined, opts)}`;
}

/** Get days in month and first day of week (0 = Sun). */
function getMonthDays(year: number, month: number): { date: string; dayOfWeek: number }[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const days: { date: string; dayOfWeek: number }[] = [];
  const pad = (n: number) => String(n).padStart(2, "0");
  for (let i = 0; i < startPad; i++) {
    days.push({ date: "", dayOfWeek: i });
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push({
      date: `${year}-${pad(month + 1)}-${pad(d)}`,
      dayOfWeek: (startPad + d - 1) % 7,
    });
  }
  return days;
}

export interface RangeSelectorPopoverProps {
  /** Current range label to show on trigger (e.g. "Last 7 Days" or "Feb 19 - Feb 25"). */
  triggerLabel: string;
  /** Timezone from shop config (e.g. America/Mexico_City). */
  timezoneIana: string;
}

export function RangeSelectorPopover({
  triggerLabel,
  timezoneIana,
}: RangeSelectorPopoverProps) {
  const t = useTranslations("dashboard.range");
  const dispatch = useDispatch();
  const rangePreset = useSelector((s: RootState) => s.dashboard.rangePreset);
  const rangeCustom = useSelector((s: RootState) => s.dashboard.rangeCustom);

  const [open, setOpen] = useState(false);
  const [pendingPreset, setPendingPreset] = useState<RangePresetType | null>(rangePreset);
  const [pendingFrom, setPendingFrom] = useState<string>(rangeCustom?.from ?? getTodayInTz(timezoneIana));
  const [pendingTo, setPendingTo] = useState<string>(rangeCustom?.to ?? getTodayInTz(timezoneIana));
  const [focusMonth, setFocusMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { refs, floatingStyles } = useFloating({
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({ padding: 12 }),
      shift({ padding: 12 }),
    ],
  });

  // Sync draft from Redux when popover opens so Apply/Cancel semantics are correct.
  useEffect(() => {
    if (open) {
      setPendingPreset(rangePreset);
      setPendingFrom(rangeCustom?.from ?? getTodayInTz(timezoneIana));
      setPendingTo(rangeCustom?.to ?? getTodayInTz(timezoneIana));
    }
  }, [open, rangePreset, rangeCustom?.from, rangeCustom?.to, timezoneIana]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onClick, true);
    };
  }, [open]);

  const handlePresetClick = (preset: RangePresetType) => {
    setPendingPreset(preset);
    setPendingFrom("");
    setPendingTo("");
  };

  const handleDayClick = (date: string) => {
    if (!date) return;
    setPendingPreset(null);
    if (!pendingFrom || (pendingFrom && pendingTo)) {
      setPendingFrom(date);
      setPendingTo(date);
    } else {
      if (date < pendingFrom) {
        setPendingTo(pendingFrom);
        setPendingFrom(date);
      } else {
        setPendingTo(date);
      }
    }
  };

  const handleApply = () => {
    if (pendingPreset) {
      dispatch(setRangePreset(pendingPreset));
    } else if (pendingFrom && pendingTo) {
      dispatch(setRangeCustom({ from: pendingFrom, to: pendingTo }));
    }
    setOpen(false);
  };

  const handleCancel = () => {
    setPendingPreset(rangePreset);
    setPendingFrom(rangeCustom?.from ?? getTodayInTz(timezoneIana));
    setPendingTo(rangeCustom?.to ?? getTodayInTz(timezoneIana));
    setOpen(false);
  };

  const displayFrom = pendingPreset ? "" : pendingFrom;
  const displayTo = pendingPreset ? "" : pendingTo;

  const leftMonth = getMonthDays(focusMonth.year, focusMonth.month);
  const nextMonth = focusMonth.month === 11
    ? getMonthDays(focusMonth.year + 1, 0)
    : getMonthDays(focusMonth.year, focusMonth.month + 1);

  const monthLabel = new Date(focusMonth.year, focusMonth.month).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const nextMonthLabel = new Date(focusMonth.year, focusMonth.month + 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="relative inline-block">
      <button
        ref={(el) => {
          triggerRef.current = el;
          refs.setReference(el);
        }}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <CalendarIcon />
        <span>{triggerLabel}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div
            ref={(el) => {
              popoverRef.current = el;
              refs.setFloating(el);
            }}
            style={floatingStyles}
            className="z-50 w-[520px] rounded-xl border border-zinc-600 bg-zinc-900 shadow-xl"
            role="dialog"
            aria-label={t("label")}
          >
            <div className="flex">
            {/* Presets sidebar */}
            <div className="w-44 shrink-0 border-r border-zinc-700 p-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                    pendingPreset === preset
                      ? "bg-emerald-600/80 text-white"
                      : "text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  {t(`presets.${preset}`)}
                  {pendingPreset === preset && <CheckIcon />}
                </button>
              ))}
            </div>

            {/* Dual calendar */}
            <div className="flex-1 p-4">
              <div className="flex gap-6">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm font-medium text-zinc-300">
                    <span>{monthLabel}</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setFocusMonth((m) =>
                            m.month === 0
                              ? { year: m.year - 1, month: 11 }
                              : { year: m.year, month: m.month - 1 }
                          )
                        }
                        className="rounded p-1 hover:bg-zinc-700"
                        aria-label="Previous month"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFocusMonth((m) =>
                            m.month === 11
                              ? { year: m.year + 1, month: 0 }
                              : { year: m.year, month: m.month + 1 }
                          )
                        }
                        className="rounded p-1 hover:bg-zinc-700"
                        aria-label="Next month"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-xs text-zinc-500">
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                      <div key={d}>{d}</div>
                    ))}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-0.5">
                    {leftMonth.map((cell, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => cell.date && handleDayClick(cell.date)}
                        disabled={!cell.date}
                        className={`h-8 rounded text-sm ${
                          !cell.date
                            ? "invisible"
                            : cell.date >= displayFrom && cell.date <= displayTo
                              ? "bg-emerald-600 text-white"
                              : "text-zinc-300 hover:bg-zinc-700"
                        } ${cell.date === displayFrom || cell.date === displayTo ? "ring-1 ring-emerald-400" : ""}`}
                      >
                        {cell.date ? new Date(cell.date + "T12:00:00").getDate() : ""}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-zinc-300">{nextMonthLabel}</div>
                  <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-xs text-zinc-500">
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                      <div key={d}>{d}</div>
                    ))}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-0.5">
                    {nextMonth.map((cell, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => cell.date && handleDayClick(cell.date)}
                        disabled={!cell.date}
                        className={`h-8 rounded text-sm ${
                          !cell.date
                            ? "invisible"
                            : cell.date >= displayFrom && cell.date <= displayTo
                              ? "bg-emerald-600 text-white"
                              : "text-zinc-300 hover:bg-zinc-700"
                        } ${cell.date === displayFrom || cell.date === displayTo ? "ring-1 ring-emerald-400" : ""}`}
                      >
                        {cell.date ? new Date(cell.date + "T12:00:00").getDate() : ""}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer: timezone + Apply/Cancel */}
          <div className="flex items-center justify-between border-t border-zinc-700 px-4 py-3">
            <span className="text-xs text-zinc-500">
              {t("timezone")}: {timezoneIana.replace(/_/g, " ")}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
              >
                {t("apply")}
              </button>
            </div>
          </div>
        </div>,
          document.body
        )}
    </div>
  );
}

/** Get trigger label from current range state and summary (for "from → to" when custom). */
export function getRangeTriggerLabel(
  rangePreset: RangePresetType | null,
  rangeCustom: { from: string; to: string } | null,
  summaryFromTo: { from: string; to: string } | undefined,
  t: (key: string) => string
): string {
  if (rangeCustom) {
    return formatRangeLabel(rangeCustom.from, rangeCustom.to);
  }
  if (rangePreset) {
    return t(`presets.${rangePreset}`);
  }
  if (summaryFromTo) {
    return formatRangeLabel(summaryFromTo.from, summaryFromTo.to);
  }
  return t("presets.last7");
}
