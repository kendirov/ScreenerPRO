"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import {
  formatCompactDateKey,
  formatMoscowUpdatedLabel,
  formatTradingDateLabel,
  isWeekendDateKey,
  moscowTodayKey,
  resolveTradingSessionModeLabel,
  TRADING_DATE_MESSAGES,
} from "@/lib/domain/trading-calendar";
import type { TradingDateMode } from "@/lib/hooks/use-selected-trading-date";
import { cn } from "@/lib/utils/cn";

type TradingDateControlProps = {
  selectedDateKey: string;
  isLive: boolean;
  mode: TradingDateMode;
  onToday: () => void;
  onYesterday: () => void;
  onPickDate: (dateKey: string) => void;
  className?: string;
  resolvedDateKey?: string | null;
  updatedAtLabel?: string | null;
  isLoading?: boolean;
  dataEmpty?: boolean;
};

const SEGMENTS: { id: TradingDateMode; label: string }[] = [
  { id: "today", label: "Сегодня" },
  { id: "yesterday", label: "Вчера" },
  { id: "pick", label: "Дата" },
];

function SegmentedControl({
  mode,
  onToday,
  onYesterday,
  onPickDate,
  dateInputRef,
}: {
  mode: TradingDateMode;
  onToday: () => void;
  onYesterday: () => void;
  onPickDate: () => void;
  dateInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const handlers: Record<TradingDateMode, () => void> = {
    today: onToday,
    yesterday: onYesterday,
    pick: () => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click() ?? onPickDate(),
  };

  return (
    <div
      className="inline-flex shrink-0 rounded-[10px] bg-white/[0.025] p-0.5 ring-1 ring-inset ring-white/[0.07]"
      role="tablist"
      aria-label="Режим даты"
    >
      {SEGMENTS.map((segment) => {
        const active = mode === segment.id;
        return (
          <button
            key={segment.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={handlers[segment.id]}
            className={cn(
              "relative min-w-[4.25rem] rounded-[8px] px-2.5 py-1 text-[11px] font-medium transition-all duration-150",
              active
                ? "bg-white/[0.09] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_8px_rgba(0,0,0,0.25)] ring-1 ring-white/[0.1]"
                : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300",
            )}
          >
            {active ? (
              <span
                className="pointer-events-none absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent"
                aria-hidden
              />
            ) : null}
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}

function SessionModeLabel({
  modeKey,
  label,
}: {
  modeKey: ReturnType<typeof resolveTradingSessionModeLabel>["key"];
  label: string;
}) {
  const toneClass =
    modeKey === "live"
      ? "text-emerald-300/85"
      : modeKey === "historical"
        ? "text-violet-300/80"
        : "text-amber-200/80";

  return (
    <span className={cn("text-[10px] font-medium tracking-wide", toneClass)} title={label}>
      {label}
    </span>
  );
}

export function TradingDateControl({
  selectedDateKey,
  isLive,
  mode,
  onToday,
  onYesterday,
  onPickDate,
  className,
  resolvedDateKey,
  updatedAtLabel,
  isLoading,
  dataEmpty,
}: TradingDateControlProps) {
  const dateInputRef = React.useRef<HTMLInputElement>(null);
  const todayKey = moscowTodayKey();
  const isWeekend = isWeekendDateKey(selectedDateKey);
  const showResolvedHint =
    resolvedDateKey && resolvedDateKey !== selectedDateKey && !isLive && !dataEmpty;

  const sessionMode = resolveTradingSessionModeLabel({
    isLive,
    dataEmpty,
    isLoading,
    selectedDateKey,
  });

  const moscowUpdated = formatMoscowUpdatedLabel(updatedAtLabel);

  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.06] bg-gradient-to-r from-slate-950/70 via-slate-950/45 to-slate-900/35 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md",
        className,
      )}
      aria-label="Выбор торгового дня"
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <SegmentedControl
          mode={mode}
          onToday={onToday}
          onYesterday={onYesterday}
          onPickDate={() => dateInputRef.current?.showPicker?.()}
          dateInputRef={dateInputRef}
        />

        <label className="group relative inline-flex min-w-[7.5rem] cursor-pointer items-center gap-1.5 rounded-[10px] border border-white/[0.08] bg-black/30 px-2 py-1 ring-1 ring-inset ring-white/[0.04] transition hover:border-cyan-500/20 hover:bg-black/40">
          <CalendarDays
            className="h-3.5 w-3.5 shrink-0 text-slate-500 transition group-hover:text-cyan-400/70"
            aria-hidden
          />
          <span className="pointer-events-none flex min-w-0 flex-col leading-none">
            <span className="font-mono text-[10px] tabular-nums text-slate-200">
              {formatCompactDateKey(selectedDateKey)}
            </span>
            <span className="mt-0.5 hidden truncate text-[8px] text-slate-500 sm:block">
              {formatTradingDateLabel(selectedDateKey)}
            </span>
          </span>
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDateKey}
            max={todayKey}
            onChange={(event) => {
              const value = event.target.value;
              if (value) onPickDate(value);
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Выбрать дату"
          />
        </label>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
          <SessionModeLabel modeKey={sessionMode.key} label={sessionMode.label} />

          {isWeekend && !dataEmpty && !isLive ? (
            <span className="rounded-md border border-slate-600/30 bg-slate-900/50 px-1.5 py-px text-[9px] text-slate-400">
              {TRADING_DATE_MESSAGES.weekend}
            </span>
          ) : null}

          {showResolvedHint ? (
            <span
              className="text-[9px] leading-snug text-amber-200/75"
              title={`${TRADING_DATE_MESSAGES.nearestDay}: ${formatTradingDateLabel(resolvedDateKey!)}`}
            >
              {TRADING_DATE_MESSAGES.nearestDay}: {formatCompactDateKey(resolvedDateKey!)}
            </span>
          ) : null}
        </div>

        <div className="ml-auto shrink-0 text-right">
          <p className="font-mono text-[9px] tabular-nums text-slate-500">
            {isLoading ? "Обновление…" : moscowUpdated ?? "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
