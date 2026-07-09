import type { StrategyCandle } from "@/lib/screener/strategies/strategy-candles";

const FIVE_MINUTES_SECONDS = 5 * 60;
const DEFAULT_START_TIME = Math.floor(new Date("2026-07-07T06:00:00+03:00").getTime() / 1000);

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

export function createSyntheticCandles(count = 80): StrategyCandle[] {
  const safeCount = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 80;
  const candles: StrategyCandle[] = [];
  let prevClose = 94.1;

  for (let index = 0; index < safeCount; index += 1) {
    const time = DEFAULT_START_TIME + index * FIVE_MINUTES_SECONDS;
    const direction = index % 2 === 0 ? 1 : -1;
    const drift = Math.sin(index / 5) * 0.08 + Math.cos(index / 9) * 0.05;
    const body = 0.1 + (index % 4) * 0.015;
    const open = roundPrice(prevClose + drift * 0.35);
    const close = roundPrice(open + direction * body);
    const upperWick = 0.05 + (index % 3) * 0.02;
    const lowerWick = 0.04 + ((index + 1) % 3) * 0.02;
    const high = roundPrice(Math.max(open, close) + upperWick);
    const low = roundPrice(Math.min(open, close) - lowerWick);

    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume: 90_000 + index * 1_250,
    });

    prevClose = close;
  }

  return candles;
}
