import type { MarketFlowYesterdayItem, MarketFlowYesterdayResponse, YesterdayFlowContext } from "@/lib/domain/market-flow-map";
import { stockCandlesUrl } from "@/lib/server/integrations/moex/endpoints";
import { mapIntradayCandlesBars } from "@/lib/server/integrations/moex/mappers";
import { moexGetJson } from "@/lib/server/integrations/moex/client";
import { moexPayloadSchema } from "@/lib/server/integrations/moex/validators";

export type YesterdayTickerSnapshot = MarketFlowYesterdayItem;

export type { MarketFlowYesterdayResponse };

const CACHE_TTL_MS = 120_000;
const cache = new Map<string, { expiresAt: number; snapshot: YesterdayTickerSnapshot }>();

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function moscowParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Moscow",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";

  return {
    minutes: hour * 60 + minute,
    dateKey: `${year}-${month}-${day}`,
    iso: `${year}-${month}-${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+03:00`,
  };
}

function previousTradingDate(fromDateKey: string): string {
  const [y, m, d] = fromDateKey.split("-").map(Number);
  const cursor = new Date(Date.UTC(y!, m! - 1, d!));
  for (let i = 0; i < 6; i++) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      return formatDate(cursor);
    }
  }
  return formatDate(cursor);
}

function candleMinutesMsk(timestamp: string): number | null {
  const match = timestamp.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function computeSnapshotFromCandles(
  candles: ReturnType<typeof mapIntradayCandlesBars>,
  targetMinutes: number,
): Pick<YesterdayFlowContext, "turnoverAtSameTime" | "openChangePctAtSameTime"> {
  if (!candles.length) {
    return { turnoverAtSameTime: null, openChangePctAtSameTime: null };
  }

  const sorted = [...candles].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const dayOpen = sorted.find((c) => c.open != null)?.open ?? sorted[0]?.open ?? null;

  let turnover = 0;
  let lastClose: number | null = null;

  for (const candle of sorted) {
    const mins = candleMinutesMsk(candle.timestamp);
    if (mins == null || mins > targetMinutes) break;
    turnover += candle.turnover ?? 0;
    if (candle.close != null) lastClose = candle.close;
  }

  let openChangePctAtSameTime: number | null = null;
  if (dayOpen != null && lastClose != null && dayOpen > 0) {
    openChangePctAtSameTime = ((lastClose - dayOpen) / dayOpen) * 100;
  }

  return {
    turnoverAtSameTime: turnover > 0 ? turnover : null,
    openChangePctAtSameTime,
  };
}

async function fetchTickerYesterdaySnapshot(
  secid: string,
  tradingDate: string,
  targetMinutes: number,
): Promise<YesterdayTickerSnapshot> {
  const key = secid.trim().toUpperCase();
  if (!key) {
    return {
      secid: key,
      turnoverAtSameTime: null,
      openChangePctAtSameTime: null,
      source: "none",
      status: "error",
      error: "Пустой тикер",
    };
  }

  const cacheKey = `${tradingDate}:${targetMinutes}:${key}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.snapshot;

  try {
    const payload = moexPayloadSchema.parse(
      await moexGetJson(stockCandlesUrl(key, tradingDate, tradingDate, 10), 300),
    );
    const table = payload.candles;
    if (!table?.columns?.length || !table.data?.length) {
      const empty: YesterdayTickerSnapshot = {
        secid: key,
        turnoverAtSameTime: null,
        openChangePctAtSameTime: null,
        source: "none",
        status: "empty",
      };
      cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, snapshot: empty });
      return empty;
    }

    const candles = mapIntradayCandlesBars(table.columns, table.data);
    const computed = computeSnapshotFromCandles(candles, targetMinutes);
    const snapshot: YesterdayTickerSnapshot = {
      secid: key,
      ...computed,
      source: computed.turnoverAtSameTime != null ? "moex-intraday" : "none",
      status: computed.turnoverAtSameTime != null ? "ok" : "empty",
    };
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, snapshot });
    return snapshot;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      secid: key,
      turnoverAtSameTime: null,
      openChangePctAtSameTime: null,
      source: "none",
      status: "error",
      error: message,
    };
  }
}

export async function buildMarketMapYesterdayResponse(tickers: string[]): Promise<MarketFlowYesterdayResponse> {
  const unique = [...new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))].slice(0, 60);
  const msk = moscowParts();
  const prevDate = previousTradingDate(msk.dateKey);
  const diagnostics: string[] = [];

  if (!unique.length) {
    return {
      asOfMsk: msk.iso,
      previousTradingDate: prevDate,
      source: "unavailable",
      items: [],
      diagnostics: ["Не переданы тикеры"],
    };
  }

  const items = await Promise.all(
    unique.map((secid) => fetchTickerYesterdaySnapshot(secid, prevDate, msk.minutes)),
  );

  for (const item of items) {
    if (item.status === "empty") diagnostics.push(`${item.secid}: нет свечей за ${prevDate}`);
    if (item.status === "error") diagnostics.push(`${item.secid}: ${item.error ?? "ошибка"}`);
  }

  const okCount = items.filter((i) => i.status === "ok").length;

  return {
    asOfMsk: msk.iso,
    previousTradingDate: prevDate,
    source: okCount > 0 ? "moex" : "unavailable",
    items,
    diagnostics,
  };
}
