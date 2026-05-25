import type {
  StockSparklineBatchResponse,
  StockSparklineCandle,
  StockSparklineSeries,
} from "@/lib/domain/stock-sparkline";
import { historyUrl, stockCandlesUrl } from "@/lib/server/integrations/moex/endpoints";
import { mapHistoryBars, mapIntradayCandlesBars } from "@/lib/server/integrations/moex/mappers";
import { moexGetJson } from "@/lib/server/integrations/moex/client";
import { moexPayloadSchema } from "@/lib/server/integrations/moex/validators";
import { getSessionProgress } from "@/lib/server/domain/stock-activity";

const MAX_SECIDS = 8;
const BATCH_CACHE_TTL_MS = 20_000;
const batchCache = new Map<string, { expiresAt: number; payload: StockSparklineBatchResponse }>();

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

function moscowWeekday(now = new Date()): number {
  const label = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Moscow", weekday: "short" }).format(now);
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  return map[label] ?? 0;
}

export function isMoexStockSessionOpen(now = new Date()): boolean {
  const weekday = moscowWeekday(now);
  if (weekday < 1 || weekday > 5) return false;
  const progress = getSessionProgress(now);
  return progress > 0.01 && progress < 0.995;
}

function emptySeries(
  secid: string,
  source: StockSparklineSeries["source"],
  interval: StockSparklineSeries["interval"],
  error?: string,
): StockSparklineSeries {
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

async function fetchIntradaySeries(secid: string, interval: 10 | 60): Promise<StockSparklineSeries> {
  const today = moscowDateKey();
  try {
    const payload = moexPayloadSchema.parse(
      await moexGetJson(stockCandlesUrl(secid, today, today, interval), 60),
    );
    const table = payload.candles;
    if (!table?.data?.length) {
      return emptySeries(secid, "intraday", interval);
    }

    const candles: StockSparklineCandle[] = mapIntradayCandlesBars(table.columns, table.data)
      .filter((bar) => bar.close != null && Number.isFinite(bar.close))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map((bar) => ({ time: bar.timestamp, close: bar.close! }));

    if (candles.length < 3) {
      return emptySeries(secid, "intraday", interval);
    }

    return {
      secid,
      status: "ok",
      source: "intraday",
      interval,
      candles,
      candleCount: candles.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return emptySeries(secid, "intraday", interval, message);
  }
}

async function fetchDailySeries(secid: string, days: number): Promise<StockSparklineSeries> {
  const till = new Date();
  const from = new Date(till.getTime() - Math.max(days + 8, 12) * 24 * 3600 * 1000);

  try {
    const payload = moexPayloadSchema.parse(
      await moexGetJson(historyUrl("stock", secid, formatDate(from), formatDate(till)), 120),
    );
    const history = payload.history;
    if (!history?.data?.length) {
      return emptySeries(secid, "daily", 24);
    }

    const candles: StockSparklineCandle[] = mapHistoryBars(history.columns, history.data)
      .filter((bar) => bar.close != null && Number.isFinite(bar.close))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-days)
      .map((bar) => ({
        time: formatDate(bar.date),
        close: bar.close!,
      }));

    if (candles.length < 3) {
      return emptySeries(secid, "daily", 24);
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
    return emptySeries(secid, "daily", 24, message);
  }
}

async function fetchSeriesForTicker(
  secid: string,
  options: { interval: 10 | 60; days: number; preferIntraday: boolean },
): Promise<StockSparklineSeries> {
  if (options.preferIntraday) {
    const intraday = await fetchIntradaySeries(secid, options.interval);
    if (intraday.status === "ok") return intraday;
  }

  const daily = await fetchDailySeries(secid, options.days);
  if (daily.status === "ok") return daily;

  if (options.preferIntraday) {
    return emptySeries(secid, "daily", 24);
  }

  return daily;
}

export async function buildStockSparklineBatch(
  secids: string[],
  options?: { interval?: 10 | 60; days?: number },
): Promise<StockSparklineBatchResponse> {
  const interval = options?.interval === 60 ? 60 : 10;
  const days = Math.min(10, Math.max(3, options?.days ?? 5));

  const unique = [...new Set(secids.map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, MAX_SECIDS);
  const cacheKey = `${unique.join(",")}|${interval}|${days}|${moscowDateKey()}|${isMoexStockSessionOpen() ? "open" : "closed"}`;
  const cached = batchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const preferIntraday = isMoexStockSessionOpen();
  const series = await Promise.all(
    unique.map((secid) => fetchSeriesForTicker(secid, { interval, days, preferIntraday })),
  );

  const payload: StockSparklineBatchResponse = {
    fetchedAt: new Date().toISOString(),
    series,
  };

  batchCache.set(cacheKey, { expiresAt: Date.now() + BATCH_CACHE_TTL_MS, payload });
  return payload;
}

export { MAX_SECIDS as STOCK_SPARKLINE_MAX_SECIDS };
