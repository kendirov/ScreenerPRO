"use client";

import type { ScreenerRow } from "@screenerpro/shared";
import {
  computePositionInRange,
  labelRangePosition,
  resolveMicroBarRange,
  type StockSparklineSeries,
} from "@/lib/domain/stock-sparkline";
import { cn } from "@/lib/utils/cn";

const HIGH_EDGE = 0.72;
const LOW_EDGE = 0.28;
const TRACK_SLOTS = 7;

type BarTone = "high" | "low" | "mid";

function resolveBarTone(position: number): BarTone {
  if (position >= HIGH_EDGE) return "high";
  if (position <= LOW_EDGE) return "low";
  return "mid";
}

const TONE_STYLE: Record<BarTone, { label: string; track: string; dot: string }> = {
  high: {
    label: "text-emerald-500/70",
    track: "text-emerald-600/45",
    dot: "text-emerald-400",
  },
  low: {
    label: "text-rose-500/70",
    track: "text-rose-600/45",
    dot: "text-rose-400",
  },
  mid: {
    label: "text-slate-500/75",
    track: "text-cyan-600/35",
    dot: "text-cyan-400/95",
  },
};

function buildDashTrack(position: number): string {
  const dotIndex = Math.round(position * (TRACK_SLOTS - 1));
  return Array.from({ length: TRACK_SLOTS }, (_, index) => (index === dotIndex ? "●" : "━")).join("");
}

export function RadarMicroPositionBar({
  row,
  series,
  className,
}: {
  row: ScreenerRow;
  series?: StockSparklineSeries | null;
  className?: string;
}) {
  const bounds = resolveMicroBarRange(row, series);
  const position =
    bounds != null
      ? computePositionInRange(row.lastPrice, bounds.low, bounds.high)
      : computePositionInRange(row.lastPrice, row.low, row.high);

  if (position == null) {
    return (
      <span
        className={cn(
          "inline-flex h-3 min-w-[3.1rem] shrink-0 items-center justify-center font-mono text-[6px] text-slate-600",
          className,
        )}
        title="Нет диапазона"
      >
        ···
      </span>
    );
  }

  const tone = resolveBarTone(position);
  const style = TONE_STYLE[tone];
  const dashTrack = buildDashTrack(position);
  const hint = labelRangePosition(position);
  const scopeHint =
    bounds?.scope === "twoSessions" ? "2 торговые сессии" : "диапазон дня";

  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-px font-mono leading-none", className)}
      title={hint ? `${hint} · ${scopeHint}` : scopeHint}
      role="img"
      aria-label={hint ?? "Положение в диапазоне"}
    >
      <span className={cn("text-[6px]", style.label)}>L</span>
      <span
        className={cn(
          "px-px text-[7px] font-medium tracking-tighter tabular-nums",
          style.track,
        )}
      >
        {dashTrack.split("").map((char, index) => (
          <span
            key={index}
            className={char === "●" ? cn("font-bold", style.dot) : undefined}
          >
            {char}
          </span>
        ))}
      </span>
      <span className={cn("text-[6px]", style.label)}>H</span>
    </span>
  );
}
