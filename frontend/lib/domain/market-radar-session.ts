/**
 * Market Radar — sessionContext: режим сессии и относительные метрики vs лидеры рынка.
 */

import type { ScreenerRow } from "@screenerpro/shared";
import {
  isBaselineTradesReliable,
  resolveHonestTradesRatio,
  resolveHonestVolumeRatio,
} from "@/lib/domain/baseline-info";
import { MARKET_RADAR_CONFIG, type RadarSessionMode } from "@/lib/domain/market-radar-config";

const sessionCfg = MARKET_RADAR_CONFIG.session;

export type { RadarSessionMode };

function isBaselineIntradayOk(row: ScreenerRow): boolean {
  return row.metrics.intradayBaselineKind === "intraday-ok" && row.metrics.baselineIsReliable === true;
}

export type RadarSessionContext = {
  mode: RadarSessionMode;
  turnoverRef: number;
  tradesRef: number;
  minTurnover: number;
  minTrades: number;
  sessionIntensity: number | null;
};

export type RadarRowSessionMetrics = {
  relativeTurnover: number;
  relativeTrades: number;
  leaderPresenceScore: number;
};

export type MarketSessionIntensities = {
  turnoverIntensity: number;
  tradesIntensity: number;
};

/** Медиана положительных конечных чисел; пустой массив → null. */
export function medianPositive(values: number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v) && v > 0);
  if (finite.length === 0) return null;
  const sorted = [...finite].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Медиана top-N по убыванию. */
export function medianOfTopDesc(values: number[], topN: number): number | null {
  const finite = values.filter((v) => Number.isFinite(v) && v > 0);
  if (finite.length === 0) return null;
  const top = [...finite].sort((a, b) => b - a).slice(0, topN);
  return medianPositive(top);
}

export function clampRelativeRatio(value: number, max = sessionCfg.relativeClampMax): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, value));
}

export function safeRatio(numerator: number | null | undefined, denominator: number | null | undefined): number | null {
  if (numerator == null || denominator == null || !Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return null;
  }
  if (denominator <= 0) return null;
  return numerator / denominator;
}

export function resolveSessionModeFromIntensity(sessionIntensity: number | null): RadarSessionMode {
  if (sessionIntensity == null || !Number.isFinite(sessionIntensity)) {
    return sessionCfg.defaultMode;
  }
  const t = sessionCfg.modeThresholds;
  if (sessionIntensity < t.quietMax) return "quiet";
  if (sessionIntensity < t.softMax) return "soft";
  if (sessionIntensity <= t.normalMax) return "normal";
  return "hot";
}

export function resolveSessionGateThresholds(mode: RadarSessionMode): {
  minTurnover: number;
  minTrades: number;
} {
  const gate = sessionCfg.gates[mode];
  return { minTurnover: gate.minTurnoverRub, minTrades: gate.minTradesCount };
}

function stockRowsOnly(rows: ScreenerRow[]): ScreenerRow[] {
  return rows.filter((row) => row.assetClass === "stock");
}

function turnoverRub(row: ScreenerRow): number {
  return row.turnover ?? 0;
}

function tradesCount(row: ScreenerRow): number {
  return row.tradesCount ?? 0;
}

/**
 * Same-time baseline по рынку: агрегат current / baseline по бумагам с intraday-ok.
 */
export function computeMarketSessionIntensities(rows: ScreenerRow[]): MarketSessionIntensities | null {
  const stocks = stockRowsOnly(rows);
  let turnoverCurrent = 0;
  let turnoverBaseline = 0;
  let tradesCurrent = 0;
  let tradesBaseline = 0;
  let turnoverContributors = 0;
  let tradesContributors = 0;

  for (const row of stocks) {
    if (!isBaselineIntradayOk(row)) continue;

    const curTurnover = row.metrics.currentTurnoverRub ?? row.turnover;
    const baseTurnover = row.metrics.avgTurnoverAtTimeRub;
    if (curTurnover != null && baseTurnover != null && baseTurnover > 0 && Number.isFinite(curTurnover)) {
      turnoverCurrent += curTurnover;
      turnoverBaseline += baseTurnover;
      turnoverContributors += 1;
    }

    const curTrades = row.tradesCount;
    const baseTrades = row.metrics.avgTradesAtTimeRub;
    if (curTrades != null && baseTrades != null && baseTrades > 0 && Number.isFinite(curTrades) && curTrades > 0) {
      tradesCurrent += curTrades;
      tradesBaseline += baseTrades;
      tradesContributors += 1;
    }
  }

  const turnoverIntensity = safeRatio(turnoverCurrent, turnoverBaseline);
  const tradesIntensity = safeRatio(tradesCurrent, tradesBaseline);

  if (turnoverContributors === 0 || turnoverIntensity == null || tradesContributors === 0 || tradesIntensity == null) {
    return null;
  }

  return { turnoverIntensity, tradesIntensity };
}

/** Fallback: медиана honest ratios, если агрегат baseline по полям недоступен. */
export function computeMarketSessionIntensitiesFromRatios(rows: ScreenerRow[]): MarketSessionIntensities | null {
  const stocks = stockRowsOnly(rows);
  const turnoverRatios: number[] = [];
  const tradesRatios: number[] = [];

  for (const row of stocks) {
    if (isBaselineIntradayOk(row)) {
      const vol = resolveHonestVolumeRatio(row);
      if (vol != null) turnoverRatios.push(vol);
    }
    if (isBaselineTradesReliable(row)) {
      const tr = resolveHonestTradesRatio(row);
      if (tr != null) tradesRatios.push(tr);
    }
  }

  const turnoverIntensity = medianPositive(turnoverRatios);
  const tradesIntensity = medianPositive(tradesRatios);
  if (turnoverIntensity == null || tradesIntensity == null) return null;
  return { turnoverIntensity, tradesIntensity };
}

export function computeSessionIntensity(intensities: MarketSessionIntensities | null): number | null {
  if (intensities == null) return null;
  const w = sessionCfg.intensityWeights;
  const value = intensities.turnoverIntensity * w.turnover + intensities.tradesIntensity * w.trades;
  return Number.isFinite(value) ? value : null;
}

export function resolveTurnoverRef(rows: ScreenerRow[]): number {
  return medianOfTopDesc(
    stockRowsOnly(rows).map(turnoverRub),
    sessionCfg.turnoverRefTopN,
  ) ?? 0;
}

export function resolveTradesRef(rows: ScreenerRow[]): number {
  return medianOfTopDesc(
    stockRowsOnly(rows).map(tradesCount),
    sessionCfg.tradesRefTopN,
  ) ?? 0;
}

export function buildRadarSessionContext(universe: ScreenerRow[]): RadarSessionContext {
  const intensities =
    computeMarketSessionIntensities(universe) ?? computeMarketSessionIntensitiesFromRatios(universe);
  const sessionIntensity = computeSessionIntensity(intensities);
  const mode = resolveSessionModeFromIntensity(sessionIntensity);
  const { minTurnover, minTrades } = resolveSessionGateThresholds(mode);

  return {
    mode,
    turnoverRef: resolveTurnoverRef(universe),
    tradesRef: resolveTradesRef(universe),
    minTurnover,
    minTrades,
    sessionIntensity,
  };
}

export function computeRadarRowSessionMetrics(
  row: ScreenerRow,
  session: RadarSessionContext,
): RadarRowSessionMetrics {
  const { turnoverRef, tradesRef } = session;
  if (turnoverRef <= 0 || tradesRef <= 0) {
    return { relativeTurnover: 0, relativeTrades: 0, leaderPresenceScore: 0 };
  }

  const relativeTurnover = clampRelativeRatio(safeRatio(turnoverRub(row), turnoverRef) ?? 0);
  const relativeTrades = clampRelativeRatio(safeRatio(tradesCount(row), tradesRef) ?? 0);
  const w = sessionCfg.leaderPresenceWeights;
  const leaderPresenceScore = relativeTurnover * w.turnover + relativeTrades * w.trades;

  return {
    relativeTurnover,
    relativeTrades,
    leaderPresenceScore: Number.isFinite(leaderPresenceScore) ? leaderPresenceScore : 0,
  };
}

export function buildRadarRowSessionMetricsMap(
  universe: ScreenerRow[],
  session: RadarSessionContext,
): Map<string, RadarRowSessionMetrics> {
  const map = new Map<string, RadarRowSessionMetrics>();
  for (const row of stockRowsOnly(universe)) {
    map.set(row.ticker, computeRadarRowSessionMetrics(row, session));
  }
  return map;
}
