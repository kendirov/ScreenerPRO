"use client";

import * as React from "react";
import type { StockSparklineSeries } from "@/lib/domain/stock-sparkline";
import { extractSparklineCloses, hasEnoughSparklinePoints } from "@/lib/domain/stock-sparkline";
import { cn } from "@/lib/utils/cn";

type SparkTone = "positive" | "negative" | "neutral";

const TONE_STROKE: Record<SparkTone, string> = {
  positive: "#34d399",
  negative: "#fb7185",
  neutral: "#67e8f9",
};

const TONE_FILL: Record<SparkTone, string> = {
  positive: "rgba(52,211,153,0.12)",
  negative: "rgba(251,113,133,0.12)",
  neutral: "rgba(103,232,249,0.08)",
};

function resolveTone(changePct: number | null | undefined): SparkTone {
  if ((changePct ?? 0) > 0) return "positive";
  if ((changePct ?? 0) < 0) return "negative";
  return "neutral";
}

function buildLinePath(values: number[], width: number, height: number, pad: number, min: number, span: number): string {
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = values.length > 1 ? innerW / (values.length - 1) : 0;

  return values
    .map((value, index) => {
      const x = pad + index * step;
      const y = pad + innerH - ((value - min) / span) * innerH;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function toY(value: number, height: number, pad: number, min: number, span: number): number {
  const innerH = height - pad * 2;
  return pad + innerH - ((value - min) / span) * innerH;
}

export function StockMiniSparkline({
  series,
  dayHigh,
  dayLow,
  changePct,
  size = "compact",
  className,
}: {
  series: StockSparklineSeries | null | undefined;
  dayHigh: number | null;
  dayLow: number | null;
  changePct: number | null;
  size?: "large" | "compact" | "preview";
  className?: string;
}) {
  const closes = React.useMemo(() => extractSparklineCloses(series), [series]);
  const ready = hasEnoughSparklinePoints(series);

  const width = size === "preview" ? 360 : size === "large" ? 96 : 72;
  const height = size === "preview" ? 170 : size === "large" ? 40 : 32;
  const pad = size === "preview" ? 8 : 3;

  if (!ready) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border border-dashed border-lab-border-soft/60 bg-black/20 text-[9px] leading-tight text-lab-text-dim",
          size === "preview" ? "h-[170px] min-w-[22rem] px-1" : size === "large" ? "h-10 min-w-[6rem] px-1" : "h-8 min-w-[4.5rem] px-0.5",
          className,
        )}
      >
        история недоступна
      </div>
    );
  }

  const zoneHigh = dayHigh ?? Math.max(...closes);
  const zoneLow = dayLow ?? Math.min(...closes);
  const min = Math.min(zoneLow, ...closes);
  const max = Math.max(zoneHigh, ...closes);
  const span = max - min || 1;
  const tone = resolveTone(changePct);
  const path = buildLinePath(closes, width, height, pad, min, span);
  const lastClose = closes[closes.length - 1]!;
  const lastX = pad + (width - pad * 2);
  const lastY = toY(lastClose, height, pad, min, span);
  const hasDayBand =
    dayHigh != null && dayLow != null && Number.isFinite(dayHigh) && Number.isFinite(dayLow) && dayHigh > dayLow;
  const bandTop = toY(dayHigh!, height, pad, min, span);
  const bandBottom = toY(dayLow!, height, pad, min, span);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0 overflow-visible", className)}
      role="img"
      aria-label="График цены"
    >
      {hasDayBand ? (
        <rect
          x={pad}
          y={Math.min(bandTop, bandBottom)}
          width={width - pad * 2}
          height={Math.abs(bandBottom - bandTop)}
          fill={TONE_FILL[tone]}
          rx={1}
        />
      ) : null}
      {hasDayBand ? (
        <>
          <line
            x1={pad}
            x2={width - pad}
            y1={bandTop}
            y2={bandTop}
            stroke="rgba(148,163,184,0.22)"
            strokeWidth="0.75"
            strokeDasharray="2 2"
          />
          <line
            x1={pad}
            x2={width - pad}
            y1={bandBottom}
            y2={bandBottom}
            stroke="rgba(148,163,184,0.22)"
            strokeWidth="0.75"
            strokeDasharray="2 2"
          />
        </>
      ) : null}
      <path
        d={path}
        fill="none"
        stroke={TONE_STROKE[tone]}
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        opacity={0.92}
      />
      <circle cx={lastX} cy={lastY} r={2.25} fill={TONE_STROKE[tone]} opacity={0.95} />
      <circle cx={lastX} cy={lastY} r={4.5} fill={TONE_STROKE[tone]} opacity={0.18} />
    </svg>
  );
}
