import type { ScreenerRow } from "@screenerpro/shared";
import {
  MARKET_RADAR_CONFIG,
  getMarketRadarReasonLabel,
  type MarketRadarReasonKey,
} from "@/lib/domain/market-radar-config";
import { computePositionInRange } from "@/lib/domain/stock-sparkline";
import { isStockIlliquid } from "@/lib/domain/stock-screener-display";
import { formatTradesCompact } from "@/lib/domain/stocks-screener-signals";

const { liquidity: liquidityCfg, inPlay: inPlayCfg, volatility: volatilityCfg } = MARKET_RADAR_CONFIG;

function stockRowsOnly(rows: ScreenerRow[]): ScreenerRow[] {
  return rows.filter((row) => row.assetClass === "stock");
}

function compareLiquidityRows(a: ScreenerRow, b: ScreenerRow): number {
  for (const field of liquidityCfg.sortBy) {
    if (field === "turnover") {
      const diff = (b.turnover ?? 0) - (a.turnover ?? 0);
      if (diff !== 0) return diff;
    }
    if (field === "trades") {
      const diff = (b.tradesCount ?? 0) - (a.tradesCount ?? 0);
      if (diff !== 0) return diff;
    }
  }
  return 0;
}

/** Есть ли у строки historical baseline (вчера / средние). */
export function rowHasHistoricalBaseline(row: ScreenerRow): boolean {
  return (
    row.metrics.previousDayTurnoverRub != null ||
    row.metrics.turnoverVsAverage != null ||
    row.metrics.rangeVsAverage != null ||
    row.metrics.tradesVsAverage != null
  );
}

/** Топ ликвидности по конфигу sortBy. */
export function selectLiquidityLeaders(
  rows: ScreenerRow[],
  limit = liquidityCfg.topN,
): ScreenerRow[] {
  return [...stockRowsOnly(rows)].sort(compareLiquidityRows).slice(0, limit);
}

function countInPlayFallbackSignals(row: ScreenerRow, position: number | null): number {
  let count = 0;
  const turnoverPct = row.metrics.turnoverPercentile ?? 0;
  const tradesPct = row.metrics.tradesPercentile ?? 0;
  const rangePct = row.metrics.rangePercentile ?? 0;
  const dayRange = Math.abs(row.metrics.dayRangePct ?? 0);
  const change = row.percentChange ?? 0;
  const near = inPlayCfg.nearExtremePosition;

  if (turnoverPct >= inPlayCfg.fallbackMinTurnoverPercentile) count += 1;
  if (tradesPct >= inPlayCfg.fallbackMinTradesPercentile) count += 1;
  if (rangePct >= inPlayCfg.fallbackMinRangePercentile || dayRange >= inPlayCfg.fallbackMinDayRangePct) {
    count += 1;
  }

  if (inPlayCfg.includeHighLowProximity && position != null) {
    if (position >= near && change > 0) count += 1;
    else if (position <= 1 - near && change < 0) count += 1;

    if (position >= near && change >= inPlayCfg.breakoutMinChangePct) count += 1;
    else if (position <= 1 - near && change <= -inPlayCfg.breakoutMinChangePct) count += 1;
  }

  return count;
}

export function passesInPlayRadarFilter(row: ScreenerRow): boolean {
  const score = row.metrics.inPlayScore;
  if (score != null && Number.isFinite(score)) {
    return score >= inPlayCfg.minInPlayScore;
  }

  const position = computePositionInRange(row.lastPrice, row.low, row.high);
  return countInPlayFallbackSignals(row, position) >= inPlayCfg.fallbackMinSignals;
}

/** Все инструменты «в игре» для радара (без лимита). */
export function selectInPlayInstruments(rows: ScreenerRow[]): ScreenerRow[] {
  return [...stockRowsOnly(rows)]
    .filter(passesInPlayRadarFilter)
    .sort((a, b) => (b.metrics.inPlayScore ?? 0) - (a.metrics.inPlayScore ?? 0));
}

/** Ключ причины для строки «Кто в игре». */
export function resolveInPlayRadarReasonKey(row: ScreenerRow): MarketRadarReasonKey {
  const position = computePositionInRange(row.lastPrice, row.low, row.high);
  const change = row.percentChange ?? 0;
  const near = inPlayCfg.nearExtremePosition;

  if (inPlayCfg.includeHighLowProximity && position != null) {
    if (position >= near && change >= inPlayCfg.breakoutMinChangePct) return "breakoutHigh";
    if (position <= 1 - near && change <= -inPlayCfg.breakoutMinChangePct) return "breakoutLow";
    if (position >= near) return "nearHigh";
    if (position <= 1 - near) return "nearLow";
  }

  const turnoverPct = row.metrics.turnoverPercentile ?? 0;
  const tradesPct = row.metrics.tradesPercentile ?? 0;
  const rangePct = row.metrics.rangePercentile ?? 0;
  const dayRange = Math.abs(row.metrics.dayRangePct ?? 0);

  if (rangePct >= inPlayCfg.fallbackMinRangePercentile || dayRange >= inPlayCfg.fallbackMinDayRangePct) {
    return "wideRange";
  }
  if (tradesPct >= inPlayCfg.fallbackMinTradesPercentile && tradesPct > turnoverPct) {
    return "manyTrades";
  }
  return "highTurnover";
}

/** Человекочитаемая причина для UI. */
export function resolveInPlayRadarReason(row: ScreenerRow): string {
  return getMarketRadarReasonLabel(resolveInPlayRadarReasonKey(row));
}

export function passesVolatilityRadarFilter(row: ScreenerRow, maxTurnover: number): boolean {
  if (volatilityCfg.useIlliquidFilter && isStockIlliquid(row, maxTurnover)) return false;

  const dayRange = Math.abs(row.metrics.dayRangePct ?? 0);
  if (dayRange < volatilityCfg.minRangePct) return false;

  const minChange = volatilityCfg.minAbsChangePct;
  if (minChange != null) {
    return Math.abs(row.percentChange ?? 0) >= minChange;
  }

  return true;
}

/** Ключ бейджа волатильности. */
export function resolveVolatilityRadarReasonKey(row: ScreenerRow): MarketRadarReasonKey {
  const dayRange = Math.abs(row.metrics.dayRangePct ?? 0);
  const change = Math.abs(row.percentChange ?? 0);
  const turnoverPct = row.metrics.turnoverPercentile ?? 0;
  const tradesPct = row.metrics.tradesPercentile ?? 0;
  const rangePct = row.metrics.rangePercentile ?? 0;
  const highlightChange = volatilityCfg.minAbsChangePct ?? volatilityCfg.highlightMinAbsChangePct;

  if (
    dayRange >= volatilityCfg.riskMinDayRangePct &&
    turnoverPct <= volatilityCfg.riskMaxTurnoverPercentile &&
    tradesPct <= volatilityCfg.riskMaxTradesPercentile
  ) {
    return "illiquidRisk";
  }

  if (change >= highlightChange) {
    return "strongMove";
  }

  if (dayRange >= volatilityCfg.wideDayRangePct || rangePct >= volatilityCfg.wideDayRangePercentile) {
    return "wideRange";
  }

  return "wideRange";
}

/** Человекочитаемый бейдж волатильности. */
export function resolveVolatilityRadarBadge(row: ScreenerRow): string {
  return getMarketRadarReasonLabel(resolveVolatilityRadarReasonKey(row));
}

/** Все инструменты с повышенной волатильностью (без лимита). */
export function selectVolatileInstruments(rows: ScreenerRow[], maxTurnover: number): ScreenerRow[] {
  return [...stockRowsOnly(rows)]
    .filter((row) => passesVolatilityRadarFilter(row, maxTurnover))
    .sort((a, b) => {
      const rangeDiff = Math.abs(b.metrics.dayRangePct ?? 0) - Math.abs(a.metrics.dayRangePct ?? 0);
      if (rangeDiff !== 0) return rangeDiff;
      return Math.abs(b.percentChange ?? 0) - Math.abs(a.percentChange ?? 0);
    });
}

export function formatRadarTrades(row: ScreenerRow): string {
  return formatTradesCompact(row.tradesCount) ?? "—";
}

/** Бейдж ликвидности для топ-N. */
export function liquidityRadarBadgeLabel(): string {
  return getMarketRadarReasonLabel("liquidity");
}
