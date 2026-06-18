"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils/cn";
import { AnimatedLabValue } from "@/components/lab/perpetual-leverage/animated-lab-value";
import { LEVERAGE_VALUE_TRANSITION } from "@/lib/domain/leverage-micro-interaction";
import {
  computePositionDiagnostics,
  formatDiagnosticsAdversePercent,
  formatLeverageX,
  formatPercentFixed,
  formatPrice,
  formatUsd,
  type PositionDiagnosticsRiskTier,
} from "@/lib/domain/perpetual-leverage";
import type { PositionAutoDiagnosisSeverity } from "@/lib/domain/position-auto-diagnosis";
import type { SimulatorControlsState } from "@/components/lab/perpetual-leverage/liquidation-map-controls";

type Props = {
  state: SimulatorControlsState;
  className?: string;
  leverageLive?: boolean;
};

const AUTO_DIAG_CLASS: Record<PositionAutoDiagnosisSeverity, string> = {
  error: "border-rose-500/28 bg-rose-950/28 text-rose-100/95",
  warning: "border-amber-500/22 bg-amber-950/20 text-amber-100/92",
  ok: "border-cyan-500/20 bg-cyan-950/18 text-cyan-100/88",
};

const RISK_TIER_CLASS: Record<PositionDiagnosticsRiskTier, string> = {
  educational: "border-cyan-500/25 bg-cyan-950/20 text-cyan-100",
  working: "border-slate-500/20 bg-slate-900/35 text-slate-200",
  high: "border-amber-500/25 bg-amber-950/22 text-amber-100",
  extreme: "border-rose-500/30 bg-rose-950/28 text-rose-100",
};

function MetricRow({
  label,
  value,
  subValue,
  animateValue,
  valueClassName,
}: {
  label: string;
  value: string;
  subValue?: string;
  animateValue?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="position-diagnostics__row flex items-baseline justify-between gap-2 border-b border-white/[0.04] py-1.5 last:border-0">
      <span className="shrink-0 text-[10px] leading-tight text-slate-500">{label}</span>
      <div className="min-w-0 text-right">
        <p
          className={cn(
            "lab-number text-sm font-bold tabular-nums text-slate-100",
            valueClassName,
          )}
        >
          {animateValue ? <AnimatedLabValue value={value} /> : value}
        </p>
        {subValue ? (
          <p className="lab-number text-[10px] font-medium tabular-nums text-slate-500">{subValue}</p>
        ) : null}
      </div>
    </div>
  );
}

export function PositionDiagnosticsPanel({ state, className, leverageLive = false }: Props) {
  const reduceMotion = useReducedMotion();
  const d = React.useMemo(
    () =>
      computePositionDiagnostics({
        deposit: state.deposit,
        leverage: state.leverage,
        stopPercent: state.stopPercent,
        direction: state.direction,
        takeProfitR: state.takeProfitR,
      }),
    [state.deposit, state.leverage, state.stopPercent, state.direction, state.takeProfitR],
  );

  const liqDistance = d.liquidationInactive
    ? "—"
    : formatDiagnosticsAdversePercent(d.liquidationDistancePercent, 2);
  const stopDistance = formatDiagnosticsAdversePercent(d.stopDistancePercent, 2);
  const bufferValue = d.liquidationInactive
    ? "—"
    : `${formatPercentFixed(d.bufferAfterStopPercent, 2)}%`;

  return (
    <aside
      className={cn(
        "position-diagnostics flex min-h-0 min-w-0 flex-col rounded-xl border border-white/[0.08] bg-black/40 p-2 sm:p-2.5",
        className,
      )}
      aria-label="Диагностика позиции"
    >
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        Диагностика позиции
      </h3>

      <motion.div
        key={d.mainAlert}
        className="mt-2 rounded-lg border border-rose-500/22 bg-rose-950/22 px-2.5 py-2"
        initial={reduceMotion ? false : { opacity: 0.9 }}
        animate={{ opacity: 1 }}
        transition={reduceMotion ? { duration: 0 } : LEVERAGE_VALUE_TRANSITION}
        role="alert"
        aria-live="polite"
      >
        <p className="text-[11px] font-medium leading-snug text-rose-100/95">
          {leverageLive ? <AnimatedLabValue value={d.mainAlert} /> : d.mainAlert}
        </p>
      </motion.div>

      <div className="mt-2 rounded-lg border border-white/[0.06] bg-black/30 px-2 py-0.5">
        <MetricRow
          label="Размер позиции"
          value={formatUsd(d.positionSize, 0)}
          animateValue={leverageLive}
        />
        <MetricRow label="Маржа" value={formatUsd(d.margin, 0)} />
        <MetricRow
          label="Плечо"
          value={formatLeverageX(d.leverage)}
          animateValue={leverageLive}
        />
        <MetricRow
          label="Цена ликвидации"
          value={d.liquidationInactive ? "—" : formatPrice(d.liquidationPrice)}
          animateValue={leverageLive}
          valueClassName={!d.liquidationInactive ? "text-rose-200" : undefined}
        />
        <MetricRow
          label="До ликвидации"
          value={liqDistance}
          animateValue={leverageLive}
          valueClassName={!d.liquidationInactive ? "text-rose-200/90" : undefined}
        />
        <MetricRow label="Стоп" value={formatPrice(d.stopPrice)} />
        <MetricRow
          label="До стопа"
          value={`${stopDistance} / -${formatUsd(d.stopLossUsd, 0)}`}
        />
        <MetricRow
          label="Запас после стопа"
          value={bufferValue}
          valueClassName={
            !d.liquidationInactive && d.bufferAfterStopPercent < 1
              ? "text-amber-200"
              : undefined
          }
        />
        <MetricRow label="Комиссия туда-обратно" value={`≈ ${formatUsd(d.roundTripFeeUsd, 2)}`} />
      </div>

      <motion.div
        key={d.riskTier}
        className={cn(
          "mt-2 rounded-lg border px-2.5 py-2 transition-colors duration-300",
          RISK_TIER_CLASS[d.riskTier],
        )}
        initial={reduceMotion ? false : { opacity: 0.75 }}
        animate={{ opacity: 1 }}
        transition={reduceMotion ? { duration: 0 } : LEVERAGE_VALUE_TRANSITION}
      >
        <p className="text-[10px] text-slate-500">Оценка риска</p>
        <p className="mt-0.5 text-xs font-semibold">
          {leverageLive ? <AnimatedLabValue value={d.riskTierLabel} /> : d.riskTierLabel}
        </p>
      </motion.div>

      {d.autoDiagnosis.severity !== "ok" ? (
        <motion.div
          key={d.autoDiagnosis.lines.join("|")}
          className={cn(
            "mt-2 rounded-lg border px-2.5 py-2",
            AUTO_DIAG_CLASS[d.autoDiagnosis.severity],
          )}
          initial={reduceMotion ? false : { opacity: 0.85 }}
          animate={{ opacity: 1 }}
          transition={reduceMotion ? { duration: 0 } : LEVERAGE_VALUE_TRANSITION}
          role={d.autoDiagnosis.severity === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          <div className="space-y-1">
            {d.autoDiagnosis.lines.map((line) => (
              <p key={line} className="text-[11px] leading-snug">
                {line}
              </p>
            ))}
          </div>
        </motion.div>
      ) : null}
    </aside>
  );
}
