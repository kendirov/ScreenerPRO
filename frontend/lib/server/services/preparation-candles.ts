import { historyUrl } from "@/lib/server/integrations/moex/endpoints";
import { mapHistoryBars } from "@/lib/server/integrations/moex/mappers";
import { moexGetJson } from "@/lib/server/integrations/moex/client";
import { moexPayloadSchema } from "@/lib/server/integrations/moex/validators";
import type {
  PreparationCandle,
  PreparationCandleSeries,
  PreparationCandlesResponse,
  PreparationInstrumentMarket,
} from "@/lib/domain/preparation-watchlist";
import { fetchFuturesDailyCandles } from "@/lib/server/services/moex-futures-candles";

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toCandle(bar: ReturnType<typeof mapHistoryBars>[number]): PreparationCandle | null {
  if (bar.close == null || !Number.isFinite(bar.close)) return null;
  return {
    date: formatDate(bar.date),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    turnover: bar.turnover ?? null,
  };
}

async function fetchStockDailyCandles(secid: string, days: number): Promise<PreparationCandleSeries> {
  const key = secid.trim().toUpperCase();
  if (!key) {
    return { secid: secid, market: "moex-stock", status: "empty", candles: [], error: "Пустой тикер" };
  }

  const till = new Date();
  const from = new Date(till.getTime() - Math.max(days + 8, 12) * 24 * 3600 * 1000);

  try {
    const payload = moexPayloadSchema.parse(
      await moexGetJson(historyUrl("stock", key, formatDate(from), formatDate(till)), 300),
    );
    const history = payload.history;
    if (!history?.data?.length) {
      return { secid: key, market: "moex-stock", status: "empty", candles: [] };
    }

    const candles = mapHistoryBars(history.columns, history.data)
      .map(toCandle)
      .filter((c): c is PreparationCandle => c != null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-days);

    if (!candles.length) {
      return { secid: key, market: "moex-stock", status: "empty", candles: [] };
    }

    return { secid: key, market: "moex-stock", status: "ok", candles };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { secid: key, market: "moex-stock", status: "error", candles: [], error: message };
  }
}

async function fetchFutureDailyCandles(secid: string, days: number): Promise<PreparationCandleSeries> {
  const key = secid.trim().toUpperCase();
  const result = await fetchFuturesDailyCandles(key, days, 24);
  const candles: PreparationCandle[] = result.points.map((p) => ({
    date: p.date,
    open: p.open ?? null,
    high: p.high ?? null,
    low: p.low ?? null,
    close: p.close,
    volume: p.volume ?? null,
  }));

  if (result.status === "ok" && candles.length) {
    return { secid: key, market: "moex-future", status: "ok", candles };
  }

  return {
    secid: key,
    market: "moex-future",
    status: result.status === "error" ? "error" : "empty",
    candles: [],
    error: result.error,
  };
}

export async function fetchPreparationCandlesForItem(
  secid: string,
  market: PreparationInstrumentMarket,
  days: number,
): Promise<PreparationCandleSeries> {
  if (market === "global" || market === "manual") {
    return {
      secid,
      market,
      status: "unavailable",
      candles: [],
      error: "Внешний источник не подключён",
    };
  }

  if (market === "moex-stock") {
    return fetchStockDailyCandles(secid, days);
  }

  return fetchFutureDailyCandles(secid, days);
}

export type PreparationCandlesRequestItem = {
  secid: string;
  market: PreparationInstrumentMarket;
};

export async function buildPreparationCandlesResponse(
  items: PreparationCandlesRequestItem[],
  days: number,
): Promise<PreparationCandlesResponse> {
  const unique = new Map<string, PreparationCandlesRequestItem>();
  for (const item of items) {
    if (item.market !== "moex-stock" && item.market !== "moex-future") continue;
    const key = `${item.market}:${item.secid.toUpperCase()}`;
    unique.set(key, { secid: item.secid.toUpperCase(), market: item.market });
  }

  const diagnostics: string[] = [];
  const series = await Promise.all(
    [...unique.values()].map(async (item) => {
      const result = await fetchPreparationCandlesForItem(item.secid, item.market, days);
      if (result.status === "empty") diagnostics.push(`${item.secid}: нет свечей MOEX ISS`);
      if (result.status === "error") diagnostics.push(`${item.secid}: ${result.error ?? "ошибка"}`);
      return result;
    }),
  );

  const okCount = series.filter((s) => s.status === "ok").length;

  return {
    days,
    source: okCount > 0 ? "moex" : "unavailable",
    series,
    diagnostics,
  };
}
