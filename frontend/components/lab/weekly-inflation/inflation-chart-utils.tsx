"use client";

import type { WeeklyInflationChartPoint } from "@/lib/domain/weekly-inflation";

export type InflationBarTone = "deceleration" | "moderate" | "acceleration" | "neutral";

export const INFLATION_BAR_COLORS: Record<
  InflationBarTone,
  { fill: string; stroke: string; glow: string }
> = {
  deceleration: { fill: "rgba(34,211,238,0.75)", stroke: "#22d3ee", glow: "rgba(34,211,238,0.35)" },
  moderate: { fill: "rgba(245,158,11,0.8)", stroke: "#f59e0b", glow: "rgba(245,158,11,0.35)" },
  acceleration: { fill: "rgba(251,113,133,0.82)", stroke: "#fb7185", glow: "rgba(251,113,133,0.35)" },
  neutral: { fill: "rgba(139,92,246,0.72)", stroke: "#8b5cf6", glow: "rgba(139,92,246,0.3)" },
};

export function classifyBarTone(value: number, previous: number | null): InflationBarTone {
  if (previous != null) {
    const delta = value - previous;
    if (delta >= 0.02) return "acceleration";
    if (delta <= -0.02) return "deceleration";
  }
  if (value >= 0.15) return "acceleration";
  if (value <= 0.05) return "deceleration";
  if (value > 0.08) return "moderate";
  return "neutral";
}

export function resolveHeatFill(value: number, min: number, max: number): string {
  const span = Math.max(max - min, 0.01);
  const mid = (min + max) / 2;
  if (value >= mid + span * 0.12) return "rgba(251,113,133,0.85)";
  if (value <= mid - span * 0.12) return "rgba(34,211,238,0.75)";
  if (value > 0.08) return "rgba(245,158,11,0.78)";
  return "rgba(139,92,246,0.68)";
}

export type ChartTooltipState = {
  x: number;
  y: number;
  title: string;
  lines: string[];
};

export function chartPointToTooltip(
  item: WeeklyInflationChartPoint,
  containerRect: DOMRect,
  anchorX: number,
  anchorY: number,
  periodLabel: string,
  sourceLabel: string,
): ChartTooltipState {
  return {
    x: anchorX - containerRect.left,
    y: anchorY - containerRect.top,
    title: periodLabel,
    lines: [
      `Headline: ${item.headlinePct >= 0 ? "+" : ""}${item.headlinePct.toFixed(2)}%`,
      item.annualizedLatest != null
        ? `Annualized: ${item.annualizedLatest >= 0 ? "+" : ""}${item.annualizedLatest.toFixed(2)}%`
        : "Annualized: —",
      item.avg4w != null ? `4w avg: ${item.avg4w >= 0 ? "+" : ""}${item.avg4w.toFixed(2)}%` : "4w avg: недостаточно истории",
      `Источник: ${sourceLabel}`,
    ],
  };
}

export function ChartTooltip({ tooltip }: { tooltip: ChartTooltipState | null }) {
  if (!tooltip) return null;
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[180px] rounded-lg border border-lab-violet/30 bg-lab-bg-deep/95 px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-sm"
      style={{ left: tooltip.x + 12, top: Math.max(8, tooltip.y - 8), transform: "translateY(-100%)" }}
    >
      <p className="text-xs font-medium text-lab-text">{tooltip.title}</p>
      <ul className="mt-1 space-y-0.5">
        {tooltip.lines.map((line) => (
          <li key={line} className="font-mono text-[10px] text-lab-muted">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
