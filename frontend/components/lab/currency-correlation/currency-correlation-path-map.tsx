"use client";

import type { TrajectoryPathStep } from "@/lib/domain/spread-trajectory";
import {
  formatUnitValueShort,
  type SpreadUnitMode,
} from "@/lib/domain/currency-spread-units";
import { cn } from "@/lib/utils/cn";

function fmtZ(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `z=${v.toFixed(1)}`;
}

export function CurrencyCorrelationPathMap({
  steps,
  summary,
  unitMode,
  compact,
}: {
  steps: TrajectoryPathStep[];
  summary: string;
  unitMode: SpreadUnitMode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.06] bg-slate-900/45 backdrop-blur-xl",
        compact ? "px-2.5 py-2" : "px-3 py-3",
      )}
    >
      <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-slate-600">
        Путь расхождения
      </p>
      {steps.length === 0 ? (
        <p className="text-[11px] text-slate-500">Нет этапов за выбранный период.</p>
      ) : (
        <>
          <p className="mb-2 font-mono text-[10px] text-violet-200/80">{summary}</p>
          <ol className="space-y-1.5">
            {steps.map((step, i) => (
              <li
                key={`${step.stageKey}-${step.timestamp}-${i}`}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md border border-white/[0.04] bg-black/20 px-2 py-1.5 text-[11px]"
              >
                <span className="font-mono text-cyan-200/80">{step.timeLabel}</span>
                <span className="text-slate-300">{step.stageLabel}</span>
                <span className="font-mono text-violet-200/90">{fmtZ(step.zScore)}</span>
                <span className="font-mono text-slate-400">
                  {formatUnitValueShort(step.spreadPoints, unitMode)}
                </span>
                {step.durationBars > 0 ? (
                  <span className="text-slate-600">{step.durationBars} св.</span>
                ) : null}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
