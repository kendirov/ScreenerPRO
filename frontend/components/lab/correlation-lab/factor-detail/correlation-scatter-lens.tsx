"use client";

import * as React from "react";
import type { CorrelationSignal } from "@/lib/domain/correlation-api";
import type { CorrelationFactorTheme } from "@/lib/domain/correlation-api-display";
import {
  CORRELATION_KIND_LABELS,
  kindScatterColor,
  pickBeta,
  pickCorr,
  type CorrelationWindowMode,
} from "@/lib/domain/correlation-factor-detail-display";
import { formatCorrelationCompact } from "@/lib/domain/correlation-lab";
import { cn } from "@/lib/utils/cn";

const W = 520;
const H = 320;
const PAD = 36;

export function CorrelationScatterLens({
  signals,
  windowMode,
  theme,
  turnoverByTicker,
  selectedTicker,
  onSelectTicker,
}: {
  signals: CorrelationSignal[];
  windowMode: CorrelationWindowMode;
  theme: CorrelationFactorTheme;
  turnoverByTicker: Map<string, number>;
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
}) {
  const [hover, setHover] = React.useState<CorrelationSignal | null>(null);

  const points = React.useMemo(() => {
    return signals
      .map((s) => {
        const x = pickCorr(s, windowMode);
        const y = pickBeta(s, windowMode);
        if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) return null;
        const turnover = turnoverByTicker.get(s.ticker) ?? 0;
        const size = turnover > 0 ? 4 + Math.sqrt(turnover / 1e9) * 8 : 5;
        return { signal: s, x, y, size: Math.min(size, 18) };
      })
      .filter(Boolean) as Array<{ signal: CorrelationSignal; x: number; y: number; size: number }>;
  }, [signals, windowMode, turnoverByTicker]);

  if (!points.length) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-lg border border-dashed border-lab-border-soft/50 text-sm text-lab-muted">
        Недостаточно данных для линзы — нужны пересекающиеся свечи
      </div>
    );
  }

  const xMin = -1;
  const xMax = 1;
  const yValues = points.map((p) => p.y);
  const yMin = Math.min(-0.5, ...yValues);
  const yMax = Math.max(0.5, ...yValues);
  const ySpan = yMax - yMin || 1;

  const toX = (v: number) => PAD + ((v - xMin) / (xMax - xMin)) * (W - PAD * 2);
  const toY = (v: number) => H - PAD - ((v - yMin) / ySpan) * (H - PAD * 2);

  const active = hover ?? points.find((p) => p.signal.ticker === selectedTicker)?.signal ?? null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-full" role="img" aria-label="Scatter corr vs beta">
        <rect x={PAD} y={PAD} width={W - PAD * 2} height={H - PAD * 2} fill="rgba(0,0,0,0.15)" rx={4} />
        <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} stroke="rgba(148,163,184,0.15)" />
        <line x1={toX(0)} y1={PAD} x2={toX(0)} y2={H - PAD} stroke="rgba(148,163,184,0.15)" />

        <text x={W / 2} y={H - 8} textAnchor="middle" className="fill-lab-text-dim text-[10px]">
          corr{windowMode}
        </text>
        <text
          x={12}
          y={H / 2}
          textAnchor="middle"
          transform={`rotate(-90 12 ${H / 2})`}
          className="fill-lab-text-dim text-[10px]"
        >
          beta{windowMode}
        </text>

        {points.map((p) => (
          <g key={p.signal.ticker}>
            <circle
              cx={toX(p.x)}
              cy={toY(p.y)}
              r={p.size}
              fill={kindScatterColor(p.signal.kind)}
              fillOpacity={selectedTicker === p.signal.ticker ? 0.95 : 0.55}
              stroke={selectedTicker === p.signal.ticker ? "#fff" : "transparent"}
              strokeWidth={1.5}
              className="cursor-pointer"
              onMouseEnter={() => setHover(p.signal)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelectTicker(p.signal.ticker)}
            />
          </g>
        ))}
      </svg>

      {active ? (
        <div
          className={cn(
            "absolute right-2 top-2 max-w-[200px] rounded-lg border bg-lab-bg-deep/95 px-2.5 py-2 text-[10px] backdrop-blur-sm",
            theme.border,
          )}
        >
          <p className={cn("font-semibold", theme.accent)}>{active.ticker}</p>
          <p className="mt-0.5 font-mono text-lab-muted">
            corr {formatCorrelationCompact(pickCorr(active, windowMode))} · beta{" "}
            {pickBeta(active, windowMode)?.toFixed(2) ?? "—"}
          </p>
          <p className="mt-0.5 text-lab-text-dim">{CORRELATION_KIND_LABELS[active.kind]}</p>
        </div>
      ) : null}

      <p className="mt-1 font-mono text-[10px] text-lab-text-dim">
        {points.length} бумаг · размер ≈ оборот · цвет = тип связи
      </p>
    </div>
  );
}
