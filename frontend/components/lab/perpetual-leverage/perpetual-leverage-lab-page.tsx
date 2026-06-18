"use client";

import * as React from "react";
import { LiquidationMapHero } from "@/components/lab/perpetual-leverage/liquidation-map-hero";
import { LiquidationMapMain } from "@/components/lab/perpetual-leverage/liquidation-map-main";
import {
  DEFAULT_SIMULATOR_CONTROLS,
  type SimulatorControlsState,
} from "@/components/lab/perpetual-leverage/liquidation-map-controls";
import { PerpetualLeverageAdvanced } from "@/components/lab/perpetual-leverage/perpetual-leverage-advanced";

export function PerpetualLeverageLabPage() {
  const [controls, setControls] = React.useState<SimulatorControlsState>(DEFAULT_SIMULATOR_CONTROLS);

  return (
    <div className="perp-lab mx-auto w-full max-w-[min(1680px,100%)] overflow-x-hidden px-2 pb-8 sm:px-3 lg:px-4 2xl:px-5">
      <section
        className="perp-lab-slide flex min-h-0 min-w-0 flex-col gap-2 sm:gap-2.5 2xl:gap-3"
        aria-label="Симулятор ликвидации"
      >
        <LiquidationMapHero />
        <LiquidationMapMain
          className="min-h-0 flex-1"
          state={controls}
          onChange={(patch) => setControls((prev) => ({ ...prev, ...patch }))}
        />
      </section>

      <div className="mt-6 border-t border-white/[0.06] pt-4">
        <PerpetualLeverageAdvanced simulator={controls} />
      </div>
    </div>
  );
}
