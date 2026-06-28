import type {
  AssetClass,
  BaselineStatus,
  ScreenerApiResponse,
  ScreenerBenchmark,
  ScreenerDataStatus,
  ScreenerDiagnostics,
  ScreenerDiagnosticsResponse,
  ScreenerHealthResponse,
  ScreenerRow,
  TradingStatus,
} from "@screenerpro/shared";
import { screenerRows as demoRows } from "@/lib/mock/screener";
import { computeInPlaySignals } from "@/lib/server/domain/in-play-signals";
import { enrichMoexStocksWithInPlayMetrics } from "@/lib/server/domain/screener-math";
import { classifyStockActivity, deriveStockActivityMetrics } from "@/lib/server/domain/stock-activity";
import { metricsFieldsFromIntraday } from "@/lib/domain/baseline-info";
import { loadIntradayBaselinesForStocks } from "@/lib/server/services/intraday-baseline-loader";
import { buildBaselineAuditRow, type BaselineAuditRow } from "@/lib/domain/baseline-audit";
import { fetchIssJson } from "@/lib/server/moex-iss/http";
import { getMoexHttpTimeoutMs } from "@/lib/server/moex-timeout";
import { moexIssPayloadSchema } from "@/lib/server/moex-iss/schemas";
import {
  canUsePrismaHistoricalBaselines,
  getBuildCommit,
  getMoexDataMode,
  getScreenerEnvironment,
  getVercelGitMetadata,
  isDemoFallbackAllowed,
  isMoexDataDisabled,
  isVercelRuntime,
  shouldUseDemoFallbackAfterLiveFailure,
} from "@/lib/server/screener-env";
import { moscowTodayKey, normalizeRequestedDateKey } from "@/lib/domain/trading-calendar";
import { getHistoricalStockSnapshot, isHistoricalDateRequest } from "@/lib/server/services/moex-screener-history";
import { fetchLiveMoexIndexBenchmark } from "@/lib/server/services/moex-index-benchmark";

const MOEX_STOCKS_ENDPOINT =
  "/engines/stock/markets/shares/boards/TQBR/securities.json?iss.meta=off&iss.only=securities,marketdata&securities.columns=SECID,SHORTNAME,LOTSIZE,STATUS,BOARDID&marketdata.columns=SECID,LAST,LASTTOPREVPRICE,PREVPRICE,VOLTODAY,VALTODAY,NUMTRADES,HIGH,LOW,OPEN,TRADINGSTATUS";
const MOEX_FUTURES_ENDPOINT =
  "/engines/futures/markets/forts/securities.json?iss.meta=off&iss.only=securities,marketdata&securities.columns=SECID,SHORTNAME,LOTSIZE,STATUS,LASTDELDATE&marketdata.columns=SECID,LAST,LASTTOPREVPRICE,PREVWAPRICE,VOLTODAY,VALTODAY,NUMTRADES,OPENPOSITION,HIGH,LOW,OPEN,TRADINGSTATUS";

type TableRow = Record<string, unknown>;

const CACHE_TTL_MS = 20_000;

type MoexSnapshotCache = {
  expiresAt: number;
  stocks: ScreenerRow[];
  futures: ScreenerRow[];
  benchmarks: ScreenerBenchmark[];
  status: ScreenerDataStatus;
};

let lastSnapshot: MoexSnapshotCache | null = null;
let inflightSnapshot: Promise<MoexSnapshotCache> | null = null;

/** Последний успешный MOEX-снимок — для stale fallback на production. */
let lastGoodSnapshot: MoexSnapshotCache | null = null;

const STALE_CACHE_MAX_AGE_MS = 30 * 60_000;

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

function toTradingStatus(value: unknown): TradingStatus {
  const normalized = asString(value)?.toLowerCase() ?? "";
  if (normalized.includes("open") || normalized.includes("normal")) return "open";
  if (normalized.includes("halt") || normalized.includes("stop")) return "halted";
  if (normalized.includes("auction")) return "auction";
  if (normalized.includes("close")) return "closed";
  return "unknown";
}

function computePercentChange(lastPrice: number | null, previousClose: number | null, moexPercent: number | null): number | null {
  if (moexPercent !== null) return moexPercent;
  if (lastPrice === null || previousClose === null || previousClose === 0) return null;
  return ((lastPrice - previousClose) / previousClose) * 100;
}

function pickRangeDenominator(previousClose: number | null, high: number | null, low: number | null): number | null {
  if (previousClose !== null && previousClose > 0) return previousClose;
  const fallback = Math.max(high ?? 0, low ?? 0);
  return fallback > 0 ? fallback : null;
}

function computeDayRangePct(high: number | null, low: number | null, previousClose: number | null): number | null {
  if (high === null || low === null) return null;
  const denominator = pickRangeDenominator(previousClose, high, low);
  if (denominator === null) return null;
  return ((high - low) / denominator) * 100;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

type StockHistoricalBaseline = {
  turnoverAverage: number | null;
  previousDayTurnover: number | null;
  rangeAveragePct: number | null;
  tradesAverage: number | null;
};

type BaselineLoadResult = {
  baselines: Map<string, StockHistoricalBaseline>;
  status: BaselineStatus;
};

export class ScreenerUnavailableError extends Error {
  readonly reason: NonNullable<ScreenerDataStatus["fallbackReason"]>;

  constructor(message: string, reason: NonNullable<ScreenerDataStatus["fallbackReason"]>) {
    super(message);
    this.name = "ScreenerUnavailableError";
    this.reason = reason;
  }
}

function classifyMoexError(error: unknown): { message: string; reason: NonNullable<ScreenerDataStatus["fallbackReason"]> } {
  const timeoutMs = getMoexHttpTimeoutMs();
  if (error instanceof Error && error.name === "AbortError") {
    return {
      message: `MOEX ISS timeout after ${timeoutMs}ms — проверьте VPN/сеть к iss.moex.com`,
      reason: "moex-unavailable",
    };
  }
  const message = error instanceof Error ? error.message : "Не удалось получить данные MOEX";
  const lower = message.toLowerCase();
  if (lower.includes("fetch failed") || lower.includes("econnrefused") || lower.includes("enotfound") || lower.includes("network")) {
    return {
      message: `MOEX ISS недоступен из этой сети (${message}) — проверьте VPN или MOEX_BASE_URL`,
      reason: "moex-unavailable",
    };
  }
  const reason = lower.includes("parse") || lower.includes("validation")
    ? "validation-failed"
    : message.includes("no usable rows")
      ? "no-usable-rows"
      : "moex-unavailable";
  return { message, reason };
}

function aggregateMarketStatus(rows: ScreenerRow[]): TradingStatus {
  if (rows.length === 0) return "unknown";
  const openCount = rows.filter((r) => r.tradingStatus === "open").length;
  if (openCount >= rows.length * 0.15) return "open";
  const closedCount = rows.filter((r) => r.tradingStatus === "closed").length;
  if (closedCount >= rows.length * 0.7) return "closed";
  return "unknown";
}

function buildDiagnostics(
  assetClass: "all" | AssetClass,
  rows: ScreenerRow[],
  status: ScreenerDataStatus,
  extra?: {
    requestedAt?: string;
    fetchMs?: number;
    moexOk?: boolean;
    fallbackUsed?: boolean;
    rowsRaw?: number;
    rowsNormalized?: number;
    endpointUsed?: string[];
    errors?: string[];
  },
): ScreenerDiagnostics {
  const stockCount = status.stockRows;
  const futureCount = status.futuresRows;
  const rowsBeforeFilter =
    assetClass === "stock" ? stockCount : assetClass === "future" ? futureCount : stockCount + futureCount;

  return {
    source: status.source,
    assetClass,
    rowsBeforeFilter,
    rowsAfterFilter: rows.length,
    fallbackReason: status.fallbackReason,
    fetchTime: status.fetchTimestamp,
    marketStatus: status.marketStatus ?? aggregateMarketStatus(rows),
    lastUpdated: status.generatedAt,
    requestedAt: extra?.requestedAt,
    fetchMs: extra?.fetchMs,
    moexOk: extra?.moexOk,
    fallbackUsed: extra?.fallbackUsed,
    rowsRaw: extra?.rowsRaw ?? rowsBeforeFilter,
    rowsNormalized: extra?.rowsNormalized ?? rowsBeforeFilter,
    endpointUsed: extra?.endpointUsed,
    errors: extra?.errors,
  };
}

function attachDiagnostics(
  assetClass: "all" | AssetClass,
  rows: ScreenerRow[],
  benchmarks: ScreenerBenchmark[],
  status: ScreenerDataStatus,
  extra?: Parameters<typeof buildDiagnostics>[3],
): ScreenerApiResponse {
  return {
    assetClass,
    rows,
    benchmarks,
    status,
    diagnostics: buildDiagnostics(assetClass, rows, status, extra),
  };
}

function buildMoexStatus(
  nowIso: string,
  stocks: ScreenerRow[],
  futures: ScreenerRow[],
  baselineStatus: BaselineStatus,
): ScreenerDataStatus {
  const degraded = baselineStatus !== "ok";
  const allRows = [...stocks, ...futures];
  return {
    source: "moex",
    isDemo: false,
    degraded,
    baselineStatus,
    generatedAt: nowIso,
    fetchTimestamp: nowIso,
    sourceTimestamp: nowIso,
    stockRows: stocks.length,
    futuresRows: futures.length,
    fallbackReason: null,
    message: degraded
      ? "Реальные данные MOEX активны (без локальных baseline)"
      : "Реальные данные MOEX активны",
    tradingDateKey: moscowTodayKey(),
    resolvedTradingDateKey: moscowTodayKey(),
    dataMode: "live",
    historicalEmpty: false,
    marketStatus: aggregateMarketStatus(allRows),
    emptyReason: allRows.length === 0 ? "MOEX не отдал строки" : null,
    staleCache: false,
  };
}

async function fetchStockHistoricalBaselines(tickers: string[]): Promise<BaselineLoadResult> {
  const empty = new Map<string, StockHistoricalBaseline>();
  if (tickers.length === 0 || !canUsePrismaHistoricalBaselines()) {
    return { baselines: empty, status: "skipped" };
  }

  try {
    const { db } = await import("@/lib/server/db");
    const baselineByTicker = new Map<string, StockHistoricalBaseline>();
    const instruments = await db.instrument.findMany({
      where: {
        ticker: { in: tickers },
        assetClass: "stock",
        isActive: true,
      },
      select: {
        ticker: true,
        dailyBars: { orderBy: { barDate: "desc" }, take: 25 },
      },
    });

    for (const instrument of instruments) {
      const bars = instrument.dailyBars;
      const turnoverBaseline = average(bars.map((bar) => bar.turnover).filter((value): value is number => value !== null));
      const rangeBaseline = average(
        bars
          .map((bar) => {
            if (bar.high === null || bar.low === null || bar.close === null || bar.close <= 0) return null;
            return ((bar.high - bar.low) / bar.close) * 100;
          })
          .filter((value): value is number => value !== null),
      );

      baselineByTicker.set(instrument.ticker, {
        turnoverAverage: turnoverBaseline,
        previousDayTurnover: bars[0]?.turnover ?? null,
        rangeAveragePct: rangeBaseline,
        tradesAverage: null,
      });
    }

    return { baselines: baselineByTicker, status: "ok" };
  } catch {
    return { baselines: empty, status: "error" };
  }
}

async function fetchStocksFromIss(nowIso: string): Promise<{ rows: ScreenerRow[]; baselineStatus: BaselineStatus }> {
  const payload = moexIssPayloadSchema.parse(await fetchIssJson(MOEX_STOCKS_ENDPOINT));

  const marketByTicker = new Map<string, TableRow>();
  for (const raw of payload.marketdata.data) {
    const item = rowToObject(payload.marketdata.columns, raw);
    const ticker = asString(item.SECID);
    if (ticker) marketByTicker.set(ticker, item);
  }

  const draftRows: Array<{
    ticker: string;
    shortName: string;
    lastPrice: number | null;
    previousClose: number | null;
    percentChange: number | null;
    turnover: number | null;
    volume: number | null;
    open: number | null;
    high: number | null;
    low: number | null;
    tradesCount: number | null;
    dayRangePct: number | null;
    tradingStatus: TradingStatus;
    lotSize: number | null;
  }> = [];
  for (const raw of payload.securities.data) {
    const sec = rowToObject(payload.securities.columns, raw);
    const ticker = asString(sec.SECID);
    if (!ticker) continue;
    const md = marketByTicker.get(ticker);
    if (!md) continue;

    const lastPrice = asNumber(md.LAST);
    const previousClose = asNumber(md.PREVPRICE);
    const high = asNumber(md.HIGH);
    const low = asNumber(md.LOW);
    const volume = asNumber(md.VOLTODAY);
    const turnover = asNumber(md.VALTODAY);
    const tradesCount = asNumber(md.NUMTRADES);
    const dayRangePct = computeDayRangePct(high, low, previousClose);

    if (lastPrice === null && turnover === null && volume === null) continue;

    draftRows.push({
      ticker,
      shortName: asString(sec.SHORTNAME) ?? ticker,
      lastPrice,
      previousClose,
      percentChange: computePercentChange(lastPrice, previousClose, asNumber(md.LASTTOPREVPRICE)),
      volume,
      turnover,
      open: asNumber(md.OPEN),
      high,
      low,
      tradesCount,
      dayRangePct,
      tradingStatus: toTradingStatus(md.TRADINGSTATUS ?? sec.STATUS),
      lotSize: asNumber(sec.LOTSIZE),
    });
  }

  let baselineStatus: BaselineStatus = "skipped";
  let baselines = new Map<string, StockHistoricalBaseline>();
  try {
    const baselineResult = await fetchStockHistoricalBaselines(draftRows.map((row) => row.ticker));
    baselines = baselineResult.baselines;
    baselineStatus = baselineResult.status;
  } catch {
    baselineStatus = "error";
  }
  const enrichedRows = enrichMoexStocksWithInPlayMetrics(draftRows);
  const nowDate = new Date(nowIso);
  const intradayBaselines = await loadIntradayBaselinesWithBudget(
    draftRows.map((row) => ({
      ticker: row.ticker,
      turnover: row.turnover,
      tradesCount: row.tradesCount,
    })),
    nowDate,
  );
  const rows = enrichedRows.map((row) => {
    const baseline = baselines.get(row.ticker) ?? { turnoverAverage: null, previousDayTurnover: null, rangeAveragePct: null, tradesAverage: null };
    const signal = computeInPlaySignals({
      turnover: row.turnover,
      tradesCount: row.tradesCount,
      percentChange: row.percentChange,
      dayRangePct: row.dayRangePct,
      turnoverBaseline: baseline.turnoverAverage,
      rangeBaselinePct: baseline.rangeAveragePct,
      tradesBaseline: baseline.tradesAverage,
    });
    const activityMetrics = deriveStockActivityMetrics({
      currentTurnoverRub: row.turnover,
      previousDayTurnoverRub: baseline.previousDayTurnover,
      tradesCount: row.tradesCount,
    }, nowDate);
    const intraday = intradayBaselines.get(row.ticker);

    return {
      ticker: row.ticker,
      shortName: row.shortName,
      assetClass: "stock",
      lastPrice: row.lastPrice,
      previousClose: row.previousClose,
      absoluteChange: row.lastPrice !== null && row.previousClose !== null ? row.lastPrice - row.previousClose : null,
      percentChange: row.percentChange,
      volume: row.volume,
      turnover: row.turnover,
      open: row.open,
      high: row.high,
      low: row.low,
      tradesCount: row.tradesCount,
      stockActivityClass: classifyStockActivity({
        currentTurnoverRub: row.turnover,
        previousDayTurnoverRub: baseline.previousDayTurnover,
        tradesCount: row.tradesCount,
      }, new Date(nowIso)),
      tradingStatus: row.tradingStatus,
      lotSize: row.lotSize,
      updatedAt: nowIso,
      sourceUpdatedAt: null,
      metrics: {
        turnoverRatio: signal.turnoverVsAverage,
        volumeRatio: metricsFieldsFromIntraday(intraday).volumeRatioNow ?? null,
        rangeVsAverage: signal.rangeVsAverage,
        /** tradesVsAverage = full-day из Prisma; Trades x только из intraday same-time. */
        tradesVsAverage: signal.tradesVsAverage,
        turnoverPercentile: row.turnoverPercentile,
        tradesPercentile: row.tradesPercentile,
        rangePercentile: row.rangePercentile,
        dayRangePct: row.dayRangePct,
        gapPct: null,
        relativeVolatility20d: null,
        inPlayScore: row.inPlayScore,
        isInPlay: row.inPlayTags.includes("IN_PLAY"),
        inPlayTags: row.inPlayTags,
        reasonLabel: row.reasonLabel,
        currentTurnoverRub: activityMetrics.currentTurnoverRub,
        previousDayTurnoverRub: activityMetrics.previousDayTurnoverRub,
        activityRatio: activityMetrics.activityRatio,
        requiredActivityRatio: activityMetrics.requiredActivityRatio,
        sessionProgress: activityMetrics.sessionProgress,
        ...metricsFieldsFromIntraday(intraday),
        /** Полный день / avg 20d — НЕ Vol x (отдельная метрика для legacy in-play). */
        turnoverVsAverage: signal.turnoverVsAverage,
      },
    } satisfies ScreenerRow;
  });

  return { rows, baselineStatus };
}

async function fetchFuturesFromIss(nowIso: string): Promise<ScreenerRow[]> {
  const payload = moexIssPayloadSchema.parse(await fetchIssJson(MOEX_FUTURES_ENDPOINT));

  const marketByTicker = new Map<string, TableRow>();
  for (const raw of payload.marketdata.data) {
    const item = rowToObject(payload.marketdata.columns, raw);
    const ticker = asString(item.SECID);
    if (ticker) marketByTicker.set(ticker, item);
  }

  const rows: ScreenerRow[] = [];
  for (const raw of payload.securities.data) {
    const sec = rowToObject(payload.securities.columns, raw);
    const ticker = asString(sec.SECID);
    if (!ticker) continue;
    const md = marketByTicker.get(ticker);
    if (!md) continue;

    const lastPrice = asNumber(md.LAST);
    const previousClose = asNumber(md.PREVWAPRICE);
    const high = asNumber(md.HIGH);
    const low = asNumber(md.LOW);
    const volume = asNumber(md.VOLTODAY);
    const turnover = asNumber(md.VALTODAY);
    const tradesCount = asNumber(md.NUMTRADES);
    const dayRangePct = computeDayRangePct(high, low, previousClose);

    if (lastPrice === null && turnover === null && volume === null) continue;

    rows.push({
      ticker,
      shortName: asString(sec.SHORTNAME) ?? ticker,
      assetClass: "future",
      lastPrice,
      previousClose,
      absoluteChange: lastPrice !== null && previousClose !== null ? lastPrice - previousClose : null,
      percentChange: computePercentChange(lastPrice, previousClose, asNumber(md.LASTTOPREVPRICE)),
      volume,
      turnover,
      tradesCount,
      openInterest: asNumber(md.OPENPOSITION),
      expiryDate: asString(sec.LASTDELDATE),
      stockActivityClass: "unknown",
      open: asNumber(md.OPEN),
      high,
      low,
      tradingStatus: toTradingStatus(md.TRADINGSTATUS ?? sec.STATUS),
      lotSize: asNumber(sec.LOTSIZE),
      updatedAt: nowIso,
      sourceUpdatedAt: null,
      metrics: {
        turnoverRatio: null,
        volumeRatio: null,
        turnoverVsAverage: null,
        rangeVsAverage: null,
        tradesVsAverage: null,
        turnoverPercentile: null,
        tradesPercentile: null,
        rangePercentile: null,
        dayRangePct,
        gapPct: null,
        relativeVolatility20d: null,
        inPlayScore: null,
        isInPlay: (dayRangePct ?? 0) >= 2.5 && (turnover ?? 0) > 0,
        inPlayTags: [],
        reasonLabel: null,
        currentTurnoverRub: turnover,
        previousDayTurnoverRub: null,
        activityRatio: null,
        requiredActivityRatio: null,
        sessionProgress: null,
      },
    });
  }

  return rows;
}

function computeStockMarketAggregates(stocks: ScreenerRow[]) {
  const aggregateTurnover = stocks.reduce<number>((acc, row) => acc + (row.turnover ?? 0), 0);
  const aggregateTrades = stocks.reduce<number>((acc, row) => acc + (row.tradesCount ?? 0), 0);
  return {
    aggregateTurnover: aggregateTurnover > 0 ? aggregateTurnover : null,
    aggregateTrades: aggregateTrades > 0 ? aggregateTrades : null,
  };
}

function normalizeScreenerMetrics(row: ScreenerRow): ScreenerRow {
  return {
    ...row,
    metrics: {
      ...row.metrics,
      inPlayTags: Array.isArray(row.metrics.inPlayTags) ? row.metrics.inPlayTags : [],
      reasonLabel: typeof row.metrics.reasonLabel === "string" ? row.metrics.reasonLabel : "",
      inPlayScore: typeof row.metrics.inPlayScore === "number" && Number.isFinite(row.metrics.inPlayScore) ? row.metrics.inPlayScore : 0,
      turnoverPercentile:
        typeof row.metrics.turnoverPercentile === "number" && Number.isFinite(row.metrics.turnoverPercentile)
          ? row.metrics.turnoverPercentile
          : 0,
      tradesPercentile:
        typeof row.metrics.tradesPercentile === "number" && Number.isFinite(row.metrics.tradesPercentile)
          ? row.metrics.tradesPercentile
          : 0,
      rangePercentile:
        typeof row.metrics.rangePercentile === "number" && Number.isFinite(row.metrics.rangePercentile)
          ? row.metrics.rangePercentile
          : 0,
    },
  };
}

async function fetchStockBenchmarksFromIss(nowIso: string, stocks: ScreenerRow[]): Promise<ScreenerBenchmark[]> {
  const aggregates = computeStockMarketAggregates(stocks);
  const benchmark = await fetchLiveMoexIndexBenchmark(nowIso, aggregates);
  return benchmark ? [benchmark] : [];
}

async function loadIntradayBaselinesWithBudget(
  rows: Parameters<typeof loadIntradayBaselinesForStocks>[0],
  now: Date,
): Promise<Awaited<ReturnType<typeof loadIntradayBaselinesForStocks>>> {
  const budgetMs = Math.min(3_000, Math.max(1_500, Math.floor(getMoexHttpTimeoutMs() / 2)));
  try {
    return await Promise.race([
      loadIntradayBaselinesForStocks(rows, now),
      new Promise<Awaited<ReturnType<typeof loadIntradayBaselinesForStocks>>>((resolve) => {
        setTimeout(() => resolve(new Map()), budgetMs);
      }),
    ]);
  } catch {
    return new Map();
  }
}

async function getMoexSnapshot() {
  const now = Date.now();
  if (lastSnapshot && lastSnapshot.expiresAt > now) {
    return lastSnapshot;
  }
  if (inflightSnapshot) {
    return inflightSnapshot;
  }

  inflightSnapshot = loadMoexSnapshotUncached();
  try {
    return await inflightSnapshot;
  } finally {
    inflightSnapshot = null;
  }
}

async function loadMoexSnapshotUncached() {
  const now = Date.now();
  const nowIso = new Date().toISOString();
  const [stockSettled, futuresSettled] = await Promise.allSettled([
    fetchStocksFromIss(nowIso),
    fetchFuturesFromIss(nowIso),
  ]);

  const stockResult =
    stockSettled.status === "fulfilled"
      ? stockSettled.value
      : { rows: [] as ScreenerRow[], baselineStatus: "error" as BaselineStatus };
  const futures = futuresSettled.status === "fulfilled" ? futuresSettled.value : [];

  const fetchErrors = [
    stockSettled.status === "rejected" ? String(stockSettled.reason) : null,
    futuresSettled.status === "rejected" ? String(futuresSettled.reason) : null,
  ].filter(Boolean) as string[];

  const stocks = stockResult.rows;

  if (stocks.length + futures.length === 0) {
    const detail = fetchErrors[0] ?? "MOEX returned no usable rows";
    throw new Error(detail);
  }

  let benchmarks: ScreenerBenchmark[] = [];
  try {
    benchmarks = await fetchStockBenchmarksFromIss(nowIso, stocks);
  } catch {
    benchmarks = [];
  }

  const status = buildMoexStatus(nowIso, stocks, futures, stockResult.baselineStatus);

  lastSnapshot = {
    expiresAt: now + CACHE_TTL_MS,
    stocks: stocks.map(normalizeScreenerMetrics),
    futures: futures.map(normalizeScreenerMetrics),
    benchmarks,
    status,
  };
  lastGoodSnapshot = lastSnapshot;

  return lastSnapshot;
}

function resolveStaleSnapshot(): MoexSnapshotCache | null {
  if (!lastGoodSnapshot) return null;
  const age = Date.now() - new Date(lastGoodSnapshot.status.fetchTimestamp).getTime();
  if (age > STALE_CACHE_MAX_AGE_MS) return null;
  return lastGoodSnapshot;
}

function buildStaleStatus(base: ScreenerDataStatus, reason: string): ScreenerDataStatus {
  const nowIso = new Date().toISOString();
  return {
    ...base,
    degraded: true,
    generatedAt: nowIso,
    fetchTimestamp: nowIso,
    fallbackReason: "moex-unavailable",
    message: `Кэш последнего успешного ответа MOEX · ${reason}`,
    staleCache: true,
    emptyReason: null,
  };
}

function getDemoSnapshot(message: string, explicitDevFallback: boolean) {
  const nowIso = new Date().toISOString();
  const stocks = demoRows.filter((row) => row.assetClass === "stock").map(normalizeScreenerMetrics);
  const futures = demoRows.filter((row) => row.assetClass === "future").map(normalizeScreenerMetrics);
  const allRows = [...stocks, ...futures];
  const fallbackReason = explicitDevFallback ? ("explicit-dev-fallback" as const) : ("moex-unavailable" as const);
  const source = explicitDevFallback ? ("fallback" as const) : ("demo" as const);
  return {
    stocks,
    futures,
    benchmarks: [],
    status: {
      source,
      isDemo: true,
      degraded: true,
      baselineStatus: "skipped" as const,
      generatedAt: nowIso,
      fetchTimestamp: nowIso,
      sourceTimestamp: null,
      stockRows: stocks.length,
      futuresRows: futures.length,
      fallbackReason,
      message: explicitDevFallback ? `DEV fallback · ${message}` : `DEMO · ${message}`,
      tradingDateKey: moscowTodayKey(),
      resolvedTradingDateKey: moscowTodayKey(),
      dataMode: "live" as const,
      historicalEmpty: false,
      marketStatus: aggregateMarketStatus(allRows),
      emptyReason: null,
      staleCache: false,
    } satisfies ScreenerDataStatus,
  };
}

function finalizeResponse(
  assetClass: "all" | AssetClass,
  stocks: ScreenerRow[],
  futures: ScreenerRow[],
  benchmarks: ScreenerBenchmark[],
  status: ScreenerDataStatus,
  extra?: Parameters<typeof buildDiagnostics>[3],
): ScreenerApiResponse {
  const rows = pickRows(assetClass, stocks, futures);
  return attachDiagnostics(assetClass, rows, pickBenchmarks(assetClass, benchmarks), status, extra);
}

export function buildUnavailableScreenerResponse(
  assetClass: "all" | AssetClass,
  reason: NonNullable<ScreenerDataStatus["fallbackReason"]>,
  message: string,
  options?: { source?: ScreenerDataStatus["source"] },
): ScreenerApiResponse {
  const nowIso = new Date().toISOString();
  const source = options?.source ?? "moex";
  const status: ScreenerDataStatus = {
    source,
    isDemo: false,
    degraded: true,
    baselineStatus: "skipped",
    generatedAt: nowIso,
    fetchTimestamp: nowIso,
    sourceTimestamp: null,
    stockRows: 0,
    futuresRows: 0,
    fallbackReason: reason,
    message,
    marketStatus: "unknown",
    emptyReason: message,
    staleCache: false,
  };
  return attachDiagnostics(assetClass, [], [], status, {
    requestedAt: nowIso,
    moexOk: false,
    fallbackUsed: true,
    rowsRaw: 0,
    rowsNormalized: 0,
    errors: [message],
    endpointUsed: source === "off" ? [] : [MOEX_STOCKS_ENDPOINT, MOEX_FUTURES_ENDPOINT],
  });
}

export function buildOffScreenerResponse(assetClass: "all" | AssetClass): ScreenerApiResponse {
  return buildUnavailableScreenerResponse(
    assetClass,
    "data-disabled",
    "MOEX_DATA_MODE=off — live fetch отключён",
    { source: "off" },
  );
}

function pickRows(assetClass: "all" | AssetClass, stocks: ScreenerRow[], futures: ScreenerRow[]) {
  if (assetClass === "stock") return stocks;
  if (assetClass === "future") return futures;
  return [...stocks, ...futures];
}

function pickBenchmarks(assetClass: "all" | AssetClass, benchmarks: ScreenerBenchmark[]) {
  if (assetClass === "future") return [];
  return benchmarks;
}

export async function getScreenerResponse(
  assetClass: "all" | AssetClass,
  options?: { date?: string | null },
): Promise<ScreenerApiResponse> {
  const requestedDate = normalizeRequestedDateKey(options?.date ?? null);

  if (requestedDate && isHistoricalDateRequest(requestedDate)) {
    const historical = await getHistoricalStockSnapshot(requestedDate);

    if (assetClass === "future") {
      return finalizeResponse(assetClass, [], [], [], {
        ...historical.status,
        futuresRows: 0,
        message: "Фьючерсы доступны только в режиме LIVE",
      });
    }

    const rows = assetClass === "all" ? historical.stocks : historical.stocks;
    return finalizeResponse(
      assetClass,
      historical.stocks,
      [],
      historical.benchmarks,
      historical.status,
    );
  }

  const requestedAt = new Date().toISOString();
  const fetchStarted = performance.now();

  if (isMoexDataDisabled()) {
    return buildOffScreenerResponse(assetClass);
  }

  try {
    const snapshot = await getMoexSnapshot();
    const fetchMs = Math.round(performance.now() - fetchStarted);
    return finalizeResponse(
      assetClass,
      snapshot.stocks,
      snapshot.futures,
      snapshot.benchmarks,
      snapshot.status,
      {
        requestedAt,
        fetchMs,
        moexOk: true,
        fallbackUsed: false,
        rowsRaw: snapshot.status.stockRows + snapshot.status.futuresRows,
        rowsNormalized: snapshot.status.stockRows + snapshot.status.futuresRows,
        endpointUsed: [MOEX_STOCKS_ENDPOINT, MOEX_FUTURES_ENDPOINT],
      },
    );
  } catch (error) {
    const fetchMs = Math.round(performance.now() - fetchStarted);
    const { message, reason } = classifyMoexError(error);
    const stale = resolveStaleSnapshot();
    if (stale) {
      return finalizeResponse(
        assetClass,
        stale.stocks,
        stale.futures,
        stale.benchmarks,
        buildStaleStatus(stale.status, message),
        {
          requestedAt,
          fetchMs,
          moexOk: false,
          fallbackUsed: true,
          rowsRaw: stale.status.stockRows + stale.status.futuresRows,
          rowsNormalized: stale.status.stockRows + stale.status.futuresRows,
          errors: [message],
          endpointUsed: [MOEX_STOCKS_ENDPOINT, MOEX_FUTURES_ENDPOINT],
        },
      );
    }
    if (shouldUseDemoFallbackAfterLiveFailure()) {
      const explicitDevFallback = getMoexDataMode() === "fallback";
      const fallback = getDemoSnapshot(message, explicitDevFallback);
      lastSnapshot = {
        expiresAt: Date.now() + CACHE_TTL_MS,
        stocks: fallback.stocks,
        futures: fallback.futures,
        benchmarks: fallback.benchmarks,
        status: fallback.status,
      };
      return finalizeResponse(
        assetClass,
        fallback.stocks,
        fallback.futures,
        fallback.benchmarks,
        fallback.status,
        {
          requestedAt,
          fetchMs,
          moexOk: false,
          fallbackUsed: true,
          rowsRaw: 0,
          rowsNormalized: fallback.stocks.length + fallback.futures.length,
          errors: [message],
          endpointUsed: [MOEX_STOCKS_ENDPOINT, MOEX_FUTURES_ENDPOINT],
        },
      );
    }
    throw new ScreenerUnavailableError(message, reason);
  }
}

export async function getScreenerHealth(): Promise<ScreenerHealthResponse> {
  const timestamp = new Date().toISOString();
  let moexFetchStatus: ScreenerHealthResponse["moexFetchStatus"] = "error";
  try {
    await fetchIssJson(
      "/engines/stock/markets/shares/boards/TQBR/securities.json?iss.meta=off&iss.only=securities&securities.columns=SECID&securities.limit=1",
    );
    moexFetchStatus = "ok";
  } catch {
    moexFetchStatus = "error";
  }

  let prismaStatus: BaselineStatus = "skipped";
  if (canUsePrismaHistoricalBaselines()) {
    try {
      const { db } = await import("@/lib/server/db");
      await db.instrument.count();
      prismaStatus = "ok";
    } catch {
      prismaStatus = "error";
    }
  }

  const git = getVercelGitMetadata();
  const buildCommit = getBuildCommit();

  return {
    environment: getScreenerEnvironment(),
    vercel: isVercelRuntime(),
    moexFetchStatus,
    prismaStatus,
    demoFallbackAllowed: isDemoFallbackAllowed(),
    moexDataMode: getMoexDataMode(),
    commitSha: git.commitSha,
    commitMessage: git.commitMessage,
    branch: git.branch,
    deploymentUrl: git.deploymentUrl,
    generatedAt: timestamp,
    buildCommit,
    timestamp,
  };
}

export async function getScreenerDiagnostics(): Promise<ScreenerDiagnosticsResponse> {
  const response = await getScreenerResponse("all");
  return {
    status: response.status,
    totalRows: response.rows.length,
    byAssetClass: {
      stock: response.status.stockRows,
      future: response.status.futuresRows,
    },
  };
}

/** Dev-only: акции из live snapshot для radar debug. */
export async function getMoexStockRowsForDebug(): Promise<ScreenerRow[]> {
  const snapshot = await getMoexSnapshot();
  return snapshot.stocks.filter((row) => row.assetClass === "stock");
}

/** Dev-only: топ-N по обороту — полная диагностика Vol x / Trades x baseline. */
export async function getBaselineAuditTop(n = 20): Promise<BaselineAuditRow[]> {
  const snapshot = await getMoexSnapshot();
  const stocks = [...snapshot.stocks]
    .filter((row) => row.assetClass === "stock")
    .sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0))
    .slice(0, Math.max(1, Math.min(n, 25)));

  const intradayMap = await loadIntradayBaselinesForStocks(
    stocks.map((row) => ({
      ticker: row.ticker,
      turnover: row.turnover,
      tradesCount: row.tradesCount ?? null,
    })),
  );

  return stocks.map((row) => buildBaselineAuditRow(row, intradayMap.get(row.ticker)));
}
