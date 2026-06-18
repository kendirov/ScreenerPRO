/**
 * Dev-диагностика Market Radar — почему бумага попала / не попала в слои.
 * Только для development / debug flag; не влияет на production UI.
 */

import type { ScreenerRow } from "@screenerpro/shared";
import { getMarketRadarReasonLabel, type MarketRadarReasonKey } from "@/lib/domain/market-radar-config";
import { getRadarRowAnalysis } from "@/lib/domain/market-radar-layers";
import {
  buildRadarBoard,
  resolveRadarActivityTag,
  resolveRadarLiquidityTag,
  resolveRadarVolatilityTag,
} from "@/lib/domain/market-radar-selectors";

export const MARKET_RADAR_DEBUG_QUERY_PARAM = "debugRadar";
export const MARKET_RADAR_DEBUG_DEFAULT_LIMIT = 30;

export type MarketRadarDebugRow = {
  ticker: string;
  turnoverRub: number;
  tradesCount: number;
  dayRangePct: number | null;
  changePct: number | null;
  relativeTurnover: number | null;
  relativeTrades: number | null;
  leaderPresenceScore: number;
  movementScore: number;
  baselineScore: number;
  executionScore: number;
  inGameScore: number;
  activityScore: number;
  volatilityScore: number;
  isInGame: boolean;
  isActive: boolean;
  isVolatile: boolean;
  listedLiquidity: boolean;
  listedInPlay: boolean;
  listedActive: boolean;
  listedVolatility: boolean;
  radarTag: string;
  radarReason: MarketRadarReasonKey;
  radarReasonLabel: string;
};

export type MarketRadarDebugSnapshot = {
  generatedAt: string;
  limit: number;
  session: {
    mode: string;
    minTurnover: number;
    minTrades: number;
    turnoverRef: number;
    tradesRef: number;
    sessionIntensity: number | null;
  };
  board: {
    liquidity: string[];
    inPlay: string[];
    active: string[];
    volatility: string[];
  };
  rows: MarketRadarDebugRow[];
};

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function stockRowsOnly(rows: ScreenerRow[]): ScreenerRow[] {
  return rows.filter((row) => row.assetClass === "stock");
}

function resolveRadarTagForRow(
  row: ScreenerRow,
  ctx: ReturnType<typeof buildRadarBoard>["rankCtx"],
  listed: { liquidity: boolean; inPlay: boolean; active: boolean; volatility: boolean },
): string {
  if (listed.inPlay || listed.active) return resolveRadarActivityTag(row, ctx);
  if (listed.volatility) return resolveRadarVolatilityTag(row, ctx);
  if (listed.liquidity) return resolveRadarLiquidityTag();
  const analysis = getRadarRowAnalysis(row, ctx);
  if (analysis.isInGame) return "в игре";
  if (analysis.isActive) return resolveRadarActivityTag(row, ctx);
  if (analysis.isVolatile) return resolveRadarVolatilityTag(row, ctx);
  return "—";
}

export function buildMarketRadarDebugSnapshot(
  universe: ScreenerRow[],
  options?: { limit?: number; candidates?: ScreenerRow[] },
): MarketRadarDebugSnapshot {
  const limit = options?.limit ?? MARKET_RADAR_DEBUG_DEFAULT_LIMIT;
  const candidates = options?.candidates ?? universe;
  const board = buildRadarBoard(universe, candidates);
  const ctx = board.rankCtx;

  const liquiditySet = new Set(board.liquidity.map((row) => row.ticker.toUpperCase()));
  const inPlaySet = new Set(board.inPlay.map((row) => row.ticker.toUpperCase()));
  const activeSet = new Set(board.active.map((row) => row.ticker.toUpperCase()));
  const volatilitySet = new Set(board.volatility.map((row) => row.ticker.toUpperCase()));

  const topRows = [...stockRowsOnly(universe)]
    .sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0))
    .slice(0, Math.max(1, limit));

  const rows: MarketRadarDebugRow[] = topRows.map((row) => {
    const analysis = getRadarRowAnalysis(row, ctx);
    const sessionMetrics = ctx.sessionMetricsByTicker.get(row.ticker);
    const tickerKey = row.ticker.toUpperCase();
    const listed = {
      liquidity: liquiditySet.has(tickerKey),
      inPlay: inPlaySet.has(tickerKey),
      active: activeSet.has(tickerKey),
      volatility: volatilitySet.has(tickerKey),
    };

    return {
      ticker: row.ticker,
      turnoverRub: row.turnover ?? 0,
      tradesCount: row.tradesCount ?? 0,
      dayRangePct: row.metrics.dayRangePct ?? null,
      changePct: row.percentChange ?? null,
      relativeTurnover: sessionMetrics?.relativeTurnover ?? null,
      relativeTrades: sessionMetrics?.relativeTrades ?? null,
      leaderPresenceScore: roundScore(analysis.leaderPresenceScore),
      movementScore: roundScore(analysis.movementScore),
      baselineScore: roundScore(analysis.baselineScore),
      executionScore: roundScore(analysis.executionScore),
      inGameScore: roundScore(analysis.inGameScore),
      activityScore: roundScore(analysis.activityScore),
      volatilityScore: roundScore(analysis.volatilityScore),
      isInGame: analysis.isInGame,
      isActive: analysis.isActive,
      isVolatile: analysis.isVolatile,
      listedLiquidity: listed.liquidity,
      listedInPlay: listed.inPlay,
      listedActive: listed.active,
      listedVolatility: listed.volatility,
      radarTag: resolveRadarTagForRow(row, ctx, listed),
      radarReason: analysis.radarReason,
      radarReasonLabel: getMarketRadarReasonLabel(analysis.radarReason),
    };
  });

  const { session } = ctx;

  return {
    generatedAt: new Date().toISOString(),
    limit,
    session: {
      mode: session.mode,
      minTurnover: session.minTurnover,
      minTrades: session.minTrades,
      turnoverRef: session.turnoverRef,
      tradesRef: session.tradesRef,
      sessionIntensity: session.sessionIntensity,
    },
    board: {
      liquidity: board.liquidity.map((row) => row.ticker),
      inPlay: board.inPlay.map((row) => row.ticker),
      active: board.active.map((row) => row.ticker),
      volatility: board.volatility.map((row) => row.ticker),
    },
    rows,
  };
}

export function isMarketRadarDebugEnabled(searchParam: string | null | undefined): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  if (searchParam == null) return false;
  const normalized = searchParam.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function fingerprintMarketRadarDebugSnapshot(snapshot: MarketRadarDebugSnapshot): string {
  return [
    snapshot.board.inPlay.join(","),
    snapshot.board.active.join(","),
    snapshot.board.volatility.join(","),
    snapshot.rows.map((row) => `${row.ticker}:${row.inGameScore}:${row.isInGame}`).join("|"),
  ].join(";");
}
