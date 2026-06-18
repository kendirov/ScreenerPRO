"use client";

import * as React from "react";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { cn } from "@/lib/utils/cn";
import { DirectionMiniSchema } from "@/components/lab/perpetual-leverage/direction-mini-schema";
import { DirectionSideToggle } from "@/components/lab/perpetual-leverage/direction-side-toggle";
import {
  DIRECTION_FLOW_LONG,
  DIRECTION_FLOW_SHORT,
} from "@/lib/domain/liquidation-map-labels";
import {
  SIMULATOR_DEPOSIT_OPTIONS,
  SIMULATOR_LEVERAGE_OPTIONS,
  SIMULATOR_STOP_OPTIONS,
  SIMULATOR_TAKE_R_OPTIONS,
  DEFAULT_SIMULATOR_STOP_PERCENT,
  DEFAULT_SIMULATOR_TAKE_PROFIT_R,
  formatLeverageX,
  formatPercentFixed,
  formatUsd,
  type LiquidationSimulatorInput,
  type PositionSide,
  type SimulatorStopOption,
  type SimulatorTakeProfitR,
} from "@/lib/domain/perpetual-leverage";

export type SimulatorControlsState = Omit<LiquidationSimulatorInput, "entryPrice"> & {
  stopPercent: SimulatorStopOption;
  takeProfitR: SimulatorTakeProfitR;
};

export const DEFAULT_SIMULATOR_CONTROLS: SimulatorControlsState = {
  deposit: 100,
  leverage: 10,
  direction: "long",
  stopPercent: DEFAULT_SIMULATOR_STOP_PERCENT,
  takeProfitR: DEFAULT_SIMULATOR_TAKE_PROFIT_R,
};

function OptionButtons<T extends number>({
  label,
  options,
  value,
  format,
  onSelect,
}: {
  label: string;
  options: readonly T[];
  value: T;
  format: (v: T) => string;
  onSelect: (v: T) => void;
}) {
  return (
    <div>
      <p className="text-[11px] text-slate-500">{label}</p>
      <div className="mt-1.5 flex gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(opt)}
            className={cn(
              "lab-number min-w-0 flex-1 rounded-lg border py-2 text-sm font-semibold transition",
              value === opt
                ? "border-slate-400/25 bg-slate-800/50 text-slate-100"
                : "border-white/[0.06] bg-black/40 text-slate-500 hover:border-white/10",
            )}
          >
            {format(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}

type Props = {
  state: SimulatorControlsState;
  onChange: (patch: Partial<SimulatorControlsState>) => void;
  onLeverageDraggingChange?: (dragging: boolean) => void;
};

function snapLeverage(raw: number): number {
  const value = Math.min(50, Math.max(1, Math.round(raw)));
  const snap = SIMULATOR_LEVERAGE_OPTIONS.find((s) => Math.abs(s - value) <= 1);
  return snap ?? value;
}

export function LiquidationMapControls({ state, onChange, onLeverageDraggingChange }: Props) {
  const [dragging, setDragging] = React.useState(false);
  const leveragePct = ((state.leverage - 1) / 49) * 100;

  const setDraggingState = (next: boolean) => {
    setDragging(next);
    onLeverageDraggingChange?.(next);
  };

  const handleLeverageInput = (raw: number) => {
    onChange({
      leverage: dragging ? Math.min(50, Math.max(1, Math.round(raw))) : snapLeverage(raw),
    });
  };

  return (
    <LabGlassPanel
      depth={20}
      className={cn(
        "perp-lab-panel flex flex-col p-3 sm:p-4 lg:h-full",
        dragging && "perp-lab-panel--leverage-live",
      )}
    >
      <div className="space-y-4">
        <div>
          <p className="text-[11px] text-slate-500">Депозит</p>
          <div className="mt-1.5 flex gap-1.5">
            {SIMULATOR_DEPOSIT_OPTIONS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => onChange({ deposit: amount })}
                className={cn(
                  "lab-number min-w-0 flex-1 rounded-lg border py-2 text-sm font-semibold transition",
                  state.deposit === amount
                    ? "border-slate-400/25 bg-slate-800/50 text-slate-100"
                    : "border-white/[0.06] bg-black/40 text-slate-500 hover:border-white/10",
                )}
              >
                {formatUsd(amount, 0)}
              </button>
            ))}
          </div>
        </div>

        <div className="perp-lab-leverage-block">
          <div className="flex items-end justify-between gap-2">
            <p className="text-[11px] text-slate-500">Плечо</p>
            <span
              className={cn(
                "lab-number text-3xl font-bold tabular-nums transition-transform duration-150",
                dragging ? "scale-110 text-slate-100" : "text-slate-200",
              )}
            >
              {formatLeverageX(state.leverage)}
            </span>
          </div>
          <div
            className="relative mt-3"
            style={{ "--leverage-pct": `${leveragePct}%` } as React.CSSProperties}
          >
            <input
              type="range"
              min={1}
              max={50}
              step={1}
              value={state.leverage}
              onPointerDown={() => setDraggingState(true)}
              onPointerUp={() => {
                setDraggingState(false);
                onChange({ leverage: snapLeverage(state.leverage) });
              }}
              onPointerCancel={() => setDraggingState(false)}
              onChange={(e) => handleLeverageInput(Number(e.target.value))}
              className={cn(
                "perp-lab-range perp-lab-range--leverage w-full",
                dragging && "perp-lab-range--dragging",
              )}
              aria-label="Плечо"
              aria-valuetext={formatLeverageX(state.leverage)}
            />
          </div>
        </div>

        <OptionButtons
          label="Стоп"
          options={SIMULATOR_STOP_OPTIONS}
          value={state.stopPercent}
          format={(v) => formatPercentFixed(v, 1)}
          onSelect={(stopPercent) => onChange({ stopPercent })}
        />

        <OptionButtons
          label="Тейк"
          options={SIMULATOR_TAKE_R_OPTIONS}
          value={state.takeProfitR}
          format={(r) => `${r}R`}
          onSelect={(takeProfitR) => onChange({ takeProfitR })}
        />

        <div>
          <p className="text-[11px] text-slate-500">Сторона</p>
          <DirectionSideToggle
            className="mt-1.5"
            value={state.direction}
            onChange={(direction) => onChange({ direction })}
          />

          <div
            className={cn(
              "mt-2 flex items-start gap-2 rounded-lg border p-2 transition-colors duration-300",
              state.direction === "long"
                ? "border-cyan-500/12 bg-cyan-950/10"
                : "border-violet-500/12 bg-violet-950/10",
            )}
          >
            <DirectionMiniSchema direction={state.direction} compact />
            <p className="min-w-0 flex-1 text-[10px] leading-snug text-slate-500">
              {state.direction === "long" ? DIRECTION_FLOW_LONG : DIRECTION_FLOW_SHORT}
            </p>
          </div>
        </div>
      </div>
    </LabGlassPanel>
  );
}

export type { PositionSide };
