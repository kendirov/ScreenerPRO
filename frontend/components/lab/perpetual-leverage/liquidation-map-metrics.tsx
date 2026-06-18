"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils/cn";
import { AnimatedLabValue } from "@/components/lab/perpetual-leverage/animated-lab-value";
import { LEVERAGE_VALUE_TRANSITION } from "@/lib/domain/leverage-micro-interaction";
import {
  computeLiquidationMapMetrics,
  formatPercentFixed,
  formatUsd,
  getLeverageChipInsight,
  getLeverageMetricsVisualTier,
  type AirAfterStopStatus,
  type LeverageMetricsVisualTier,
} from "@/lib/domain/perpetual-leverage";
import type { SimulatorControlsState } from "@/components/lab/perpetual-leverage/liquidation-map-controls";

type Props = {
  state: SimulatorControlsState;
};

const AIR_STATUS_STYLES: Record<AirAfterStopStatus, { airValue: string }> = {
  inactive: { airValue: "text-slate-500" },
  invalid: { airValue: "text-rose-200" },
  tight: { airValue: "text-amber-200" },
  ok: { airValue: "text-cyan-200" },
};

function MetricTile({
  label,
  value,
  emphasis = "muted",
  valueClassName,
  animateValue = false,
}: {
  label: string;
  value: string;
  emphasis?: "primary" | "muted";
  valueClassName?: string;
  animateValue?: boolean;
}) {
  const primary = emphasis === "primary";

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col justify-center rounded-lg border px-2.5 py-2 transition-colors duration-300 sm:px-3 sm:py-2.5",
        primary
          ? "border-white/[0.12] bg-slate-900/50 shadow-[0_0_24px_rgba(0,0,0,0.25)]"
          : "border-white/[0.04] bg-slate-950/20 opacity-75",
      )}
    >
      <p
        className={cn(
          "truncate",
          primary ? "text-[11px] font-medium text-slate-400" : "text-[10px] text-slate-600",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "lab-number mt-1 truncate font-bold tabular-nums",
          primary ? "text-lg text-slate-50 sm:text-xl" : "text-sm text-slate-500 sm:text-base",
          valueClassName,
        )}
      >
        {animateValue ? (
          <AnimatedLabValue value={value} className={valueClassName} />
        ) : (
          value
        )}
      </p>
    </div>
  );
}

function formatAdversePercent(value: number): string {
  return `-${formatPercentFixed(value, 1)}`;
}

function formatPositivePercent(value: number): string {
  return `+${formatPercentFixed(value, 1)}`;
}

const INSIGHT_TONE: Record<LeverageMetricsVisualTier, string> = {
  calm: "border-cyan-500/15 bg-cyan-950/12 text-cyan-100/85",
  warning: "border-amber-500/15 bg-amber-950/15 text-amber-100/85",
  danger: "border-rose-500/20 bg-rose-950/18 text-rose-100/88",
  extreme: "border-rose-500/25 bg-rose-950/22 text-rose-50/90",
};

const INVALID_PLAN_MESSAGE = "План невалиден: ликвидация раньше стопа.";

type MetricsProps = Props & {
  variant?: "compact" | "full";
  leverageLive?: boolean;
};

function AnimatedRiskInsight({
  tier,
  insight,
}: {
  tier: LeverageMetricsVisualTier;
  insight: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.p
      key={`${tier}-${insight}`}
      className={cn("rounded-lg border px-3 py-2.5 text-sm leading-snug", INSIGHT_TONE[tier])}
      role="status"
      initial={reduceMotion ? false : { opacity: 0.7 }}
      animate={{ opacity: 1 }}
      transition={reduceMotion ? { duration: 0 } : LEVERAGE_VALUE_TRANSITION}
    >
      {insight}
    </motion.p>
  );
}

export function LiquidationMapMetrics({ state, variant = "full", leverageLive = false }: MetricsProps) {
  const m = computeLiquidationMapMetrics(state);
  const airStyles = AIR_STATUS_STYLES[m.airStatus];
  const leverageTier = getLeverageMetricsVisualTier(state.leverage);
  const insight = getLeverageChipInsight(state.leverage);
  const invalidPlan = !m.liquidationInactive && (m.airStatus === "invalid" || m.airAfterStop <= 0);

  const stopValue = formatAdversePercent(m.riskPercent);
  const liqValue = m.liquidationInactive ? "—" : formatAdversePercent(m.liquidationDistancePercent);
  const airValue = m.liquidationInactive ? "—" : formatPercentFixed(m.airAfterStop, 1);
  const targetValue = `${formatPositivePercent(m.takeProfitPercent)} / ${m.takeProfitR}R`;

  const tiles = (
    <div className="min-w-0 space-y-1.5">
      <div className="grid min-w-0 grid-cols-3 gap-1.5 sm:gap-2">
        <MetricTile
          emphasis="primary"
          label="Размер позиции"
          value={formatUsd(m.positionSize)}
          animateValue={leverageLive}
        />
        <MetricTile
          emphasis="primary"
          label="До ликвидации"
          value={liqValue}
          animateValue={leverageLive}
        />
        <MetricTile
          emphasis="primary"
          label="Запас"
          value={airValue}
          valueClassName={airStyles.airValue}
          animateValue={leverageLive}
        />
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-1 sm:gap-1.5">
        <MetricTile emphasis="muted" label="До стопа" value={stopValue} />
        <MetricTile
          emphasis="muted"
          label="Цель"
          value={targetValue}
          valueClassName="text-emerald-600/80"
        />
      </div>
    </div>
  );

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "perp-lab-risk-metrics min-w-0 rounded-lg border border-white/[0.06] bg-black/25 px-2 py-1.5 sm:px-2.5 sm:py-2",
          invalidPlan && "perp-lab-risk-metrics--invalid",
          leverageLive && "perp-lab-risk-metrics--live",
        )}
        aria-label="Оценка риска"
      >
        {invalidPlan ? (
          <p className="mb-1.5 text-xs font-medium leading-snug text-rose-200/95" role="alert">
            {INVALID_PLAN_MESSAGE}
          </p>
        ) : null}
        {tiles}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "perp-lab-risk-metrics min-w-0 space-y-2 rounded-lg border border-white/[0.06] p-2",
        invalidPlan && "perp-lab-risk-metrics--invalid",
      )}
      aria-label="Оценка риска"
    >
      {invalidPlan ? (
        <p className="text-sm font-medium text-rose-200/95" role="alert">
          {INVALID_PLAN_MESSAGE}
        </p>
      ) : null}
      {tiles}

      {m.proximityWarning ? (
        <p className="rounded-lg border border-rose-500/20 bg-rose-950/20 px-3 py-2 text-sm text-rose-100/90" role="alert">
          {m.proximityWarning}
        </p>
      ) : null}

      {m.statusMessage ? (
        <p className="rounded-lg border border-white/[0.06] bg-slate-900/30 px-3 py-2 text-sm text-slate-400" role="status">
          {m.statusMessage}
        </p>
      ) : null}

      <AnimatedRiskInsight tier={leverageTier} insight={insight} />
    </div>
  );
}
