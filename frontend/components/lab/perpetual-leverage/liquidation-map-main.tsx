"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import {
  LiquidationMapControls,
  type SimulatorControlsState,
} from "@/components/lab/perpetual-leverage/liquidation-map-controls";
import { LiquidationMapMetrics } from "@/components/lab/perpetual-leverage/liquidation-map-metrics";
import { PositionDiagnosticsPanel } from "@/components/lab/perpetual-leverage/position-diagnostics-panel";
import { LeverageInsightChips } from "@/components/lab/perpetual-leverage/leverage-insight-chips";
import { VerticalRiskLadder } from "@/components/lab/perpetual-leverage/vertical-risk-ladder";
import type { SimulatorLeverageOption } from "@/lib/domain/perpetual-leverage";
import { computeLiquidationSimulator, computeRiskLadderPrices } from "@/lib/domain/perpetual-leverage";
import { useLeverageInteractionActive } from "@/lib/hooks/use-leverage-interaction-active";
import { getLeverage50xWarning } from "@/lib/domain/leverage-micro-interaction";
import { LeverageExtremeWarning } from "@/components/lab/perpetual-leverage/leverage-extreme-warning";
import { AnimatePresence } from "motion/react";

type Props = {
  state: SimulatorControlsState;
  onChange: (patch: Partial<SimulatorControlsState>) => void;
  className?: string;
};

export function LiquidationMapMain({ state, onChange, className }: Props) {
  const [leverageDragging, setLeverageDragging] = React.useState(false);
  const leverageLive = useLeverageInteractionActive(state.leverage, leverageDragging);
  const result = React.useMemo(() => computeLiquidationSimulator(state), [state]);
  const show50xWarning = getLeverage50xWarning(state.leverage, result.leverageOneNote != null);
  const ladder = React.useMemo(
    () =>
      computeRiskLadderPrices({
        leverage: state.leverage,
        direction: state.direction,
        stopPercent: state.stopPercent,
        takeProfitR: state.takeProfitR,
      }),
    [state.leverage, state.direction, state.stopPercent, state.takeProfitR],
  );

  return (
    <div
      className={cn(
        "grid min-h-0 min-w-0 grid-cols-1 gap-2 lg:grid-cols-[minmax(0,11.5rem)_minmax(0,1fr)] lg:gap-3 xl:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] xl:gap-3.5 2xl:grid-cols-[minmax(0,12.5rem)_minmax(0,1fr)]",
        className,
      )}
    >
      <div className="order-2 min-w-0 lg:order-1">
        <LiquidationMapControls
          state={state}
          onChange={onChange}
          onLeverageDraggingChange={setLeverageDragging}
        />
      </div>

      <div
        className={cn(
          "perp-lab-glass-stage order-1 flex min-h-0 min-w-0 flex-col gap-2 p-2 sm:gap-2.5 sm:p-2.5 lg:order-2",
          leverageLive && "perp-lab-glass-stage--leverage-live",
        )}
      >
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(10.5rem,12.5rem)] xl:grid-cols-[minmax(0,1fr)_minmax(11.5rem,13rem)] 2xl:grid-cols-[minmax(0,1fr)_minmax(12.5rem,14rem)]">
          <VerticalRiskLadder
            minimal
            className="min-h-0"
            entryPrice={ladder.entryPrice}
            stopPrice={ladder.stopPrice}
            takeProfitPrice={ladder.takeProfitPrice}
            liquidationPrice={ladder.liquidationPrice}
            direction={state.direction}
            leverage={state.leverage}
            deposit={state.deposit}
            riskPercent={state.stopPercent}
            takeProfitR={state.takeProfitR}
            liquidationDistancePercent={result.liquidationDistancePercent}
            airAfterStop={
              ladder.liquidationInactive ? 0 : result.liquidationDistancePercent - state.stopPercent
            }
            liquidationInactive={ladder.liquidationInactive}
            leverageDragging={leverageDragging}
            onLeverageSelect={(lev) => onChange({ leverage: lev })}
          />
          <PositionDiagnosticsPanel
            state={state}
            className="hidden lg:flex"
            leverageLive={leverageLive}
          />
        </div>
        <PositionDiagnosticsPanel state={state} className="lg:hidden" leverageLive={leverageLive} />
        <AnimatePresence>
          {show50xWarning ? <LeverageExtremeWarning /> : null}
        </AnimatePresence>
        <LiquidationMapMetrics state={state} variant="compact" leverageLive={leverageLive} />
        <LeverageInsightChips
          layout="row"
          activeLeverage={state.leverage}
          onSelect={(leverage: SimulatorLeverageOption) => onChange({ leverage })}
        />
      </div>
    </div>
  );
}
