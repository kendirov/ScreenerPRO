import type { ScreenerRow } from "@screenerpro/shared";
import { MARKET_RADAR_CONFIG, getMarketRadarReasonLabel, type MarketRadarReasonKey } from "@/lib/domain/market-radar-config";
import { TRADER_SIGNAL_SHORT } from "@/lib/domain/trader-signal-labels";
import type { IntradayBaselineKind, IntradayBaselineStatus } from "@/lib/domain/intraday-baseline";
import {
  buildBaselineInfoFromRow,
  buildTradesRatioTooltip,
  buildVolumeRatioTooltip,
  resolveHonestTradesRatio,
  resolveHonestVolumeRatio,
} from "@/lib/domain/baseline-info";
import { hasHonestIntradayTradesBaseline, isHonestIntradayVolumeBaseline } from "@/lib/domain/intraday-baseline";
import {
  buildRadarRankContext,
  absChangePct,
  absDayRangePct,
  computeInPlaySortScore,
  computeLayerScores,
  computeShotScore,
  evaluatePriceStructure,
  getRadarRowAnalysis as getRadarRowAnalysisFromLayers,
  isActiveCandidate,
  passesInPlayLayer,
  resolveActiveLayerReasonKey,
  resolveInPlayLayerReasonKey,
  resolveShotsLayerReasonKey,
  safeTradesRatioNow,
  safeVolumeRatioNow,
  selectActiveCandidates,
  selectActivityVisibleRows,
  selectActiveVisibleRows,
  selectInPlayVisibleRows,
  selectLiquidityVisibleRows,
  selectShotsVisibleRows,
  type RadarRankContext,
  type RadarRowAnalysis,
} from "@/lib/domain/market-radar-layers";
import {
  RADAR_ACTIVITY_REASON,
  RADAR_VOLATILITY_REASON,
  radarLiquidityTag,
} from "@/lib/domain/radar-ui-labels";
import { formatTradesCompact } from "@/lib/domain/stocks-screener-signals";
import { classifyStockTradingState } from "@/lib/domain/stock-trading-state";
import {
  buildRadarRowSessionMetricsMap,
  buildRadarSessionContext,
  clampRelativeRatio,
  computeMarketSessionIntensities,
  computeRadarRowSessionMetrics,
  computeSessionIntensity,
  medianOfTopDesc,
  medianPositive,
  resolveSessionGateThresholds,
  resolveSessionModeFromIntensity,
  resolveTurnoverRef,
  resolveTradesRef,
  type RadarRowSessionMetrics,
  type RadarSessionContext,
  type RadarSessionMode,
} from "@/lib/domain/market-radar-session";

const { activity: activityCfg } = MARKET_RADAR_CONFIG;
const scoreCfg = MARKET_RADAR_CONFIG.scoring;

export type { RadarRankContext, RadarRowAnalysis, RadarSessionContext, RadarSessionMode, RadarRowSessionMetrics };

export type RadarRatioSource = "intraday-ok" | "intraday-partial" | "rough" | "legacy" | "none";

export type RadarVolumeRatio = {
  value: number | null;
  source: RadarRatioSource;
  status: IntradayBaselineStatus | null;
};

export type RadarTradesRatio = {
  value: number | null;
  source: RadarRatioSource;
  status: IntradayBaselineStatus | null;
};

export type ActiveSelectionResult = {
  visible: ScreenerRow[];
  candidateCount: number;
};

function mapBaselineStatus(status: IntradayBaselineStatus | null | undefined): RadarRatioSource {
  if (status === "ok") return "intraday-ok";
  if (status === "partial") return "intraday-partial";
  if (status === "rough") return "rough";
  return "none";
}

function resolveBaselineKind(row: ScreenerRow): IntradayBaselineKind | null {
  return (row.metrics.intradayBaselineKind ?? null) as IntradayBaselineKind | null;
}

export function resolveVolumeRatioNow(row: ScreenerRow): RadarVolumeRatio {
  const status = (row.metrics.intradayBaselineStatus ?? null) as IntradayBaselineStatus | null;
  const info = buildBaselineInfoFromRow(row);
  const value = resolveHonestVolumeRatio(row);
  if (value != null && info.isReliable) {
    return { value, source: mapBaselineStatus(status), status };
  }
  return { value: null, source: "none", status };
}

export function resolveTradesRatioNow(row: ScreenerRow): RadarTradesRatio {
  const kind = resolveBaselineKind(row);
  const status = (row.metrics.intradayBaselineStatus ?? null) as IntradayBaselineStatus | null;
  const value = resolveHonestTradesRatio(row);
  if (value != null && hasHonestIntradayTradesBaseline(kind)) {
    return { value, source: mapBaselineStatus(status), status };
  }
  return { value: null, source: "none", status: null };
}

export { buildVolumeRatioTooltip, buildTradesRatioTooltip, buildBaselineInfoFromRow };

export function rowHasVolumeBaseline(row: ScreenerRow): boolean {
  return isHonestIntradayVolumeBaseline(resolveBaselineKind(row));
}

function stockRowsOnly(rows: ScreenerRow[]): ScreenerRow[] {
  return rows.filter((row) => row.assetClass === "stock");
}

export function rowHasHistoricalBaseline(row: ScreenerRow): boolean {
  return (
    row.metrics.previousDayTurnoverRub != null ||
    row.metrics.turnoverVsAverage != null ||
    row.metrics.rangeVsAverage != null ||
    row.metrics.tradesVsAverage != null
  );
}

export { getRadarRowAnalysisFromLayers as getRadarRowAnalysis };

function activityBaselineMissing(row: ScreenerRow, analysis: RadarRowAnalysis): boolean {
  const vol = safeVolumeRatioNow(row);
  const trd = safeTradesRatioNow(row);
  return vol == null || trd == null || analysis.baselineScore === scoreCfg.baseline.missingScore;
}

/** Тег/reason для колонки активности (бейдж «в игре» — отдельно). */
export function resolveRadarActivityTag(row: ScreenerRow, ctx: RadarRankContext): string {
  const analysis = getRadarRowAnalysisFromLayers(row, ctx);
  if (activityBaselineMissing(row, analysis)) {
    return RADAR_ACTIVITY_REASON.noBaseline;
  }

  const leader = analysis.leaderPresenceScore;
  const vol = safeVolumeRatioNow(row);
  const trd = safeTradesRatioNow(row);
  const range = absDayRangePct(row);
  const absCh = absChangePct(row);

  if (leader >= 0.5 && range >= 1.5) return RADAR_ACTIVITY_REASON.leaderRange;
  if (vol != null && vol >= 1.5 && trd != null && trd >= 1.5) return RADAR_ACTIVITY_REASON.volumeTrades;
  if (trd != null && trd >= 1.5 && absCh >= 0.5) return RADAR_ACTIVITY_REASON.tradesMove;

  if (analysis.isActive) return RADAR_ACTIVITY_REASON.active;
  return RADAR_ACTIVITY_REASON.active;
}

/** Тег/reason для колонки волатильности. */
export function resolveRadarVolatilityTag(row: ScreenerRow, ctx: RadarRankContext): string {
  const analysis = getRadarRowAnalysisFromLayers(row, ctx);
  if (analysis.volatilityTier === "thin") return RADAR_VOLATILITY_REASON.thin;

  const price = evaluatePriceStructure(row);
  if (price.breakoutHigh) return RADAR_VOLATILITY_REASON.breakoutHigh;
  if (price.breakoutLow) return RADAR_VOLATILITY_REASON.breakoutLow;
  if (price.nearHigh) return RADAR_VOLATILITY_REASON.nearHigh;
  if (price.nearLow) return RADAR_VOLATILITY_REASON.nearLow;

  if (activityBaselineMissing(row, analysis) && !safeVolumeRatioNow(row) && !safeTradesRatioNow(row)) {
    return RADAR_VOLATILITY_REASON.noBaseline;
  }

  return RADAR_VOLATILITY_REASON.range;
}

export function resolveRadarLiquidityTag(): string {
  return radarLiquidityTag();
}

/** @deprecated используйте resolveRadarActivityTag / resolveRadarVolatilityTag */
export function resolveRadarDisplayTag(
  row: ScreenerRow,
  _reasonKey: MarketRadarReasonKey,
  variant: "liquidity" | "activity" | "volatility",
  ctx: RadarRankContext,
): string {
  if (variant === "liquidity") return resolveRadarLiquidityTag();
  if (variant === "activity") return resolveRadarActivityTag(row, ctx);
  return resolveRadarVolatilityTag(row, ctx);
}

export function formatRadarRatioMultiplier(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `x${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value)}`;
}

export { buildRadarRankContext };

export {
  buildRadarSessionContext,
  buildRadarRowSessionMetricsMap,
  computeRadarRowSessionMetrics,
  computeMarketSessionIntensities,
  computeSessionIntensity,
  clampRelativeRatio,
  medianOfTopDesc,
  medianPositive,
  resolveSessionGateThresholds,
  resolveSessionModeFromIntensity,
  resolveTurnoverRef,
  resolveTradesRef,
};

export function buildMarketRadarSession(universe: ScreenerRow[]): {
  session: RadarSessionContext;
  rowMetrics: Map<string, RadarRowSessionMetrics>;
} {
  const session = buildRadarSessionContext(universe);
  return {
    session,
    rowMetrics: buildRadarRowSessionMetricsMap(universe, session),
  };
}

export type RadarBoard = {
  rankCtx: RadarRankContext;
  liquidity: ScreenerRow[];
  inPlay: ScreenerRow[];
  active: ScreenerRow[];
  activity: ScreenerRow[];
  volatility: ScreenerRow[];
};

/** Единый snapshot радара — один rankCtx / sessionContext на все колонки. */
export function buildRadarBoard(universe: ScreenerRow[], candidates: ScreenerRow[] = universe): RadarBoard {
  const rankCtx = buildRadarRankContext(universe);
  return {
    rankCtx,
    liquidity: selectLiquidityVisibleRows(universe, rankCtx),
    inPlay: selectInPlayVisibleRows(candidates, rankCtx),
    active: selectActiveCandidates(candidates, rankCtx),
    activity: selectActivityVisibleRows(candidates, rankCtx),
    volatility: selectShotsVisibleRows(candidates, rankCtx),
  };
}

export function hasBaselineOk(row: ScreenerRow): boolean {
  return rowHasVolumeBaseline(row);
}

export function computeRadarHardScore(row: ScreenerRow, ctx: RadarRankContext): number {
  return computeInPlaySortScore(row, ctx);
}

export function passesHardInPlayRadarFilter(
  row: ScreenerRow,
  ctx: RadarRankContext,
  maxTurnover?: number,
): boolean {
  return passesInPlayLayer(row, ctx, maxTurnover);
}

export function passesActiveRadarFilter(row: ScreenerRow, ctx: RadarRankContext, _maxTurnover: number): boolean {
  return isActiveCandidate(row, ctx);
}

/** Финальный список In Play (0–2, макс. 3). */
export function selectHardInPlayInstruments(
  rows: ScreenerRow[],
  universe: ScreenerRow[] = rows,
): ScreenerRow[] {
  const ctx = buildRadarRankContext(universe);
  return selectInPlayVisibleRows(rows, ctx);
}

/** @deprecated Алиас финального In Play. */
export function selectAllHardInPlayInstruments(
  rows: ScreenerRow[],
  universe: ScreenerRow[] = rows,
): ScreenerRow[] {
  return selectHardInPlayInstruments(rows, universe);
}

export function selectActiveInstruments(rows: ScreenerRow[], universe: ScreenerRow[] = rows): ScreenerRow[] {
  const ctx = buildRadarRankContext(universe);
  return selectActiveVisibleRows(rows, ctx);
}

export function selectActiveSelection(
  rows: ScreenerRow[],
  universe: ScreenerRow[] = rows,
): ActiveSelectionResult {
  const ctx = buildRadarRankContext(universe);
  const candidates = selectActiveCandidates(rows, ctx);
  return {
    visible: candidates.slice(0, activityCfg.maxVisible),
    candidateCount: candidates.length,
  };
}

export function selectDangerousInstruments(rows: ScreenerRow[], universe: ScreenerRow[] = rows, limit = 5): ScreenerRow[] {
  const maxTurnover = universe.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0);
  return [...rows]
    .filter((row) => row.assetClass === "stock" && classifyStockTradingState(row, maxTurnover) === "dangerous")
    .sort((a, b) => Math.abs(b.percentChange ?? 0) - Math.abs(a.percentChange ?? 0))
    .slice(0, limit);
}

export function selectInPlayInstruments(rows: ScreenerRow[], universe?: ScreenerRow[]): ScreenerRow[] {
  return selectHardInPlayInstruments(rows, universe ?? rows);
}

export function selectLiquidityLeaders(rows: ScreenerRow[], universe: ScreenerRow[] = rows): ScreenerRow[] {
  const ctx = buildRadarRankContext(universe);
  return selectLiquidityVisibleRows(rows, ctx);
}

export function resolveInPlayRadarReasonKey(row: ScreenerRow, ctx: RadarRankContext): MarketRadarReasonKey {
  return resolveInPlayLayerReasonKey(row, ctx);
}

export function showHardInPlayBadge(row: ScreenerRow, ctx: RadarRankContext): boolean {
  return ctx.inPlayTickerSet.has(row.ticker.toUpperCase());
}

export function resolveActiveRadarReasonKey(row: ScreenerRow, ctx: RadarRankContext): MarketRadarReasonKey {
  return resolveActiveLayerReasonKey(row, ctx);
}

export function resolveActiveRadarReason(row: ScreenerRow, ctx: RadarRankContext): string {
  return getMarketRadarReasonLabel(resolveActiveRadarReasonKey(row, ctx));
}

export type RadarRowFlag = { label: string; muted?: boolean; title?: string };

export function resolveInPlayRowFlags(row: ScreenerRow): RadarRowFlag[] {
  const flags: RadarRowFlag[] = [];
  const kind = resolveBaselineKind(row);
  const baselineOk = hasBaselineOk(row);

  if (baselineOk) {
    const vol = resolveVolumeRatioNow(row).value;
    const volLabel = formatRadarRatioMultiplier(vol);
    if (volLabel) flags.push({ label: volLabel, title: "объём к норме (20d ok)" });

    const trades = resolveTradesRatioNow(row).value;
    const tradesLabel = formatRadarRatioMultiplier(trades);
    if (tradesLabel) flags.push({ label: tradesLabel, title: "сделки к норме (20d ok)" });
  } else if (kind === "intraday-partial") {
    flags.push({ label: TRADER_SIGNAL_SHORT.partial, muted: true, title: "частичный intraday baseline" });
  } else if (kind === "rough-day-avg" || kind === "previous-day") {
    flags.push({ label: TRADER_SIGNAL_SHORT.rough, muted: true, title: "rough baseline · не 20d intraday" });
  } else {
    flags.push({ label: TRADER_SIGNAL_SHORT.noBaseline, muted: true });
  }

  return flags;
}

export function resolveInPlayRadarReason(row: ScreenerRow, ctx: RadarRankContext): string {
  return getMarketRadarReasonLabel(resolveInPlayRadarReasonKey(row, ctx));
}

export function passesShotsRadarFilter(row: ScreenerRow, ctx: RadarRankContext, maxTurnover?: number): boolean {
  return selectShotsVisibleRows([row], ctx).length > 0;
}

export function computeShotsImpulseScore(row: ScreenerRow, ctx: RadarRankContext): number {
  return computeShotScore(row, ctx);
}

export function resolveShotsRadarReasonKey(row: ScreenerRow, ctx: RadarRankContext): MarketRadarReasonKey {
  return resolveShotsLayerReasonKey(row, ctx);
}

export function resolveShotsRadarBadge(row: ScreenerRow, ctx: RadarRankContext): string {
  return getMarketRadarReasonLabel(resolveShotsRadarReasonKey(row, ctx));
}

export function selectShotsInstruments(rows: ScreenerRow[], universe: ScreenerRow[]): ScreenerRow[] {
  const ctx = buildRadarRankContext(universe);
  return selectShotsVisibleRows(rows, ctx);
}

export function formatRadarTrades(row: ScreenerRow): string {
  return formatTradesCompact(row.tradesCount) ?? "—";
}

export function liquidityRadarBadgeLabel(): string {
  return getMarketRadarReasonLabel("liquidity");
}

/** In Play score для UI. */
export function getRadarInPlayScore(row: ScreenerRow, ctx: RadarRankContext): number {
  return Math.round(computeLayerScores(row, ctx).inPlayScore);
}
