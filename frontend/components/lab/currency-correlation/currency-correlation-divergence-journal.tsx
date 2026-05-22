"use client";

import * as React from "react";
import {
  filterJournal,
  type JournalFilter,
  type TrajectoryJournalRow,
} from "@/lib/domain/spread-trajectory";
import {
  formatUnitValueShort,
  type SpreadUnitMode,
} from "@/lib/domain/currency-spread-units";
import { cn } from "@/lib/utils/cn";

const FILTER_OPTIONS: { id: JournalFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "return", label: "Возврат" },
  { id: "breakdown", label: "Невозврат" },
  { id: "extreme", label: "Экстрим" },
];

function fmtZ(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

export function CurrencyCorrelationDivergenceJournal({
  rows,
  unitMode,
  compact,
}: {
  rows: TrajectoryJournalRow[];
  unitMode: SpreadUnitMode;
  compact?: boolean;
}) {
  const [filter, setFilter] = React.useState<JournalFilter>("all");
  const filtered = React.useMemo(() => filterJournal(rows, filter), [rows, filter]);

  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.06] bg-slate-900/45 backdrop-blur-xl",
        compact ? "px-2.5 py-2" : "px-3 py-3",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">
          Журнал расхождений
        </p>
        <div className="flex flex-wrap gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFilter(opt.id)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[9px] transition",
                filter === opt.id
                  ? "border-violet-500/35 bg-violet-950/40 text-violet-100"
                  : "border-white/[0.06] text-slate-500 hover:text-slate-300",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-[11px] text-slate-500">Событий по фильтру нет.</p>
      ) : (
        <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
          {filtered.map((row) => (
            <li
              key={`${row.timestamp}-${row.eventLabel}-${row.state}`}
              className="grid grid-cols-[minmax(68px,0.85fr)_minmax(48px,0.55fr)_minmax(0,1.1fr)_minmax(72px,0.75fr)_minmax(40px,0.45fr)_minmax(44px,0.5fr)_minmax(36px,0.4fr)] gap-1 rounded border border-white/[0.03] bg-black/15 px-2 py-1 text-[10px] text-slate-400"
            >
              <span className="font-mono text-cyan-200/75 truncate">{row.timeLabel}</span>
              <span className="font-mono text-violet-200/80 truncate">{row.pair}</span>
              <span className="truncate text-slate-300">{row.eventLabel}</span>
              <span className="truncate text-slate-500" title="недельный контекст">
                {row.weeklyContextLabel}
              </span>
              <span className="font-mono text-right">
                {formatUnitValueShort(row.spreadFromAnchor, unitMode)}
              </span>
              <span className="font-mono text-right text-cyan-200/80">{fmtZ(row.zScore)}</span>
              <span
                className="font-mono text-right text-emerald-300/80"
                title="длительность до возврата"
              >
                {row.durationBarsToReturn != null ? `${row.durationBarsToReturn} св.` : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 border-t border-white/[0.04] pt-1.5 text-[9px] leading-relaxed text-slate-600">
        Невозврат — статистическая зона риска, а не прогноз. События описывают состояние связки, не
        торговую рекомендацию.
      </p>
    </div>
  );
}
