"use client";

import type { StocksMarketSummary } from "@/lib/screener/stocks-radar";
import { metricColors } from "@/lib/screener/metric-styles";
import { cn } from "@/lib/utils/cn";

export function MarketBreadthMini({
  summary,
  universeCount,
  className,
}: {
  summary: StocksMarketSummary;
  universeCount: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded border border-white/[0.06] bg-slate-950/60 px-2 py-1", className)}>
      <p className="text-[9px] text-lab-text-dim">Ширина рынка</p>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 font-mono text-[11px] tabular-nums">
        <span className={metricColors.breadthUp}>↑ {summary.rising}</span>
        <span className={metricColors.breadthDown}>↓ {summary.falling}</span>
        <span className={metricColors.breadthFlat}>→ {summary.flat}</span>
        <span className={cn("text-[10px]", metricColors.muted)}>/ {universeCount}</span>
      </div>
    </div>
  );
}
