"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils/cn";
import { DirectionMiniSchema } from "@/components/lab/perpetual-leverage/direction-mini-schema";
import {
  LADDER_CHART_HEADLINE_LONG,
  LADDER_CHART_HEADLINE_SHORT,
} from "@/lib/domain/liquidation-map-labels";
import type { PositionSide } from "@/lib/domain/perpetual-leverage";

type Props = {
  direction: PositionSide;
  className?: string;
};

function ChartHeadline({ direction }: { direction: PositionSide }) {
  const isLong = direction === "long";

  if (isLong) {
    return (
      <p className="min-w-0 flex-1 text-balance text-xs font-medium leading-snug text-slate-300 sm:text-sm">
        <span className="font-semibold text-emerald-200/95">Long:</span>{" "}
        <span className="text-slate-400">вниз</span>
        <span className="text-slate-600"> → </span>
        <span className="text-amber-300/90">стоп</span>
        <span className="text-slate-600"> → </span>
        <span className="text-rose-300/90">ликвидация</span>
        <span className="text-slate-600"> · </span>
        <span className="text-slate-400">вверх</span>
        <span className="text-slate-600"> → </span>
        <span className="text-emerald-300/85">цель</span>
      </p>
    );
  }

  return (
    <p className="min-w-0 flex-1 text-balance text-xs font-medium leading-snug text-slate-300 sm:text-sm">
      <span className="font-semibold text-violet-200/95">Short:</span>{" "}
      <span className="text-slate-400">вверх</span>
      <span className="text-slate-600"> → </span>
      <span className="text-amber-300/90">стоп</span>
      <span className="text-slate-600"> → </span>
      <span className="text-rose-300/90">ликвидация</span>
      <span className="text-slate-600"> · </span>
      <span className="text-slate-400">вниз</span>
      <span className="text-slate-600"> → </span>
      <span className="text-emerald-300/85">цель</span>
    </p>
  );
}

export function DirectionChartHeader({ direction, className }: Props) {
  const reduceMotion = useReducedMotion();
  const isLong = direction === "long";

  return (
    <header
      className={cn(
        "direction-chart-header flex items-start gap-2 sm:gap-2.5",
        isLong ? "direction-chart-header--long" : "direction-chart-header--short",
        className,
      )}
      aria-label={isLong ? LADDER_CHART_HEADLINE_LONG : LADDER_CHART_HEADLINE_SHORT}
    >
      <motion.div
        key={direction}
        className="flex min-w-0 flex-1 items-start gap-2 sm:gap-2.5"
        initial={reduceMotion ? false : { opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
      >
        <DirectionMiniSchema direction={direction} compact className="shrink-0" />
        <ChartHeadline direction={direction} />
      </motion.div>
    </header>
  );
}
