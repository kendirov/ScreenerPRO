"use client";

import * as React from "react";
import type { CorrelationPairResponse } from "@/lib/domain/correlation-api";
import type { CorrelationFactorTheme } from "@/lib/domain/correlation-api-display";
import {
  buildCorrelationPairChartModel,
  type CorrelationBreakZone,
  formatPairTooltipDate,
} from "@/lib/domain/correlation-pair-break";
import { formatCorrelationCompact } from "@/lib/domain/correlation-lab";
import { cn } from "@/lib/utils/cn";

const W = 560;
const MAIN_H = 200;
const CORR_H = 56;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 8;

type HoverSnap = {
  idx: number;
  x: number;
  stock: number;
  factor: number;
  corr: number | null;
  t: string;
};

export function CorrelationPairChart({
  pair,
  stockLabel,
  factorLabel,
  theme,
  className,
}: {
  pair: CorrelationPairResponse;
  stockLabel: string;
  factorLabel: string;
  theme: CorrelationFactorTheme;
  className?: string;
}) {
  const model = React.useMemo(() => buildCorrelationPairChartModel(pair), [pair]);
  const [hover, setHover] = React.useState<HoverSnap | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const n = model.stock.length;
  if (n < 2) {
    return (
      <div
        className={cn(
          "flex h-[280px] items-center justify-center rounded-lg border border-dashed border-lab-border-soft/50 text-sm text-lab-muted",
          className,
        )}
      >
        История недостаточна для графика пары
      </div>
    );
  }

  const stockVals = model.stock.map((p) => p.value);
  const factorVals = model.factor.map((p) => p.value);
  const all = [...stockVals, ...factorVals];
  const yMin = Math.min(...all);
  const yMax = Math.max(...all);
  const ySpan = yMax - yMin || 1;

  const plotW = W - PAD_L - PAD_R;
  const mainPlotH = MAIN_H - PAD_T - PAD_B;
  const step = n > 1 ? plotW / (n - 1) : plotW;

  const toX = (i: number) => PAD_L + i * step;
  const toYMain = (v: number) => PAD_T + mainPlotH - ((v - yMin) / ySpan) * mainPlotH;
  const toYCorr = (v: number) => {
    const clamped = Math.max(-1, Math.min(1, v));
    return MAIN_H + 8 + CORR_H - ((clamped + 1) / 2) * (CORR_H - 12);
  };

  const linePath = (vals: number[]) =>
    vals
      .map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toYMain(v).toFixed(1)}`)
      .join(" ");

  const corrVals = model.rollingCorr.map((p) => p.value);
  const corrPath =
    corrVals.length > 1
      ? corrVals
          .map((v, i) => `${i === 0 ? "M" : "L"}${toX(i + 1).toFixed(1)},${toYCorr(v).toFixed(1)}`)
          .join(" ")
      : "";

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.max(0, Math.min(n - 1, Math.round((relX - PAD_L) / step)));
    setHover({
      idx,
      x: toX(idx),
      stock: stockVals[idx]!,
      factor: factorVals[idx]!,
      corr: model.rollingCorr[idx - 1]?.value ?? model.rollingCorr.at(-1)?.value ?? null,
      t: model.stock[idx]!.t,
    });
  };

  return (
    <div className={cn("relative", className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${MAIN_H + CORR_H + 16}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={`График пары ${stockLabel} и ${factorLabel}, нормализация от 100`}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <rect x={0} y={0} width={W} height={MAIN_H} fill="rgba(0,0,0,0.18)" rx={6} />

        {model.breakZones.map((zone, zi) => (
          <BreakZoneRect
            key={`${zone.startIdx}-${zone.endIdx}-${zi}`}
            zone={zone}
            toX={toX}
            mainH={MAIN_H}
            padT={PAD_T}
            mainPlotH={mainPlotH}
            padB={PAD_B}
          />
        ))}

        <line
          x1={PAD_L}
          y1={toYMain(100)}
          x2={W - PAD_R}
          y2={toYMain(100)}
          stroke="rgba(148,163,184,0.12)"
          strokeDasharray="4 4"
        />

        <path d={linePath(factorVals)} fill="none" stroke={theme.stroke} strokeWidth={1.6} opacity={0.85} />
        <path d={linePath(stockVals)} fill="none" stroke="#22d3ee" strokeWidth={1.8} opacity={0.9} />

        {model.breakZones.map((zone, zi) => {
          const mid = Math.floor((zone.startIdx + zone.endIdx) / 2);
          return (
            <circle
              key={`m-${zi}`}
              cx={toX(mid)}
              cy={toYMain(stockVals[mid]!)}
              r={3.5}
              fill="#f59e0b"
              stroke="#1c1917"
              strokeWidth={1}
              opacity={0.9}
            />
          );
        })}

        <text x={PAD_L + 4} y={PAD_T + 4} className="fill-lab-text-dim text-[9px]">
          {stockLabel}
        </text>
        <text x={PAD_L + 4} y={PAD_T + 14} fill={theme.stroke} className="text-[9px]">
          {factorLabel}
        </text>

        <rect x={0} y={MAIN_H + 4} width={W} height={CORR_H + 12} fill="rgba(0,0,0,0.12)" rx={4} />
        <text x={PAD_L + 4} y={MAIN_H + 14} className="fill-lab-text-dim text-[9px]">
          rolling corr · 20
        </text>
        <line x1={PAD_L} y1={toYCorr(0)} x2={W - PAD_R} y2={toYCorr(0)} stroke="rgba(148,163,184,0.15)" />
        {corrPath ? (
          <path d={corrPath} fill="none" stroke="#f59e0b" strokeWidth={1.4} opacity={0.85} />
        ) : null}

        {hover ? (
          <>
            <line
              x1={hover.x}
              y1={PAD_T}
              x2={hover.x}
              y2={MAIN_H + CORR_H + 12}
              stroke="rgba(34,211,238,0.35)"
              strokeWidth={1}
            />
            <circle cx={hover.x} cy={toYMain(hover.stock)} r={4} fill="#22d3ee" />
            <circle cx={hover.x} cy={toYMain(hover.factor)} r={3.5} fill={theme.stroke} />
          </>
        ) : null}
      </svg>

      {hover ? (
        <div className="pointer-events-none absolute left-2 top-2 max-w-[220px] rounded-lg border border-lab-border-soft/50 bg-lab-bg-deep/95 px-2.5 py-2 text-[10px] backdrop-blur-sm">
          <p className="font-mono text-lab-text-dim">{formatPairTooltipDate(hover.t)}</p>
          <p className="mt-1 text-lab-cyan">
            {stockLabel}: <span className="font-mono tabular-nums">{hover.stock.toFixed(2)}</span>
          </p>
          <p style={{ color: theme.stroke }}>
            {factorLabel}: <span className="font-mono tabular-nums">{hover.factor.toFixed(2)}</span>
          </p>
          {hover.corr != null ? (
            <p className="mt-1 text-lab-amber">
              corr: <span className="font-mono tabular-nums">{formatCorrelationCompact(hover.corr)}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {model.breakZones.length ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {model.breakZones.slice(-3).map((z, i) => (
            <span
              key={i}
              className={cn(
                "rounded border px-1.5 py-0.5 text-[9px]",
                z.kind === "break"
                  ? "border-lab-amber/40 bg-lab-amber/10 text-lab-amber"
                  : z.kind === "stock-stronger"
                    ? "border-rose-500/30 bg-rose-950/30 text-rose-300/90"
                    : "border-lab-muted/30 bg-lab-muted/10 text-lab-muted",
              )}
            >
              {z.label}
            </span>
          ))}
        </div>
      ) : null}

      <p className="mt-1 font-mono text-[9px] text-lab-text-dim">
        base 100 · только реальные свечи MOEX · не торговая рекомендация
      </p>
    </div>
  );
}

function BreakZoneRect({
  zone,
  toX,
  mainH,
  padT,
  mainPlotH,
  padB,
}: {
  zone: CorrelationBreakZone;
  toX: (i: number) => number;
  mainH: number;
  padT: number;
  mainPlotH: number;
  padB: number;
}) {
  const x1 = toX(zone.startIdx);
  const x2 = toX(zone.endIdx);
  const fill =
    zone.kind === "break"
      ? "rgba(245,158,11,0.12)"
      : zone.kind === "stock-stronger"
        ? "rgba(251,113,133,0.1)"
        : "rgba(100,116,139,0.12)";

  return (
    <rect
      x={x1}
      y={padT}
      width={Math.max(x2 - x1, 6)}
      height={mainPlotH + padB}
      fill={fill}
      rx={2}
    />
  );
}

export { buildCorrelationPairChartModel };
