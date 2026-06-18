import {
  avgCumulativeTurnoverAtTime,
  buildIntradayBaselineMetric,
  formatMoscowTimeLabel,
  type DailyHistoryBaseline,
  type IntradayBaselineMetric,
  type IntradayCandlePoint,
} from "@/lib/domain/intraday-baseline";
import { getSessionProgress } from "@/lib/server/domain/stock-activity";
import { moexGetJson } from "@/lib/server/integrations/moex/client";
import { stockCandlesUrl } from "@/lib/server/integrations/moex/endpoints";
import { mapIntradayCandlesBars } from "@/lib/server/integrations/moex/mappers";
import { moexPayloadSchema } from "@/lib/server/integrations/moex/validators";
import { canUsePrismaHistoricalBaselines } from "@/lib/server/screener-env";

const CACHE_TTL_MS = 5 * 60_000;
const INTRADAY_TOP_N = 35;
const CANDLE_LOOKBACK_DAYS = 28;

type StockLiveRow = {
  ticker: string;
  turnover: number | null;
  tradesCount: number | null;
};

type PrismaDailyBaseline = {
  avgDailyTurnover20d: number | null;
  avgDailyTrades20d: number | null;
  previousDayTurnover: number | null;
  previousDayTrades: number | null;
  historyDays: number;
};

const batchCache = new Map<string, { expiresAt: number; payload: Map<string, IntradayBaselineMetric> }>();
const candleCache = new Map<string, { expiresAt: number; candles: IntradayCandlePoint[] }>();

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function moscowDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function moscowMinutes(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Moscow",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function formatMoscowDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function formatDate(d: Date): string {
  return formatMoscowDate(d);
}

function toCandlePoints(bars: ReturnType<typeof mapIntradayCandlesBars>): IntradayCandlePoint[] {
  return bars
    .filter((bar) => bar.turnover != null && bar.turnover > 0)
    .map((bar) => {
      const dayKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Moscow",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(bar.date);
      const isoMatch = bar.timestamp.match(/T(\d{2}):(\d{2})/);
      const minutesMsk = isoMatch
        ? Number(isoMatch[1]) * 60 + Number(isoMatch[2])
        : moscowMinutes(bar.date);
      return { dayKey, minutesMsk, turnover: bar.turnover! };
    });
}

async function fetchIntradayCandlesForTicker(ticker: string): Promise<IntradayCandlePoint[]> {
  const cached = candleCache.get(ticker);
  if (cached && cached.expiresAt > Date.now()) return cached.candles;

  const till = moscowDateKey();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - CANDLE_LOOKBACK_DAYS);
  const from = formatDate(fromDate);

  try {
    const payload = moexPayloadSchema.parse(await moexGetJson(stockCandlesUrl(ticker, from, till, 10), 60));
    const table = payload.candles;
    if (!table?.data?.length) return [];

    const candles = toCandlePoints(mapIntradayCandlesBars(table.columns, table.data));
    candleCache.set(ticker, { expiresAt: Date.now() + CACHE_TTL_MS, candles });
    return candles;
  } catch {
    return [];
  }
}

async function loadPrismaDailyBaselines(tickers: string[]): Promise<Map<string, PrismaDailyBaseline>> {
  const result = new Map<string, PrismaDailyBaseline>();
  if (!canUsePrismaHistoricalBaselines() || tickers.length === 0) return result;

  try {
    const { db } = await import("@/lib/server/db");
    const instruments = await db.instrument.findMany({
      where: { ticker: { in: tickers }, assetClass: "stock", isActive: true },
      select: {
        ticker: true,
        dailyBars: { orderBy: { barDate: "desc" }, take: 20 },
      },
    });

    for (const instrument of instruments) {
      const bars = instrument.dailyBars;
      const turnovers = bars.map((b) => b.turnover).filter((v): v is number => v != null && v > 0);
      result.set(instrument.ticker, {
        avgDailyTurnover20d: average(turnovers),
        avgDailyTrades20d: null,
        previousDayTurnover: bars[0]?.turnover ?? null,
        previousDayTrades: null,
        historyDays: turnovers.length,
      });
    }
  } catch {
    /* prisma недоступен */
  }

  return result;
}

function emptyMetric(
  row: StockLiveRow,
  now: Date,
  daily: DailyHistoryBaseline | null,
): IntradayBaselineMetric {
  return buildIntradayBaselineMetric({
    secid: row.ticker,
    timeMsk: formatMoscowTimeLabel(now),
    currentTurnover: row.turnover,
    currentTrades: row.tradesCount,
    sessionProgress: getSessionProgress(now),
    intradayAvgTurnoverAtTime: null,
    intradaySessions: 0,
    daily,
  });
}

/**
 * Загружает intraday baseline для акций скринера.
 * Top-N ликвидных — MOEX intraday candles (ok/partial); остальные — rough/partial из daily или no-history.
 */
export async function loadIntradayBaselinesForStocks(
  rows: StockLiveRow[],
  now = new Date(),
): Promise<Map<string, IntradayBaselineMetric>> {
  const stockRows = rows.filter((r) => r.ticker);
  if (!stockRows.length) return new Map();

  const cacheKey = `${moscowDateKey(now)}|${Math.floor(moscowMinutes(now) / 5)}|${stockRows.length}`;
  const cached = batchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;

  const tickers = stockRows.map((r) => r.ticker);
  const prismaDaily = await loadPrismaDailyBaselines(tickers);
  const cutoffMinutes = moscowMinutes(now);
  const sessionProgress = getSessionProgress(now);

  const topTickers = [...stockRows]
    .sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0))
    .slice(0, INTRADAY_TOP_N)
    .map((r) => r.ticker);

  const intradayByTicker = new Map<
    string,
    { avg: number | null; sessions: number; firstDate: string | null; lastDate: string | null }
  >();
  await Promise.all(
    topTickers.map(async (ticker) => {
      const candles = await fetchIntradayCandlesForTicker(ticker);
      intradayByTicker.set(ticker, avgCumulativeTurnoverAtTime(candles, cutoffMinutes));
    }),
  );

  const payload = new Map<string, IntradayBaselineMetric>();
  for (const row of stockRows) {
    const dailyRaw = prismaDaily.get(row.ticker);
    const daily: DailyHistoryBaseline | null = dailyRaw
      ? {
          avgDailyTurnover20d: dailyRaw.avgDailyTurnover20d,
          avgDailyTrades20d: dailyRaw.avgDailyTrades20d,
          previousDayTurnover: dailyRaw.previousDayTurnover,
          previousDayTrades: dailyRaw.previousDayTrades,
          historyDays: dailyRaw.historyDays,
        }
      : null;

    const intraday = intradayByTicker.get(row.ticker);
    const metric =
      intraday && intraday.avg != null && intraday.avg > 0
        ? buildIntradayBaselineMetric({
            secid: row.ticker,
            timeMsk: formatMoscowTimeLabel(now),
            currentTurnover: row.turnover,
            currentTrades: row.tradesCount,
            sessionProgress,
            intradayAvgTurnoverAtTime: intraday.avg,
            intradaySessions: intraday.sessions,
            intradayFirstDate: intraday.firstDate,
            intradayLastDate: intraday.lastDate,
            daily,
          })
        : emptyMetric(row, now, daily);

    payload.set(row.ticker, metric);
  }

  batchCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
  return payload;
}
