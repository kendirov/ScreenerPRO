"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { LiquidationMapKeyThought } from "@/components/lab/perpetual-leverage/liquidation-map-key-thought";
import { LiquidationMapMetrics } from "@/components/lab/perpetual-leverage/liquidation-map-metrics";
import { LeverageLadderPhrase } from "@/components/lab/perpetual-leverage/leverage-ladder-phrase";
import { PerpetualLeverageAdvancedControls } from "@/components/lab/perpetual-leverage/perpetual-leverage-advanced-controls";
import { PerpetualLeverageMetrics } from "@/components/lab/perpetual-leverage/perpetual-leverage-metrics";
import type { SimulatorControlsState } from "@/components/lab/perpetual-leverage/liquidation-map-controls";
import {
  DEFAULT_PERPETUAL_ADVANCED,
  PERPETUAL_LIQUIDATION_DISCLAIMER,
  computePerpetualCalculator,
  mergeSimulatorWithAdvanced,
  type PerpetualAdvancedControlsState,
} from "@/lib/domain/perpetual-leverage";

type Props = {
  simulator: SimulatorControlsState;
};

export function PerpetualLeverageAdvanced({ simulator }: Props) {
  const [open, setOpen] = React.useState(false);
  const [advanced, setAdvanced] = React.useState<PerpetualAdvancedControlsState>(DEFAULT_PERPETUAL_ADVANCED);

  const handleToggle = () => {
    setOpen((wasOpen) => {
      if (!wasOpen) setAdvanced(DEFAULT_PERPETUAL_ADVANCED);
      return !wasOpen;
    });
  };

  const calculatorInput = React.useMemo(
    () => mergeSimulatorWithAdvanced(simulator, advanced),
    [simulator, advanced],
  );

  const result = React.useMemo(() => computePerpetualCalculator(calculatorInput), [calculatorInput]);

  return (
    <section className="min-w-0" aria-label="Advanced mode">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/8 bg-black/40 px-4 py-3 text-sm text-slate-400 transition hover:border-white/12 hover:text-slate-300"
      >
        <span>{open ? "Скрыть Advanced" : "Advanced"}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          open ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          <div className="space-y-4">
            <LeverageLadderPhrase leverage={simulator.leverage} />
            <LiquidationMapKeyThought />
            <LiquidationMapMetrics state={simulator} variant="full" />

            <p className="text-center text-[10px] leading-relaxed text-slate-600">
              {PERPETUAL_LIQUIDATION_DISCLAIMER}
            </p>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,280px)_1fr]">
              <PerpetualLeverageAdvancedControls
                state={advanced}
                onChange={(patch) => setAdvanced((prev) => ({ ...prev, ...patch }))}
              />
              <PerpetualLeverageMetrics
                result={result}
                leverage={simulator.leverage}
                direction={simulator.direction}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
