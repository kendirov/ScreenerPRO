"use client";

import type { StockQuickFilter } from "@/lib/screener/stock-screener-priority-filters";
import {
  countQuickFilter,
  STOCK_QUICK_FILTER_LABELS,
  type PriorityFilterSets,
} from "@/lib/screener/stock-screener-priority-filters";
import { cn } from "@/lib/utils/cn";

const FILTERS: StockQuickFilter[] = ["all", "in_play", "liquidity", "volatility", "risk"];

const FILTER_TONE: Record<StockQuickFilter, string> = {
  all: "text-lab-text-main",
  in_play: "text-cyan-300/90",
  liquidity: "text-zinc-400",
  volatility: "text-amber-200/80",
  risk: "text-rose-300/85",
};

const FILTER_ACTIVE: Record<StockQuickFilter, string> = {
  all: "border-white/20 bg-white/[0.06]",
  in_play: "border-cyan-700/45 bg-cyan-950/25",
  liquidity: "border-zinc-600/40 bg-zinc-900/40",
  volatility: "border-amber-700/40 bg-amber-950/20",
  risk: "border-rose-800/45 bg-rose-950/20",
};

export function StockScreenerQuickFilters({
  value,
  onChange,
  sets,
  className,
}: {
  value: StockQuickFilter;
  onChange: (filter: StockQuickFilter) => void;
  sets: PriorityFilterSets;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)} role="group" aria-label="Быстрые фильтры">
      {FILTERS.map((key) => {
        const active = value === key;
        const count = countQuickFilter(key, sets);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] transition",
              active ? FILTER_ACTIVE[key] : "border-white/10 bg-slate-950/40 hover:border-white/15",
              !active && FILTER_TONE[key],
            )}
            aria-pressed={active}
          >
            <span>{STOCK_QUICK_FILTER_LABELS[key]}</span>
            {count != null ? (
              <span className="tabular-nums text-lab-text-dim/80">{count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
