"use client";

import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { cn } from "@/lib/utils/cn";
import {
  formatLeverageX,
  formatPercentFixed,
  formatPrice,
  formatUsd,
  type PerpetualCalculatorResult,
  type PositionSide,
} from "@/lib/domain/perpetual-leverage";
import { PerpetualLeverageWarnings } from "@/components/lab/perpetual-leverage/perpetual-leverage-warnings";

type Props = {
  result: PerpetualCalculatorResult;
  leverage: number;
  direction: PositionSide;
  className?: string;
};

function MetricRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "loss" | "danger" | "cyan" | "violet";
}) {
  const valueClass = {
    neutral: "text-slate-100",
    loss: "text-rose-300",
    danger: "text-rose-400",
    cyan: "text-cyan-200",
    violet: "text-violet-200",
  }[tone];

  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/5 py-2 last:border-0">
      <p className="text-[11px] text-slate-500">{label}</p>
      <span className={cn("lab-number text-sm font-medium tabular-nums", valueClass)}>{value}</span>
    </div>
  );
}

export function PerpetualLeverageMetrics({ result, leverage, direction, className }: Props) {
  const costHigh = result.totalEstimatedCost > result.margin * 0.15;
  const riskPctOfDeposit =
    result.margin > 0 ? (result.totalEstimatedCost / result.margin) * 100 : 0;
  const directionLabel = direction === "long" ? "Long" : "Short";

  return (
    <LabGlassPanel
      depth={20}
      className={cn("perp-lab-panel flex h-full flex-col gap-3 p-4 sm:p-5", className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-100">Расчёт</h3>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">
          {directionLabel} · {formatLeverageX(leverage)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-white/6 bg-black/30 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Позиция</p>
          <p className="lab-number mt-0.5 text-base text-cyan-200/95">{formatUsd(result.positionSize)}</p>
        </div>
        <div className="rounded-lg border border-white/6 bg-black/30 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Маржа</p>
          <p className="lab-number mt-0.5 text-base text-violet-200/95">{formatUsd(result.margin)}</p>
        </div>
      </div>

      <div className="rounded-lg border border-white/6 bg-black/30 px-3 py-0.5">
        <MetricRow label="Ликвидация" value={formatPrice(result.liquidationPrice)} tone="danger" />
        <MetricRow
          label="До ликвидации"
          value={formatPercentFixed(result.liquidationDistancePercent, 1)}
          tone="danger"
        />
        <MetricRow label="Стоп" value={formatPrice(result.stopPrice)} tone="cyan" />
        <MetricRow label="Убыток на стопе" value={formatUsd(result.lossAtStop)} tone="loss" />
      </div>

      <div className="rounded-lg border border-white/6 bg-black/25 px-3 py-0.5">
        <p className="py-1.5 text-[10px] uppercase tracking-[0.12em] text-slate-500">Издержки</p>
        <MetricRow label="Комиссия RT" value={formatUsd(result.feeRoundTrip)} />
        <MetricRow label="Funding" value={formatUsd(result.fundingCost)} />
        <MetricRow label="Итого риск" value={formatUsd(result.totalEstimatedCost)} tone={costHigh ? "loss" : "neutral"} />
        <MetricRow
          label="Риск от депозита"
          value={formatPercentFixed(riskPctOfDeposit, 1)}
          tone={costHigh ? "loss" : "neutral"}
        />
      </div>

      <PerpetualLeverageWarnings warnings={result.warnings} />
    </LabGlassPanel>
  );
}
