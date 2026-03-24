import type {
  AssetClass,
  ScreenerApiResponse,
  ScreenerBenchmark,
  ScreenerDataStatus,
  ScreenerDiagnosticsResponse,
  ScreenerRow,
  TradingStatus,
} from "@screenerpro/shared";
import { screenerRows as demoRows } from "@/lib/mock/screener";
import { db } from "@/lib/server/db";
import { computeInPlaySignals } from "@/lib/server/domain/in-play-signals";
import { enrichMoexStocksWithInPlayMetrics } from "@/lib/server/domain/screener-math";
import { classifyStockActivity, deriveStockActivityMetrics } from "@/lib/server/domain/stock-activity";
import { fetchIssJson } from "@/lib/server/moex-iss/http";
import { moexIssPayloadSchema } from "@/lib/server/moex-iss/schemas";

type TableRow = Record<string, unknown>;

const CACHE_TTL_MS = 20_000;

let lastSnapshot:
  | {
      expiresAt: number;
      stocks: ScreenerRow[];
      futures: ScreenerRow[];
      benchmarks: ScreenerBenchmark[];
      status: ScreenerDataStatus;
    }
  | null = null;

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

async function fetchStockHistoricalBaselines(tickers: string[]): Promise<Map<string, StockHistoricalBaseline>> {
  const baselineByTicker = new Map<string, StockHistoricalBaseline>();
  if (!process.env.DATABASE_URL || tickers.length === 0) return baselineByTicker;

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

  return baselineByTicker;
}

async function fetchStocksFromIss(nowIso: string): Promise<ScreenerRow[]> {
  const payload = moexIssPayloadSchema.parse(
    await fetchIssJson(
      "/engines/stock/markets/shares/boards/TQBR/securities.json?iss.meta=off&iss.only=securities,marketdata&securities.columns=SECID,SHORTNAME,LOTSIZE,STATUS,BOARDID&marketdata.columns=SECID,LAST,LASTTOPREVPRICE,PREVPRICE,VOLTODAY,VALTODAY,NUMTRADES,HIGH,LOW,OPEN,TRADINGSTATUS",
    ),
  );

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

  const baselines = await fetchStockHistoricalBaselines(draftRows.map((row) => row.ticker));
  const enrichedRows = enrichMoexStocksWithInPlayMetrics(draftRows);
  return enrichedRows.map((row) => {
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
    }, new Date(nowIso));

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
        volumeRatio: null,
        turnoverVsAverage: signal.turnoverVsAverage,
        rangeVsAverage: signal.rangeVsAverage,
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
      },
    } satisfies ScreenerRow;
  });
}

async function fetchFuturesFromIss(nowIso: string): Promise<ScreenerRow[]> {
  const payload = moexIssPayloadSchema.parse(
    await fetchIssJson(
      "/engines/futures/markets/forts/securities.json?iss.meta=off&iss.only=securities,marketdata&securities.columns=SECID,SHORTNAME,LOTSIZE,STATUS,LASTDELDATE&marketdata.columns=SECID,LAST,LASTTOPREVPRICE,PREVWAPRICE,VOLTODAY,VALTODAY,OPENPOSITION,HIGH,LOW,OPEN,TRADINGSTATUS",
    ),
  );

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
  try {
    const aggregates = computeStockMarketAggregates(stocks);
    const payload = moexIssPayloadSchema.parse(
      await fetchIssJson(
        "/engines/stock/markets/index/securities/IMOEX2.json?iss.meta=off&iss.only=securities,marketdata&securities.columns=SECID,SHORTNAME&marketdata.columns=SECID,CURRENTVALUE,LASTVALUE,LASTTOPREVPRICE,PREVPRICE,HIGH,LOW",
      ),
    );

    if (payload.securities.data.length === 0 || payload.marketdata.data.length === 0) {
      return [];
    }

    const sec = rowToObject(payload.securities.columns, payload.securities.data[0] ?? []);
    const md = rowToObject(payload.marketdata.columns, payload.marketdata.data[0] ?? []);

    const code = asString(sec.SECID) ?? "IMOEX2";
    const lastValue = asNumber(md.CURRENTVALUE) ?? asNumber(md.LASTVALUE);
    const previousClose = asNumber(md.PREVPRICE);
    const high = asNumber(md.HIGH);
    const low = asNumber(md.LOW);

    if (lastValue === null && high === null && low === null) {
      return [];
    }

    return [
      {
        code,
        name: asString(sec.SHORTNAME) ?? "Индекс МосБиржи 2",
        market: "stock",
        lastValue,
        percentChange: computePercentChange(lastValue, previousClose, asNumber(md.LASTTOPREVPRICE)),
        dayRangePct: computeDayRangePct(high, low, previousClose),
        aggregateTurnover: aggregates.aggregateTurnover,
        aggregateTrades: aggregates.aggregateTrades,
        updatedAt: nowIso,
        sourceUpdatedAt: null,
      },
    ];
  } catch {
    return [];
  }
}

async function getMoexSnapshot() {
  const now = Date.now();
  if (lastSnapshot && lastSnapshot.expiresAt > now) {
    return lastSnapshot;
  }

  const nowIso = new Date().toISOString();
  const [stocks, futures] = await Promise.all([fetchStocksFromIss(nowIso), fetchFuturesFromIss(nowIso)]);
  const benchmarks = await fetchStockBenchmarksFromIss(nowIso, stocks);

  if (stocks.length + futures.length === 0) {
    throw new Error("MOEX returned no usable rows");
  }

  const status: ScreenerDataStatus = {
    source: "moex",
    fetchTimestamp: nowIso,
    sourceTimestamp: nowIso,
    stockRows: stocks.length,
    futuresRows: futures.length,
    fallbackReason: null,
    message: "Реальные данные MOEX активны",
  };

  lastSnapshot = {
    expiresAt: now + CACHE_TTL_MS,
    stocks: stocks.map(normalizeScreenerMetrics),
    futures: futures.map(normalizeScreenerMetrics),
    benchmarks,
    status,
  };

  return lastSnapshot;
}

function getDemoSnapshot(reason: ScreenerDataStatus["fallbackReason"], message: string) {
  const nowIso = new Date().toISOString();
  const stocks = demoRows.filter((row) => row.assetClass === "stock").map(normalizeScreenerMetrics);
  const futures = demoRows.filter((row) => row.assetClass === "future").map(normalizeScreenerMetrics);
  return {
    stocks,
    futures,
    benchmarks: [],
    status: {
      source: "demo",
      fetchTimestamp: nowIso,
      sourceTimestamp: null,
      stockRows: stocks.length,
      futuresRows: futures.length,
      fallbackReason: reason,
      message,
    } satisfies ScreenerDataStatus,
  };
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

export async function getScreenerResponse(assetClass: "all" | AssetClass): Promise<ScreenerApiResponse> {
  try {
    const snapshot = await getMoexSnapshot();
    return {
      assetClass,
      rows: pickRows(assetClass, snapshot.stocks, snapshot.futures),
      benchmarks: pickBenchmarks(assetClass, snapshot.benchmarks),
      status: snapshot.status,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось получить данные MOEX";
    const reason = message.toLowerCase().includes("parse") ? "validation-failed" : message.includes("no usable rows") ? "no-usable-rows" : "moex-unavailable";
    const fallback = getDemoSnapshot(reason, `Fallback активирован: ${message}`);
    return {
      assetClass,
      rows: pickRows(assetClass, fallback.stocks, fallback.futures),
      benchmarks: pickBenchmarks(assetClass, fallback.benchmarks),
      status: fallback.status,
    };
  }
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
