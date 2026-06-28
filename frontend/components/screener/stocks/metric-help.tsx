"use client";

import { cn } from "@/lib/utils/cn";

export function MetricHelp({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={cn(
        "ml-0.5 inline-flex h-3 w-3 cursor-help items-center justify-center rounded-full border border-white/15 text-[8px] leading-none text-lab-text-dim",
        className,
      )}
      title={text}
      aria-label={text}
    >
      ?
    </span>
  );
}
