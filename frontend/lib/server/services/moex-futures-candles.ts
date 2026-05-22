import type { IntradayCandlePoint } from "@/lib/domain/currency-correlation-intraday";
import type { CurrencyHistoryPoint } from "@/lib/domain/currency-correlation-history";
import { futuresCandleBordersUrl, futuresCandlesUrl } from "@/lib/server/integrations/moex/endpoints";
import { mapCandlesBars, mapIntradayCandlesBars } from "@/lib/server/integrations/moex/mappers";
import { moexGetJson } from "@/lib/server/integrations/moex/client";
import { moexPayloadSchema } from "@/lib/server/integrations/moex/validators";

export type FetchFuturesCandlesResult = {
  points: CurrencyHistoryPoint[];
  status: "ok" | "empty" | "error";
  error?: string;
  endpoint: "candles";
};

export type FetchFuturesIntradayResult = {
  points: IntradayCandlePoint[];
  status: "ok" | "empty" | "error";
  error?: string;
  requestedInterval: number;
  usedInterval: number;
  intervalNotice?: string;
};

/** Цепочка fallback для интрадей: 5м → 10м → 60м → день. */
export const INTRADAY_INTERVAL_FALLBACK_CHAIN = [5, 10, 60, 24] as const;

const candleBordersCache = new Map<string, { expiresAt: number; intervals: number[] }>();

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toHistoryPoint(bar: ReturnType<typeof mapCandlesBars>[number]): CurrencyHistoryPoint | null {
  if (bar.close == null || !Number.isFinite(bar.close)) return null;
  return {
    date: formatDate(bar.date),
    close: bar.close,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    volume: bar.volume,
  };
}

function toIntradayPoint(bar: ReturnType<typeof mapIntradayCandlesBars>[number]): IntradayCandlePoint | null {
  if (bar.close == null || !Number.isFinite(bar.close)) return null;
  return {
    timestamp: bar.timestamp,
    open: bar.open ?? bar.close,
    high: bar.high ?? bar.close,
    low: bar.low ?? bar.close,
    close: bar.close,
    volume: bar.volume,
    value: bar.turnover,
  };
}

function rowToObject(columns: string[], row: unknown[]) {
  return Object.fromEntries(columns.map((column, idx) => [column, row[idx]]));
}

function parseIntervalsFromBordersPayload(payload: Record<string, unknown>): number[] {
  const tables = ["borders", "candleborders", "durations"];
  const intervals = new Set<number>();

  for (const key of tables) {
    const table = payload[key] as { columns?: string[]; data?: unknown[][] } | undefined;
    if (!table?.columns?.length || !table.data?.length) continue;

    const intervalIdx = table.columns.findIndex((c) => c.toLowerCase() === "interval");
    if (intervalIdx < 0) continue;

    for (const row of table.data) {
      const item = rowToObject(table.columns, row);
      const raw = item.interval ?? item.INTERVAL ?? row[intervalIdx];
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) intervals.add(Math.trunc(n));
    }
  }

  return [...intervals].sort((a, b) => a - b);
}

/**
 * Доступные интервалы свечей по инструменту (candleborders).
 * При ошибке — пустой список (fallback-цепочка всё равно попробует запрос).
 */
export async function fetchFuturesCandleBorders(secid: string): Promise<number[]> {
  const key = secid.trim().toUpperCase();
  if (!key) return [];

  const cached = candleBordersCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.intervals;

  try {
    const payload = (await moexGetJson(futuresCandleBordersUrl(key), 120)) as Record<string, unknown>;
    const intervals = parseIntervalsFromBordersPayload(payload);
    candleBordersCache.set(key, { expiresAt: Date.now() + 10 * 60_000, intervals });
    return intervals;
  } catch {
    return [];
  }
}

function resolveIntervalChain(
  requested: number,
  available: number[],
): { chain: number[]; notice?: string } {
  const preferred = INTRADAY_INTERVAL_FALLBACK_CHAIN.includes(
    requested as (typeof INTRADAY_INTERVAL_FALLBACK_CHAIN)[number],
  )
    ? [requested, ...INTRADAY_INTERVAL_FALLBACK_CHAIN.filter((i) => i !== requested)]
    : [requested, ...INTRADAY_INTERVAL_FALLBACK_CHAIN];

  const uniquePreferred = [...new Set(preferred)];

  if (!available.length) {
    return { chain: uniquePreferred };
  }

  const allowed = uniquePreferred.filter((i) => available.includes(i));
  if (!allowed.length) {
    const nearest = [...available].sort(
      (a, b) => Math.abs(a - requested) - Math.abs(b - requested),
    )[0];
    if (nearest != null) {
      return {
        chain: [nearest],
        notice: `${requested}м недоступен, использован ${formatIntervalLabel(nearest)}`,
      };
    }
    return { chain: uniquePreferred };
  }

  if (!allowed.includes(requested)) {
    const used = allowed[0]!;
    return {
      chain: allowed,
      notice: `${formatIntervalLabel(requested)} недоступен, использован ${formatIntervalLabel(used)}`,
    };
  }

  return { chain: allowed };
}

function formatIntervalLabel(interval: number): string {
  if (interval === 24) return "день (24)";
  if (interval === 60) return "60м";
  if (interval === 1) return "1м";
  return `${interval}м`;
}

async function fetchCandlesAtInterval(
  secid: string,
  fromStr: string,
  tillStr: string,
  interval: number,
): Promise<IntradayCandlePoint[]> {
  const payload = moexPayloadSchema.parse(
    await moexGetJson(futuresCandlesUrl(secid, fromStr, tillStr, interval), 60),
  );
  const candles = payload.candles;
  if (!candles?.data?.length) return [];

  const bars = mapIntradayCandlesBars(candles.columns, candles.data);
  return bars
    .map(toIntradayPoint)
    .filter((p): p is IntradayCandlePoint => p != null)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Для графика Lab используем candles (`engines/futures/.../candles.json`),
 * потому что нужны стабильные OHLC/close по датам; history через `engines/stock`
 * для FORTS часто возвращает пустой ряд.
 */
export async function fetchFuturesDailyCandles(
  ticker: string,
  days: number,
  interval = 24,
): Promise<FetchFuturesCandlesResult> {
  const secid = ticker.trim().toUpperCase();
  if (!secid) {
    return { points: [], status: "empty", error: "Пустой тикер", endpoint: "candles" };
  }

  const till = new Date();
  const from = new Date(till.getTime() - Math.max(days + 10, 14) * 24 * 3600 * 1000);
  const fromStr = formatDate(from);
  const tillStr = formatDate(till);

  try {
    const payload = moexPayloadSchema.parse(
      await moexGetJson(futuresCandlesUrl(secid, fromStr, tillStr, interval), 300),
    );
    const candles = payload.candles;
    if (!candles?.data?.length) {
      return { points: [], status: "empty", endpoint: "candles" };
    }

    const bars = mapCandlesBars(candles.columns, candles.data);
    const points = bars
      .map(toHistoryPoint)
      .filter((p): p is CurrencyHistoryPoint => p != null)
      .sort((a, b) => a.date.localeCompare(b.date));

    const trimmed = points.slice(-days);
    if (!trimmed.length) {
      return { points: [], status: "empty", endpoint: "candles" };
    }

    return { points: trimmed, status: "ok", endpoint: "candles" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { points: [], status: "error", error: message, endpoint: "candles" };
  }
}

/**
 * Интрадей-свечи FORTS за явный диапазон дат (YYYY-MM-DD), с fallback интервала.
 */
export async function fetchFuturesIntradayCandlesForRange(
  ticker: string,
  fromDate: string,
  tillDate: string,
  requestedInterval: number,
): Promise<FetchFuturesIntradayResult> {
  const secid = ticker.trim().toUpperCase();
  if (!secid) {
    return {
      points: [],
      status: "empty",
      error: "Пустой тикер",
      requestedInterval,
      usedInterval: requestedInterval,
    };
  }

  const fromStr = fromDate.slice(0, 10);
  const tillStr = tillDate.slice(0, 10);

  const available = await fetchFuturesCandleBorders(secid);
  const { chain, notice: bordersNotice } = resolveIntervalChain(requestedInterval, available);

  let lastError: string | undefined;
  for (const interval of chain) {
    try {
      const points = await fetchCandlesAtInterval(secid, fromStr, tillStr, interval);
      if (!points.length) continue;

      const intervalNotice =
        interval !== requestedInterval
          ? bordersNotice ??
            `${formatIntervalLabel(requestedInterval)} недоступен, использован ${formatIntervalLabel(interval)}`
          : bordersNotice;

      return {
        points,
        status: "ok",
        requestedInterval,
        usedInterval: interval,
        intervalNotice,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    points: [],
    status: lastError ? "error" : "empty",
    error: lastError,
    requestedInterval,
    usedInterval: chain[0] ?? requestedInterval,
    intervalNotice: bordersNotice,
  };
}

/**
 * Интрадей-свечи FORTS с проверкой candleborders и fallback интервала.
 */
export async function fetchFuturesIntradayCandles(
  ticker: string,
  days: number,
  requestedInterval: number,
): Promise<FetchFuturesIntradayResult> {
  const secid = ticker.trim().toUpperCase();
  if (!secid) {
    return {
      points: [],
      status: "empty",
      error: "Пустой тикер",
      requestedInterval,
      usedInterval: requestedInterval,
    };
  }

  const till = new Date();
  const from = new Date(till.getTime() - Math.max(days, 1) * 24 * 3600 * 1000);
  const fromStr = formatDate(from);
  const tillStr = formatDate(till);

  const available = await fetchFuturesCandleBorders(secid);
  const { chain, notice: bordersNotice } = resolveIntervalChain(requestedInterval, available);

  let lastError: string | undefined;
  for (const interval of chain) {
    try {
      const points = await fetchCandlesAtInterval(secid, fromStr, tillStr, interval);
      if (!points.length) continue;

      const intervalNotice =
        interval !== requestedInterval
          ? bordersNotice ?? `${formatIntervalLabel(requestedInterval)} недоступен, использован ${formatIntervalLabel(interval)}`
          : bordersNotice;

      return {
        points,
        status: "ok",
        requestedInterval,
        usedInterval: interval,
        intervalNotice,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    points: [],
    status: lastError ? "error" : "empty",
    error: lastError,
    requestedInterval,
    usedInterval: chain[0] ?? requestedInterval,
    intervalNotice: bordersNotice,
  };
}
