import { isWeekendDateKey, moscowTodayKey } from "@/lib/domain/trading-calendar";
import type { SpreadLabHistoryDepth } from "./spread-lab-config";
import { spreadLabSessionCountForDepth } from "./spread-lab-config";
import type { QuadHedgeLegSeries, QuadHedgePricePoint } from "./types";
import {
  collectTradingSessionKeys,
  filterLegsToSessions,
  lastNTradingSessions,
  moscowSessionKeyFromIso,
  type QuadHedgeWindowApplyResult,
} from "./window";

export type SpreadLabSessionExtrema = {
  maxSpreadToday: number | null;
  minSpreadToday: number | null;
  maxSpread7S: number | null;
  minSpread7S: number | null;
  percentile: number | null;
};

/** Обрезка рядов под выбранную глубину (1/3/7 торговых сессий или MAX). */
export function applySpreadLabHistoryDepth(
  legs: QuadHedgeLegSeries[],
  depth: SpreadLabHistoryDepth,
): QuadHedgeWindowApplyResult {
  const allSessionsFound = collectTradingSessionKeys(legs);

  if (!allSessionsFound.length) {
    return { legs, scope: "pick", tradingSessions: [], allSessionsFound: [] };
  }

  if (depth === "MAX") {
    return {
      legs,
      scope: "pick",
      tradingSessions: allSessionsFound,
      allSessionsFound,
    };
  }

  const sessionCount = spreadLabSessionCountForDepth(depth) ?? 1;
  const tradingSessions = lastNTradingSessions(allSessionsFound, sessionCount);

  return {
    legs: filterLegsToSessions(legs, tradingSessions),
    scope: "pick",
    tradingSessions,
    allSessionsFound,
  };
}

function extremaForSessionKeys(
  series: number[],
  timestamps: string[],
  allowed: Set<string>,
): { max: number | null; min: number | null } {
  const values: number[] = [];
  for (let i = 0; i < series.length; i++) {
    const v = series[i]!;
    if (!Number.isFinite(v)) continue;
    const key = moscowSessionKeyFromIso(timestamps[i] ?? "");
    if (key && allowed.has(key)) values.push(v);
  }
  if (!values.length) return { max: null, min: null };
  return { max: Math.max(...values), min: Math.min(...values) };
}

function percentileRank(current: number, values: number[]): number | null {
  if (!values.length || !Number.isFinite(current)) return null;
  const sorted = [...values].sort((a, b) => a - b);
  let below = 0;
  for (const v of sorted) {
    if (v <= current) below++;
  }
  return Math.round((below / sorted.length) * 100);
}

export function sessionKeysFromTimestamps(timestamps: string[]): string[] {
  const keys = new Set<string>();
  for (const ts of timestamps) {
    const key = moscowSessionKeyFromIso(ts);
    if (key && !isWeekendDateKey(key)) keys.add(key);
  }
  return [...keys].sort();
}

/** Экстремумы по сессиям + percentile текущего spread. */
export function calcSpreadSessionExtrema(
  series: number[],
  timestamps: string[],
  allSessionKeys: string[],
): SpreadLabSessionExtrema {
  const finite = series.filter(Number.isFinite);
  if (finite.length < 2) {
    return {
      maxSpreadToday: null,
      minSpreadToday: null,
      maxSpread7S: null,
      minSpread7S: null,
      percentile: null,
    };
  }

  const today = moscowTodayKey();
  const todaySet = new Set([today]);
  const last7 = new Set(lastNTradingSessions(allSessionKeys, 7));

  const todayExt = extremaForSessionKeys(series, timestamps, todaySet);
  const weekExt = extremaForSessionKeys(series, timestamps, last7);
  const current = series[series.length - 1]!;

  return {
    maxSpreadToday: todayExt.max,
    minSpreadToday: todayExt.min,
    maxSpread7S: weekExt.max,
    minSpread7S: weekExt.min,
    percentile: percentileRank(current, finite),
  };
}

export function count5mCandlesInLeg(points: QuadHedgePricePoint[], bucketMinutes = 5): number {
  if (points.length === 0) return 0;
  const bucketMs = bucketMinutes * 60 * 1000;
  const keys = new Set<number>();
  for (const p of points) {
    const ms = Date.parse(p.timestamp);
    if (!Number.isFinite(ms)) continue;
    keys.add(Math.floor(ms / bucketMs) * bucketMs);
  }
  return keys.size;
}

export function spreadLabHistoryInsufficient(
  depth: SpreadLabHistoryDepth,
  sessionsFound: number,
  alignedPoints: number,
  requiredSessions: number,
): boolean {
  if (depth === "MAX") return alignedPoints < 2;
  return sessionsFound < requiredSessions || alignedPoints < 2;
}

export function spreadLabEmptyHistoryMessage(
  depth: SpreadLabHistoryDepth,
  candleCount: number,
): string {
  const label = depth === "MAX" ? "MAX" : depth;
  return `История ${label} недоступна через текущий MOEX ISS запрос. Получено ${candleCount} свечей. Для стабильной истории нужен local collector.`;
}
