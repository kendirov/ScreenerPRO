import type { ScreenerBenchmark, ScreenerRow } from "@screenerpro/shared";
import { resolveHonestTradesRatio, resolveHonestVolumeRatio } from "@/lib/domain/baseline-info";
import { computePositionInRange } from "@/lib/domain/stock-sparkline";
import { RADAR_THRESHOLDS } from "@/lib/screener/radar-thresholds";
import { filterValidStockUniverse, type UniverseFilterAudit } from "@/lib/screener/stock-universe-filter";
import {
  buildInGameSelection,
  type InGameDiagnostics,
  type InGameRowInput,
} from "@/lib/screener/in-game-logic";
import {
  computeInstrumentSituation,
  getMoscowSessionMins,
  type InstrumentSituation,
} from "@/lib/screener/situation-engine";
import {
  computeIndexBreadth,
  toIndexBreadthSummary,
  type IndexBreadthDiagnostics,
  type IndexBreadthSummary,
  type MarketBreadthDiagnostics,
} from "@/lib/screener/index-breadth";

export type RadarTag = "liquidity" | "in-play" | "volatility";

export type NormalizedStockRow = {
  ticker: string;
  name: string;
  last: number | null;
  changePct: number | null;
  turnover: number | null;
  trades: number | null;
  rangePct: number | null;
  positionInDayRange: number | null;
  turnoverRank: number;
  tradesRank: number;
  rangeRank: number;
  changeRank: number;
  shareOfMarketTurnover: number | null;
  liquidityScore: number;
  inPlayScore: number;
  volatilityScore: number;
  isIlliquid: boolean;
  isInGame: boolean;
  tags: RadarTag[];
  reasons: string[];
  tableReason: string;
  situation: InstrumentSituation;
  raw: ScreenerRow;
};

export type RadarLeader = {
  row: NormalizedStockRow;
  label: string;
  detail: string;
};

export type StocksMarketSummary = {
  totalTurnover: number;
  totalTrades: number;
  activeTickers: number;
  rising: number;
  falling: number;
  flat: number;
  indexChangePct: number | null;
  indexRangePct: number | null;
  indexPositionPct: number | null;
  indexBreadth: IndexBreadthSummary;
};

export type IlliquidThresholds = {
  minTradesDynamic: number;
  minTurnoverDynamic: number;
};

export type BreadthAudit = UniverseFilterAudit & {
  universeCount: number;
  risingCount: number;
  fallingCount: number;
  flatCount: number;
  sum: number;
  nonStockRemoved: number;
  filteredIlliquidCount: number;
};

export type StocksRadarDiagnostics = BreadthAudit & {
  hasHistoricalBaseline: boolean;
  breadthMismatch: boolean;
  inGame?: InGameDiagnostics;
  marketBreadth: MarketBreadthDiagnostics;
  indexBreadth: IndexBreadthDiagnostics;
};

export type StocksRadarModel = {
  normalizedRows: NormalizedStockRow[];
  marketSummary: StocksMarketSummary;
  liquidityLeaders: RadarLeader[];
  inPlayLeaders: RadarLeader[];
  inGameUniverseCount: number;
  volatilityLeaders: RadarLeader[];
  illiquidThresholds: IlliquidThresholds;
  diagnostics: StocksRadarDiagnostics;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rankScore(rank: number, total: number): number {
  if (total <= 1) return rank === 1 ? 100 : 0;
  if (rank <= 0) return 0;
  return 100 * (1 - (rank - 1) / Math.max(total - 1, 1));
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo] ?? 0;
  const loVal = sorted[lo] ?? 0;
  const hiVal = sorted[hi] ?? loVal;
  return loVal + (hiVal - loVal) * (idx - lo);
}

export function computeIlliquidThresholds(stocks: ScreenerRow[]): IlliquidThresholds {
  const cfg = RADAR_THRESHOLDS.illiquid;
  const trades = stocks.map((r) => r.tradesCount ?? 0);
  const turnovers = stocks.map((r) => r.turnover ?? 0);
  return {
    minTradesDynamic: Math.max(quantile(trades, cfg.quantile), cfg.minTradesFloor),
    minTurnoverDynamic: Math.max(quantile(turnovers, cfg.quantile), cfg.minTurnoverFloor),
  };
}

function rankToPercentile(rank: number, total: number): number {
  if (total <= 1) return 50;
  return 100 * (1 - (rank - 1) / Math.max(total - 1, 1));
}

export function isDynamicIlliquid(row: NormalizedStockRow, thresholds: IlliquidThresholds, total: number): boolean {
  const cfg = RADAR_THRESHOLDS.illiquid;
  const trades = row.trades ?? 0;
  const turnover = row.turnover ?? 0;
  const rangePct = Math.abs(row.rangePct ?? 0);
  const absChange = Math.abs(row.changePct ?? 0);
  const tradesPct = row.raw.metrics.tradesPercentile ?? rankToPercentile(row.tradesRank, total);
  const turnoverPct = row.raw.metrics.turnoverPercentile ?? rankToPercentile(row.turnoverRank, total);

  const liquidEnough =
    cfg.blueChipWhitelist.has(row.ticker.toUpperCase()) ||
    tradesPct >= cfg.liquidPercentileMin ||
    turnoverPct >= cfg.liquidPercentileMin ||
    trades >= thresholds.minTradesDynamic ||
    turnover >= thresholds.minTurnoverDynamic;

  if (liquidEnough) return false;
  if (absChange >= cfg.moveKeepThreshold) return false;
  if (rangePct >= cfg.volatilityKeepThreshold) return false;
  return true;
}

function buildDescRankMap(rows: ScreenerRow[], valueFn: (row: ScreenerRow) => number): Map<string, number> {
  const ranked = [...rows]
    .map((row) => ({ row, value: valueFn(row) }))
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => b.value! - a.value!);
  const map = new Map<string, number>();
  ranked.forEach((item, index) => map.set(item.row.ticker, index + 1));
  return map;
}

export function prepareStockUniverse(
  rows: ScreenerRow[],
  options?: {
    /** Rows already filtered by buildStockScreenerUniverse — skip second pass. */
    preFiltered?: boolean;
    filterAudit?: UniverseFilterAudit;
    sourceRawCount?: number;
  },
): {
  universe: ScreenerRow[];
  audit: Omit<BreadthAudit, "filteredIlliquidCount">;
} {
  const filterResult = options?.preFiltered
    ? { universe: rows, audit: options.filterAudit ?? emptyFilterAudit(rows.length, options.sourceRawCount) }
    : filterValidStockUniverse(rows);

  const { universe, audit: filterAudit } = filterResult;
  const { rising, falling, flat } = computeBreadthCounts(universe);
  const rawTotal = options?.sourceRawCount ?? filterAudit.rawRows;

  return {
    universe,
    audit: {
      ...filterAudit,
      universeCount: universe.length,
      risingCount: rising,
      fallingCount: falling,
      flatCount: flat,
      sum: rising + falling + flat,
      nonStockRemoved: Math.max(0, rawTotal - universe.length),
    },
  };
}

function emptyFilterAudit(rowCount: number, sourceRawCount?: number): UniverseFilterAudit {
  return {
    rawRows: sourceRawCount ?? rowCount,
    afterAssetClass: rowCount,
    afterTypeFilter: rowCount,
    afterTickerShapeFilter: rowCount,
    afterBondFundExclusion: rowCount,
    duplicatesRemoved: 0,
    invalidRowsRemoved: 0,
    excludedBondLike: 0,
    excludedFunds: 0,
    excludedEtfs: 0,
    excludedExamples: [],
  };
}

export function classifyBreadth(changePct: number | null): "rising" | "falling" | "flat" {
  const threshold = RADAR_THRESHOLDS.breadthFlatPct;
  const ch = changePct ?? 0;
  if (ch > threshold) return "rising";
  if (ch < -threshold) return "falling";
  return "flat";
}

export function computeBreadthCounts(universe: ScreenerRow[]): {
  rising: number;
  falling: number;
  flat: number;
} {
  let rising = 0;
  let falling = 0;
  let flat = 0;
  for (const row of universe) {
    const bucket = classifyBreadth(row.percentChange);
    if (bucket === "rising") rising++;
    else if (bucket === "falling") falling++;
    else flat++;
  }
  return { rising, falling, flat };
}

function indexPosition(benchmark: ScreenerBenchmark | null): number | null {
  if (!benchmark?.lastValue || benchmark.low == null || benchmark.high == null) return null;
  const span = benchmark.high - benchmark.low;
  if (span <= 0) return null;
  return (benchmark.lastValue - benchmark.low) / span;
}

function turnoverScore(row: ScreenerRow, turnoverRank: number, total: number): number {
  const volRatio = resolveHonestVolumeRatio(row) ?? row.metrics.turnoverVsAverage;
  if (volRatio != null && volRatio > 0) {
    return clamp(rankScore(turnoverRank, total) * 0.55 + clamp(volRatio, 0, 3) / 3 * 45, 0, 100);
  }
  return rankScore(turnoverRank, total);
}

function tradesScore(row: ScreenerRow, tradesRank: number, total: number): number {
  const tradesRatio = resolveHonestTradesRatio(row) ?? row.metrics.tradesVsAverage;
  if (tradesRatio != null && tradesRatio > 0) {
    return clamp(rankScore(tradesRank, total) * 0.55 + clamp(tradesRatio, 0, 3) / 3 * 45, 0, 100);
  }
  return rankScore(tradesRank, total);
}

function marketAdjustedMove(row: ScreenerRow, indexChangePct: number | null): number {
  const stock = Math.abs(row.percentChange ?? 0);
  const index = Math.max(Math.abs(indexChangePct ?? 0), 0.4);
  return stock / index;
}

function toInGameInput(row: NormalizedStockRow): InGameRowInput {
  return {
    ticker: row.ticker,
    last: row.last,
    changePct: row.changePct,
    turnover: row.turnover,
    trades: row.trades,
    rangePct: row.rangePct,
    isIlliquid: row.isIlliquid,
    tradesRank: row.tradesRank,
    turnoverRank: row.turnoverRank,
    rangeRank: row.rangeRank,
    changeRank: row.changeRank,
  };
}

function buildVolatilityDetail(row: NormalizedStockRow): string {
  if (row.isIlliquid) {
    if ((row.trades ?? 0) < RADAR_THRESHOLDS.illiquid.minTradesFloor) return "мало сделок";
    return "тонко";
  }
  return "";
}

function buildTableReason(row: NormalizedStockRow): string {
  if (row.isInGame) return row.reasons[0] ?? "в игре";
  if (row.tags.includes("volatility")) return row.isIlliquid ? "волатильность · тонко" : "волатильность";
  if (row.tags.includes("liquidity")) return "ликвидность";
  if (row.isIlliquid) return "тонко";
  return "—";
}

function selectLiquidityLeaders(rows: NormalizedStockRow[]): RadarLeader[] {
  const max = RADAR_THRESHOLDS.liquidity.maxLeaders;
  return [...rows]
    .sort((a, b) => {
      const tDiff = (b.turnover ?? 0) - (a.turnover ?? 0);
      if (tDiff !== 0) return tDiff;
      return (b.trades ?? 0) - (a.trades ?? 0);
    })
    .slice(0, max)
    .map((row) => ({ row, label: row.ticker, detail: "" }));
}

export type BuildStocksRadarModelOptions = {
  /** Universe already filtered — see buildStockScreenerUniverse. */
  universePreFiltered?: boolean;
  filterAudit?: UniverseFilterAudit;
  sourceRawCount?: number;
};

export function buildStocksRadarModel(
  rows: ScreenerRow[],
  benchmark: ScreenerBenchmark | null,
  options?: BuildStocksRadarModelOptions,
): StocksRadarModel {
  const { universe: stocks, audit } = prepareStockUniverse(rows, {
    preFiltered: options?.universePreFiltered,
    filterAudit: options?.filterAudit,
    sourceRawCount: options?.sourceRawCount,
  });
  const total = stocks.length;
  const illiquidThresholds = computeIlliquidThresholds(stocks);
  const indexChangePct = benchmark?.percentChange ?? null;

  const turnoverRankMap = buildDescRankMap(stocks, (row) => row.turnover ?? 0);
  const tradesRankMap = buildDescRankMap(stocks, (row) => row.tradesCount ?? 0);
  const rangeRankMap = buildDescRankMap(stocks, (row) => Math.abs(row.metrics.dayRangePct ?? 0));
  const changeRankMap = buildDescRankMap(stocks, (row) => Math.abs(row.percentChange ?? 0));

  const totalTurnover = stocks.reduce((sum, row) => sum + (row.turnover ?? 0), 0);
  const totalTrades = stocks.reduce((sum, row) => sum + (row.tradesCount ?? 0), 0);
  const { rising, falling, flat } = computeBreadthCounts(stocks);
  const indexPos = indexPosition(benchmark);
  const indexBreadthDiag = computeIndexBreadth(stocks);
  const indexBreadthSummary = toIndexBreadthSummary(indexBreadthDiag);
  const sessionMins = getMoscowSessionMins();
  const maxTurnover = stocks.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0);

  const marketSummary: StocksMarketSummary = {
    totalTurnover,
    totalTrades,
    activeTickers: stocks.filter((row) => (row.turnover ?? 0) > 0 || (row.tradesCount ?? 0) > 0).length,
    rising,
    falling,
    flat,
    indexChangePct,
    indexRangePct: benchmark?.dayRangePct ?? null,
    indexPositionPct: indexPos,
    indexBreadth: indexBreadthSummary,
  };

  let hasHistoricalBaseline = false;

  const normalizedRows: NormalizedStockRow[] = stocks.map((row) => {
    const turnoverRank = turnoverRankMap.get(row.ticker) ?? total + 1;
    const tradesRank = tradesRankMap.get(row.ticker) ?? total + 1;
    const rangeRank = rangeRankMap.get(row.ticker) ?? total + 1;
    const changeRank = changeRankMap.get(row.ticker) ?? total + 1;

    if (row.metrics.intradayBaselineKind === "intraday-ok" || row.metrics.turnoverVsAverage != null) {
      hasHistoricalBaseline = true;
    }

    const tScore = turnoverScore(row, turnoverRank, total);
    const trScore = tradesScore(row, tradesRank, total);
    const rScore = rankScore(rangeRank, total);
    const adjMove = marketAdjustedMove(row, indexChangePct);
    const adjMoveScore = clamp(adjMove * 35, 0, 100);
    const activityConfirm = clamp((tScore + trScore) / 2, 0, 100);
    const position = computePositionInRange(row.lastPrice, row.low, row.high);
    const rangePct = row.metrics.dayRangePct;
    const share = totalTurnover > 0 && row.turnover != null ? row.turnover / totalTurnover : null;
    const liquidityScore = clamp(tScore * 0.65 + trScore * 0.35, 0, 100);

    const vw = RADAR_THRESHOLDS.volatility.weights;
    const volatilityScore = clamp(
      vw.rangePctRank * rScore +
        vw.absChangePctRank * rankScore(changeRank, total) +
        vw.marketAdjustedMove * adjMoveScore +
        vw.activityConfirmation * activityConfirm,
      0,
      100,
    );

    const normalized: NormalizedStockRow = {
      ticker: row.ticker,
      name: row.shortName,
      last: row.lastPrice,
      changePct: row.percentChange,
      turnover: row.turnover,
      trades: row.tradesCount ?? null,
      rangePct,
      positionInDayRange: position,
      turnoverRank,
      tradesRank,
      rangeRank,
      changeRank,
      shareOfMarketTurnover: share,
      liquidityScore,
      inPlayScore: 0,
      volatilityScore,
      isIlliquid: false,
      isInGame: false,
      tags: [],
      reasons: [],
      tableReason: "—",
      situation: {
        tags: ["quiet"],
        primaryTag: "quiet",
        score: 0,
        reasons: [{ code: "quiet", label: "Тихо", severity: "neutral" }],
      },
      raw: row,
    };

    normalized.isIlliquid = isDynamicIlliquid(normalized, illiquidThresholds, total);
    return normalized;
  });

  const inGameMarketCtx = {
    indexChangePct,
    indexRangePct: benchmark?.dayRangePct ?? null,
    total,
    rising,
    falling,
    universeCount: total,
  };

  const inGameSelection = buildInGameSelection(
    normalizedRows.map(toInGameInput),
    inGameMarketCtx,
  );

  const shortlistByTicker = new Map(inGameSelection.shortlist.map((row) => [row.ticker, row]));

  for (const row of normalizedRows) {
    const picked = shortlistByTicker.get(row.ticker);
    if (picked) {
      row.inPlayScore = picked.score;
      row.isInGame = true;
      row.reasons = [picked.reason];
      row.tags.push("in-play");
      row.tableReason = buildTableReason(row);
    }
  }

  const inGameShortlist = normalizedRows
    .filter((row) => row.isInGame)
    .sort((a, b) => {
      const scoreDiff = b.inPlayScore - a.inPlayScore;
      if (scoreDiff !== 0) return scoreDiff;
      return (b.trades ?? 0) - (a.trades ?? 0);
    });

  const filteredIlliquidCount = normalizedRows.filter((r) => r.isIlliquid).length;

  const liquidityLeaders = selectLiquidityLeaders(normalizedRows);
  const liquiditySet = new Set(liquidityLeaders.map((l) => l.row.ticker));
  for (const row of normalizedRows) {
    if (liquiditySet.has(row.ticker)) row.tags.push("liquidity");
  }

  const inPlayLeaders = [...inGameShortlist]
    .sort((a, b) => {
      const tradesDiff = (b.trades ?? 0) - (a.trades ?? 0);
      if (tradesDiff !== 0) return tradesDiff;
      return b.inPlayScore - a.inPlayScore;
    })
    .slice(0, RADAR_THRESHOLDS.inPlay.cardDisplayMax)
    .map((row) => ({
      row,
      label: row.ticker,
      detail: row.reasons[0] ?? "",
    }));

  const volatilityLeaders = normalizedRows
    .filter((row) => {
      if (row.volatilityScore < RADAR_THRESHOLDS.volatility.minScore) return false;
      if (row.isIlliquid && (row.trades ?? 0) < RADAR_THRESHOLDS.illiquid.minTradesFloor && (row.rangePct ?? 0) < 3) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const rangeDiff = (b.rangePct ?? 0) - (a.rangePct ?? 0);
      if (rangeDiff !== 0) return rangeDiff;
      return b.volatilityScore - a.volatilityScore;
    })
    .slice(0, RADAR_THRESHOLDS.volatility.maxLeaders)
    .map((row) => ({
      row,
      label: row.ticker,
      detail: buildVolatilityDetail(row),
    }));

  for (const leader of volatilityLeaders) leader.row.tags.push("volatility");

  for (const row of normalizedRows) {
    if (!row.isInGame) row.tableReason = buildTableReason(row);
    row.situation = computeInstrumentSituation(row.raw, { maxTurnover, sessionMins });
  }

  normalizedRows.sort((a, b) => (b.trades ?? 0) - (a.trades ?? 0));

  const breadthMismatch = audit.sum !== audit.universeCount;

  return {
    normalizedRows,
    marketSummary,
    liquidityLeaders,
    inPlayLeaders,
    inGameUniverseCount: inGameSelection.diagnostics.shortlistCount,
    volatilityLeaders,
    illiquidThresholds,
    diagnostics: {
      ...audit,
      filteredIlliquidCount,
      hasHistoricalBaseline,
      breadthMismatch,
      inGame: inGameSelection.diagnostics,
      marketBreadth: {
        universeCount: audit.universeCount,
        rising: audit.risingCount,
        falling: audit.fallingCount,
        flat: audit.flatCount,
        sum: audit.sum,
      },
      indexBreadth: indexBreadthDiag,
    },
  };
}

export function applyIlliquidFilter(rows: NormalizedStockRow[], hideIlliquid: boolean): NormalizedStockRow[] {
  if (!hideIlliquid) return rows;
  return rows.filter((row) => !row.isIlliquid);
}

export function searchRadarRows(rows: NormalizedStockRow[], query: string): NormalizedStockRow[] {
  const q = query.trim().toUpperCase();
  if (!q) return rows;
  return rows.filter((row) => row.ticker.toUpperCase().includes(q) || row.name.toUpperCase().includes(q));
}

export type TableSortKey =
  | "ticker"
  | "last"
  | "changePct"
  | "turnover"
  | "trades"
  | "rangePct"
  | "positionInDayRange"
  | "inPlayScore";

export type TableSortDir = "asc" | "desc";

export function sortRadarRows(
  rows: NormalizedStockRow[],
  key: TableSortKey,
  dir: TableSortDir,
): NormalizedStockRow[] {
  const sorted = [...rows].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "ticker":
        cmp = a.ticker.localeCompare(b.ticker, "ru");
        break;
      case "last":
        cmp = (a.last ?? -Infinity) - (b.last ?? -Infinity);
        break;
      case "changePct":
        cmp = (a.changePct ?? -Infinity) - (b.changePct ?? -Infinity);
        break;
      case "turnover":
        cmp = (a.turnover ?? -Infinity) - (b.turnover ?? -Infinity);
        break;
      case "trades":
        cmp = (a.trades ?? -Infinity) - (b.trades ?? -Infinity);
        break;
      case "rangePct":
        cmp = (a.rangePct ?? -Infinity) - (b.rangePct ?? -Infinity);
        break;
      case "positionInDayRange":
        cmp = (a.positionInDayRange ?? -Infinity) - (b.positionInDayRange ?? -Infinity);
        break;
      case "inPlayScore":
        cmp = a.inPlayScore - b.inPlayScore;
        break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}
