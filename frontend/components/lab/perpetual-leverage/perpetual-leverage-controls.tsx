"use client";

import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { cn } from "@/lib/utils/cn";
import {
  PERPETUAL_LEVERAGE_OPTIONS,
  formatLeverageX,
  type PerpetualCalculatorInput,
} from "@/lib/domain/perpetual-leverage";

export type PerpetualControlsState = PerpetualCalculatorInput;
export type { PositionSide } from "@/lib/domain/perpetual-leverage";

type Props = {
  state: PerpetualControlsState;
  onChange: (patch: Partial<PerpetualControlsState>) => void;
};

function NumField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={Number.isFinite(value) ? value : ""}
          min={min}
          max={max}
          step={step ?? "any"}
          onChange={(e) => onChange(Number(e.target.value))}
          className="lab-number w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5 text-sm text-slate-100 outline-none ring-cyan-500/30 focus:border-cyan-500/40 focus:ring-1"
        />
        {suffix ? <span className="shrink-0 text-[10px] text-slate-500">{suffix}</span> : null}
      </div>
    </label>
  );
}

export function PerpetualLeverageControls({ state, onChange }: Props) {
  return (
    <LabGlassPanel depth={20} className="perp-lab-panel h-full space-y-3 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-slate-100">Параметры</h3>

      <div className="grid grid-cols-2 gap-2">
        {(["long", "short"] as const).map((direction) => (
          <button
            key={direction}
            type="button"
            onClick={() => onChange({ direction })}
            className={cn(
              "rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition",
              state.direction === direction
                ? direction === "long"
                  ? "border-emerald-500/40 bg-emerald-950/35 text-emerald-200"
                  : "border-rose-500/40 bg-rose-950/35 text-rose-200"
                : "border-white/8 bg-slate-950/40 text-slate-500 hover:border-white/15",
            )}
          >
            {direction === "long" ? "Long" : "Short"}
          </button>
        ))}
      </div>

      <NumField
        label="Депозит"
        value={state.deposit}
        min={1}
        step={10}
        suffix="USDT"
        onChange={(deposit) => onChange({ deposit })}
      />
      <NumField
        label="Цена входа"
        value={state.entryPrice}
        min={0.01}
        step={1}
        onChange={(entryPrice) => onChange({ entryPrice })}
      />

      <div className="space-y-1.5">
        <span className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Плечо</span>
        <div className="flex flex-wrap gap-1.5">
          {PERPETUAL_LEVERAGE_OPTIONS.map((lev) => (
            <button
              key={lev}
              type="button"
              onClick={() => onChange({ leverage: lev })}
              className={cn(
                "lab-number min-w-[2.25rem] rounded-md border px-2 py-1 text-xs font-semibold transition",
                state.leverage === lev
                  ? "border-cyan-500/35 bg-cyan-950/35 text-cyan-200/95"
                  : "border-white/8 bg-black/40 text-slate-500 hover:border-white/15",
              )}
            >
              {formatLeverageX(lev)}
            </button>
          ))}
        </div>
      </div>

      <NumField
        label="Стоп от входа"
        value={state.stopPercent}
        min={0}
        max={100}
        step={0.1}
        suffix="%"
        onChange={(stopPercent) => onChange({ stopPercent })}
      />

      <div className="grid grid-cols-2 gap-2 border-t border-white/6 pt-3">
        <NumField
          label="Taker fee"
          value={state.takerFee}
          min={0}
          step={0.001}
          suffix="%"
          onChange={(takerFee) => onChange({ takerFee })}
        />
        <NumField
          label="Maker fee"
          value={state.makerFee}
          min={0}
          step={0.001}
          suffix="%"
          onChange={(makerFee) => onChange({ makerFee })}
        />
        <NumField
          label="Funding"
          value={state.fundingRate}
          min={0}
          step={0.001}
          suffix="%"
          onChange={(fundingRate) => onChange({ fundingRate })}
        />
      </div>

      <NumField
        label="Периодов funding"
        value={state.fundingPeriods}
        min={0}
        step={1}
        onChange={(fundingPeriods) => onChange({ fundingPeriods: Math.round(fundingPeriods) })}
      />
    </LabGlassPanel>
  );
}
