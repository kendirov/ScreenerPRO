"use client";

import * as React from "react";
import type { ExternalSeriesPoint } from "@/lib/preparation/preparation-types";
import { cn } from "@/lib/utils/cn";

type ChartTone = "positive" | "negative" | "neutral";

const TONE_STROKE: Record<ChartTone, string> = {
  positive: "#34d399",
  negative: "#fb7185",
  neutral: "#67e8f9",
};

function resolveTone(changePct: number | null | undefined): ChartTone {
  if ((changePct ?? 0) > 0) return "positive";
  if ((changePct ?? 0) < 0) return "negative";
  return "neutral";
}

function buildPath(values: number[], width: number, height: number, pad: number): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
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

export function MiniLineChart({
  series,
  changePct,
  height = 48,
  className,
}: {
  series: ExternalSeriesPoint[];
  changePct?: number | null;
  height?: number;
  className?: string;
}) {
  const values = React.useMemo(
    () => series.map((p) => p.value).filter((v) => Number.isFinite(v)),
    [series],
  );

  if (values.length < 2) return null;

  const width = 120;
  const pad = 3;
  const tone = resolveTone(changePct ?? series[series.length - 1]!.value - series[0]!.value);
  const path = buildPath(values, width, height, pad);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerH = height - pad * 2;
  const lastY = pad + innerH - ((values[values.length - 1]! - min) / span) * innerH;
  const lastX = pad + (width - pad * 2);

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("block w-full overflow-visible", className)}
      role="img"
      aria-hidden
    >
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
      <circle cx={lastX} cy={lastY} r={2} fill={TONE_STROKE[tone]} />
    </svg>
  );
}
