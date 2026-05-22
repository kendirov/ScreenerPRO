import type { IntradayCandlePoint } from "@/lib/domain/currency-correlation-intraday";
import {
  getPairConfig,
  type PointsPairKey,
} from "@/lib/domain/currency-pair-config";
import type { AlignedIntradayRow } from "@/lib/domain/currency-intraday-series";

export type TimeSeriesCandle = {
  timestamp: string;
  close: number;
  volume?: number | null;
  value?: number | null;
};

export type LegAlignMeta = {
  originalTimestamp: string;
  forwardFilled: boolean;
  staleMinutes: number;
  volume?: number | null;
};

export type AlignedIntradayRowWithMeta = AlignedIntradayRow & {
  legMeta?: Partial<Record<string, LegAlignMeta>>;
};

export type AlignedPairPoint = {
  timestamp: string;
  leftPrice: number;
  rightPrice: number;
  leftOriginalTimestamp: string;
  rightOriginalTimestamp: string;
  leftIsForwardFilled: boolean;
  rightIsForwardFilled: boolean;
  staleMinutes: number;
  leftVolume?: number | null;
  rightVolume?: number | null;
};

export type PairAlignmentStats = {
  pairKey: PointsPairKey;
  leftInstrument: string;
  rightInstrument: string;
  leftPointCount: number;
  rightPointCount: number;
  alignedCount: number;
  forwardFilledCount: number;
  staleDroppedCount: number;
  maxStaleMinutes: number;
};

export type PairAlignmentResult = {
  rows: AlignedIntradayRowWithMeta[];
  points: AlignedPairPoint[];
  stats: PairAlignmentStats;
};

function parseTs(ts: string): number {
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? ms : NaN;
}

export function maxStaleMinutesForInterval(intervalMinutes: number): number {
  if (intervalMinutes <= 1) return 15;
  if (intervalMinutes <= 5) return 30;
  if (intervalMinutes <= 10) return 60;
  if (intervalMinutes <= 15) return 90;
  return 240;
}

export function candlesFromIntraday(points: IntradayCandlePoint[]): TimeSeriesCandle[] {
  return [...points]
    .filter((p) => Number.isFinite(p.close))
    .map((p) => ({
      timestamp: p.timestamp,
      close: p.close,
      volume: p.volume,
      value: p.value,
    }))
    .sort((a, b) => parseTs(a.timestamp) - parseTs(b.timestamp));
}

/** Последняя свеча с timestamp <= targetMs (forward fill). */
function lastKnownAtOrBefore(
  series: TimeSeriesCandle[],
  targetMs: number,
): { candle: TimeSeriesCandle; index: number } | null {
  if (!series.length || !Number.isFinite(targetMs)) return null;

  let lo = 0;
  let hi = series.length - 1;
  let best: { candle: TimeSeriesCandle; index: number } | null = null;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const ms = parseTs(series[mid]!.timestamp);
    if (!Number.isFinite(ms)) {
      hi = mid - 1;
      continue;
    }
    if (ms <= targetMs) {
      best = { candle: series[mid]!, index: mid };
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return best;
}

function staleMinutes(baseMs: number, legMs: number): number {
  return Math.max(0, (baseMs - legMs) / 60_000);
}

/**
 * Выравнивание двух рядов: базовая шкала = left (более ликвидная нога).
 * Правая нога — last known price <= baseTime; без интерполяции между точками.
 */
export function alignTimeSeriesWithForwardFill(
  leftSeries: TimeSeriesCandle[],
  rightSeries: TimeSeriesCandle[],
  maxStaleMinutes: number,
): { points: AlignedPairPoint[]; forwardFilledCount: number; staleDroppedCount: number } {
  const points: AlignedPairPoint[] = [];
  let forwardFilledCount = 0;
  let staleDroppedCount = 0;

  if (!leftSeries.length || !rightSeries.length) {
    return { points, forwardFilledCount, staleDroppedCount };
  }

  for (const left of leftSeries) {
    const baseMs = parseTs(left.timestamp);
    if (!Number.isFinite(baseMs)) continue;

    const rightHit = lastKnownAtOrBefore(rightSeries, baseMs);
    if (!rightHit) {
      staleDroppedCount++;
      continue;
    }

    const rightMs = parseTs(rightHit.candle.timestamp);
    if (!Number.isFinite(rightMs)) {
      staleDroppedCount++;
      continue;
    }

    const stale = staleMinutes(baseMs, rightMs);
    if (stale > maxStaleMinutes) {
      staleDroppedCount++;
      continue;
    }

    const rightIsForwardFilled = rightMs < baseMs;
    if (rightIsForwardFilled) forwardFilledCount++;

    points.push({
      timestamp: left.timestamp,
      leftPrice: left.close,
      rightPrice: rightHit.candle.close,
      leftOriginalTimestamp: left.timestamp,
      rightOriginalTimestamp: rightHit.candle.timestamp,
      leftIsForwardFilled: false,
      rightIsForwardFilled,
      staleMinutes: stale,
      leftVolume: left.volume,
      rightVolume: rightHit.candle.volume,
    });
  }

  return { points, forwardFilledCount, staleDroppedCount };
}

function intervalToleranceMs(intervalMinutes: number): number {
  return (intervalMinutes * 60 * 1000) / 2;
}

/** Точное совпадение двух ног (±половина интервала), только для debug. */
function alignExactTwoLegs(
  pairKey: PointsPairKey,
  leftKey: string,
  rightKey: string,
  left: IntradayCandlePoint[],
  right: IntradayCandlePoint[],
  intervalMinutes: number,
): PairAlignmentResult {
  const series = {
    [leftKey]: left,
    [rightKey]: right,
  };
  const tolerance = intervalToleranceMs(intervalMinutes);
  const leftSorted = candlesFromIntraday(left);
  const rightSorted = candlesFromIntraday(right);
  const usedRight = new Set<number>();
  const points: AlignedPairPoint[] = [];

  for (const l of leftSorted) {
    const baseMs = parseTs(l.timestamp);
    if (!Number.isFinite(baseMs)) continue;

    let bestIdx = -1;
    let bestDelta = Infinity;
    for (let i = 0; i < rightSorted.length; i++) {
      if (usedRight.has(i)) continue;
      const ms = parseTs(rightSorted[i]!.timestamp);
      if (!Number.isFinite(ms)) continue;
      const delta = Math.abs(ms - baseMs);
      if (delta <= tolerance && delta < bestDelta) {
        bestDelta = delta;
        bestIdx = i;
      }
    }

    if (bestIdx < 0) continue;
    usedRight.add(bestIdx);
    const r = rightSorted[bestIdx]!;
    const rightMs = parseTs(r.timestamp);
    points.push({
      timestamp: l.timestamp,
      leftPrice: l.close,
      rightPrice: r.close,
      leftOriginalTimestamp: l.timestamp,
      rightOriginalTimestamp: r.timestamp,
      leftIsForwardFilled: false,
      rightIsForwardFilled: rightMs < baseMs,
      staleMinutes: staleMinutes(baseMs, rightMs),
      leftVolume: l.volume,
      rightVolume: r.volume,
    });
  }

  return {
    points,
    rows: pairPointsToRows(points, leftKey, rightKey),
    stats: {
      pairKey,
      leftInstrument: leftKey,
      rightInstrument: rightKey,
      leftPointCount: left.length,
      rightPointCount: right.length,
      alignedCount: points.length,
      forwardFilledCount: points.filter((p) => p.rightIsForwardFilled).length,
      staleDroppedCount: 0,
      maxStaleMinutes: maxStaleMinutesForInterval(intervalMinutes),
    },
  };
}

function pairPointsToRows(
  points: AlignedPairPoint[],
  leftKey: string,
  rightKey: string,
): AlignedIntradayRowWithMeta[] {
  return points.map((p) => ({
    timestamp: p.timestamp,
    closes: {
      [leftKey]: p.leftPrice,
      [rightKey]: p.rightPrice,
    },
    legMeta: {
      [leftKey]: {
        originalTimestamp: p.leftOriginalTimestamp,
        forwardFilled: p.leftIsForwardFilled,
        staleMinutes: p.leftIsForwardFilled ? p.staleMinutes : 0,
        volume: p.leftVolume,
      },
      [rightKey]: {
        originalTimestamp: p.rightOriginalTimestamp,
        forwardFilled: p.rightIsForwardFilled,
        staleMinutes: p.staleMinutes,
        volume: p.rightVolume,
      },
    },
  }));
}

export function alignIntradayForPair(
  pairKey: PointsPairKey,
  series: Record<string, IntradayCandlePoint[]>,
  intervalMinutes: number,
): PairAlignmentResult | null {
  const config = getPairConfig(pairKey);
  const leftKey = config.leftInstrument;
  const rightKey = config.rightInstrument;
  const leftRaw = series[leftKey] ?? [];
  const rightRaw = series[rightKey] ?? [];

  if (!leftRaw.length || !rightRaw.length) return null;

  if (config.alignmentMode === "exact") {
    return alignExactTwoLegs(pairKey, leftKey, rightKey, leftRaw, rightRaw, intervalMinutes);
  }

  const maxStale = maxStaleMinutesForInterval(intervalMinutes);
  const left = candlesFromIntraday(leftRaw);
  const right = candlesFromIntraday(rightRaw);
  const { points, forwardFilledCount, staleDroppedCount } = alignTimeSeriesWithForwardFill(
    left,
    right,
    maxStale,
  );

  return {
    points,
    rows: pairPointsToRows(points, leftKey, rightKey),
    stats: {
      pairKey,
      leftInstrument: leftKey,
      rightInstrument: rightKey,
      leftPointCount: leftRaw.length,
      rightPointCount: rightRaw.length,
      alignedCount: points.length,
      forwardFilledCount,
      staleDroppedCount,
      maxStaleMinutes: maxStale,
    },
  };
}

export function insufficientPairAlignmentMessage(
  stats: PairAlignmentStats | null | undefined,
  focusLabel: string,
): string {
  if (!stats) {
    return `Недостаточно синхронизированных точек для ${focusLabel}. Проверьте загрузку обеих ног.`;
  }
  if (stats.alignedCount >= 5) return "";

  const illiquid =
    stats.rightInstrument === "ED" || stats.pairKey.includes("ED")
      ? "ED неликвиден или давно не обновлялся"
      : "вторая нога редко совпадает по времени";

  return (
    `Недостаточно синхронизированных точек (${stats.alignedCount} из ${stats.leftPointCount} свечей ${stats.leftInstrument}). ` +
    `${illiquid}. Попробуйте интервал 10м/15м/60м или период 2д/5д.`
  );
}
