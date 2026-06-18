/**
 * Market Radar — ранги, score, отбор слоёв (Ликвидность / Активность / Волатильность).
 */

import type { ScreenerRow } from "@screenerpro/shared";
import {
  isBaselineTradesReliable,
  isBaselineVolumeReliable,
  resolveHonestTradesRatio,
  resolveHonestVolumeRatio,
} from "@/lib/domain/baseline-info";
import { MARKET_RADAR_CONFIG, type MarketRadarReasonKey } from "@/lib/domain/market-radar-config";
import {
  buildRadarRowSessionMetricsMap,
  buildRadarSessionContext,
  computeRadarRowSessionMetrics,
  type RadarRowSessionMetrics,
  type RadarSessionContext,
} from "@/lib/domain/market-radar-session";
import { RADAR_ROW_TAG } from "@/lib/domain/radar-ui-labels";
import { computePositionInRange } from "@/lib/domain/stock-sparkline";

const { liquidity: liqCfg, activity: actCfg, volatility: volCfg, scoring: scoreCfg, structure } =
  MARKET_RADAR_CONFIG;

export const NO_RANK = 9999;

export type ActivityTier = "in-game" | "active" | "none";
export type VolatilityTier = "tradable" | "thin" | "none";

export type PriceStructureFlags = {
  position: number | null;
  nearHigh: boolean;
  nearLow: boolean;
  breakoutHigh: boolean;
  breakoutLow: boolean;
  nearHighAfterMove: boolean;
  nearLowAfterMove: boolean;
  nearHighAfterStrongMove: boolean;
  nearLowAfterStrongMove: boolean;
};

export type RadarRowAnalysis = {
  liquidityScore: number;
  movementScore: number;
  executionScore: number;
  baselineScore: number;
  inGameScore: number;
  activityScore: number;
  volatilityScore: number;
  leaderPresenceScore: number;
  isInGame: boolean;
  isActive: boolean;
  isVolatile: boolean;
  activityTier: ActivityTier;
  volatilityTier: VolatilityTier;
  radarReason: MarketRadarReasonKey;
  radarTags: string[];
};

export type RadarRankContext = {
  total: number;
  maxTurnover: number;
  turnoverRank: Map<string, number>;
  tradesRank: Map<string, number>;
  rangeRank: Map<string, number>;
  absChangeRank: Map<string, number>;
  volumeRatioRank: Map<string, number>;
  volumeRatioRankedTotal: number;
  inPlayTickerSet: Set<string>;
  session: RadarSessionContext;
  sessionMetricsByTicker: Map<string, RadarRowSessionMetrics>;
  analysisByTicker: Map<string, RadarRowAnalysis>;
};

export type RadarLayerScores = {
  inPlayScore: number;
  activeScore: number;
  shotScore: number;
  structureScore: number;
};

export function finitePositive(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function scaleLinear(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || max <= min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function absDayRangePct(row: ScreenerRow): number {
  const v = row.metrics.dayRangePct;
  if (v == null || !Number.isFinite(v)) return 0;
  return Math.abs(v);
}

export function absChangePct(row: ScreenerRow): number {
  const v = row.percentChange;
  if (v == null || !Number.isFinite(v)) return 0;
  return Math.abs(v);
}

export function safeVolumeRatioNow(row: ScreenerRow): number | null {
  return resolveHonestVolumeRatio(row);
}

export function safeTradesRatioNow(row: ScreenerRow): number | null {
  return resolveHonestTradesRatio(row);
}

export function hasVolumeBaselineGap(row: ScreenerRow): boolean {
  return !isBaselineVolumeReliable(row);
}

export function isBaselineIntradayOk(row: ScreenerRow): boolean {
  return row.metrics.intradayBaselineKind === "intraday-ok" && row.metrics.baselineIsReliable === true;
}

export function resolveSpreadPct(row: ScreenerRow): number | null {
  const raw = (row.metrics as { spreadPct?: unknown }).spreadPct;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return null;
  return raw;
}

export function rankScore(rank: number, total: number): number {
  if (rank >= NO_RANK || total <= 0) return 50;
  if (total === 1) return 100;
  return 100 * (1 - (rank - 1) / Math.max(total - 1, 1));
}

function rankOf(map: Map<string, number>, ticker: string): number {
  return map.get(ticker) ?? NO_RANK;
}

function buildDescRankMap(
  rows: ScreenerRow[],
  valueFn: (row: ScreenerRow) => number | null,
): { map: Map<string, number>; rankedTotal: number } {
  const ranked = rows
    .map((row) => ({ row, value: valueFn(row) }))
    .filter((item) => item.value != null && Number.isFinite(item.value))
    .sort((a, b) => b.value! - a.value!);

  const map = new Map<string, number>();
  ranked.forEach((item, index) => map.set(item.row.ticker, index + 1));
  return { map, rankedTotal: ranked.length };
}

function spreadQualityScore(spreadPct: number | null): number {
  if (spreadPct == null) return 50;
  return Math.max(0, Math.min(100, 100 - (spreadPct / 0.5) * 50));
}

function turnoverRub(row: ScreenerRow): number {
  return row.turnover ?? 0;
}

function tradesCount(row: ScreenerRow): number {
  return row.tradesCount ?? 0;
}

function hasNormalTurnoverTrades(row: ScreenerRow, session: RadarSessionContext): boolean {
  return turnoverRub(row) >= session.minTurnover && tradesCount(row) >= session.minTrades;
}

export function evaluatePriceStructure(row: ScreenerRow): PriceStructureFlags {
  const position = computePositionInRange(row.lastPrice, row.low, row.high);
  const change = row.percentChange ?? 0;
  const near = structure.nearExtremePosition;

  const nearHigh = position != null && position >= near;
  const nearLow = position != null && position <= 1 - near;
  const breakoutHigh = nearHigh && change >= structure.breakoutMinChangePct;
  const breakoutLow = nearLow && change <= -structure.breakoutMinChangePct;
  const nearHighAfterMove = nearHigh && change >= structure.inPlayNearHighMinChangePct;
  const nearLowAfterMove = nearLow && change <= structure.inPlayNearLowMaxChangePct;
  const nearHighAfterStrongMove = nearHigh && change >= structure.shotsNearHighMinChangePct;
  const nearLowAfterStrongMove = nearLow && change <= structure.shotsNearLowMaxChangePct;

  return {
    position,
    nearHigh,
    nearLow,
    breakoutHigh,
    breakoutLow,
    nearHighAfterMove,
    nearLowAfterMove,
    nearHighAfterStrongMove,
    nearLowAfterStrongMove,
  };
}

export function structureScoreFromFlags(price: PriceStructureFlags): number {
  if (price.breakoutHigh || price.breakoutLow) return 100;
  if (price.nearHighAfterMove || price.nearLowAfterMove) return 75;
  return 0;
}

export function hasInPlayStructure(price: PriceStructureFlags): boolean {
  return price.breakoutHigh || price.breakoutLow || price.nearHighAfterMove || price.nearLowAfterMove;
}

function edgeScoreFromFlags(price: PriceStructureFlags): number {
  return price.nearHigh || price.nearLow ? 1 : 0;
}

function breakoutBinaryScore(price: PriceStructureFlags): number {
  return price.breakoutHigh || price.breakoutLow ? 1 : 0;
}

export function computeMovementScore(row: ScreenerRow, price: PriceStructureFlags): number {
  const m = scoreCfg.movement;
  const rangeScore = scaleLinear(absDayRangePct(row), m.rangeScale.min, m.rangeScale.max);
  const absChangeScore = scaleLinear(absChangePct(row), m.absChangeScale.min, m.absChangeScale.max);
  const edgeScore = edgeScoreFromFlags(price);
  const breakoutScore = breakoutBinaryScore(price);
  const score =
    rangeScore * m.weights.range +
    absChangeScore * m.weights.absChange +
    edgeScore * m.weights.edge +
    breakoutScore * m.weights.breakout;
  return Number.isFinite(score) ? score : 0;
}

export function computeExecutionScore(row: ScreenerRow, session: RadarSessionContext): number {
  const e = scoreCfg.execution;
  const spread = resolveSpreadPct(row);
  if (spread == null) {
    return hasNormalTurnoverTrades(row, session) ? e.scoreNoSpreadNormal : e.scorePoor;
  }
  if (spread <= e.spreadExcellent) return e.scoreExcellent;
  if (spread <= e.spreadGood) return e.scoreGood;
  if (spread <= e.spreadFair) return e.scoreFair;
  return e.scorePoor;
}

export function computeBaselineScore(row: ScreenerRow): number {
  const vol = safeVolumeRatioNow(row);
  const trd = safeTradesRatioNow(row);
  if (vol == null || trd == null) return scoreCfg.baseline.missingScore;

  const b = scoreCfg.baseline;
  const volScore = scaleLinear(vol, b.ratioScale.min, b.ratioScale.max);
  const trdScore = scaleLinear(trd, b.ratioScale.min, b.ratioScale.max);
  return volScore * b.weights.volumeRatio + trdScore * b.weights.tradesRatio;
}

export function computeVolatilityComponentScore(row: ScreenerRow, price: PriceStructureFlags): number {
  const v = scoreCfg.volatility;
  const rangeScore = scaleLinear(absDayRangePct(row), scoreCfg.movement.rangeScale.min, scoreCfg.movement.rangeScale.max);
  const absChangeScore = scaleLinear(absChangePct(row), scoreCfg.movement.absChangeScale.min, scoreCfg.movement.absChangeScale.max);
  const edgeScore = edgeScoreFromFlags(price);
  const breakoutScore = breakoutBinaryScore(price);
  const score =
    rangeScore * v.weights.range +
    absChangeScore * v.weights.absChange +
    edgeScore * v.weights.edge +
    breakoutScore * v.weights.breakout;
  return Number.isFinite(score) ? score : 0;
}

export function computeLiquidityScore(row: ScreenerRow, ctx: RadarRankContext): number {
  const w = liqCfg.scoreWeights;
  const turnoverRs = rankScore(rankOf(ctx.turnoverRank, row.ticker), ctx.total);
  const tradesRs = rankScore(rankOf(ctx.tradesRank, row.ticker), ctx.total);
  const spreadRs = spreadQualityScore(resolveSpreadPct(row));
  const score = turnoverRs * w.turnover + tradesRs * w.trades + spreadRs * w.spread;
  return Number.isFinite(score) ? score : 0;
}

export function computeInGameScore(
  leaderPresenceScore: number,
  movementScore: number,
  baselineScore: number,
): number {
  const w = scoreCfg.inGame.weights;
  return leaderPresenceScore * w.leaderPresence + movementScore * w.movement + baselineScore * w.baseline;
}

export function computeActivityCompositeScore(
  leaderPresenceScore: number,
  movementScore: number,
  baselineScore: number,
  executionScore: number,
): number {
  const w = scoreCfg.activity.weights;
  return (
    leaderPresenceScore * w.leaderPresence +
    baselineScore * w.baseline +
    movementScore * w.movement +
    executionScore * w.execution
  );
}

function passesLiquidityGate(row: ScreenerRow): boolean {
  return turnoverRub(row) > 0 && tradesCount(row) > 0;
}

function isVolatilityThin(row: ScreenerRow): boolean {
  const t = volCfg.thin;
  return turnoverRub(row) < t.maxTurnoverRub || tradesCount(row) < t.maxTradesCount;
}

function isActivityThin(row: ScreenerRow): boolean {
  return isVolatilityThin(row);
}

function passesVolatileGate(row: ScreenerRow, price: PriceStructureFlags): boolean {
  const g = volCfg.gate;
  return (
    absDayRangePct(row) >= g.minDayRangePct ||
    absChangePct(row) >= g.minAbsChangePct ||
    price.nearHigh ||
    price.nearLow ||
    price.breakoutHigh ||
    price.breakoutLow
  );
}

function resolveRadarTags(
  row: ScreenerRow,
  price: PriceStructureFlags,
  activityTier: ActivityTier,
  volatilityTier: VolatilityTier,
  baselineScore: number,
): string[] {
  const tags: string[] = [];
  const vol = safeVolumeRatioNow(row);
  const trd = safeTradesRatioNow(row);
  if (vol == null || trd == null || baselineScore === scoreCfg.baseline.missingScore) {
    tags.push(RADAR_ROW_TAG.noBaseline);
  }
  if (volatilityTier === "thin") tags.push(RADAR_ROW_TAG.thin);
  if (activityTier === "in-game") tags.push(RADAR_ROW_TAG.inPlay);
  else if (activityTier === "active") tags.push(RADAR_ROW_TAG.active);
  if (price.breakoutHigh) tags.push(RADAR_ROW_TAG.breakoutHigh);
  else if (price.breakoutLow) tags.push(RADAR_ROW_TAG.breakoutLow);
  else if (price.nearHigh) tags.push(RADAR_ROW_TAG.high);
  else if (price.nearLow) tags.push(RADAR_ROW_TAG.low);
  else if (absDayRangePct(row) >= volCfg.gate.minDayRangePct) tags.push(RADAR_ROW_TAG.range);
  return [...new Set(tags)];
}

function resolveRadarReasonKeysInternal(
  row: ScreenerRow,
  ctx: RadarRankContext,
  price: PriceStructureFlags,
): MarketRadarReasonKey[] {
  const keys: MarketRadarReasonKey[] = [];
  const volRatio = safeVolumeRatioNow(row);
  const tradesRatio = safeTradesRatioNow(row);
  const change = row.percentChange ?? 0;
  const session = ctx.session;

  if (volRatio == null || tradesRatio == null) keys.push("noBaseline");
  if (rankOf(ctx.turnoverRank, row.ticker) <= 15 || turnoverRub(row) >= session.minTurnover) {
    keys.push("liquidity");
  }
  if (rankOf(ctx.tradesRank, row.ticker) <= 15 || tradesCount(row) >= session.minTrades) {
    keys.push("manyTrades");
  }
  if (volRatio != null && volRatio >= 1.8) keys.push("volumeRatio");
  if (tradesRatio != null && tradesRatio >= 1.8) keys.push("tradesRatio");
  if (absDayRangePct(row) >= volCfg.gate.minDayRangePct) keys.push("wideRange");
  if (change >= scoreCfg.movement.absChangeScale.min) keys.push("impulseUp");
  if (change <= -scoreCfg.movement.absChangeScale.min) keys.push("impulseDown");
  if (price.breakoutHigh) keys.push("breakoutHigh");
  if (price.breakoutLow) keys.push("breakoutLow");
  if (price.nearHigh) keys.push("nearHigh");
  if (price.nearLow) keys.push("nearLow");

  return [...new Set(keys)];
}

function resolvePrimaryReasonKeyInternal(
  row: ScreenerRow,
  ctx: RadarRankContext,
  price: PriceStructureFlags,
): MarketRadarReasonKey {
  const keys = resolveRadarReasonKeysInternal(row, ctx, price);
  const priority: MarketRadarReasonKey[] = [
    "breakoutHigh",
    "breakoutLow",
    "nearHigh",
    "nearLow",
    "impulseUp",
    "impulseDown",
    "wideRange",
    "volumeRatio",
    "tradesRatio",
    "manyTrades",
    "liquidity",
    "noBaseline",
    "activity",
  ];
  for (const key of priority) {
    if (keys.includes(key)) return key;
  }
  return "activity";
}

export function analyzeRadarRow(row: ScreenerRow, ctx: RadarRankContext): RadarRowAnalysis {
  const price = evaluatePriceStructure(row);
  const session = ctx.session;
  const sessionMetrics =
    ctx.sessionMetricsByTicker.get(row.ticker) ??
    computeRadarRowSessionMetrics(row, session);
  const leaderPresenceScore = sessionMetrics.leaderPresenceScore;

  const movementScore = computeMovementScore(row, price);
  const executionScore = computeExecutionScore(row, session);
  const baselineScore = computeBaselineScore(row);
  const inGameScore = computeInGameScore(leaderPresenceScore, movementScore, baselineScore);
  const activityScore = computeActivityCompositeScore(
    leaderPresenceScore,
    movementScore,
    baselineScore,
    executionScore,
  );
  const volatilityScore = computeVolatilityComponentScore(row, price);
  const liquidityScore = computeLiquidityScore(row, ctx);

  const ig = scoreCfg.inGame;
  const isInGame =
    inGameScore >= ig.minScore &&
    leaderPresenceScore >= ig.minLeaderPresence &&
    movementScore >= ig.minMovement &&
    turnoverRub(row) >= session.minTurnover &&
    tradesCount(row) >= session.minTrades;

  const ac = scoreCfg.activity;
  const isActive =
    !isInGame &&
    !isActivityThin(row) &&
    activityScore >= ac.minScore &&
    movementScore >= ac.minMovement &&
    leaderPresenceScore >= ac.minLeaderPresence &&
    turnoverRub(row) >= session.minTurnover * ac.gateTurnoverRatio &&
    tradesCount(row) >= session.minTrades * ac.gateTradesRatio;

  const isVolatile = passesVolatileGate(row, price);

  let activityTier: ActivityTier = "none";
  if (isInGame) activityTier = "in-game";
  else if (isActive) activityTier = "active";

  let volatilityTier: VolatilityTier = "none";
  if (isVolatile) {
    volatilityTier = isVolatilityThin(row) ? "thin" : "tradable";
  }

  const radarReason = resolvePrimaryReasonKeyInternal(row, ctx, price);
  const radarTags = resolveRadarTags(row, price, activityTier, volatilityTier, baselineScore);

  return {
    liquidityScore,
    movementScore,
    executionScore,
    baselineScore,
    inGameScore,
    activityScore,
    volatilityScore,
    leaderPresenceScore,
    isInGame,
    isActive,
    isVolatile,
    activityTier,
    volatilityTier,
    radarReason,
    radarTags,
  };
}

/** @deprecated используйте computeActivityCompositeScore */
export function computeActivityScore(row: ScreenerRow, ctx: RadarRankContext): number {
  return ctx.analysisByTicker.get(row.ticker)?.activityScore ?? analyzeRadarRow(row, ctx).activityScore;
}

export function computeVolatilityScore(row: ScreenerRow, ctx: RadarRankContext): number {
  return ctx.analysisByTicker.get(row.ticker)?.volatilityScore ?? analyzeRadarRow(row, ctx).volatilityScore;
}

export function computeLayerScores(row: ScreenerRow, ctx: RadarRankContext): RadarLayerScores {
  const analysis = ctx.analysisByTicker.get(row.ticker) ?? analyzeRadarRow(row, ctx);
  const price = evaluatePriceStructure(row);
  return {
    inPlayScore: analysis.inGameScore,
    activeScore: analysis.activityScore,
    shotScore: analysis.volatilityScore,
    structureScore: structureScoreFromFlags(price),
  };
}

export function compareRadarTickerTiebreak(a: ScreenerRow, b: ScreenerRow): number {
  return a.ticker.localeCompare(b.ticker, "ru");
}

export function dedupeRadarRowsByTicker(rows: ScreenerRow[]): ScreenerRow[] {
  const seen = new Set<string>();
  const out: ScreenerRow[] = [];
  for (const row of rows) {
    const key = row.ticker.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function stockRowsOnly(rows: ScreenerRow[]): ScreenerRow[] {
  return rows.filter((row) => row.assetClass === "stock");
}

export function buildRadarRankContext(universe: ScreenerRow[]): RadarRankContext {
  const stocks = dedupeRadarRowsByTicker(stockRowsOnly(universe));
  const total = stocks.length;
  const maxTurnover = stocks.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0);
  const session = buildRadarSessionContext(universe);
  const sessionMetricsByTicker = buildRadarRowSessionMetricsMap(stocks, session);

  const turnover = buildDescRankMap(stocks, (row) => finitePositive(row.turnover));
  const trades = buildDescRankMap(stocks, (row) => finitePositive(row.tradesCount));
  const range = buildDescRankMap(stocks, (row) => {
    const v = row.metrics.dayRangePct;
    return v != null && Number.isFinite(v) ? Math.abs(v) : null;
  });
  const absChange = buildDescRankMap(stocks, (row) => absChangePct(row) || null);
  const volumeRatio = buildDescRankMap(stocks, (row) => {
    const r = safeVolumeRatioNow(row);
    return r != null && isBaselineVolumeReliable(row) ? r : null;
  });

  const baseCtx: RadarRankContext = {
    total,
    maxTurnover,
    turnoverRank: turnover.map,
    tradesRank: trades.map,
    rangeRank: range.map,
    absChangeRank: absChange.map,
    volumeRatioRank: volumeRatio.map,
    volumeRatioRankedTotal: volumeRatio.rankedTotal,
    inPlayTickerSet: new Set(),
    session,
    sessionMetricsByTicker,
    analysisByTicker: new Map(),
  };

  for (const row of stocks) {
    baseCtx.analysisByTicker.set(row.ticker, analyzeRadarRow(row, baseCtx));
  }

  const inGameRows = selectInPlayVisibleRows(stocks, baseCtx);
  baseCtx.inPlayTickerSet = new Set(inGameRows.map((r) => r.ticker.toUpperCase()));
  return baseCtx;
}

export function selectLiquidityVisibleRows(rows: ScreenerRow[], ctx: RadarRankContext): ScreenerRow[] {
  return dedupeRadarRowsByTicker(stockRowsOnly(rows))
    .filter((row) => passesLiquidityGate(row))
    .map((row) => ({
      row,
      score: ctx.analysisByTicker.get(row.ticker)?.liquidityScore ?? computeLiquidityScore(row, ctx),
    }))
    .sort((a, b) => {
      const diff = b.score - a.score;
      return diff !== 0 ? diff : compareRadarTickerTiebreak(a.row, b.row);
    })
    .map((item) => item.row)
    .slice(0, liqCfg.topN);
}

export function selectInPlayVisibleRows(rows: ScreenerRow[], ctx: RadarRankContext): ScreenerRow[] {
  return dedupeRadarRowsByTicker(stockRowsOnly(rows))
    .filter((row) => ctx.analysisByTicker.get(row.ticker)?.isInGame ?? false)
    .map((row) => ({
      row,
      score: ctx.analysisByTicker.get(row.ticker)?.inGameScore ?? 0,
    }))
    .sort((a, b) => {
      const diff = b.score - a.score;
      return diff !== 0 ? diff : compareRadarTickerTiebreak(a.row, b.row);
    })
    .map((item) => item.row);
}

export function countInPlayCandidates(rows: ScreenerRow[], ctx: RadarRankContext): number {
  return selectInPlayVisibleRows(rows, ctx).length;
}

export function selectActiveCandidates(rows: ScreenerRow[], ctx: RadarRankContext): ScreenerRow[] {
  const inPlayTickers = ctx.inPlayTickerSet;
  return dedupeRadarRowsByTicker(stockRowsOnly(rows))
    .filter((row) => {
      const analysis = ctx.analysisByTicker.get(row.ticker);
      return analysis?.isActive === true && !inPlayTickers.has(row.ticker.toUpperCase());
    })
    .map((row) => ({
      row,
      score: ctx.analysisByTicker.get(row.ticker)?.activityScore ?? 0,
    }))
    .sort((a, b) => {
      const diff = b.score - a.score;
      return diff !== 0 ? diff : compareRadarTickerTiebreak(a.row, b.row);
    })
    .map((item) => item.row);
}

export function selectActivityVisibleRows(rows: ScreenerRow[], ctx: RadarRankContext): ScreenerRow[] {
  const inGame = selectInPlayVisibleRows(rows, ctx);
  const inGameTickers = new Set(inGame.map((r) => r.ticker.toUpperCase()));
  const active = selectActiveCandidates(rows, ctx).filter((r) => !inGameTickers.has(r.ticker.toUpperCase()));
  return [...inGame, ...active].slice(0, actCfg.maxVisible);
}

export function selectActiveVisibleRows(rows: ScreenerRow[], ctx: RadarRankContext): ScreenerRow[] {
  return selectActivityVisibleRows(rows, ctx).filter(
    (row) => !ctx.inPlayTickerSet.has(row.ticker.toUpperCase()),
  );
}

export function selectShotsVisibleRows(rows: ScreenerRow[], ctx: RadarRankContext): ScreenerRow[] {
  return dedupeRadarRowsByTicker(stockRowsOnly(rows))
    .filter((row) => ctx.analysisByTicker.get(row.ticker)?.isVolatile ?? false)
    .map((row) => ({
      row,
      score: ctx.analysisByTicker.get(row.ticker)?.volatilityScore ?? 0,
    }))
    .sort((a, b) => {
      const diff = b.score - a.score;
      return diff !== 0 ? diff : compareRadarTickerTiebreak(a.row, b.row);
    })
    .map((item) => item.row)
    .slice(0, volCfg.maxVisible);
}

export function resolveRadarReasonKeys(row: ScreenerRow, ctx: RadarRankContext): MarketRadarReasonKey[] {
  return resolveRadarReasonKeysInternal(row, ctx, evaluatePriceStructure(row));
}

export function resolvePrimaryReasonKey(row: ScreenerRow, ctx: RadarRankContext): MarketRadarReasonKey {
  const cached = ctx.analysisByTicker.get(row.ticker)?.radarReason;
  if (cached) return cached;
  return resolvePrimaryReasonKeyInternal(row, ctx, evaluatePriceStructure(row));
}

function buildMinimalCtx(row: ScreenerRow, maxTurnover: number): RadarRankContext {
  const session = buildRadarSessionContext([row]);
  return {
    total: 1,
    maxTurnover,
    turnoverRank: new Map([[row.ticker, 1]]),
    tradesRank: new Map([[row.ticker, 1]]),
    rangeRank: new Map([[row.ticker, 1]]),
    absChangeRank: new Map([[row.ticker, 1]]),
    volumeRatioRank: new Map(),
    volumeRatioRankedTotal: 0,
    inPlayTickerSet: new Set(),
    session,
    sessionMetricsByTicker: buildRadarRowSessionMetricsMap([row], session),
    analysisByTicker: new Map(),
  };
}

export function isTradableLiquid(row: ScreenerRow, maxTurnover: number): boolean {
  const ctx = buildMinimalCtx(row, maxTurnover);
  const analysis = analyzeRadarRow(row, ctx);
  return analysis.isInGame || analysis.isActive;
}

export function isInPlayCandidate(row: ScreenerRow, ctx: RadarRankContext): boolean {
  return ctx.analysisByTicker.get(row.ticker)?.isInGame ?? false;
}

export function isActiveCandidate(row: ScreenerRow, ctx: RadarRankContext): boolean {
  const tier = ctx.analysisByTicker.get(row.ticker)?.activityTier;
  return tier === "active" || tier === "in-game";
}

export function isShotsCandidate(row: ScreenerRow, ctx: RadarRankContext): boolean {
  return ctx.analysisByTicker.get(row.ticker)?.isVolatile ?? false;
}

export function computeInPlaySortScore(row: ScreenerRow, ctx: RadarRankContext): number {
  return ctx.analysisByTicker.get(row.ticker)?.inGameScore ?? 0;
}

export function computeActiveScore(row: ScreenerRow, ctx: RadarRankContext): number {
  return ctx.analysisByTicker.get(row.ticker)?.activityScore ?? 0;
}

export function computeShotScore(row: ScreenerRow, ctx: RadarRankContext): number {
  return ctx.analysisByTicker.get(row.ticker)?.volatilityScore ?? 0;
}

export function passesInPlayLayer(row: ScreenerRow, ctx: RadarRankContext, _maxTurnover?: number): boolean {
  return isInPlayCandidate(row, ctx);
}

export function passesActiveLayer(
  row: ScreenerRow,
  ctx: RadarRankContext,
  _maxTurnover: number,
  isInPlay: boolean,
): boolean {
  if (isInPlay) return false;
  return ctx.analysisByTicker.get(row.ticker)?.isActive ?? false;
}

export function passesShotsLayer(row: ScreenerRow, ctx: RadarRankContext, _maxTurnover?: number): boolean {
  return isShotsCandidate(row, ctx);
}

export function resolveInPlayLayerReasonKey(row: ScreenerRow, ctx: RadarRankContext): MarketRadarReasonKey {
  return resolvePrimaryReasonKey(row, ctx);
}

export function resolveActiveLayerReasonKey(row: ScreenerRow, ctx: RadarRankContext): MarketRadarReasonKey {
  return resolvePrimaryReasonKey(row, ctx);
}

export function resolveShotsLayerReasonKey(row: ScreenerRow, ctx: RadarRankContext): MarketRadarReasonKey {
  return resolvePrimaryReasonKey(row, ctx);
}

export function turnoverRankOf(ctx: RadarRankContext, row: ScreenerRow): number {
  return rankOf(ctx.turnoverRank, row.ticker);
}

export function tradesRankOf(ctx: RadarRankContext, row: ScreenerRow): number {
  return rankOf(ctx.tradesRank, row.ticker);
}

export function getRadarRowAnalysis(row: ScreenerRow, ctx: RadarRankContext): RadarRowAnalysis {
  return ctx.analysisByTicker.get(row.ticker) ?? analyzeRadarRow(row, ctx);
}

export type { RadarSessionContext, RadarRowSessionMetrics };
