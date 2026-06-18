"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils/cn";
import { LEVERAGE_50X_WARNING } from "@/lib/domain/leverage-micro-interaction";

type Props = {
  className?: string;
};

export function LeverageExtremeWarning({ className }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.p
      className={cn(
        "rounded-lg border border-rose-500/22 bg-rose-950/22 px-2.5 py-2 text-xs font-medium leading-snug text-rose-100/92 sm:text-sm",
        className,
      )}
      role="alert"
      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -2 }}
      transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
    >
      {LEVERAGE_50X_WARNING}
    </motion.p>
  );
}
