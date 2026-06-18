"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { LADDER_LINE_TOOLTIPS } from "@/lib/domain/liquidation-map-labels";
import {
  formatSignedPercent,
  type HonestAxisTick,
  type HonestAxisTickRole,
  type HonestLevelLine,
  type HonestZoneBand,
  type LevelLabelPlacement,
} from "@/lib/domain/honest-price-ladder-scale";
import type { LadderScaleMode } from "@/lib/domain/entry-anchored-ladder-scale";
import type { LiquidationGhostLine } from "@/lib/domain/liquidation-ghost-lines";
import { LiquidationGhostLinesLayer } from "@/components/lab/perpetual-leverage/liquidation-ghost-lines-layer";
import type { PriceLadderLevelId } from "@/lib/domain/price-ladder";
import {
  getLevelMotionTransition,
  getLiquidationLineVisualTier,
} from "@/lib/domain/leverage-micro-interaction";
import { formatPrice, type PositionSide } from "@/lib/domain/perpetual-leverage";

const AXIS_TICK_ROLE_CLASS: Record<HonestAxisTickRole, string> = {
  default: "price-ladder-axis-tick--default",
  entry: "price-ladder-axis-tick--entry",
  take: "price-ladder-axis-tick--take",
  stop: "price-ladder-axis-tick--stop",
  liquidation: "price-ladder-axis-tick--liquidation",
};

const LINE_CLASS: Record<PriceLadderLevelId, string> = {
  take: "price-ladder-line price-ladder-line--take",
  entry: "price-ladder-line price-ladder-line--entry",
  stop: "price-ladder-line price-ladder-line--stop",
  liquidation: "price-ladder-line price-ladder-line--liquidation",
};

const ZONE_CLASS: Record<HonestZoneBand["id"], string> = {
  profit: "price-ladder-zone-honest price-ladder-zone-honest--profit",
  controlled: "price-ladder-zone-honest price-ladder-zone-honest--controlled",
  danger_buffer: "price-ladder-zone-honest price-ladder-zone-honest--danger",
  liquidation: "price-ladder-zone-honest price-ladder-zone-honest--liquidation",
};

const LIQUIDATION_LINE_CLASS: Record<ReturnType<typeof getLiquidationLineVisualTier>, string | undefined> = {
  default: undefined,
  glow: "price-ladder-line--liquidation-glow",
  "glow-pulse": "price-ladder-line--liquidation-glow price-ladder-line--liquidation-pulse",
};

export function CoordGrid({ ticks }: { ticks: HonestAxisTick[] }) {
  return (
    <>
      {ticks.slice(0, -1).map((tick, i) => {
        const next = ticks[i + 1];
        const midY = (tick.yPct + next.yPct) / 2;
        return (
          <div
            key={`minor-${tick.price}`}
            className="price-ladder-grid-line price-ladder-grid-line--minor"
            style={{ top: `${midY}%` }}
            aria-hidden
          />
        );
      })}
      {ticks.map((tick) => (
        <div
          key={`major-${tick.price}`}
          className="price-ladder-grid-line price-ladder-grid-line--major"
          style={{ top: `${tick.yPct}%` }}
          aria-hidden
        />
      ))}
      <div className="price-ladder-grid-vert" aria-hidden />
    </>
  );
}

export function ZoneLayer({
  bands,
  live,
  reduceMotion,
}: {
  bands: HonestZoneBand[];
  live: boolean;
  reduceMotion: boolean;
}) {
  const transition = getLevelMotionTransition(live, reduceMotion);
  return (
    <>
      {bands.map((band) => {
        const top = Math.min(band.topYPct, band.bottomYPct);
        const height = Math.abs(band.bottomYPct - band.topYPct);
        return (
          <motion.div
            key={band.id}
            className={cn(ZONE_CLASS[band.id])}
            initial={false}
            animate={{ top: `${top}%`, height: `${height}%` }}
            transition={transition}
            aria-hidden
          >
            <span className="price-ladder-zone-honest__label">{band.label}</span>
          </motion.div>
        );
      })}
    </>
  );
}

function PriceAxisColumn({
  ticks,
  live,
  reduceMotion,
}: {
  ticks: HonestAxisTick[];
  live: boolean;
  reduceMotion: boolean;
}) {
  const transition = getLevelMotionTransition(live, reduceMotion);
  return (
    <div className="price-ladder-axis-y price-ladder-axis-y--price relative w-[3.25rem] shrink-0 sm:w-[3.75rem]">
      {ticks.map((tick) => (
        <motion.span
          key={`price-${tick.price}`}
          className={cn(
            "price-ladder-axis-tick lab-number",
            AXIS_TICK_ROLE_CLASS[tick.role],
          )}
          initial={false}
          animate={{ top: `${tick.yPct}%` }}
          transition={transition}
          style={{ translate: "0 -50%" }}
        >
          {formatPrice(tick.price)}
        </motion.span>
      ))}
    </div>
  );
}

function PercentAxisColumn({
  ticks,
  live,
  reduceMotion,
}: {
  ticks: HonestAxisTick[];
  live: boolean;
  reduceMotion: boolean;
}) {
  const transition = getLevelMotionTransition(live, reduceMotion);
  return (
    <div className="price-ladder-axis-y price-ladder-axis-y--percent relative w-[2.85rem] shrink-0 sm:w-[3.35rem]">
      {ticks.map((tick) => (
        <motion.span
          key={`pct-${tick.price}`}
          className={cn(
            "price-ladder-axis-tick lab-number",
            AXIS_TICK_ROLE_CLASS[tick.role],
          )}
          initial={false}
          animate={{ top: `${tick.yPct}%` }}
          transition={transition}
          style={{ translate: "0 -50%" }}
        >
          {tick.percentLabel}
        </motion.span>
      ))}
    </div>
  );
}

function CurrentPriceCrosshair({
  yPct,
  percentFromEntry,
  live,
  reduceMotion,
}: {
  yPct: number;
  percentFromEntry: number;
  live: boolean;
  reduceMotion: boolean;
}) {
  return (
    <motion.div
      className="price-ladder-crosshair pointer-events-none absolute inset-0 z-[15]"
      initial={false}
      animate={{ top: `${yPct}%` }}
      transition={getLevelMotionTransition(live, reduceMotion)}
      style={{ translate: "0 -50%" }}
      aria-hidden
    >
      <div className="price-ladder-crosshair__h" />
      <div className="price-ladder-crosshair__v" />
      <span className="price-ladder-crosshair__pct lab-number">{formatSignedPercent(percentFromEntry)}</span>
    </motion.div>
  );
}

function EntryAnchorBaseline({ yPct }: { yPct: number }) {
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-[7]"
      style={{ top: `${yPct}%`, translate: "0 -50%" }}
      aria-hidden
    >
      <div className="price-ladder-entry-anchor absolute left-[5.5rem] right-[5.5rem] sm:left-[6.25rem] sm:right-[6.25rem]" />
    </div>
  );
}

function ClippedLevelBadge({
  level,
  live,
  reduceMotion,
}: {
  level: HonestLevelLine;
  live: boolean;
  reduceMotion: boolean;
}) {
  if (!level.clipLabel || level.inView) return null;
  const transition = getLevelMotionTransition(live, reduceMotion);

  return (
    <motion.div
      className="absolute left-[5.5rem] right-[5.5rem] z-[11] flex sm:left-[6.25rem] sm:right-[6.25rem]"
      initial={false}
      animate={{ top: `${level.yPct}%` }}
      transition={transition}
      style={{ translate: "0 -50%" }}
    >
      <span
        className={cn(
          "price-ladder-clip-badge lab-number max-w-full truncate",
          level.clipEdge === "top" ? "ml-auto" : "mr-auto",
        )}
      >
        {level.clipEdge === "bottom" ? "↓ " : "↑ "}
        {level.clipLabel}
      </span>
    </motion.div>
  );
}

function HonestLevelRow({
  level,
  placement,
  live,
  reduceMotion,
  leverage,
}: {
  level: HonestLevelLine;
  placement: LevelLabelPlacement;
  live: boolean;
  reduceMotion: boolean;
  leverage: number;
}) {
  const isEntry = level.id === "entry";
  const isLiquidation = level.id === "liquidation";
  const liqInline = isLiquidation && level.inView && level.inlineLabel;
  const liqVisual = getLiquidationLineVisualTier(leverage);
  const transition = getLevelMotionTransition(live, reduceMotion);
  const labelOnLeft = placement.side === "left";
  const tooltip = LADDER_LINE_TOOLTIPS[level.id];

  if (!level.inView && level.clipLabel) {
    return <ClippedLevelBadge level={level} live={live} reduceMotion={reduceMotion} />;
  }

  return (
    <motion.div
      className="absolute left-0 right-0 z-[8]"
      initial={false}
      animate={{ top: `${level.yPct}%` }}
      transition={transition}
      style={{ translate: "0 -50%" }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "price-ladder-line-hit absolute z-[9] h-5 border-0 bg-transparent p-0",
              labelOnLeft ? "left-[5.5rem] right-0 sm:left-[6.25rem]" : "left-0 right-[5.5rem] sm:right-[6.25rem]",
              "cursor-help focus-visible:outline focus-visible:outline-1 focus-visible:outline-cyan-500/50",
            )}
            style={{ top: "50%", transform: "translateY(-50%)" }}
            aria-label={`${level.title}: ${formatPrice(level.price)}`}
          />
        </TooltipTrigger>
        <TooltipContent side={labelOnLeft ? "right" : "left"} className="max-w-[14rem] text-xs leading-snug">
          <p className="font-semibold text-slate-100">{level.title}</p>
          <p className="mt-0.5 text-slate-400">{tooltip}</p>
        </TooltipContent>
      </Tooltip>

      <div
        className={cn(
          "pointer-events-none absolute flex items-center",
          labelOnLeft ? "left-[5.5rem] right-0 sm:left-[6.25rem]" : "left-0 right-[5.5rem] sm:right-[6.25rem]",
          liqInline && "right-[0.35rem] sm:right-[0.5rem]",
        )}
        style={{ top: "50%", transform: "translateY(-50%)" }}
        aria-hidden
      >
        {!isEntry ? (
          <span className={cn("price-ladder-level-notch shrink-0", `price-ladder-level-notch--${level.id}`)} />
        ) : null}
        <div
          className={cn(
            "relative min-w-0 flex-1",
            !isEntry && LINE_CLASS[level.id],
            isEntry && "price-ladder-line price-ladder-line--entry-base",
            isLiquidation && LIQUIDATION_LINE_CLASS[liqVisual],
          )}
        >
          {liqInline ? (
            <span className="price-ladder-liq-inline lab-number absolute right-0 top-1/2 max-w-[11rem] -translate-y-1/2 translate-x-[calc(100%+0.35rem)] truncate text-right text-[9px] font-medium leading-tight text-rose-200/95 sm:text-[10px]">
              {level.inlineLabel}
            </span>
          ) : null}
        </div>
      </div>

      {!liqInline ? (
      <div
        className={cn(
          "absolute top-1/2 max-w-[5.5rem] -translate-y-1/2 sm:max-w-[6.25rem]",
          labelOnLeft ? "left-0 text-left" : "right-0 text-right",
          isEntry && "right-0",
        )}
        style={{ marginTop: placement.nudgePx }}
      >
        {placement.ultraCompact ? (
          <p className="text-[9px] leading-tight sm:text-[10px]">
            <span
              className={cn(
                "font-semibold uppercase tracking-[0.06em]",
                level.id === "take" && "text-emerald-300",
                level.id === "entry" && "text-cyan-200",
                level.id === "stop" && "text-amber-200",
                level.id === "liquidation" && "text-rose-200",
              )}
            >
              {level.title}
            </span>
            <span className="lab-number font-bold tabular-nums text-slate-100">
              {" "}
              {formatPrice(level.price)}
            </span>
            <span className="lab-number block text-[9px] text-slate-500">{level.percentLabel}</span>
          </p>
        ) : (
          <>
            <p
              className={cn(
                "font-semibold uppercase tracking-[0.08em]",
                isEntry ? "text-xs text-cyan-200 sm:text-sm" : "text-[10px] sm:text-[11px]",
                level.id === "take" && "text-emerald-300",
                level.id === "stop" && "text-amber-200",
                level.id === "liquidation" && "text-rose-200",
                placement.compact && "text-[9px] sm:text-[10px]",
              )}
            >
              {level.title}
              {!placement.compact ? (
                <span className="font-normal normal-case tracking-normal text-slate-500">
                  {" "}
                  / {level.tagline}
                </span>
              ) : null}
            </p>
            <p
              className={cn(
                "lab-number mt-0.5 font-bold tabular-nums text-slate-100",
                isEntry ? "text-base sm:text-lg" : placement.compact ? "text-xs sm:text-sm" : "text-sm sm:text-base",
              )}
            >
              {formatPrice(level.price)}
            </p>
            {!placement.compact ? (
              <p className="lab-number text-[10px] font-semibold tabular-nums text-slate-500">
                {level.percentLabel}
              </p>
            ) : (
              <p className="lab-number text-[9px] font-semibold tabular-nums text-slate-500">
                {level.percentLabel}
              </p>
            )}
            {!placement.compact ? (
              <p className="mt-0.5 text-[10px] leading-snug text-slate-600">{level.hint}</p>
            ) : null}
          </>
        )}
      </div>
      ) : null}
    </motion.div>
  );
}

export function CurrentPriceMarker({
  yPct,
  price,
  reduceMotion,
  statusKey,
}: {
  yPct: number;
  price: number;
  reduceMotion: boolean;
  statusKey: string;
}) {
  return (
    <motion.div
      className="absolute left-0 right-0 z-[20]"
      initial={false}
      animate={{ top: `${yPct}%` }}
      transition={getLevelMotionTransition(false, !!reduceMotion)}
      style={{ translate: "0 -50%" }}
    >
      <div
        className="price-ladder-current-line absolute left-0 right-[5.5rem]"
        style={{ top: "50%", transform: "translateY(-50%)" }}
        aria-hidden
      />
      <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
        <motion.div
          key={statusKey}
          className="price-ladder-current-badge"
          initial={reduceMotion ? false : { scale: 0.96, opacity: 0.85 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.22 }}
        >
          <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400">Сейчас</span>
          <span className="lab-number block text-sm font-bold tabular-nums text-white">
            {formatPrice(price)}
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}

export type PriceLadderCoordPlotProps = {
  ticks: HonestAxisTick[];
  zones: HonestZoneBand[];
  levels: HonestLevelLine[];
  labelPlacements: Record<HonestLevelLine["id"], LevelLabelPlacement>;
  currentYPct: number;
  currentPercentFromEntry: number;
  currentPrice: number;
  currentStatusKey: string;
  reduceMotion: boolean;
  leverage: number;
  leverageLive: boolean;
  direction: PositionSide;
  plotTopPct: number;
  plotBottomPct: number;
  scaleMode: LadderScaleMode;
  entryAnchorYPct: number;
  liquidationGhostLines?: LiquidationGhostLine[];
  showCurrentPrice?: boolean;
};

export function PriceLadderCoordPlot({
  ticks,
  zones,
  levels,
  labelPlacements,
  currentYPct,
  currentPercentFromEntry,
  currentPrice,
  currentStatusKey,
  reduceMotion,
  leverage,
  leverageLive,
  direction,
  plotTopPct,
  plotBottomPct,
  entryAnchorYPct,
  liquidationGhostLines = [],
  showCurrentPrice = false,
}: PriceLadderCoordPlotProps) {
  const isLong = direction === "long";

  return (
    <div
      className={cn(
        "price-ladder-coord-chart relative mt-2 min-h-[min(40vh,320px)] flex-1 sm:min-h-[280px] lg:min-h-[300px] xl:min-h-[340px] 2xl:min-h-[400px]",
        isLong ? "price-ladder-coord-chart--long" : "price-ladder-coord-chart--short",
        leverageLive && "price-ladder-coord-chart--leverage-live",
      )}
      style={
        {
          "--plot-top": `${plotTopPct}%`,
          "--plot-bottom": `${plotBottomPct}%`,
        } as React.CSSProperties
      }
    >
      <div className="price-ladder-coord-chart__minor-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="absolute inset-0 flex h-full min-h-0">
        <PriceAxisColumn ticks={ticks} live={leverageLive} reduceMotion={reduceMotion} />

        <div className="relative min-h-0 min-w-0 flex-1 self-stretch">
          <motion.div
            key={direction}
            className="price-ladder-plot-area"
            initial={reduceMotion ? false : { opacity: 0.92 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            style={
              {
                "--plot-top": `${plotTopPct}%`,
                "--plot-bottom": `${plotBottomPct}%`,
              } as React.CSSProperties
            }
          >
            <CoordGrid ticks={ticks} />
              <ZoneLayer bands={zones} live={leverageLive} reduceMotion={reduceMotion} />
              <EntryAnchorBaseline yPct={entryAnchorYPct} />
              <LiquidationGhostLinesLayer
                lines={liquidationGhostLines}
                live={leverageLive}
                reduceMotion={reduceMotion}
              />
              {showCurrentPrice ? (
                <CurrentPriceCrosshair
                  yPct={currentYPct}
                  percentFromEntry={currentPercentFromEntry}
                  live={leverageLive}
                  reduceMotion={reduceMotion}
                />
              ) : null}

              {levels.map((level) => (
                <HonestLevelRow
                  key={level.id}
                  level={level}
                  placement={labelPlacements[level.id]}
                  live={leverageLive}
                  reduceMotion={reduceMotion}
                  leverage={leverage}
                />
              ))}

            {showCurrentPrice ? (
              <CurrentPriceMarker
                yPct={currentYPct}
                price={currentPrice}
                reduceMotion={reduceMotion}
                statusKey={currentStatusKey}
              />
            ) : null}
          </motion.div>
        </div>

        <PercentAxisColumn ticks={ticks} live={leverageLive} reduceMotion={reduceMotion} />
      </div>
    </div>
  );
}
