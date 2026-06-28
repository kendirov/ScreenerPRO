"use client";

import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { cn } from "@/lib/utils/cn";

export function MarketKpiCard({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "in_play" | "warning" | "money";
  className?: string;
}) {
  const toneClass = {
    neutral: "text-lab-text",
    in_play: "text-cyan-200/95",
    warning: "text-amber-200/90",
    money: "text-emerald-200/90",
  }[tone];

  return (
    <LabGlassPanel depth={10} className={cn("min-w-[7.5rem] flex-1 px-2.5 py-2", className)}>
      <p className="text-[9px] uppercase tracking-[0.12em] text-lab-dim">{label}</p>
      <p className={cn("lab-number mt-0.5 text-base tabular-nums", toneClass)}>{value}</p>
      {hint ? <p className="mt-0.5 text-[9px] text-lab-dim">{hint}</p> : null}
    </LabGlassPanel>
  );
}
