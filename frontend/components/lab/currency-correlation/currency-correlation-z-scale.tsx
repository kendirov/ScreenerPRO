"use client";

import { divergenceZScalePercent } from "@/lib/domain/currency-correlation-divergence-map";
import {
  LIFECYCLE_STATE_CHART_COLORS,
  type SpreadLifecycleState,
} from "@/lib/domain/spread-lifecycle";
import { cn } from "@/lib/utils/cn";

const ZONE_BANDS = [
  { from: 0, to: 25, className: "bg-rose-500/10" },
  { from: 25, to: 33.33, className: "bg-violet-500/8" },
  { from: 33.33, to: 41.67, className: "bg-amber-500/6" },
  { from: 41.67, to: 58.33, className: "bg-slate-700/20" },
  { from: 58.33, to: 66.67, className: "bg-amber-500/6" },
  { from: 66.67, to: 75, className: "bg-violet-500/8" },
  { from: 75, to: 100, className: "bg-rose-500/10" },
] as const;

const ZONE_LINES = [
  { pct: 16.67, label: "−3" },
  { pct: 25, label: "−2" },
  { pct: 33.33, label: "−1.5" },
  { pct: 50, label: "0" },
  { pct: 66.67, label: "+1.5" },
  { pct: 75, label: "+2" },
  { pct: 83.33, label: "+3" },
] as const;

export function CurrencyCorrelationZScale({
  z,
  state,
  className,
}: {
  z: number | null;
  state: SpreadLifecycleState;
  className?: string;
}) {
  const pct = divergenceZScalePercent(z);
  const markerColor = LIFECYCLE_STATE_CHART_COLORS[state];

  return (
    <div className={cn("space-y-1", className)}>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-950/80 ring-1 ring-white/[0.06]">
        <div className="absolute inset-0 flex">
          {ZONE_BANDS.map((band) => (
            <div
              key={`${band.from}-${band.to}`}
              className={cn("h-full", band.className)}
              style={{ width: `${band.to - band.from}%` }}
            />
          ))}
        </div>
        {ZONE_LINES.map((line) => (
          <div
            key={line.pct}
            className={cn(
              "absolute inset-y-0 w-px",
              line.label === "0" ? "bg-cyan-400/45" : "bg-white/[0.08]",
            )}
            style={{ left: `${line.pct}%` }}
            aria-hidden
          />
        ))}
        <div
          className="absolute top-1/2 z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25 shadow-sm"
          style={{
            left: `${pct}%`,
            backgroundColor: markerColor,
            boxShadow: `0 0 10px ${markerColor}66`,
          }}
          aria-hidden
        />
      </div>
      <div className="flex justify-between text-[8px] text-slate-600">
        <span>норма</span>
        <span>растяжение</span>
        <span>экстрим</span>
        <span>слом</span>
      </div>
    </div>
  );
}
