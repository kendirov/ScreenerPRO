import type {
  StockExpandedCandle,
  StockExpandedChartInterval,
  StockExpandedChartResponse,
  StockExpandedChartSeries,
} from "@/lib/domain/stock-expanded-chart";
import { historyUrl, stockCandlesUrl } from "@/lib/server/integrations/moex/endpoints";
import type { NormalizedIntradayBar } from "@/lib/server/integrations/moex/mappers";
import { mapHistoryBars, mapIntradayCandlesBars } from "@/lib/server/integrations/moex/mappers";
import { moexGetJson } from "@/lib/server/integrations/moex/client";
import { moexPayloadSchema } from "@/lib/server/integrations/moex/validators";

const CHART_CACHE_TTL_MS = 20_000;
const chartCache = new Map<string, { expiresAt: number; payload: StockExpandedChartResponse }>();

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function moscowDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function emptyChartSeries(
  secid: string,
  interval: StockExpandedChartInterval,
  source: StockExpandedChartSeries["source"],
  error?: string,
): StockExpandedChartSeries {
  return {
    secid,
    status: error ? "error" : "no-data",
    source,
    interval,
    candles: [],
    candleCount: 0,
    error,
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

async function fetchRawIntradayBars(secid: string, moexInterval: 1 | 10 | 60): Promise<NormalizedIntradayBar[]> {
  const today = moscowDateKey();
  const from = formatDate(new Date(Date.now() - 8 * 24 * 3600 * 1000));
  const payload = moexPayloadSchema.parse(
    await moexGetJson(stockCandlesUrl(secid, from, today, moexInterval), 60),
  );
  const table = payload.candles;
  if (!table?.data?.length) return [];

  const bars = mapIntradayCandlesBars(table.columns, table.data)
    .filter((bar) => bar.close != null && Number.isFinite(bar.close))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const latestSession = bars.at(-1)?.timestamp.slice(0, 10);
  return latestSession ? bars.filter((bar) => bar.timestamp.slice(0, 10) === latestSession) : [];
}

async function fetchIntradayExpandedSeries(
  secid: string,
  interval: 5 | 10 | 30,
): Promise<StockExpandedChartSeries> {
  try {
    let candles: StockExpandedCandle[] = [];

    if (interval === 5) {
      const bars = await fetchRawIntradayBars(secid, 1);
      candles = aggregateIntradayBars(bars, 5);
    } else if (interval === 10) {
      const bars = await fetchRawIntradayBars(secid, 10);
      candles = aggregateIntradayBars(bars, 1);
    } else {
      const bars = await fetchRawIntradayBars(secid, 10);
      candles = aggregateIntradayBars(bars, 3);
    }

    if (candles.length < 1) {
      return emptyChartSeries(secid, interval, "intraday");
    }

    return {
      secid,
      status: candles.length >= 3 ? "ok" : "ok",
      source: "intraday",
      interval,
      candles,
      candleCount: candles.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return emptyChartSeries(secid, interval, "intraday", message);
  }
}

async function fetchDailyExpandedSeries(secid: string): Promise<StockExpandedChartSeries> {
  const till = new Date();
  const from = new Date(till.getTime() - 45 * 24 * 3600 * 1000);

  try {
    const payload = moexPayloadSchema.parse(
      await moexGetJson(historyUrl("stock", secid, formatDate(from), formatDate(till)), 120),
    );
    const history = payload.history;
    if (!history?.data?.length) {
      return emptyChartSeries(secid, 24, "daily");
    }

    const candles: StockExpandedCandle[] = mapHistoryBars(history.columns, history.data)
      .filter(
        (bar) =>
          bar.open != null &&
          bar.high != null &&
          bar.low != null &&
          bar.close != null &&
          [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite),
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-30)
      .map((bar) => ({
        time: formatDate(bar.date),
        open: bar.open!,
        high: bar.high!,
        low: bar.low!,
        close: bar.close!,
        volume: bar.volume,
      }));

    if (candles.length < 1) {
      return emptyChartSeries(secid, 24, "daily");
    }

    return {
      secid,
      status: "ok",
      source: "daily",
      interval: 24,
      candles,
      candleCount: candles.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return emptyChartSeries(secid, 24, "daily", message);
  }
}

export async function buildStockExpandedChartSeries(
  secid: string,
  interval: StockExpandedChartInterval,
): Promise<StockExpandedChartResponse> {
  const key = secid.trim().toUpperCase();
  const cacheKey = `${key}|${interval}|${moscowDateKey()}`;
  const cached = chartCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const series =
    interval === 24 ? await fetchDailyExpandedSeries(key) : await fetchIntradayExpandedSeries(key, interval);

  const payload: StockExpandedChartResponse = {
    fetchedAt: new Date().toISOString(),
    series,
  };

  chartCache.set(cacheKey, { expiresAt: Date.now() + CHART_CACHE_TTL_MS, payload });
  return payload;
}
