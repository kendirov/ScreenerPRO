"use client";

import type { StockSparklineSeries } from "@/lib/domain/stock-sparkline";
import { hasEnoughSparklinePoints } from "@/lib/domain/stock-sparkline";

const WIDTH = 190;
const HEIGHT = 52;
const PRICE_HEIGHT = 38;
const PAD = 2;

function linePath(values: number[], low: number, high: number): string {
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
  compact = false,
}: {
  series: StockSparklineSeries | null | undefined;
  change: number | null | undefined;
  loading: boolean;
  error: boolean;
  unavailableLabel?: string;
  compact?: boolean;
}) {
  const ready = hasEnoughSparklinePoints(series);

  if (loading) return <div className={`tr-mini-chart__state ${compact ? "is-compact" : ""}`}>получаем свечи</div>;
  if (error || !ready) return <div className={`tr-mini-chart__state ${compact ? "is-compact" : ""}`}>{unavailableLabel ?? "свечей нет"}</div>;

  const candles = series?.candles ?? [];
  const sessionKeys = series?.sessionKeys?.length ? series.sessionKeys : ["session"];
  const sessions = sessionKeys.map((key) => {
    const sessionCandles = key === "session" ? candles : candles.filter((candle) => candle.sessionKey === key);
    const first = sessionCandles[0]?.close ?? 1;
    return {
      key,
      candles: sessionCandles,
      values: sessionCandles.map((candle) => ((candle.close - first) / first) * 100),
    };
  }).filter((session) => session.values.length >= 2);
  const allValues = sessions.flatMap((session) => session.values);
  const low = Math.min(...allValues, -0.05);
  const high = Math.max(...allValues, 0.05);
  const currentSession = sessions.at(-1);
  const turnovers = currentSession?.candles.map((candle) => candle.turnover ?? 0) ?? [];
  const maxTurnover = Math.max(...turnovers, 1);
  const step = (WIDTH - PAD * 2) / Math.max(1, (currentSession?.candles.length ?? 1) - 1);
  const tone = (change ?? 0) > 0 ? "is-positive" : (change ?? 0) < 0 ? "is-negative" : "is-neutral";

  return (
    <div className={`tr-mini-chart ${tone} ${compact ? "is-compact" : ""}`}>
      <div className="tr-mini-chart__meta">
        <span className="tr-mini-chart__legend" aria-label="Легенда сессий">
          {sessions.map((session, index) => {
            const distance = sessions.length - 1 - index;
            const label = distance === 0 ? "сегодня" : `−${distance}`;
            return <i className={distance === 0 ? "is-current" : `is-previous-${distance}`} key={session.key}>{label}</i>;
          })}
        </span>
        <span>{series?.interval}м · MOEX</span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Реальный внутридневной график MOEX">
        {currentSession?.candles.map((candle, index) => {
          const turnover = candle.turnover ?? 0;
          if (turnover <= 0) return null;
          const height = Math.max(1, (turnover / maxTurnover) * 9);
          return <rect className="tr-mini-chart__volume" key={`${candle.time}-${index}`} x={PAD + index * step} y={HEIGHT - height} width={Math.max(.8, Math.min(2, step * .55))} height={height} />;
        })}
        {sessions.map((session, index) => (
          <path
            className={`tr-mini-chart__line ${index === sessions.length - 1 ? "is-current" : `is-previous is-previous-${sessions.length - 1 - index}`}`}
            d={linePath(session.values, low, high)}
            key={session.key}
          ><title>{index === sessions.length - 1 ? "Текущая сессия" : `Предыдущая сессия −${sessions.length - 1 - index}`}</title></path>
        ))}
      </svg>
    </div>
  );
}
