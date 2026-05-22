"use client";

import type { MarketMapSummary } from "@/lib/domain/market-map";
import { formatSummaryLine } from "@/lib/domain/market-map";
import { cn } from "@/lib/utils/cn";

const SUMMARY_ITEMS = [
  { key: "money" as const, label: "Деньги", tone: "text-emerald-300/90" },
  { key: "impulse" as const, label: "Импульс", tone: "text-cyan-300/90" },
  { key: "pressure" as const, label: "Давление", tone: "text-rose-300/90" },
];

export function MarketMapSummaryBar({ summary }: { summary: MarketMapSummary }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {SUMMARY_ITEMS.map(({ key, label, tone }) => (
        <div
          key={key}
          className="rounded-xl border border-white/[0.06] bg-slate-900/45 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl"
        >
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className={cn("mt-1 font-mono text-sm tabular-nums tracking-tight", tone)}>
            {formatSummaryLine(key, summary[key])}
          </p>
        </div>
      ))}
    </div>
  );
}
