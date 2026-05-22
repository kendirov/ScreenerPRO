"use client";

import { VIEW_MODE_LABELS, VIEW_MODE_ORDER, type SimulatorViewMode } from "@/lib/domain/orderflow-teaching";
import { cn } from "@/lib/utils/cn";

type SimulatorViewModeTabsProps = {
  value: SimulatorViewMode;
  onChange: (mode: SimulatorViewMode) => void;
  compact?: boolean;
  className?: string;
};

export function SimulatorViewModeTabs({ value, onChange, compact = false, className }: SimulatorViewModeTabsProps) {
  return (
    <div className={cn("flex items-center gap-2", className)} role="group" aria-label="Вид">
      <span className={cn("uppercase tracking-[0.14em] text-slate-600", compact ? "text-[9px]" : "text-[10px]")}>
        Вид
      </span>
      <div className="inline-flex rounded border border-white/[0.06] bg-[#030508] p-px">
        {VIEW_MODE_ORDER.map((mode) => (
          <button
            key={mode}
            type="button"
            className={cn(
              "rounded px-2 py-0.5 font-mono transition",
              compact ? "text-[10px]" : "text-[11px] px-2.5 py-1",
              value === mode
                ? "bg-violet-950/70 text-violet-100"
                : "text-slate-500 hover:text-slate-300",
            )}
            onClick={() => onChange(mode)}
          >
            {VIEW_MODE_LABELS[mode]}
          </button>
        ))}
      </div>
    </div>
  );
}
