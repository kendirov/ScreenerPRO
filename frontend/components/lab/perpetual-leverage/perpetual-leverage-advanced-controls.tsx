"use client";

import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { cn } from "@/lib/utils/cn";
import {
  MARGIN_MODE_EXPLANATION,
  type MarginMode,
  type PerpetualAdvancedControlsState,
} from "@/lib/domain/perpetual-leverage";

type Props = {
  state: PerpetualAdvancedControlsState;
  onChange: (patch: Partial<PerpetualAdvancedControlsState>) => void;
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
      <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={Number.isFinite(value) ? value : ""}
          min={min}
          max={max}
          step={step ?? "any"}
          onChange={(e) => onChange(Number(e.target.value))}
          className="lab-number w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/25"
        />
        {suffix ? <span className="shrink-0 text-[10px] text-slate-600">{suffix}</span> : null}
      </div>
    </label>
  );
}

export function PerpetualLeverageAdvancedControls({ state, onChange }: Props) {
  return (
    <LabGlassPanel depth={10} className="perp-lab-panel space-y-3 p-4 sm:p-5">
      <p className="text-xs leading-relaxed text-slate-500">
        Дополнительные параметры не меняют главную шкалу — только уточняют издержки и стоп.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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

      <div className="grid grid-cols-2 gap-2">
        <NumField
          label="Стоп от входа"
          value={state.stopPercent}
          min={0}
          max={100}
          step={0.1}
          suffix="%"
          onChange={(stopPercent) => onChange({ stopPercent })}
        />
        <NumField
          label="Периодов funding"
          value={state.fundingPeriods}
          min={0}
          step={1}
          onChange={(fundingPeriods) => onChange({ fundingPeriods: Math.round(fundingPeriods) })}
        />
      </div>

      <div>
        <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Margin mode</span>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {(["isolated", "cross"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onChange({ marginMode: mode })}
              className={cn(
                "rounded-lg border px-2 py-2 text-xs font-medium capitalize transition",
                state.marginMode === mode
                  ? "border-cyan-500/35 bg-cyan-950/30 text-cyan-200"
                  : "border-white/8 bg-black/40 text-slate-500 hover:border-white/12",
              )}
            >
              {mode}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-slate-600">
          {MARGIN_MODE_EXPLANATION[state.marginMode]}
        </p>
      </div>
    </LabGlassPanel>
  );
}

export type { PerpetualAdvancedControlsState, MarginMode };
