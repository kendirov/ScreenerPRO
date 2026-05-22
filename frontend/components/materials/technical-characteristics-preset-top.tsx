"use client";

import type { RankedPresetRow } from "@/lib/domain/technical-characteristics-presets";
import { cn } from "@/lib/utils/cn";

export function TechnicalCharacteristicsPresetTop({
  ranked,
  selectedTicker,
  onSelectTicker,
}: {
  ranked: RankedPresetRow[];
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
}) {
  if (ranked.length === 0) return null;

  return (
    <section className="rounded-lg border border-slate-800/90 bg-slate-900/40 p-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Топ под выбранную задачу</p>
      <p className="mt-0.5 text-[11px] text-slate-500">Для наблюдения и сравнения в уроке — не сигнал к сделке.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {ranked.map((item) => {
          const active = item.row.ticker === selectedTicker;
          const reasons = item.evaluation.presetReasonTags.slice(0, 2);
          return (
            <button
              key={item.row.ticker}
              type="button"
              onClick={() => onSelectTicker(item.row.ticker)}
              className={cn(
                "min-w-[140px] flex-1 rounded-lg border px-3 py-2 text-left transition sm:max-w-[220px]",
                active
                  ? "border-cyan-400/45 bg-cyan-500/10"
                  : "border-slate-700/80 bg-slate-950/50 hover:border-slate-600 hover:bg-slate-900/70",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-sm font-semibold text-slate-100">
                  #{item.rank} {item.row.ticker}
                </span>
                <span className="font-mono text-[11px] text-cyan-300/90">{item.evaluation.presetScore}</span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-slate-400">{item.row.instrumentName}</p>
              {reasons.length > 0 ? (
                <ul className="mt-1.5 space-y-0.5">
                  {reasons.map((tag) => (
                    <li key={tag} className="text-[10px] text-slate-500">
                      · {tag}
                    </li>
                  ))}
                </ul>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
