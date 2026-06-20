/**
 * Единый fetcher intraday-свечей MOEX ISS для CBR replay и lab.
 * Server-side only. Без demo/fake fallback.
 */

import {
  CBR_SESSION_END_MSK,
  CBR_SESSION_START_MSK,
  getEventWindow,
} from "@/lib/domain/cbr-rate-event-window";
import { moexCandlesUrl } from "@/lib/server/integrations/moex/endpoints";
import { mapIntradayCandlesBars } from "@/lib/server/integrations/moex/mappers";
import { moexGetJson } from "@/lib/server/integrations/moex/client";
import { moexPayloadSchema } from "@/lib/server/integrations/moex/validators";

const MOEX_ISS_BASE = process.env.MOEX_BASE_URL ?? "https://iss.moex.com/iss";
const MOEX_CACHE_SEC = 120;
const MAX_PAGES = 8;
const PAGE_SIZE = 500;

export type MoexCandleInterval = 1 | 5 | 15;

const ALLOWED_INTERVALS = new Set<MoexCandleInterval>([1, 5, 15]);

export type MoexNormalizedCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  value?: number;
};

export type FetchMoexCandlesParams = {
  engine: string;
  market: string;
  board?: string;
  security: string;
  /** YYYY-MM-DD — торговый день заседания ЦБ */
  date: string;
  interval: MoexCandleInterval;
};

export type FetchMoexCandlesResult = {
  status: "moex" | "no_data" | "error";
  candles: MoexNormalizedCandle[];
  sourceUrl: string;
  errorMessage?: string;
};

function logMoexCandles(
  level: "warn" | "error",
  message: string,
  context: Record<string, string | number | undefined>,
) {
  const payload = { ...context, message };
  if (level === "error") {
    console.error("[fetchMoexCandles]", payload);
  } else {
    console.warn("[fetchMoexCandles]", payload);
  }
}

function buildIssPath(params: {
  engine: string;
  market: string;
  board?: string;
  security: string;
  from: string;
  till: string;
  interval: number;
  start?: number;
}): string {
  return moexCandlesUrl({
    engine: params.engine,
    market: params.market,
    secid: params.security.trim().toUpperCase(),
    board: params.board,
    from: params.from,
    till: params.till,
    interval: params.interval,
    start: params.start,
  });
}

function normalizeBarsToCandles(
  bars: ReturnType<typeof mapIntradayCandlesBars>,
  window: ReturnType<typeof getEventWindow>,
): MoexNormalizedCandle[] {
  const out: MoexNormalizedCandle[] = [];

  for (const bar of bars) {
    if (bar.close == null || !Number.isFinite(bar.close)) continue;
    const time = Math.floor(new Date(bar.timestamp).getTime() / 1000);
    if (time < window.startUnix || time > window.endUnix) continue;

    out.push({
      time,
      open: bar.open ?? bar.close,
      high: bar.high ?? bar.close,
      low: bar.low ?? bar.close,
      close: bar.close,
      volume: bar.volume ?? undefined,
      value: bar.turnover ?? undefined,
    });
  }

  return out.sort((a, b) => a.time - b.time);
}

/**
 * Загрузка свечей MOEX ISS на торговый день заседания ЦБ.
 * Окно: 10:00–19:00 MSK. ISS from/till — календарная дата; фильтр по времени после загрузки.
 */
export async function fetchMoexCandles(
  params: FetchMoexCandlesParams,
): Promise<FetchMoexCandlesResult> {
  const security = params.security.trim().toUpperCase();
  const day = params.date.slice(0, 10);
  const window = getEventWindow(day);

  if (!ALLOWED_INTERVALS.has(params.interval)) {
    const errorMessage = `Недопустимый interval: ${params.interval} (допустимо: 1, 5, 15)`;
    logMoexCandles("error", errorMessage, {
      security,
      engine: params.engine,
      market: params.market,
      board: params.board,
      date: day,
    });
    return {
      status: "error",
      candles: [],
      sourceUrl: "",
      errorMessage,
    };
  }

  const issFrom = day;
  const issTill = day;
  const firstPath = buildIssPath({
    engine: params.engine,
    market: params.market,
    board: params.board,
    security,
    from: issFrom,
    till: issTill,
    interval: params.interval,
    start: 0,
  });
  const sourceUrl = `${MOEX_ISS_BASE}${firstPath}`;

  try {
    const merged: ReturnType<typeof mapIntradayCandlesBars> = [];

    for (let page = 0; page < MAX_PAGES; page++) {
      const path = buildIssPath({
        engine: params.engine,
        market: params.market,
        board: params.board,
        security,
        from: issFrom,
        till: issTill,
        interval: params.interval,
        start: page * PAGE_SIZE,
      });

      const payload = moexPayloadSchema.parse(await moexGetJson(path, MOEX_CACHE_SEC));
      const table = payload.candles;
      if (!table?.data?.length) break;

      merged.push(...mapIntradayCandlesBars(table.columns, table.data));
      if (table.data.length < PAGE_SIZE) break;
    }

    const candles = normalizeBarsToCandles(merged, window);

    if (!merged.length) {
      const errorMessage = `MOEX ISS вернул 0 строк candles за ${day} (${security})`;
      logMoexCandles("warn", errorMessage, {
        security,
        engine: params.engine,
        market: params.market,
        board: params.board,
        interval: params.interval,
        windowFrom: `${day} ${CBR_SESSION_START_MSK} MSK`,
        windowTill: `${day} ${CBR_SESSION_END_MSK} MSK`,
        sourceUrl,
      });
      return { status: "no_data", candles: [], sourceUrl, errorMessage };
    }

    if (!candles.length) {
      const errorMessage = `MOEX ISS: ${merged.length} строк за день, но 0 свечей в окне ${CBR_SESSION_START_MSK}–${CBR_SESSION_END_MSK} MSK`;
      logMoexCandles("warn", errorMessage, {
        security,
        engine: params.engine,
        market: params.market,
        board: params.board,
        interval: params.interval,
        rawBars: merged.length,
        sourceUrl,
      });
      return { status: "no_data", candles: [], sourceUrl, errorMessage };
    }

    return { status: "moex", candles, sourceUrl };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logMoexCandles("error", errorMessage, {
      security,
      engine: params.engine,
      market: params.market,
      board: params.board,
      date: day,
      sourceUrl,
    });
    return { status: "error", candles: [], sourceUrl, errorMessage };
  }
}
