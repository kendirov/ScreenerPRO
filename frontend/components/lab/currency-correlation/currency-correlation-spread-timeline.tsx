"use client";

import type { SpreadScannerTimelineItem } from "@/lib/domain/currency-correlation-spread-scanner";
import {
  formatUnitValueShort,
  type SpreadUnitMode,
} from "@/lib/domain/currency-spread-units";
import { cn } from "@/lib/utils/cn";

function fmtZ(v: number): string {
  return v.toFixed(2);
}

export function CurrencyCorrelationSpreadTimeline({
  events,
  zThreshold,
  compact,
  unitMode = "raw-points",
}: {
  events: SpreadScannerTimelineItem[];
  zThreshold: number;
  compact?: boolean;
  unitMode?: SpreadUnitMode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.06] bg-slate-900/40 backdrop-blur-xl",
        compact ? "px-2.5 py-2" : "px-4 py-3",
      )}
    >
      <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-slate-600">
        Журнал расхождений
      </p>
      {events.length === 0 ? (
        <p className="text-sm text-slate-500">Сильных расхождений сейчас нет</p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <li
              key={`${ev.timestamp}-${ev.pair}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                <p className="font-mono text-[11px] text-violet-200/90">{ev.timeLabel}</p>
                <p className="mt-0.5 font-mono text-slate-400">{ev.pair}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums text-[10px]">
                <span className="text-slate-500">{ev.anchorModeLabel}</span>
                <span className="text-slate-600">{ev.durationFromAnchor}</span>
                <span className="text-slate-300">
                  {formatUnitValueShort(ev.spreadFromAnchor, unitMode)}
                </span>
                <span
                  className={cn(
                    Math.abs(ev.zScore) >= 2
                      ? "text-violet-300"
                      : Math.abs(ev.zScore) >= zThreshold
                        ? "text-amber-300"
                        : "text-slate-500",
                  )}
                >
                  z {fmtZ(ev.zScore)}
                </span>
                <span className="text-slate-500">{ev.direction}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!compact ? (
        <p className="mt-2 text-[10px] text-slate-600">
          До 5 последних эпизодов растяжения (|z| ≥ порога чувствительности).
        </p>
      ) : null}
    </div>
  );
}
