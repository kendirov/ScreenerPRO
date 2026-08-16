"use client";

import { useMemo } from "react";
import type { StockSparklineSeries } from "@/lib/domain/stock-sparkline";
import { extractSparklineCloses, hasEnoughSparklinePoints } from "@/lib/domain/stock-sparkline";

const WIDTH = 190;
const HEIGHT = 52;
const PRICE_HEIGHT = 38;
const PAD = 2;

function linePath(values: number[]): string {
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const step = (WIDTH - PAD * 2) / Math.max(1, values.length - 1);
  return values.map((value, index) => {
    const x = PAD + index * step;
    const y = PAD + (PRICE_HEIGHT - PAD * 2) - ((value - low) / span) * (PRICE_HEIGHT - PAD * 2);
    return `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

export function TradingMiniChart({
  series,
  change,
  loading,
  error,
  unavailableLabel,
}: {
  series: StockSparklineSeries | null | undefined;
  change: number | null | undefined;
  loading: boolean;
  error: boolean;
  unavailableLabel?: string;
}) {
  const values = useMemo(() => extractSparklineCloses(series), [series]);
  const ready = hasEnoughSparklinePoints(series);

  if (loading) return <div className="tr-mini-chart__state">получаем свечи</div>;
  if (error || !ready) return <div className="tr-mini-chart__state">{unavailableLabel ?? "свечей нет"}</div>;

  const candles = series?.candles ?? [];
  const turnovers = candles.map((candle) => candle.turnover ?? 0);
  const maxTurnover = Math.max(...turnovers, 1);
  const step = (WIDTH - PAD * 2) / Math.max(1, candles.length - 1);
  const sessionKeys = series?.sessionKeys ?? [];
  const currentSession = sessionKeys.at(-1);
  const splitIndex = currentSession ? candles.findIndex((candle) => candle.sessionKey === currentSession) : -1;
  const splitX = splitIndex > 0 ? PAD + splitIndex * step : null;
  const tone = (change ?? 0) > 0 ? "is-positive" : (change ?? 0) < 0 ? "is-negative" : "is-neutral";

  return (
    <div className={`tr-mini-chart ${tone}`}>
      <div className="tr-mini-chart__meta">
        <span>{series?.scope === "twoSessions" ? "2 сессии" : "сессия"}</span>
        <span>{series?.interval}м · MOEX</span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Реальный внутридневной график MOEX">
        {splitX != null ? <line className="tr-mini-chart__split" x1={splitX} x2={splitX} y1={PAD} y2={HEIGHT} /> : null}
        {candles.map((candle, index) => {
          const turnover = candle.turnover ?? 0;
          if (turnover <= 0) return null;
          const height = Math.max(1, (turnover / maxTurnover) * 9);
          return <rect className="tr-mini-chart__volume" key={`${candle.time}-${index}`} x={PAD + index * step} y={HEIGHT - height} width={Math.max(.8, Math.min(2, step * .55))} height={height} />;
        })}
        <path className="tr-mini-chart__line" d={linePath(values)} />
      </svg>
    </div>
  );
}
