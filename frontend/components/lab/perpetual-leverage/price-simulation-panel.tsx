"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils/cn";
import {
  PRICE_SIMULATION_STATUS_RU,
  type PriceMarkerStatus,
} from "@/lib/domain/price-ladder";
import { formatPercentFixed, formatPrice, formatUsd } from "@/lib/domain/perpetual-leverage";

const STATUS_PANEL_CLASS: Record<PriceMarkerStatus, string> = {
  profit_zone: "border-emerald-500/30 bg-emerald-950/30 text-emerald-200",
  normal_risk: "border-cyan-500/25 bg-cyan-950/25 text-cyan-100",
  stop_should_trigger: "border-amber-500/30 bg-amber-950/30 text-amber-100",
  danger_zone: "border-rose-500/35 bg-rose-950/35 text-rose-100",
  liquidated: "border-rose-500/45 bg-rose-950/50 text-rose-50",
};

type Props = {
  currentPrice: number;
  sliderMin: number;
  sliderMax: number;
  sliderStep: number;
  onPriceChange: (price: number) => void;
  pnlPercent: number;
  pnlUsd: number;
  status: PriceMarkerStatus;
};

export function PriceSimulationPanel({
  currentPrice,
  sliderMin,
  sliderMax,
  sliderStep,
  onPriceChange,
  pnlPercent,
  pnlUsd,
  status,
}: Props) {
  const reduceMotion = useReducedMotion();
  const meta = PRICE_SIMULATION_STATUS_RU[status];
  const pnlPositive = pnlPercent >= 0;

  return (
    <div className="price-simulation-panel space-y-2.5">
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label htmlFor="price-ladder-current" className="text-xs font-medium text-slate-300">
            Текущая цена после входа
          </label>
          <span className="lab-number text-xs font-semibold tabular-nums text-slate-200">
            {formatPrice(currentPrice)}
          </span>
        </div>
        <input
          id="price-ladder-current"
          type="range"
          min={sliderMin}
          max={sliderMax}
          step={sliderStep}
          value={currentPrice}
          onChange={(e) => onPriceChange(Number(e.target.value))}
          className="price-ladder-slider w-full"
          aria-valuetext={formatPrice(currentPrice)}
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <MetricBox
          label="PnL, % с плечом"
          value={`${pnlPositive ? "+" : ""}${formatPercentFixed(pnlPercent, 1)}`}
          valueClassName={pnlPositive ? "text-emerald-300" : "text-rose-300"}
        />
        <MetricBox
          label="PnL, $"
          value={`${pnlUsd >= 0 ? "+" : ""}${formatUsd(pnlUsd, 0)}`}
          valueClassName={pnlPositive ? "text-emerald-300" : "text-rose-300"}
        />
      </div>

      <motion.div
        key={status}
        initial={reduceMotion ? false : { opacity: 0.85 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className={cn("rounded-lg border px-3 py-2", STATUS_PANEL_CLASS[status])}
        role="status"
        aria-live="polite"
      >
        <p className="text-xs font-semibold leading-snug">{meta.label}</p>
        <p className="mt-0.5 text-[11px] leading-snug opacity-85">{meta.hint}</p>
      </motion.div>
    </div>
  );
}

function MetricBox({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/40 px-2 py-1.5 sm:px-2.5 sm:py-2">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className={cn("lab-number mt-0.5 text-sm font-bold tabular-nums text-slate-100", valueClassName)}>
        {value}
      </p>
    </div>
  );
}
