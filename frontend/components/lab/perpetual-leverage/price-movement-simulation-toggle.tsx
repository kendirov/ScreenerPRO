"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Props = {
  open: boolean;
  onToggle: () => void;
  className?: string;
};

export function PriceMovementSimulationToggle({ open, onToggle, className }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "price-movement-sim-toggle inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-black/50 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-cyan-500/25 hover:text-cyan-100 sm:text-xs",
        open && "border-cyan-500/20 text-cyan-100",
        className,
      )}
    >
      <ChevronDown
        className={cn("size-3.5 shrink-0 text-slate-500 transition", open && "rotate-180 text-cyan-400/80")}
        aria-hidden
      />
      {open ? "Скрыть симуляцию движения цены" : "Показать симуляцию движения цены"}
    </button>
  );
}
