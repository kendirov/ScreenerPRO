import type { ScreenerBenchmark, ScreenerDataStatus, ScreenerRow } from "@screenerpro/shared";
import {
  isWeekendDateKey,
  moscowTodayKey,
  shiftCalendarDaysKey,
  TRADING_DATE_MESSAGES,
} from "@/lib/domain/trading-calendar";
import { fetchHistoricalMoexIndexBenchmark } from "@/lib/server/services/moex-index-benchmark";
import { enrichMoexStocksWithInPlayMetrics } from "@/lib/server/domain/screener-math";
import { stockBoardHistoryByDateUrl } from "@/lib/server/integrations/moex/endpoints";
import { mapHistoryBars } from "@/lib/server/integrations/moex/mappers";
import { moexGetJson } from "@/lib/server/integrations/moex/client";
import { moexPayloadSchema } from "@/lib/server/integrations/moex/validators";

const HISTORY_CACHE_TTL_MS = 120_000;
const historyCache = new Map<
  string,
  {
    expiresAt: number;
    stocks: ScreenerRow[];
    benchmarks: ScreenerBenchmark[];
    status: ScreenerDataStatus;
  }
>();

type TableRow = Record<string, unknown>;

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function rowToObject(columns: string[], row: unknown[]): TableRow {
  return Object.fromEntries(columns.map((column, idx) => [column, row[idx]]));
}

function computeDayRangePct(high: number | null, low: number | null, close: number | null): number | null {
  if (high === null || low === null || close === null || close <= 0) return null;
  return ((high - low) / close) * 100;
}

function computePreviousClose(close: number | null, trendPct: number | null): number | null {
  if (close === null || trendPct === null) return null;
  const factor = 1 + trendPct / 100;
  if (factor === 0) return null;
  return close / factor;
}

function emptyHistoricalMetrics(
  dayRangePct: number | null,
  enriched?: ReturnType<typeof enrichMoexStocksWithInPlayMetrics>[number],
) {
  return {
    turnoverRatio: null,
    volumeRatio: null,
    turnoverVsAverage: null,
    rangeVsAverage: null,
    tradesVsAverage: null,
    turnoverPercentile: enriched?.turnoverPercentile ?? null,
    tradesPercentile: enriched?.tradesPercentile ?? null,
    rangePercentile: enriched?.rangePercentile ?? null,
    dayRangePct,
    gapPct: null,
    relativeVolatility20d: null,
    inPlayScore: enriched?.inPlayScore ?? null,
    isInPlay: enriched?.inPlayTags.includes("IN_PLAY") ?? false,
    inPlayTags: enriched?.inPlayTags ?? [],
    reasonLabel: enriched?.reasonLabel ?? null,
    currentTurnoverRub: null,
    previousDayTurnoverRub: null,
    activityRatio: null,
    requiredActivityRatio: null,
    sessionProgress: null,
  };
}

type HistoryDraftRow = {
  ticker: string;
  shortName: string;
  lastPrice: number | null;
  previousClose: number | null;
  absoluteChange: number | null;
  percentChange: number | null;
  volume: number | null;
  turnover: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  tradesCount: number | null;
  dayRangePct: number | null;
};

function mapHistoryRowToDraft(row: TableRow): HistoryDraftRow | null {
  const ticker = asString(row.SECID);
  if (!ticker) return null;

  const close = asNumber(row.CLOSE);
  const open = asNumber(row.OPEN);
  const high = asNumber(row.HIGH);
  const low = asNumber(row.LOW);
  const turnover = asNumber(row.VALUE);
  const volume = asNumber(row.VOLUME);
  const tradesCount = asNumber(row.NUMTRADES);
  const percentChange = asNumber(row.TRENDCLSPR);
  const previousClose = computePreviousClose(close, percentChange);
  const dayRangePct = computeDayRangePct(high, low, close ?? previousClose);

  if (close === null && turnover === null && volume === null) return null;

  return {
    ticker,
    shortName: asString(row.SHORTNAME) ?? ticker,
    lastPrice: close,
    previousClose,
    absoluteChange: close !== null && previousClose !== null ? close - previousClose : null,
    percentChange,
    volume,
    turnover,
    open,
    high,
    low,
    tradesCount,
    dayRangePct,
  };
}

function buildHistoricalScreenerRows(rawRows: TableRow[], nowIso: string, tradeDate: string): ScreenerRow[] {
  const drafts = rawRows.map(mapHistoryRowToDraft).filter((row): row is HistoryDraftRow => row !== null);
  if (!drafts.length) return [];

  const enriched = enrichMoexStocksWithInPlayMetrics(
    drafts.map((row) => ({
      turnover: row.turnover,
      tradesCount: row.tradesCount,
      dayRangePct: row.dayRangePct,
    })),
  );

  return drafts.map((draft, index) => ({
    ticker: draft.ticker,
    shortName: draft.shortName,
    assetClass: "stock" as const,
    lastPrice: draft.lastPrice,
    previousClose: draft.previousClose,
    absoluteChange: draft.absoluteChange,
    percentChange: draft.percentChange,
    volume: draft.volume,
    turnover: draft.turnover,
    open: draft.open,
    high: draft.high,
    low: draft.low,
    tradesCount: draft.tradesCount,
    stockActivityClass: "unknown" as const,
    tradingStatus: "closed" as const,
    lotSize: null,
    updatedAt: nowIso,
    sourceUpdatedAt: tradeDate,
    metrics: emptyHistoricalMetrics(draft.dayRangePct, enriched[index]),
  }));
}

async function fetchHistoryPage(dateKey: string, start: number, limit: number) {
  const payload = moexPayloadSchema.parse(
    await moexGetJson(stockBoardHistoryByDateUrl("TQBR", dateKey, start, limit), 60),
  );
  const history = payload.history;
  if (!history?.data?.length) return { rows: [] as TableRow[], columns: history?.columns ?? [] };

  return {
    columns: history.columns,
    rows: history.data.map((raw) => rowToObject(history.columns, raw)),
  };
}

async function hasStockHistoryForDate(dateKey: string): Promise<boolean> {
  const page = await fetchHistoryPage(dateKey, 0, 1);
  return page.rows.length > 0;
}

export async function resolveNearestTradingDateKey(requestedDateKey: string, maxLookback = 12): Promise<string | null> {
  let cursor = requestedDateKey;
  for (let i = 0; i < maxLookback; i++) {
    if (!isWeekendDateKey(cursor) && (await hasStockHistoryForDate(cursor))) {
      return cursor;
    }
    cursor = shiftCalendarDaysKey(cursor, -1);
  }
  return null;
}

async function fetchAllStockHistoryRows(dateKey: string): Promise<TableRow[]> {
  const all: TableRow[] = [];
  const pageSize = 100;
  for (let start = 0; start < 2000; start += pageSize) {
    const page = await fetchHistoryPage(dateKey, start, pageSize);
    if (!page.rows.length) break;
    all.push(...page.rows);
    if (page.rows.length < pageSize) break;
  }
  return all;
}

async function fetchIndexBenchmarkForDate(
  dateKey: string,
  nowIso: string,
  stocks: ScreenerRow[],
): Promise<ScreenerBenchmark[]> {
  const aggregateTurnover = stocks.reduce((sum, row) => sum + (row.turnover ?? 0), 0);
  const aggregateTrades = stocks.reduce((sum, row) => sum + (row.tradesCount ?? 0), 0);
  const benchmark = await fetchHistoricalMoexIndexBenchmark(dateKey, nowIso, {
    aggregateTurnover: aggregateTurnover > 0 ? aggregateTurnover : null,
    aggregateTrades: aggregateTrades > 0 ? aggregateTrades : null,
  });
  return benchmark ? [benchmark] : [];
}

function buildHistoricalStatus(input: {
  nowIso: string;
  requestedDateKey: string;
  resolvedDateKey: string | null;
  stockRows: number;
  empty: boolean;
}): ScreenerDataStatus {
  const resolved = input.resolvedDateKey ?? input.requestedDateKey;
  const shifted = input.resolvedDateKey !== null && input.resolvedDateKey !== input.requestedDateKey;

  return {
    source: "moex",
    isDemo: false,
    degraded: true,
    baselineStatus: "skipped",
    generatedAt: input.nowIso,
    fetchTimestamp: input.nowIso,
    sourceTimestamp: resolved,
    stockRows: input.stockRows,
    futuresRows: 0,
    fallbackReason: null,
    message: input.empty
      ? TRADING_DATE_MESSAGES.noData
      : shifted
        ? `${TRADING_DATE_MESSAGES.nearestDay}: ${resolved}`
        : "Исторический срез MOEX ISS",
    tradingDateKey: input.requestedDateKey,
    resolvedTradingDateKey: shifted ? input.resolvedDateKey : input.requestedDateKey,
    dataMode: "historical",
    historicalEmpty: input.empty,
  };
}

export async function getHistoricalStockSnapshot(requestedDateKey: string): Promise<{
  stocks: ScreenerRow[];
  benchmarks: ScreenerBenchmark[];
  status: ScreenerDataStatus;
}> {
  const cacheHit = historyCache.get(requestedDateKey);
  if (cacheHit && cacheHit.expiresAt > Date.now()) {
    return cacheHit;
  }

  const nowIso = new Date().toISOString();
  const resolvedDateKey = await resolveNearestTradingDateKey(requestedDateKey);

  if (!resolvedDateKey) {
    const status = buildHistoricalStatus({
      nowIso,
      requestedDateKey,
      resolvedDateKey: null,
      stockRows: 0,
      empty: true,
    });
    const payload = { stocks: [], benchmarks: [], status };
    historyCache.set(requestedDateKey, { ...payload, expiresAt: Date.now() + HISTORY_CACHE_TTL_MS });
    return payload;
  }

  const rawRows = await fetchAllStockHistoryRows(resolvedDateKey);
  const stocks = buildHistoricalScreenerRows(rawRows, nowIso, resolvedDateKey);

  const benchmarks = await fetchIndexBenchmarkForDate(resolvedDateKey, nowIso, stocks);

  const status = buildHistoricalStatus({
    nowIso,
    requestedDateKey,
    resolvedDateKey,
    stockRows: stocks.length,
    empty: stocks.length === 0,
  });

  const payload = { stocks, benchmarks, status };
  historyCache.set(requestedDateKey, { ...payload, expiresAt: Date.now() + HISTORY_CACHE_TTL_MS });
  return payload;
}

export function isHistoricalDateRequest(dateKey: string | null | undefined): boolean {
  if (!dateKey) return false;
  return dateKey !== moscowTodayKey();
}
