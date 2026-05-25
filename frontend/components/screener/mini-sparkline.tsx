"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type SparklineTone = "positive" | "negative" | "neutral";

const TONE_STROKE: Record<SparklineTone, string> = {
  positive: "stroke-lab-green",
  negative: "stroke-lab-red",
  neutral: "stroke-lab-blue/65",
};

const TONE_STROKE_BACKDROP: Record<SparklineTone, string> = {
  positive: "stroke-lab-green/75",
  negative: "stroke-lab-red/75",
  neutral: "stroke-lab-blue/45",
};

const TONE_STROKE_AURA: Record<SparklineTone, string> = {
  positive: "stroke-lab-green/35",
  negative: "stroke-lab-red/35",
  neutral: "stroke-lab-blue/28",
};

export function inferTone(values: number[]): SparklineTone {
  if (values.length < 2) return "neutral";
  const delta = values[values.length - 1]! - values[0]!;
  if (delta > 0) return "positive";
  if (delta < 0) return "negative";
  return "neutral";
}

export function inferToneFromChange(percentChange: number | null | undefined): SparklineTone {
  if ((percentChange ?? 0) > 0) return "positive";
  if ((percentChange ?? 0) < 0) return "negative";
  return "neutral";
}

function hashSeed(input: string | number): number {
  const raw = String(input);
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) || 1;
}

export interface SignalAuraMetrics {
  changePct?: number | null;
  turnover?: number | null;
  tradesCount?: number | null;
  rangePct?: number | null;
  seed?: string | number;
}

/** Декоративная кривая от live-метрик (не история цены). */
export function generateSignalAuraSeries(metrics: SignalAuraMetrics, pointCount = 40): number[] {
  const change = metrics.changePct ?? 0;
  const turnoverNorm = Math.min(1, Math.log10(Math.max(metrics.turnover ?? 1, 1)) / 10);
  const tradesNorm = Math.min(1, (metrics.tradesCount ?? 0) / 8000);
  const rangeNorm = Math.min(1, Math.abs(metrics.rangePct ?? 0) / 5);
  const activity = (turnoverNorm * 0.45 + tradesNorm * 0.3 + rangeNorm * 0.25);
  const slope = Math.tanh(change / 2.8) * 0.38;
  const s = hashSeed(metrics.seed ?? 1);
  const values: number[] = [];

  for (let i = 0; i < pointCount; i++) {
    const t = pointCount > 1 ? i / (pointCount - 1) : 0;
    const wave =
      Math.sin(t * Math.PI * 2 + s * 0.011) * (0.12 + activity * 0.22) +
      Math.sin(t * Math.PI * 3.6 + s * 0.019) * (0.05 + activity * 0.08);
    values.push(0.5 + slope * (t - 0.5) + wave);
  }
  return values;
}

function buildPath(values: number[], width: number, height: number, pad = 2): string {
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

function buildSmoothBezierPath(values: number[], width: number, height: number, pad = 2): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = values.length > 1 ? innerW / (values.length - 1) : 0;

  const points = values.map((value, index) => ({
    x: pad + index * step,
    y: pad + innerH - ((value - min) / span) * innerH,
  }));

  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M${points[0]!.x.toFixed(2)},${points[0]!.y.toFixed(2)} L${points[1]!.x.toFixed(2)},${points[1]!.y.toFixed(2)}`;
  }

  let d = `M${points[0]!.x.toFixed(2)},${points[0]!.y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

type SparkSvgProps = {
  path: string;
  tone: SparklineTone;
  variant: "inline" | "backdrop";
  width: number;
  height: number;
  className?: string;
  decorative?: boolean;
};

function SparkSvg({ path, tone, variant, width, height, className, decorative }: SparkSvgProps) {
  const strokeClass = decorative
    ? TONE_STROKE_AURA[tone]
    : variant === "backdrop"
      ? TONE_STROKE_BACKDROP[tone]
      : TONE_STROKE[tone];

  if (variant === "backdrop") {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 h-full w-full",
          decorative ? "opacity-[0.12]" : "opacity-[0.28]",
          className,
        )}
        aria-hidden
      >
        <path
          d={path}
          fill="none"
          className={strokeClass}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0 overflow-visible", className)}
      role="img"
      aria-hidden={decorative}
      aria-label={decorative ? undefined : "График 5 дней"}
    >
      <path
        d={path}
        fill="none"
        className={cn(strokeClass, !decorative && "opacity-90")}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export interface RealSparklineProps {
  values: number[] | null | undefined;
  tone?: SparklineTone;
  width?: number;
  height?: number;
  className?: string;
  variant?: "inline" | "backdrop";
}

/** Только реальная история; подпись «5д» — отдельно у родителя. */
export function RealSparkline({
  values,
  tone,
  width = 72,
  height = 28,
  className,
  variant = "inline",
}: RealSparklineProps) {
  const series = React.useMemo(() => {
    if (!values?.length) return null;
    const cleaned = values.filter((v) => Number.isFinite(v));
    return cleaned.length >= 2 ? cleaned : null;
  }, [values]);

  if (!series) return null;

  const resolvedTone = tone ?? inferTone(series);
  const pathW = variant === "backdrop" ? 240 : width;
  const pathH = variant === "backdrop" ? 96 : height;
  const path =
    variant === "backdrop" ? buildPath(series, pathW, pathH, 4) : buildPath(series, width, height, 2);

  return <SparkSvg path={path} tone={resolvedTone} variant={variant} width={pathW} height={pathH} className={className} />;
}

export interface SignalAuraProps {
  metrics: SignalAuraMetrics;
  tone?: SparklineTone;
  width?: number;
  height?: number;
  className?: string;
  variant?: "inline" | "backdrop";
}

/** Декоративный фон от текущих метрик; не подписывать как график. */
export function SignalAura({
  metrics,
  tone,
  width = 72,
  height = 28,
  className,
  variant = "inline",
}: SignalAuraProps) {
  const series = React.useMemo(
    () => generateSignalAuraSeries(metrics, variant === "backdrop" ? 40 : 28),
    [metrics, variant],
  );
  const resolvedTone = tone ?? inferToneFromChange(metrics.changePct);
  const pathW = variant === "backdrop" ? 240 : width;
  const pathH = variant === "backdrop" ? 96 : height;
  const path = buildSmoothBezierPath(series, pathW, pathH, variant === "backdrop" ? 4 : 2);

  return (
    <SparkSvg
      path={path}
      tone={resolvedTone}
      variant={variant}
      width={pathW}
      height={pathH}
      className={className}
      decorative
    />
  );
}

export function hasRealSparklineHistory(values: number[] | null | undefined): boolean {
  if (!values?.length) return false;
  return values.filter((v) => Number.isFinite(v)).length >= 2;
}

export function HistoryCaption({
  hasHistory,
  className,
  debug = false,
}: {
  hasHistory: boolean;
  className?: string;
  /** Показывать «история недоступна» только в debug/tooltip-режиме */
  debug?: boolean;
}) {
  if (!hasHistory && !debug) return null;
  return (
    <span
      className={cn("font-mono text-[9px] uppercase tracking-[0.12em] text-lab-text-dim", className)}
      title={!hasHistory ? "История недоступна" : "5 дней"}
    >
      {hasHistory ? "5д" : "история недоступна"}
    </span>
  );
}

/** @deprecated Используйте RealSparkline или SignalAura */
export function MiniSparkline({
  values,
  tone,
  referenceChange,
  placeholderSeed = 1,
  width = 72,
  height = 28,
  className,
  variant = "inline",
}: {
  values?: number[] | null;
  tone?: SparklineTone;
  referenceChange?: number | null;
  placeholderSeed?: string | number;
  width?: number;
  height?: number;
  className?: string;
  label?: string;
  variant?: "inline" | "backdrop";
}) {
  const hasHistory = hasRealSparklineHistory(values);
  if (hasHistory) {
    return (
      <RealSparkline values={values} tone={tone} width={width} height={height} className={className} variant={variant} />
    );
  }
  return null;
}
