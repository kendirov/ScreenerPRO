"use client";

import type { MarketFlowSummary } from "@/lib/domain/market-flow-map";
import { cn } from "@/lib/utils/cn";

const ITEMS = [
  { key: "money" as const, label: "Деньги", tone: "text-emerald-300/90", subTone: "text-slate-500" },
  { key: "impulse" as const, label: "Импульс", tone: "text-cyan-300/90", subTone: "text-slate-500" },
  { key: "pressure" as const, label: "Давление", tone: "text-rose-300/90", subTone: "text-slate-500" },
];

const COVERAGE_LABELS: Record<MarketFlowSummary["yesterdayCoverage"], string | null> = {
  full: "вчера MOEX · хвосты доступны",
  partial: "оценка по вчерашнему дню · без хвостов",
  none: null,
};

export function FlowMapSummaryBar({ summary }: { summary: MarketFlowSummary }) {
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-3">
        {ITEMS.map(({ key, label, tone, subTone }) => {
          const entry = summary[key];
          return (
            <div
              key={key}
              className="lab-glass-card rounded-xl border border-white/[0.06] bg-slate-900/40 px-3 py-2.5 backdrop-blur-xl"
            >
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <p className={cn("mt-1 font-mono text-sm font-medium tabular-nums tracking-tight", tone)}>
                {entry?.ticker ?? "—"}
              </p>
              {entry?.detail ? (
                <p className={cn("mt-0.5 font-mono text-[11px] tabular-nums", subTone)}>{entry.detail}</p>
              ) : null}
            </div>
          );
        })}
      </div>
      {COVERAGE_LABELS[summary.yesterdayCoverage] ? (
        <p className="text-[10px] text-slate-600">{COVERAGE_LABELS[summary.yesterdayCoverage]}</p>
      ) : null}
    </div>
  );
}
