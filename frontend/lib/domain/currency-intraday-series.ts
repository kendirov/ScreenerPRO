import type { IntradayCandlePoint } from "@/lib/domain/currency-correlation-intraday";
import {
  calculatePairDivergence,
  DEFAULT_PAIR_Z_WINDOW,
  type DivergenceAnchorOptions,
} from "@/lib/domain/currency-pair-divergence";
import type { PointsPairKey } from "@/lib/domain/currency-pair-config";
export { alignIntradayForPair } from "@/lib/domain/currency-time-series-align";
export type {
  AlignedPairPoint,
  PairAlignmentResult,
  PairAlignmentStats,
} from "@/lib/domain/currency-time-series-align";

export type AlignedIntradayRow = {
  timestamp: string;
  closes: Record<string, number>;
};

export type SpreadEventDirection = "A_above_B" | "B_above_A";

export type SpreadEvent = {
  timestamp: string;
  pair: string;
  spreadPoints: number;
  zScore: number;
  direction: SpreadEventDirection;
  strength: "умеренное" | "сильное";
};

function intervalToleranceMs(intervalMinutes: number): number {
  return (intervalMinutes * 60 * 1000) / 2;
}

function parseTs(ts: string): number {
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? ms : NaN;
}

/**
 * Выравнивание рядов по общим timestamp с допуском ±половина интервала.
 * Не сопоставляет свечи, если ближайшая точка дальше допуска.
 */
export function alignIntradayByTimestamp(
  series: Record<string, IntradayCandlePoint[]>,
  intervalMinutes: number,
): AlignedIntradayRow[] {
  const keys = Object.keys(series).filter((k) => series[k]?.length);
  if (keys.length < 2) return [];

  const tolerance = intervalToleranceMs(intervalMinutes);
  const anchorKey = keys.reduce((best, key) => {
    const len = series[key]?.length ?? 0;
    const bestLen = series[best]?.length ?? 0;
    return len > bestLen ? key : best;
  }, keys[0]!);

  const anchorPoints = [...(series[anchorKey] ?? [])].sort(
    (a, b) => parseTs(a.timestamp) - parseTs(b.timestamp),
  );

  const indexByKey: Record<string, IntradayCandlePoint[]> = {};
  for (const key of keys) {
    indexByKey[key] = [...(series[key] ?? [])].sort(
      (a, b) => parseTs(a.timestamp) - parseTs(b.timestamp),
    );
  }

  const usedIdx: Record<string, Set<number>> = {};
  for (const key of keys) usedIdx[key] = new Set();

  const rows: AlignedIntradayRow[] = [];

  for (const anchor of anchorPoints) {
    const anchorMs = parseTs(anchor.timestamp);
    if (!Number.isFinite(anchorMs)) continue;

    const closes: Record<string, number> = {};
    let matched = 0;

    for (const key of keys) {
      const points = indexByKey[key]!;
      let bestIdx = -1;
      let bestDelta = Infinity;

      for (let i = 0; i < points.length; i++) {
        if (usedIdx[key]!.has(i)) continue;
        const pt = points[i]!;
        const ms = parseTs(pt.timestamp);
        if (!Number.isFinite(ms)) continue;
        const delta = Math.abs(ms - anchorMs);
        if (delta <= tolerance && delta < bestDelta) {
          bestDelta = delta;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0) {
        const pt = points[bestIdx]!;
        if (Number.isFinite(pt.close)) {
          closes[key] = pt.close;
          usedIdx[key]!.add(bestIdx);
          matched++;
        }
      }
    }

    if (matched >= 2) {
      rows.push({ timestamp: anchor.timestamp, closes });
    }
  }

  return rows.sort((a, b) => parseTs(a.timestamp) - parseTs(b.timestamp));
}

/** Движение в пунктах от якоря. */
export function calcPointMoveFromAnchor(
  aligned: AlignedIntradayRow[],
  instrumentKey: string,
  anchorIndex = 0,
): number[] {
  if (!aligned.length) return [];
  const anchorClose = aligned[anchorIndex]!.closes[instrumentKey];
  if (!Number.isFinite(anchorClose)) return [];

  return aligned.map((row) => {
    const close = row.closes[instrumentKey];
    if (!Number.isFinite(close)) return NaN;
    return close - anchorClose!;
  });
}

/** Изменение close за свечу в пунктах. */
export function calcBarPointChange(
  aligned: AlignedIntradayRow[],
  instrumentKey: string,
): number[] {
  let prev: number | null = null;
  const out: number[] = [];

  for (const row of aligned) {
    const close = row.closes[instrumentKey];
    if (!Number.isFinite(close)) {
      out.push(NaN);
      continue;
    }
    if (prev == null) {
      out.push(0);
      prev = close;
      continue;
    }
    out.push(close - prev);
    prev = close;
  }

  return out;
}

/** Спред в пунктах: moveA − hedgeRatio × moveB. */
export function calcPairSpread(
  moveA: number[],
  moveB: number[],
  hedgeRatio = 1,
): number[] {
  const len = Math.min(moveA.length, moveB.length);
  const out: number[] = [];
  for (let i = 0; i < len; i++) {
    const a = moveA[i]!;
    const b = moveB[i]!;
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      out.push(NaN);
      continue;
    }
    out.push(a - hedgeRatio * b);
  }
  return out;
}

/** Скользящий z-score по спреду; при недостатке окна — null. */
export function calcSpreadZScore(
  spread: number[],
  window = 30,
): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < spread.length; i++) {
    if (i + 1 < window) {
      out.push(null);
      continue;
    }
    const slice = spread.slice(i + 1 - window, i + 1).filter(Number.isFinite);
    if (slice.length < window) {
      out.push(null);
      continue;
    }
    const mean = slice.reduce((s, v) => s + v, 0) / slice.length;
    const variance =
      slice.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(slice.length - 1, 1);
    const std = Math.sqrt(variance);
    const current = spread[i]!;
    if (!Number.isFinite(current) || std < 1e-9) {
      out.push(null);
      continue;
    }
    out.push((current - mean) / std);
  }
  return out;
}

export function findSpreadEvents(
  aligned: AlignedIntradayRow[],
  pairKey: PointsPairKey,
  hedgeRatio = 1,
  zWindow = DEFAULT_PAIR_Z_WINDOW,
  zThreshold = 1.5,
  anchorOptions?: DivergenceAnchorOptions,
): SpreadEvent[] {
  const divergence = calculatePairDivergence(
    aligned,
    pairKey,
    hedgeRatio,
    zWindow,
    anchorOptions,
  );
  if (!divergence) return [];

  const { spread, zScores, config } = divergence;
  const events: SpreadEvent[] = [];

  for (let i = 0; i < aligned.length; i++) {
    const z = zScores[i];
    const sp = spread[i];
    if (z == null || !Number.isFinite(z) || !Number.isFinite(sp)) continue;
    const absZ = Math.abs(z);
    if (absZ < zThreshold) continue;

    events.push({
      timestamp: aligned[i]!.timestamp,
      pair: pairKey,
      spreadPoints: sp,
      zScore: z,
      direction: sp >= 0 ? "A_above_B" : "B_above_A",
      strength: absZ >= 2 ? "сильное" : "умеренное",
    });
  }

  return events;
}

/** @deprecated Используйте findSpreadEvents(aligned, pairKey, …) */
export function findSpreadEventsLegacy(
  aligned: AlignedIntradayRow[],
  pairLabel: string,
  keyA: string,
  keyB: string,
  hedgeRatio = 1,
  zWindow = DEFAULT_PAIR_Z_WINDOW,
  zThreshold = 1.5,
): SpreadEvent[] {
  const pairKey = pairLabel as PointsPairKey;
  if (pairKey === "SI/CNY" || pairKey === "SI/ED" || pairKey === "CNY/ED") {
    return findSpreadEvents(aligned, pairKey, hedgeRatio, zWindow, zThreshold);
  }
  const moveA = calcPointMoveFromAnchor(aligned, keyA);
  const moveB = calcPointMoveFromAnchor(aligned, keyB);
  const spread = calcPairSpread(moveA, moveB, hedgeRatio);
  const zScores = calcSpreadZScore(spread, zWindow);
  const events: SpreadEvent[] = [];
  for (let i = 0; i < aligned.length; i++) {
    const z = zScores[i];
    const sp = spread[i];
    if (z == null || !Number.isFinite(z) || !Number.isFinite(sp)) continue;
    if (Math.abs(z) < zThreshold) continue;
    events.push({
      timestamp: aligned[i]!.timestamp,
      pair: pairLabel,
      spreadPoints: sp,
      zScore: z,
      direction: sp >= 0 ? "A_above_B" : "B_above_A",
      strength: Math.abs(z) >= 2 ? "сильное" : "умеренное",
    });
  }
  return events;
}
