"use client";

import { cn } from "@/lib/utils/cn";
import {
  SIMULATOR_LEVERAGE_OPTIONS,
  formatLeverageX,
  type SimulatorLeverageOption,
} from "@/lib/domain/perpetual-leverage";

type ChipTone = "cyan" | "amber" | "violet";

function chipTone(leverage: SimulatorLeverageOption): ChipTone {
  if (leverage <= 2) return "cyan";
  if (leverage <= 10) return "amber";
  return "violet";
}

const TONE_CLASS: Record<ChipTone, { base: string; active: string }> = {
  cyan: {
    base: "border-white/[0.06] text-slate-500 hover:border-slate-500/25 hover:text-slate-300",
    active: "border-slate-400/35 bg-slate-800/60 text-slate-100 ring-1 ring-slate-400/20",
  },
  amber: {
    base: "border-white/[0.06] text-slate-500 hover:border-amber-500/20 hover:text-amber-200/80",
    active: "border-amber-500/35 bg-amber-950/35 text-amber-100 ring-1 ring-amber-500/20",
  },
  violet: {
    base: "border-white/[0.06] text-slate-500 hover:border-violet-500/22 hover:text-violet-200/80",
    active: "border-violet-500/32 bg-violet-950/35 text-violet-100 ring-1 ring-violet-500/18",
  },
};

type Props = {
  activeLeverage: number;
  onSelect: (leverage: SimulatorLeverageOption) => void;
  className?: string;
  layout?: "column" | "row";
};

export function LeverageInsightChips({
  activeLeverage,
  onSelect,
  className,
  layout = "column",
}: Props) {
  const isRow = layout === "row";

  return (
    <div
      className={cn(
        isRow ? "min-w-0" : "perp-lab-panel rounded-xl border border-white/[0.06] bg-black p-3 sm:p-4",
        className,
      )}
      aria-label="Пресеты плеча"
    >
      <div
        className={cn(
          isRow ? "flex flex-wrap gap-1.5" : "mt-0 grid grid-cols-3 gap-1.5 sm:grid-cols-2 lg:grid-cols-1",
        )}
      >
        {SIMULATOR_LEVERAGE_OPTIONS.map((lev) => {
          const active = activeLeverage === lev;
          const tone = TONE_CLASS[chipTone(lev)];
          return (
            <button
              key={lev}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(lev)}
              className={cn(
                "lab-number rounded-lg border font-semibold transition",
                isRow ? "min-w-[2.75rem] flex-1 px-2 py-2 text-sm sm:flex-none" : "px-2 py-2.5 text-sm",
                active ? tone.active : tone.base,
              )}
            >
              {formatLeverageX(lev)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
