"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils/cn";
import {
  buildLeverageSpaceCompressionItems,
  LEVERAGE_SPACE_COMPRESSION_STEPS,
  snapLeverageSpaceCompressionStep,
  type CompressionVisualTier,
  type LeverageSpaceCompressionItem,
  type LeverageSpaceCompressionStep,
} from "@/lib/domain/leverage-space-compression";
import { formatLeverageX } from "@/lib/domain/perpetual-leverage";

const ITEMS = buildLeverageSpaceCompressionItems();

const TIER_CARD_CLASS: Record<CompressionVisualTier, string> = {
  calm: "leverage-space-compression__card--tier-calm",
  neutral: "leverage-space-compression__card--tier-neutral",
  danger: "leverage-space-compression__card--tier-danger",
  extreme: "leverage-space-compression__card--tier-extreme",
};

type Props = {
  activeLeverage: number;
  className?: string;
  leverageLive?: boolean;
  onLeverageSelect?: (leverage: LeverageSpaceCompressionStep) => void;
};

function CompressionGapViz({
  item,
  active,
  tier,
}: {
  item: LeverageSpaceCompressionItem;
  active: boolean;
  tier: CompressionVisualTier;
}) {
  const gapPct = item.movePercent == null ? 92 : item.gapVisual * 100;

  return (
    <div className="leverage-space-compression__viz mt-2" aria-hidden>
      <div className="flex items-center gap-0.5">
        <span className="text-[7px] font-medium uppercase tracking-wide text-cyan-500/70">Вход</span>
        <div className="relative mx-0.5 h-3.5 min-w-0 flex-1">
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/[0.08]" />
          <span
            className={cn(
              "leverage-space-compression__dot leverage-space-compression__dot--entry absolute left-0 top-1/2 -translate-y-1/2",
              active && "leverage-space-compression__dot--active",
            )}
          />
          <motion.div
            className={cn(
              "leverage-space-compression__gap absolute left-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full",
              item.movePercent == null && "leverage-space-compression__gap--inactive",
              active && "leverage-space-compression__gap--active",
              active && `leverage-space-compression__gap--tier-${tier}`,
            )}
            initial={false}
            animate={{ width: `${gapPct}%` }}
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          />
          <span
            className={cn(
              "leverage-space-compression__dot leverage-space-compression__dot--liq absolute top-1/2 -translate-y-1/2",
              active && "leverage-space-compression__dot--active",
            )}
            style={{ left: `${gapPct}%`, marginLeft: -2 }}
          />
        </div>
        <span className="text-[7px] font-medium uppercase tracking-wide text-rose-400/70">Ликв.</span>
      </div>
    </div>
  );
}

function CompressionCard({
  item,
  active,
  leverageLive,
  onSelect,
}: {
  item: LeverageSpaceCompressionItem;
  active: boolean;
  leverageLive: boolean;
  onSelect?: (leverage: LeverageSpaceCompressionStep) => void;
}) {
  const reduceMotion = useReducedMotion();
  const tier = item.visualTier;

  const body = (
    <>
      <p
        className={cn(
          "lab-number text-center text-sm font-bold tabular-nums",
          active ? "text-slate-50" : "text-slate-300",
        )}
      >
        {formatLeverageX(item.leverage)}
      </p>
      <p
        className={cn(
          "mt-1 min-h-[2.25rem] text-center text-[8px] leading-tight sm:min-h-[2.5rem] sm:text-[9px]",
          active ? "text-slate-300" : "text-slate-500",
        )}
      >
        {item.moveLabel}
      </p>
      <CompressionGapViz item={item} active={active} tier={tier} />
    </>
  );

  const className = cn(
    "leverage-space-compression__card flex min-w-0 flex-col rounded-lg border px-1.5 py-2 transition-[border-color,box-shadow,background-color] duration-300 sm:px-2",
    TIER_CARD_CLASS[tier],
    active && "leverage-space-compression__card--active",
    active && `leverage-space-compression__card--active-${tier}`,
    leverageLive && active && "leverage-space-compression__card--live",
  );

  if (onSelect) {
    return (
      <motion.button
        type="button"
        layout={!reduceMotion}
        className={className}
        aria-current={active ? "true" : undefined}
        aria-pressed={active}
        onClick={() => onSelect(item.leverage)}
      >
        {body}
      </motion.button>
    );
  }

  return (
    <motion.div layout={!reduceMotion} className={className} aria-current={active ? "true" : undefined}>
      {body}
    </motion.div>
  );
}

export function LeverageSpaceCompression({
  activeLeverage,
  className,
  leverageLive = false,
  onLeverageSelect,
}: Props) {
  const highlighted = React.useMemo(
    () => snapLeverageSpaceCompressionStep(activeLeverage),
    [activeLeverage],
  );
  const exactPreset = LEVERAGE_SPACE_COMPRESSION_STEPS.includes(
    Math.round(activeLeverage) as LeverageSpaceCompressionStep,
  );

  return (
    <section
      className={cn(
        "leverage-space-compression mt-2 rounded-lg border border-white/[0.06] bg-black/30 px-2 py-2 sm:px-2.5 sm:py-2.5",
        leverageLive && "leverage-space-compression--live",
        className,
      )}
      aria-label="Как плечо сжимает пространство"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
          Как плечо сжимает пространство
        </h4>
        <p className="lab-number text-[9px] tabular-nums text-slate-600">
          на графике:{" "}
          <span className="font-semibold text-cyan-500/80">{formatLeverageX(highlighted)}</span>
          {!exactPreset ? (
            <span className="text-slate-600"> · ползунок {formatLeverageX(activeLeverage)}</span>
          ) : null}
        </p>
      </div>
      <p className="mt-0.5 text-[10px] leading-snug text-slate-600">
        Те же уровни, что пунктир на графике: чем выше плечо — тем короче отрезок до ликвидации.
      </p>

      <div className="mt-2 grid grid-cols-3 gap-1 min-[480px]:grid-cols-6 sm:gap-1.5">
        {ITEMS.map((item) => (
          <CompressionCard
            key={item.leverage}
            item={item}
            active={highlighted === item.leverage}
            leverageLive={leverageLive}
            onSelect={onLeverageSelect}
          />
        ))}
      </div>
    </section>
  );
}
