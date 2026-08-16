import type { IntradaySparkline2sResponse } from "@/lib/domain/intraday-sparkline-2s";
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
/** Совпадает с `useRadarSparklineCandles` (до 24 тикеров радара). */
const RADAR_SPARKLINE_MAX_SECIDS = 24;
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

function candleSessionKey(timestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

function lookbackDateKey(days: number, from = new Date()): string {
  return moscowDateKey(new Date(from.getTime() - days * 24 * 3600 * 1000));
}

async function fetchTwoSessionIntradaySeries(secid: string, interval: 10 | 60): Promise<StockSparklineSeries> {
  const till = moscowDateKey();
  // A calendar window is intentional: on weekends and holidays the nearest
  // previous weekday alone contains only one real trading session.
  const from = lookbackDateKey(7);

  try {
    const payload = moexPayloadSchema.parse(
      await moexGetJson(stockCandlesUrl(secid, from, till, interval), 90),
    );
    const table = payload.candles;
    if (!table?.data?.length) {
      return { ...emptySeries(secid, "intraday", interval), scope: "twoSessions", sessionKeys: [] };
    }

    const allCandles: StockSparklineCandle[] = mapIntradayCandlesBars(table.columns, table.data)
      .filter((bar) => bar.close != null && Number.isFinite(bar.close))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map((bar) => ({
        time: bar.timestamp,
        close: bar.close!,
        turnover: bar.turnover,
        volume: bar.volume,
        sessionKey: candleSessionKey(bar.timestamp),
      }));

    const allSessionKeys = [...new Set(allCandles.map((c) => c.sessionKey).filter(Boolean))] as string[];
    const sessionKeys = allSessionKeys.slice(-2);
    const selectedSessions = new Set(sessionKeys);
    const candles = allCandles.filter((candle) => candle.sessionKey && selectedSessions.has(candle.sessionKey));

    if (candles.length < 3 || sessionKeys.length < 2) {
      return {
        ...emptySeries(secid, "intraday", interval),
        scope: "twoSessions",
        sessionKeys,
        candles,
        candleCount: candles.length,
        status: "no-data",
      };
    }

    return {
      secid,
      status: "ok",
      source: "intraday",
      interval,
      scope: "twoSessions",
      sessionKeys,
      candles,
      candleCount: candles.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...emptySeries(secid, "intraday", interval, message), scope: "twoSessions", sessionKeys: [] };
  }
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
  options?: { interval?: 10 | 60; days?: number; sessions?: 1 | 2 },
): Promise<StockSparklineBatchResponse> {
  const interval = options?.interval === 60 ? 60 : 10;
  const days = Math.min(10, Math.max(3, options?.days ?? 5));
  const twoSessions = options?.sessions === 2;
  const maxSecids = twoSessions ? RADAR_SPARKLINE_MAX_SECIDS : MAX_SECIDS;

  const unique = [...new Set(secids.map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, maxSecids);
  const cacheKey = `${unique.join(",")}|${interval}|${days}|${twoSessions ? "2s" : "1s"}|${moscowDateKey()}|${isMoexStockSessionOpen() ? "open" : "closed"}`;
  const cached = batchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const preferIntraday = isMoexStockSessionOpen();
  const series = await Promise.all(
    unique.map((secid) =>
      twoSessions
        ? fetchTwoSessionIntradaySeries(secid, interval)
        : fetchSeriesForTicker(secid, { interval, days, preferIntraday }),
    ),
  );

  const payload: StockSparklineBatchResponse = {
    fetchedAt: new Date().toISOString(),
    series,
  };

  batchCache.set(cacheKey, { expiresAt: Date.now() + BATCH_CACHE_TTL_MS, payload });
  return payload;
}

const HOVER_SPARKLINE_CACHE_TTL_MS = 25_000;
const hoverSparklineCache = new Map<string, { expiresAt: number; payload: IntradaySparkline2sResponse }>();

function downsampleSparklinePoints(candles: StockSparklineCandle[], target = 64): { t: number; p: number }[] {
  if (candles.length === 0) return [];
  if (candles.length <= target) {
    return candles.map((c) => ({ t: new Date(c.time).getTime(), p: c.close }));
  }
  const out: { t: number; p: number }[] = [];
  const step = candles.length / target;
  for (let i = 0; i < target; i++) {
    const idx = Math.min(candles.length - 1, Math.floor(i * step));
    const candle = candles[idx]!;
    out.push({ t: new Date(candle.time).getTime(), p: candle.close });
  }
  return out;
}

/** Компактный 2С sparkline для hover-card (40–80 точек). */
export async function buildIntradaySparklineHover(ticker: string): Promise<IntradaySparkline2sResponse> {
  const secid = ticker.trim().toUpperCase();
  const cacheKey = `${secid}|${moscowDateKey()}|hover-2s`;
  const cached = hoverSparklineCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const series = await fetchTwoSessionIntradaySeries(secid, 10);
  const closes = series.candles.map((c) => c.close).filter((v) => Number.isFinite(v));
  const points = downsampleSparklinePoints(series.candles, 64);
  const high = closes.length ? Math.max(...closes) : 0;
  const low = closes.length ? Math.min(...closes) : 0;

  const sessionKeys = series.sessionKeys ?? [];
  let prevClose: number | null = null;
  if (sessionKeys.length >= 2) {
    const prevKey = sessionKeys[sessionKeys.length - 2];
    const prevSession = series.candles.filter((c) => c.sessionKey === prevKey);
    if (prevSession.length) prevClose = prevSession[prevSession.length - 1]?.close ?? null;
  }

  const payload: IntradaySparkline2sResponse = {
    ticker: secid,
    points,
    prevClose,
    high,
    low,
    cachedAt: new Date().toISOString(),
  };

  hoverSparklineCache.set(cacheKey, { expiresAt: Date.now() + HOVER_SPARKLINE_CACHE_TTL_MS, payload });
  return payload;
}

export { MAX_SECIDS as STOCK_SPARKLINE_MAX_SECIDS, RADAR_SPARKLINE_MAX_SECIDS };
