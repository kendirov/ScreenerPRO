"use client";

import type {
  IntradayDayOption,
  IntradayIntervalOption,
} from "@/lib/domain/currency-correlation-intraday";
import {
  INTRADAY_DAY_OPTIONS,
  INTRADAY_INTERVAL_OPTIONS,
} from "@/lib/domain/currency-correlation-intraday";
import { cn } from "@/lib/utils/cn";

export type CurrencyDataMode = "day" | "intraday";

function formatIntervalLabel(interval: IntradayIntervalOption): string {
  if (interval === 60) return "60м";
  return `${interval}м`;
}

export function CurrencyCorrelationDataModeBar({
  dataMode,
  onDataModeChange,
  intradayInterval,
  onIntradayIntervalChange,
  intradayDays,
  onIntradayDaysChange,
}: {
  dataMode: CurrencyDataMode;
  onDataModeChange: (mode: CurrencyDataMode) => void;
  intradayInterval: IntradayIntervalOption;
  onIntradayIntervalChange: (interval: IntradayIntervalOption) => void;
  intradayDays: IntradayDayOption;
  onIntradayDaysChange: (days: IntradayDayOption) => void;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-slate-950/55 p-3 backdrop-blur-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          <span className="mr-1 self-center text-[10px] uppercase tracking-[0.12em] text-slate-600">
            Режим данных
          </span>
          {(
            [
              { id: "intraday" as const, label: "Интрадей" },
              { id: "day" as const, label: "День" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onDataModeChange(item.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] transition",
                dataMode === item.id
                  ? "border-violet-500/40 bg-violet-950/50 text-violet-100 shadow-[0_0_12px_rgba(139,92,246,0.2)]"
                  : "border-white/[0.06] bg-black/20 text-slate-500 hover:border-white/10 hover:text-slate-300",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {dataMode === "intraday" ? (
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap gap-1.5">
              <span className="mr-1 self-center text-[10px] uppercase tracking-[0.12em] text-slate-600">
                Интервал
              </span>
              {INTRADAY_INTERVAL_OPTIONS.map((iv) => (
                <button
                  key={iv}
                  type="button"
                  onClick={() => onIntradayIntervalChange(iv)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] transition",
                    intradayInterval === iv
                      ? "border-cyan-500/35 bg-cyan-950/40 text-cyan-100"
                      : "border-white/[0.06] bg-black/20 text-slate-500 hover:border-white/10 hover:text-slate-300",
                  )}
                >
                  {formatIntervalLabel(iv)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="mr-1 self-center text-[10px] uppercase tracking-[0.12em] text-slate-600">
                Период
              </span>
              {INTRADAY_DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onIntradayDaysChange(d)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] transition",
                    intradayDays === d
                      ? "border-amber-500/35 bg-amber-950/35 text-amber-100"
                      : "border-white/[0.06] bg-black/20 text-slate-500 hover:border-white/10 hover:text-slate-300",
                  )}
                >
                  {d === 1 ? "сегодня" : `${d} дн`}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
