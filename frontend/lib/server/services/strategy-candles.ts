import type {
  StockExpandedCandle,
  StockExpandedChartInterval,
  StockExpandedChartResponse,
  StockExpandedChartSeries,
} from "@/lib/domain/stock-expanded-chart";
import {
  capStrategyCandles,
  moscowDateKey,
  type StrategyCandlePeriodId,
} from "@/lib/screener/strategies/strategy-candle-range";
import { moexCandlesUrl } from "@/lib/server/integrations/moex/endpoints";
import type { NormalizedIntradayBar } from "@/lib/server/integrations/moex/mappers";
import { mapIntradayCandlesBars } from "@/lib/server/integrations/moex/mappers";
import { moexGetJson } from "@/lib/server/integrations/moex/client";
import { moexPayloadSchema } from "@/lib/server/integrations/moex/validators";

const CHART_CACHE_TTL_MS = 20_000;
const MOEX_PAGE_SIZE = 500;
const MAX_MOEX_PAGES = 40;

type StrategyChartCacheKey = string;

const chartCache = new Map<
  StrategyChartCacheKey,
  { expiresAt: number; payload: StockExpandedChartResponse }
>();

export type StrategyChartFetchMeta = {
  from: string;
  till: string;
  periodId: StrategyCandlePeriodId;
  board: string;
  fetchRequestCount: number;
  daysLoaded: number;
  rawCount: number;
  capped: boolean;
};

export type StrategyChartSeries = StockExpandedChartSeries & {
  fetchMeta?: StrategyChartFetchMeta;
};

export type StrategyChartResponse = Omit<StockExpandedChartResponse, "series"> & {
  series: StrategyChartSeries;
};

function emptyChartSeries(
  secid: string,
  interval: StockExpandedChartInterval,
  error?: string,
  fetchMeta?: StrategyChartFetchMeta,
): StrategyChartSeries {
  return {
    secid,
    status: error ? "error" : "no-data",
    source: "intraday",
    interval,
    candles: [],
    candleCount: 0,
    error,
    fetchMeta,
  };
}

function toExpandedCandle(bar: NormalizedIntradayBar): StockExpandedCandle | null {
  if (bar.open == null || bar.high == null || bar.low == null || bar.close == null) return null;
  if (![bar.open, bar.high, bar.low, bar.close].every(Number.isFinite)) return null;
  return {
    time: bar.timestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
  };
}

function aggregateIntradayBars(bars: NormalizedIntradayBar[], bucketSize: number): StockExpandedCandle[] {
  if (bucketSize <= 1) {
    return bars.map(toExpandedCandle).filter((c): c is StockExpandedCandle => c != null);
  }

  const sorted = [...bars].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const result: StockExpandedCandle[] = [];

  for (let i = 0; i < sorted.length; i += bucketSize) {
    const chunk = sorted.slice(i, i + bucketSize);
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    if (!first || !last) continue;

    const open = first.open;
    const close = last.close;
    if (open == null || close == null || !Number.isFinite(open) || !Number.isFinite(close)) continue;

    let high = -Infinity;
    let low = Infinity;
    let volume = 0;
    let hasVolume = false;

    for (const bar of chunk) {
      if (bar.high != null && Number.isFinite(bar.high)) high = Math.max(high, bar.high);
      if (bar.low != null && Number.isFinite(bar.low)) low = Math.min(low, bar.low);
      if (bar.volume != null && Number.isFinite(bar.volume)) {
        volume += bar.volume;
        hasVolume = true;
      }
    }

    if (!Number.isFinite(high) || !Number.isFinite(low)) continue;

    result.push({
      time: first.timestamp,
      open,
      high,
      low,
      close,
      volume: hasVolume ? volume : null,
    });
  }

  return result;
}

function uniqueTradingDays(bars: NormalizedIntradayBar[]): number {
  const days = new Set<string>();
  for (const bar of bars) {
    const day = bar.timestamp.slice(0, 10);
    if (day) days.add(day);
  }
  return days.size;
}

async function fetchRawIntradayBarsPaginated(options: {
  secid: string;
  board: string;
  from: string;
  till: string;
  issInterval: 1 | 10 | 60;
}): Promise<{ bars: NormalizedIntradayBar[]; fetchRequestCount: number }> {
  const byTimestamp = new Map<string, NormalizedIntradayBar>();
  let start = 0;
  let fetchRequestCount = 0;

  for (let page = 0; page < MAX_MOEX_PAGES; page++) {
    const path = moexCandlesUrl({
      engine: "stock",
      market: "shares",
      board: options.board,
      secid: options.secid,
      from: options.from,
      till: options.till,
      interval: options.issInterval,
      start,
    });

    fetchRequestCount += 1;
    const payload = moexPayloadSchema.parse(await moexGetJson(path, 60));
    const table = payload.candles;
    if (!table?.data?.length) break;

    const bars = mapIntradayCandlesBars(table.columns, table.data);
    for (const bar of bars) {
      if (bar.close == null || !Number.isFinite(bar.close)) continue;
      byTimestamp.set(bar.timestamp, bar);
    }

    if (table.data.length < MOEX_PAGE_SIZE) break;
    start += table.data.length;
  }

  const bars = [...byTimestamp.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return { bars, fetchRequestCount };
}

function mapIntervalToSeriesMetadata(interval: 1 | 5 | 15 | 30 | 60): StockExpandedChartInterval {
  if (interval === 30) return 30;
  if (interval === 60) return 24;
  if (interval === 15) return 10;
  return 5;
}

function resolveIssPlan(interval: 1 | 5 | 15 | 30 | 60): { issInterval: 1 | 10 | 60; bucketSize: number } {
  if (interval === 1) return { issInterval: 1, bucketSize: 1 };
  if (interval === 5) return { issInterval: 1, bucketSize: 5 };
  if (interval === 15) return { issInterval: 1, bucketSize: 15 };
  if (interval === 30) return { issInterval: 10, bucketSize: 3 };
  return { issInterval: 60, bucketSize: 1 };
}

export async function buildStrategyChartSeries(options: {
  secid: string;
  interval: 1 | 5 | 15 | 30 | 60;
  board?: string;
  from: string;
  till: string;
  periodId: StrategyCandlePeriodId;
  maxCandles?: number;
}): Promise<StrategyChartResponse> {
  const key = options.secid.trim().toUpperCase();
  const board = (options.board ?? "TQBR").trim().toUpperCase();
  const maxCandles = options.maxCandles ?? 5000;
  const cacheKey = `${key}|${board}|${options.interval}|${options.from}|${options.till}|${options.periodId}|${maxCandles}|${moscowDateKey()}`;
  const cached = chartCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload as StrategyChartResponse;
  }

  const fetchMetaBase = {
    from: options.from,
    till: options.till,
    periodId: options.periodId,
    board,
    fetchRequestCount: 0,
    daysLoaded: 0,
    rawCount: 0,
    capped: false,
  };

  try {
    const plan = resolveIssPlan(options.interval);
    const { bars, fetchRequestCount } = await fetchRawIntradayBarsPaginated({
      secid: key,
      board,
      from: options.from,
      till: options.till,
      issInterval: plan.issInterval,
    });

    const aggregated = aggregateIntradayBars(bars, plan.bucketSize);
    const { candles: cappedCandles, capped } = capStrategyCandles(aggregated, maxCandles);

    const fetchMeta: StrategyChartFetchMeta = {
      ...fetchMetaBase,
      fetchRequestCount,
      daysLoaded: uniqueTradingDays(bars),
      rawCount: aggregated.length,
      capped,
    };

    const seriesInterval = mapIntervalToSeriesMetadata(options.interval);

    if (cappedCandles.length < 1) {
      const payload: StrategyChartResponse = {
        fetchedAt: new Date().toISOString(),
        series: emptyChartSeries(key, seriesInterval, undefined, fetchMeta),
      };
      chartCache.set(cacheKey, { expiresAt: Date.now() + CHART_CACHE_TTL_MS, payload });
      return payload;
    }

    const payload: StrategyChartResponse = {
      fetchedAt: new Date().toISOString(),
      series: {
        secid: key,
        status: "ok",
        source: "intraday",
        interval: seriesInterval,
        candles: cappedCandles,
        candleCount: cappedCandles.length,
        fetchMeta,
      },
    };

    chartCache.set(cacheKey, { expiresAt: Date.now() + CHART_CACHE_TTL_MS, payload });
    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const payload: StrategyChartResponse = {
      fetchedAt: new Date().toISOString(),
      series: emptyChartSeries(key, mapIntervalToSeriesMetadata(options.interval), message, fetchMetaBase),
    };
    return payload;
  }
}
