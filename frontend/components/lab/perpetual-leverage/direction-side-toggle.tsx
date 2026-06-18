"use client";

import { cn } from "@/lib/utils/cn";
import type { PositionSide } from "@/lib/domain/perpetual-leverage";

const SIDES: PositionSide[] = ["long", "short"];

type Props = {
  value: PositionSide;
  onChange: (direction: PositionSide) => void;
  className?: string;
};

export function DirectionSideToggle({ value, onChange, className }: Props) {
  return (
    <div className={cn("grid grid-cols-2 gap-1.5", className)}>
      {SIDES.map((direction) => {
        const active = value === direction;
        const isLong = direction === "long";
        return (
          <button
            key={direction}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(direction)}
            className={cn(
              "direction-side-toggle rounded-lg border py-2 text-sm font-bold uppercase tracking-wide transition-[border-color,background-color,color,box-shadow] duration-300",
              active
                ? isLong
                  ? "direction-side-toggle--long-active border-cyan-500/28 bg-gradient-to-br from-emerald-950/55 via-cyan-950/45 to-slate-950/60 text-cyan-50 shadow-[inset_0_1px_0_rgba(34,211,238,0.12),0_4px_20px_rgba(6,78,59,0.18)]"
                  : "direction-side-toggle--short-active border-violet-500/28 bg-gradient-to-br from-violet-950/50 via-fuchsia-950/35 to-amber-950/30 text-violet-100 shadow-[inset_0_1px_0_rgba(167,139,250,0.1),0_4px_20px_rgba(76,29,149,0.16)]"
                : "border-white/[0.06] bg-black/40 text-slate-500 hover:border-white/10 hover:text-slate-400",
            )}
          >
            {direction}
          </button>
        );
      })}
    </div>
  );
}
