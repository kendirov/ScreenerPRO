"use client";

import * as React from "react";
import type { ExternalSeriesPoint } from "@/lib/preparation/preparation-types";
import { cn } from "@/lib/utils/cn";

type ChartTone = "positive" | "negative" | "neutral";

const TONE: Record<ChartTone, { stroke: string; fill: string }> = {
  positive: { stroke: "#34d399", fill: "rgba(52,211,153,0.14)" },
  negative: { stroke: "#fb7185", fill: "rgba(251,113,133,0.14)" },
  neutral: { stroke: "#67e8f9", fill: "rgba(103,232,249,0.08)" },
};

function resolveTone(changePct: number | null | undefined, series: ExternalSeriesPoint[]): ChartTone {
  if (changePct != null) {
    if (changePct > 0) return "positive";
    if (changePct < 0) return "negative";
    return "neutral";
  }
  if (series.length >= 2) {
    const delta = series[series.length - 1]!.value - series[0]!.value;
    if (delta > 0) return "positive";
    if (delta < 0) return "negative";
  }
  return "neutral";
}

function buildPaths(
  values: number[],
  width: number,
  height: number,
  pad: number,
): { line: string; area: string; min: number; span: number; innerH: number } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = values.length > 1 ? innerW / (values.length - 1) : 0;

  const coords = values.map((value, index) => {
    const x = pad + index * step;
    const y = pad + innerH - ((value - min) / span) * innerH;
    return { x, y };
  });

  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1]!.x.toFixed(2)},${(pad + innerH).toFixed(2)} L${coords[0]!.x.toFixed(2)},${(pad + innerH).toFixed(2)} Z`;

  return { line, area, min, span, innerH };
}

function toY(value: number, height: number, pad: number, min: number, span: number, innerH: number): number {
  return pad + innerH - ((value - min) / span) * innerH;
}

export function SvgMiniChart({
  series,
  changePct,
  height = 64,
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

  const width = 160;
  const pad = 4;
  const tone = resolveTone(changePct, series);
  const colors = TONE[tone];
  const { line, area, min, span, innerH } = buildPaths(values, width, height, pad);
  const last = values[values.length - 1]!;
  const lastX = pad + (width - pad * 2);
  const lastY = toY(last, height, pad, min, span, innerH);

  const highs = series.map((p) => p.high).filter((v): v is number => v != null && Number.isFinite(v));
  const lows = series.map((p) => p.low).filter((v): v is number => v != null && Number.isFinite(v));
  const showHl = highs.length >= 2 && lows.length >= 2;
  const highVal = showHl ? Math.max(...highs) : null;
  const lowVal = showHl ? Math.min(...lows) : null;

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
      <path d={area} fill={colors.fill} />
      <path
        d={line}
        fill="none"
        stroke={colors.stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        opacity={0.95}
      />
      {highVal != null ? (
        <circle
          cx={lastX * 0.55}
          cy={toY(highVal, height, pad, min, span, innerH)}
          r={1.5}
          fill={colors.stroke}
          opacity={0.35}
        />
      ) : null}
      {lowVal != null ? (
        <circle
          cx={lastX * 0.55}
          cy={toY(lowVal, height, pad, min, span, innerH)}
          r={1.5}
          fill={colors.stroke}
          opacity={0.35}
        />
      ) : null}
      <circle cx={lastX} cy={lastY} r={2.5} fill={colors.stroke} />
      <circle cx={lastX} cy={lastY} r={5} fill={colors.stroke} opacity={0.15} />
    </svg>
  );
}
