"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils/cn";
import { LEVERAGE_VALUE_TRANSITION } from "@/lib/domain/leverage-micro-interaction";

type Props = {
  value: string;
  className?: string;
  as?: "span" | "p";
};

export function AnimatedLabValue({ value, className, as = "span" }: Props) {
  const reduceMotion = useReducedMotion();
  const Tag = motion[as];

  return (
    <Tag
      key={value}
      className={cn("inline-block", className)}
      initial={reduceMotion ? false : { opacity: 0.55, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : LEVERAGE_VALUE_TRANSITION}
    >
      {value}
    </Tag>
  );
}
