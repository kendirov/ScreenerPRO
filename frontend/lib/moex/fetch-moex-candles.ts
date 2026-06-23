/**
 * Единый fetcher intraday-свечей MOEX ISS для CBR replay и lab.
 * Server-side only. Без demo/fake fallback.
 */

import {
  aggregateMoexCandles,
  isMoexUiCandleInterval,
  resolveMoexIssFallbackPlan,
  resolveMoexIssFetchPlan,
  resolveMoexCandlesBoard,
  type MoexUiCandleInterval,
} from "@/lib/moex/moex-iss-interval";
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
const MAX_PAGES = 12;
const PAGE_SIZE = 500;

export type MoexCandleInterval = MoexUiCandleInterval;

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
  issIntervalMinutes?: number;
  resampledToMinutes?: number | null;
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

async function fetchIssBars(
  params: FetchMoexCandlesParams & { board?: string; issIntervalMinutes: number },
): Promise<{ bars: ReturnType<typeof mapIntradayCandlesBars>; sourceUrl: string }> {
  const security = params.security.trim().toUpperCase();
  const day = params.date.slice(0, 10);
  const merged: ReturnType<typeof mapIntradayCandlesBars> = [];

  const firstPath = buildIssPath({
    engine: params.engine,
    market: params.market,
    board: params.board,
    security,
    from: day,
    till: day,
    interval: params.issIntervalMinutes,
    start: 0,
  });
  const sourceUrl = `${MOEX_ISS_BASE}${firstPath}`;

  for (let page = 0; page < MAX_PAGES; page++) {
    const path = buildIssPath({
      engine: params.engine,
      market: params.market,
      board: params.board,
      security,
      from: day,
      till: day,
      interval: params.issIntervalMinutes,
      start: page * PAGE_SIZE,
    });

    const payload = moexPayloadSchema.parse(await moexGetJson(path, MOEX_CACHE_SEC));
    const table = payload.candles;
    if (!table?.data?.length) break;

    merged.push(...mapIntradayCandlesBars(table.columns, table.data));
    if (table.data.length < PAGE_SIZE) break;
  }

  return { bars: merged, sourceUrl };
}

async function fetchWithPlan(
  params: FetchMoexCandlesParams,
  plan: ReturnType<typeof resolveMoexIssFetchPlan>,
  board: string | undefined,
): Promise<FetchMoexCandlesResult> {
  const security = params.security.trim().toUpperCase();
  const day = params.date.slice(0, 10);
  const window = getEventWindow(day);

  const { bars, sourceUrl } = await fetchIssBars({
    ...params,
    board,
    issIntervalMinutes: plan.issIntervalMinutes,
  });

  let candles = normalizeBarsToCandles(bars, window);
  if (plan.resampleToMinutes && candles.length) {
    candles = aggregateMoexCandles(candles, plan.resampleToMinutes);
  }

  return {
    status: candles.length ? "moex" : bars.length ? "no_data" : "no_data",
    candles,
    sourceUrl,
    issIntervalMinutes: plan.issIntervalMinutes,
    resampledToMinutes: plan.resampleToMinutes,
    errorMessage: candles.length
      ? undefined
      : bars.length
        ? `MOEX ISS: ${bars.length} строк (${plan.issIntervalMinutes}м), но 0 свечей в окне ${CBR_SESSION_START_MSK}–${CBR_SESSION_END_MSK} MSK`
        : `MOEX ISS вернул 0 строк candles за ${day} (${security}, ISS interval=${plan.issIntervalMinutes})`,
  };
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
  const board = resolveMoexCandlesBoard(params.engine, params.market, params.board);

  if (!isMoexUiCandleInterval(params.interval)) {
    const errorMessage = `Недопустимый interval: ${params.interval} (допустимо: 1, 5, 15, 60)`;
    logMoexCandles("error", errorMessage, {
      security,
      engine: params.engine,
      market: params.market,
      board,
      date: day,
    });
    return {
      status: "error",
      candles: [],
      sourceUrl: "",
      errorMessage,
    };
  }

  const primaryPlan = resolveMoexIssFetchPlan(params.interval);

  try {
    let result = await fetchWithPlan(params, primaryPlan, board);

    if (!result.candles.length) {
      const fallbackPlan = resolveMoexIssFallbackPlan(params.interval);
      if (fallbackPlan) {
        const fallback = await fetchWithPlan(params, fallbackPlan, board);
        if (fallback.candles.length) {
          result = {
            ...fallback,
            errorMessage: `ISS ${primaryPlan.issIntervalMinutes}м пусто — использован fallback ${fallbackPlan.issIntervalMinutes}м (целевой ТФ ${params.interval}м)`,
          };
        }
      }
    }

    if (!result.candles.length) {
      logMoexCandles("warn", result.errorMessage ?? "no_data", {
        security,
        engine: params.engine,
        market: params.market,
        board,
        targetInterval: params.interval,
        issInterval: result.issIntervalMinutes,
        sourceUrl: result.sourceUrl,
      });
      return { ...result, status: "no_data" };
    }

    return { ...result, status: "moex" };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const firstPath = buildIssPath({
      engine: params.engine,
      market: params.market,
      board,
      security,
      from: day,
      till: day,
      interval: primaryPlan.issIntervalMinutes,
      start: 0,
    });
    const sourceUrl = `${MOEX_ISS_BASE}${firstPath}`;
    logMoexCandles("error", errorMessage, {
      security,
      engine: params.engine,
      market: params.market,
      board,
      date: day,
      sourceUrl,
    });
    return { status: "error", candles: [], sourceUrl, errorMessage };
  }
}
