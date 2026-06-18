"use client";

import * as React from "react";
import type { StockSparklineSeries } from "@/lib/domain/stock-sparkline";
import { extractSparklineCloses, hasTwoSessionSparkline } from "@/lib/domain/stock-sparkline";
import { cn } from "@/lib/utils/cn";

type SparkTone = "positive" | "negative" | "neutral";

const TONE_STROKE: Record<SparkTone, string> = {
  positive: "#34d399",
  negative: "#fb7185",
  neutral: "#94a3b8",
};

const TONE_VOL: Record<SparkTone, string> = {
  positive: "rgba(52,211,153,0.45)",
  negative: "rgba(251,113,133,0.45)",
  neutral: "rgba(148,163,184,0.35)",
};

function resolveTone(changePct: number | null | undefined): SparkTone {
  if ((changePct ?? 0) > 0) return "positive";
  if ((changePct ?? 0) < 0) return "negative";
  return "neutral";
}

function buildLinePath(values: number[], width: number, priceH: number, pad: number, min: number, span: number): string {
  const innerW = width - pad * 2;
  const innerH = priceH - pad;
  const step = values.length > 1 ? innerW / (values.length - 1) : 0;

  return values
    .map((value, index) => {
      const x = pad + index * step;
      const y = pad + innerH - ((value - min) / span) * innerH;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function toY(value: number, priceH: number, pad: number, min: number, span: number): number {
  const innerH = priceH - pad;
  return pad + innerH - ((value - min) / span) * innerH;
}

export function RadarMiniSparkline({
  series,
  dayHigh,
  dayLow,
  changePct,
  size = "inline",
  className,
}: {
  series: StockSparklineSeries | null | undefined;
  dayHigh: number | null;
  dayLow: number | null;
  changePct: number | null;
  size?: "inline" | "tooltip";
  className?: string;
}) {
  const ready = hasTwoSessionSparkline(series);
  const candles = series?.candles ?? [];
  const closes = React.useMemo(() => extractSparklineCloses(series), [series]);

  const width = size === "tooltip" ? 268 : 88;
  const height = size === "tooltip" ? 52 : 20;
  const priceH = size === "tooltip" ? 38 : 14;
  const volH = size === "tooltip" ? 12 : 5;
  const pad = 2;

  if (!ready) {
    if (size !== "tooltip") return null;
    return null;
  }

  const zoneHigh = dayHigh ?? Math.max(...closes);
  const zoneLow = dayLow ?? Math.min(...closes);
  const min = Math.min(zoneLow, ...closes);
  const max = Math.max(zoneHigh, ...closes);
  const span = max - min || 1;
  const tone = resolveTone(changePct);
  const path = buildLinePath(closes, width, priceH, pad, min, span);
  const lastClose = closes[closes.length - 1]!;
  const lastX = pad + (width - pad * 2);
  const lastY = toY(lastClose, priceH, pad, min, span);
  const hasDayBand =
    dayHigh != null && dayLow != null && Number.isFinite(dayHigh) && Number.isFinite(dayLow) && dayHigh > dayLow;
  const bandTop = toY(dayHigh!, priceH, pad, min, span);
  const bandBottom = toY(dayLow!, priceH, pad, min, span);

  const turnovers = candles.map((c) => c.turnover ?? 0);
  const maxTurnover = Math.max(...turnovers, 1);
  const hasVolume = turnovers.some((v) => v > 0);
  const innerW = width - pad * 2;
  const barStep = candles.length > 1 ? innerW / (candles.length - 1) : innerW;
  const barW = Math.max(0.8, Math.min(2.2, barStep * 0.55));

  const sessionKeys = series?.sessionKeys ?? [];
  let sessionSplitX: number | null = null;
  if (sessionKeys.length >= 2) {
    const splitKey = sessionKeys[sessionKeys.length - 2];
    const splitIndex = candles.findIndex((c) => c.sessionKey === splitKey);
    if (splitIndex >= 0) {
      sessionSplitX = pad + splitIndex * (candles.length > 1 ? innerW / (candles.length - 1) : 0);
    }
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0 overflow-visible", className)}
      role="img"
      aria-label="График 2 торговые сессии"
    >
      {hasDayBand ? (
        <rect
          x={sessionSplitX ?? pad}
          y={Math.min(bandTop, bandBottom)}
          width={width - (sessionSplitX ?? pad) - pad}
          height={Math.abs(bandBottom - bandTop)}
          fill="rgba(148,163,184,0.06)"
          rx={0.5}
        />
      ) : null}
      {hasDayBand ? (
        <>
          <line
            x1={sessionSplitX ?? pad}
            x2={width - pad}
            y1={bandTop}
            y2={bandTop}
            stroke="rgba(148,163,184,0.2)"
            strokeWidth="0.6"
            strokeDasharray="2 2"
          />
          <line
            x1={sessionSplitX ?? pad}
            x2={width - pad}
            y1={bandBottom}
            y2={bandBottom}
            stroke="rgba(148,163,184,0.2)"
            strokeWidth="0.6"
            strokeDasharray="2 2"
          />
        </>
      ) : null}
      {sessionSplitX != null ? (
        <line
          x1={sessionSplitX}
          x2={sessionSplitX}
          y1={pad}
          y2={priceH}
          stroke="rgba(100,116,139,0.35)"
          strokeWidth="0.6"
          strokeDasharray="1 2"
        />
      ) : null}
      <path
        d={path}
        fill="none"
        stroke={TONE_STROKE[tone]}
        strokeWidth={size === "tooltip" ? 1.5 : 1.15}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        opacity={0.95}
      />
      <circle cx={lastX} cy={lastY} r={size === "tooltip" ? 2.5 : 1.8} fill={TONE_STROKE[tone]} />
      {hasVolume
        ? candles.map((candle, index) => {
            const turnover = candle.turnover ?? 0;
            if (turnover <= 0) return null;
            const x = pad + index * barStep - barW / 2;
            const h = (turnover / maxTurnover) * (volH - 1);
            return (
              <rect
                key={`${candle.time}-${index}`}
                x={x}
                y={height - h}
                width={barW}
                height={h}
                fill={TONE_VOL[tone]}
                rx={0.3}
              />
            );
          })
        : null}
    </svg>
  );
}
