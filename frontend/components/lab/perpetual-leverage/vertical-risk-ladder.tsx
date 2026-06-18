"use client";

import * as React from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils/cn";
import { LeverageSpaceCompression } from "@/components/lab/perpetual-leverage/leverage-space-compression";
import { LiquidationMapTakeaway } from "@/components/lab/perpetual-leverage/liquidation-map-takeaway";
import { PriceLadderCoordPlot } from "@/components/lab/perpetual-leverage/price-ladder-coord-chart";
import { useLeverageInteractionActive } from "@/lib/hooks/use-leverage-interaction-active";
import { PriceMovementSimulationToggle } from "@/components/lab/perpetual-leverage/price-movement-simulation-toggle";
import { PriceSimulationPanel } from "@/components/lab/perpetual-leverage/price-simulation-panel";
import { DirectionChartHeader } from "@/components/lab/perpetual-leverage/direction-chart-header";
import type { EducationalLevelId } from "@/lib/domain/liquidation-map-labels";
import {
  buildHonestAxisTicks,
  buildHonestLevelLines,
  buildHonestPriceScale,
  buildHonestZoneBands,
  ENTRY_ANCHOR_Y_PCT,
  HONEST_PLOT_BOTTOM_PCT,
  HONEST_PLOT_TOP_PCT,
  resolveLevelLabelPlacements,
} from "@/lib/domain/honest-price-ladder-scale";
import type { LadderScaleMode } from "@/lib/domain/entry-anchored-ladder-scale";
import { LadderScaleModeToggle } from "@/components/lab/perpetual-leverage/ladder-scale-mode-toggle";
import {
  computePriceSimulationSnapshot,
  getPriceLadderSliderBounds,
} from "@/lib/domain/price-ladder";
import { buildLiquidationGhostLines } from "@/lib/domain/liquidation-ghost-lines";
import type { LeverageSpaceCompressionStep } from "@/lib/domain/leverage-space-compression";
import {
  LEVERAGE_ONE_NOTE,
  type PositionSide,
} from "@/lib/domain/perpetual-leverage";

export type VerticalRiskLadderProps = {
  entryPrice: number;
  stopPrice: number;
  takeProfitPrice: number;
  liquidationPrice: number;
  direction: PositionSide;
  leverage: number;
  deposit: number;
  riskPercent: number;
  takeProfitR: number;
  liquidationDistancePercent: number;
  airAfterStop?: number;
  liquidationInactive?: boolean;
  leverageDragging?: boolean;
  minimal?: boolean;
  className?: string;
  onLeverageSelect?: (leverage: LeverageSpaceCompressionStep) => void;
};

export function VerticalRiskLadder({
  entryPrice,
  stopPrice,
  takeProfitPrice,
  liquidationPrice,
  direction,
  leverage,
  deposit,
  liquidationInactive = false,
  leverageDragging = false,
  minimal = false,
  className,
  onLeverageSelect,
}: VerticalRiskLadderProps) {
  const reduceMotion = useReducedMotion();
  const leverageLive = useLeverageInteractionActive(leverage, leverageDragging);
  const [scaleMode, setScaleMode] = React.useState<LadderScaleMode>("risk_focus");

  const scale = React.useMemo(
    () =>
      buildHonestPriceScale({
        entryPrice,
        takeProfitPrice,
        stopPrice,
        liquidationPrice,
        liquidationInactive,
        direction,
        mode: scaleMode,
      }),
    [
      entryPrice,
      takeProfitPrice,
      stopPrice,
      liquidationPrice,
      liquidationInactive,
      direction,
      scaleMode,
    ],
  );

  const levelPrices = React.useMemo(() => {
    const defs: { id: EducationalLevelId; price: number }[] = [
      { id: "take", price: takeProfitPrice },
      { id: "entry", price: entryPrice },
      { id: "stop", price: stopPrice },
    ];
    if (!liquidationInactive) defs.push({ id: "liquidation", price: liquidationPrice });
    return defs;
  }, [takeProfitPrice, entryPrice, stopPrice, liquidationPrice, liquidationInactive]);

  const ticks = React.useMemo(() => buildHonestAxisTicks(scale, 6, levelPrices), [scale, levelPrices]);

  const levels = React.useMemo(
    () =>
      buildHonestLevelLines({
        entryPrice,
        takeProfitPrice,
        stopPrice,
        liquidationPrice,
        liquidationInactive,
        scale,
      }),
    [entryPrice, takeProfitPrice, stopPrice, liquidationPrice, liquidationInactive, scale],
  );

  const labelPlacements = React.useMemo(
    () =>
      resolveLevelLabelPlacements(
        levels.map((l) => ({ id: l.id, yPct: l.yPct })),
        { leverage },
      ),
    [levels, leverage],
  );

  const liquidationGhostLines = React.useMemo(
    () =>
      buildLiquidationGhostLines({
        entryPrice,
        direction,
        activeLeverage: leverage,
        scale,
        liquidationInactive,
      }),
    [entryPrice, direction, leverage, scale, liquidationInactive],
  );

  const zones = React.useMemo(
    () =>
      buildHonestZoneBands({
        direction,
        entryPrice,
        stopPrice,
        liquidationPrice,
        liquidationInactive,
        scale,
      }),
    [direction, entryPrice, stopPrice, liquidationPrice, liquidationInactive, scale],
  );

  const sliderBounds = React.useMemo(
    () =>
      getPriceLadderSliderBounds({
        direction,
        takeProfitPrice,
        liquidationPrice,
        liquidationInactive,
        entryPrice,
      }),
    [direction, takeProfitPrice, liquidationPrice, liquidationInactive, entryPrice],
  );

  const simResetKey = `${entryPrice}|${direction}|${stopPrice}|${takeProfitPrice}|${liquidationPrice}|${liquidationInactive}`;

  return (
    <section
      className={cn(
        "price-ladder-chart vertical-risk-ladder relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl",
        leverageLive && "liquidation-map--live",
        className,
      )}
      aria-label="Карта ликвидации"
    >
      <div className={cn("relative z-[1] flex min-h-0 flex-1 flex-col", minimal ? "p-2" : "p-2.5")}>
        <div className="flex flex-wrap items-start justify-between gap-2 px-0.5">
          <DirectionChartHeader direction={direction} className="min-w-0 flex-1" />
          <LadderScaleModeToggle mode={scaleMode} onChange={setScaleMode} className="shrink-0" />
        </div>

        <LadderSimulationLayer
          key={simResetKey}
          entryPrice={entryPrice}
          direction={direction}
          stopPrice={stopPrice}
          takeProfitPrice={takeProfitPrice}
          liquidationPrice={liquidationPrice}
          liquidationInactive={liquidationInactive}
          leverage={leverage}
          deposit={deposit}
          scale={scale}
          reduceMotion={!!reduceMotion}
          leverageLive={leverageLive}
          ticks={ticks}
          zones={zones}
          levels={levels}
          labelPlacements={labelPlacements}
          liquidationGhostLines={liquidationGhostLines}
          sliderBounds={sliderBounds}
          scaleMode={scaleMode}
          entryAnchorYPct={ENTRY_ANCHOR_Y_PCT}
        />

        {liquidationInactive ? (
          <p className="mt-1 text-center text-[11px] text-slate-500">{LEVERAGE_ONE_NOTE}</p>
        ) : null}

        <LeverageSpaceCompression
          activeLeverage={leverage}
          leverageLive={leverageLive}
          onLeverageSelect={onLeverageSelect}
          className="mx-0.5"
        />

        <LiquidationMapTakeaway className="mt-2 px-0.5" />
      </div>
    </section>
  );
}

type LadderSimulationLayerProps = {
  entryPrice: number;
  direction: PositionSide;
  stopPrice: number;
  takeProfitPrice: number;
  liquidationPrice: number;
  liquidationInactive: boolean;
  leverage: number;
  deposit: number;
  scale: ReturnType<typeof buildHonestPriceScale>;
  reduceMotion: boolean;
  leverageLive: boolean;
  ticks: ReturnType<typeof buildHonestAxisTicks>;
  zones: ReturnType<typeof buildHonestZoneBands>;
  levels: ReturnType<typeof buildHonestLevelLines>;
  labelPlacements: ReturnType<typeof resolveLevelLabelPlacements>;
  liquidationGhostLines: ReturnType<typeof buildLiquidationGhostLines>;
  sliderBounds: ReturnType<typeof getPriceLadderSliderBounds>;
  scaleMode: LadderScaleMode;
  entryAnchorYPct: number;
};

function LadderSimulationLayer({
  entryPrice,
  direction,
  stopPrice,
  takeProfitPrice,
  liquidationPrice,
  liquidationInactive,
  leverage,
  deposit,
  scale,
  reduceMotion,
  leverageLive,
  ticks,
  zones,
  levels,
  labelPlacements,
  liquidationGhostLines,
  sliderBounds,
  scaleMode,
  entryAnchorYPct,
}: LadderSimulationLayerProps) {
  const [simulationOpen, setSimulationOpen] = React.useState(false);
  const [currentPrice, setCurrentPrice] = React.useState(entryPrice);

  const toggleSimulation = React.useCallback(() => {
    setSimulationOpen((open) => {
      if (!open) setCurrentPrice(entryPrice);
      return !open;
    });
  }, [entryPrice]);

  const simulation = React.useMemo(() => {
    if (!simulationOpen) return null;
    return computePriceSimulationSnapshot({
      direction,
      entryPrice,
      currentPrice,
      stopPrice,
      takeProfitPrice,
      liquidationPrice,
      liquidationInactive,
      leverage,
      deposit,
      scale,
    });
  }, [
    simulationOpen,
    direction,
    entryPrice,
    currentPrice,
    stopPrice,
    takeProfitPrice,
    liquidationPrice,
    liquidationInactive,
    leverage,
    deposit,
    scale,
  ]);

  const currentPercentFromEntry =
    entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;

  return (
    <>
      <PriceLadderCoordPlot
        direction={direction}
        ticks={ticks}
        zones={zones}
        levels={levels}
        labelPlacements={labelPlacements}
        currentYPct={simulation?.currentYPct ?? scale.entryYPct}
        currentPercentFromEntry={currentPercentFromEntry}
        currentPrice={currentPrice}
        currentStatusKey={simulation?.status ?? "normal_risk"}
        reduceMotion={reduceMotion}
        leverage={leverage}
        leverageLive={leverageLive}
        plotTopPct={HONEST_PLOT_TOP_PCT}
        plotBottomPct={HONEST_PLOT_BOTTOM_PCT}
        scaleMode={scaleMode}
        entryAnchorYPct={entryAnchorYPct}
        liquidationGhostLines={liquidationGhostLines}
        showCurrentPrice={simulationOpen}
      />

      <div className="mt-2 flex flex-col items-stretch gap-2 px-0.5">
        <PriceMovementSimulationToggle open={simulationOpen} onToggle={toggleSimulation} />

        {simulationOpen && simulation ? (
          <section
            className="price-movement-simulation rounded-lg border border-white/[0.08] bg-black/35 p-2.5 sm:p-3"
            aria-label="Симуляция движения цены после входа"
          >
            <h3 className="mb-2.5 text-xs font-semibold text-slate-200 sm:text-sm">
              Симуляция движения цены после входа
            </h3>
            <PriceSimulationPanel
              currentPrice={currentPrice}
              sliderMin={sliderBounds.min}
              sliderMax={sliderBounds.max}
              sliderStep={entryPrice * 0.0005}
              onPriceChange={setCurrentPrice}
              pnlPercent={simulation.pnlPercent}
              pnlUsd={simulation.pnlUsd}
              status={simulation.status}
            />
          </section>
        ) : null}
      </div>
    </>
  );
}
