"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils/cn";
import type { LiquidationGhostLine } from "@/lib/domain/liquidation-ghost-lines";
import { getLevelMotionTransition } from "@/lib/domain/leverage-micro-interaction";
import { formatLeverageX } from "@/lib/domain/perpetual-leverage";

type Props = {
  lines: LiquidationGhostLine[];
  live: boolean;
  reduceMotion: boolean;
};

export function LiquidationGhostLinesLayer({ lines, live, reduceMotion }: Props) {
  if (lines.length === 0) return null;

  const transition = getLevelMotionTransition(live, reduceMotion);

  return (
    <>
      {lines.map((line) => (
        <motion.div
          key={line.leverage}
          className="pointer-events-none absolute left-0 right-0 z-[6]"
          initial={false}
          animate={{ top: `${line.yPct}%` }}
          transition={transition}
          style={{ translate: "0 -50%" }}
          aria-hidden
        >
          <div
            className={cn(
              "absolute left-[5.5rem] right-[5.5rem] sm:left-[6.25rem] sm:right-[6.25rem]",
              "flex items-center",
            )}
            style={{ top: "50%", transform: "translateY(-50%)" }}
          >
            <div
              className={cn(
                "price-ladder-liq-ghost-line min-w-0 flex-1",
                line.isActive && "price-ladder-liq-ghost-line--active",
              )}
            />
            {!line.isActive ? (
              <span
                className="price-ladder-liq-ghost-label lab-number ml-1 shrink-0 tabular-nums"
                style={{ marginTop: line.labelNudgePx }}
              >
                {formatLeverageX(line.leverage)}
              </span>
            ) : null}
          </div>
        </motion.div>
      ))}
    </>
  );
}
