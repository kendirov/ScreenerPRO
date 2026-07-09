"use client";

import {
  MARKET_PRIORITY_PRESETS,
  type MarketPriorityMode,
} from "@/lib/screener/market-priority-presets";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

const MODES: MarketPriorityMode[] = ["strict", "balanced", "wide"];

export function InPlayModeSwitch({
  mode,
  onChange,
  className,
}: {
  mode: MarketPriorityMode;
  onChange: (mode: MarketPriorityMode) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-px rounded border border-lab-border/35 bg-slate-950/60 p-px",
        className,
      )}
      role="group"
      aria-label="Режим отбора В игре"
    >
      {MODES.map((key) => {
        const preset = MARKET_PRIORITY_PRESETS[key];
        const active = mode === key;
        return (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onChange(key)}
                className={cn(
                  "rounded px-1 py-px font-mono text-[8px] uppercase tracking-wide transition",
                  active
                    ? "bg-cyan-950/60 text-cyan-300"
                    : "text-zinc-600 hover:text-zinc-400",
                )}
                aria-pressed={active}
              >
                {preset.label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[200px] text-[10px]">
              {preset.tooltip}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
