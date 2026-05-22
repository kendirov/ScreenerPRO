"use client";

import {
  correlationLinkStatus,
  type CurrencyChartModel,
} from "@/lib/domain/currency-correlation-chart-model";
import { cn } from "@/lib/utils/cn";

const PAIRS: Array<{ id: keyof CurrencyChartModel["correlations"]; title: string }> = [
  { id: "SI/CNY", title: "Доллар · Юань" },
  { id: "SI/ED", title: "Доллар · Евро/доллар" },
  { id: "CNY/ED", title: "Юань · Евро/доллар" },
];

const TONE_CLASS: Record<string, string> = {
  strong: "text-emerald-300 border-emerald-500/30 bg-emerald-950/25",
  medium: "text-cyan-200 border-cyan-500/25 bg-cyan-950/20",
  weak: "text-slate-400 border-slate-600/40 bg-slate-900/40",
  negative: "text-rose-300 border-rose-500/30 bg-rose-950/25",
  muted: "text-slate-500 border-slate-700/40 bg-slate-950/30",
};

export function CurrencyCorrelationMatrix({
  model,
  compact,
}: {
  model: CurrencyChartModel;
  compact?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Матрица связи</p>
      <div className={cn(compact ? "space-y-1.5" : "space-y-2")}>
        {PAIRS.map(({ id, title }) => {
          const corr = model.correlations[id];
          const commonDates = model.commonDatesByPair[id];
          const status = correlationLinkStatus(corr, commonDates);
          return (
            <div
              key={id}
              className={cn(
                "rounded-lg border backdrop-blur-sm",
                compact ? "px-2 py-2" : "px-3 py-2.5",
                TONE_CLASS[status.tone] ?? TONE_CLASS.muted,
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium">{title}</span>
                <span className="font-mono text-sm tabular-nums">
                  {corr != null && Number.isFinite(corr) ? corr.toFixed(2) : "—"}
                </span>
              </div>
              <p className="mt-1 text-[10px] opacity-90">{status.label}</p>
              <p className="mt-1 text-[9px] text-slate-500/90">
                {commonDates === 0
                  ? "нет общих дат между контрактами"
                  : commonDates >= 3
                    ? `общих дат: ${commonDates} · по дневным изменениям`
                    : `мало общих дат (${commonDates}) для оценки связи`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
