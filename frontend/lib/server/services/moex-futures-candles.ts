import type { IntradayCandlePoint } from "@/lib/domain/currency-correlation-intraday";
import type { CurrencyHistoryPoint } from "@/lib/domain/currency-correlation-history";
import type { SpreadLabHistoryMode } from "@/lib/domain/quad-hedge/spread-lab-config";
import { moscowTodayKey, shiftCalendarDaysKey } from "@/lib/domain/trading-calendar";
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
  debug?: {
    secid: string;
    from: string;
    till: string;
    requestedFrom?: string;
    requestedTill?: string;
    candlesUrl: string;
    engine: string;
    market: string;
    rawCount: number;
    moexPages?: number;
    moexChunks?: number;
    moexLimitNotice?: string;
    firstTime?: string;
    lastTime?: string;
  };
};

/** Цепочка fallback для интрадей FORTS: 1м → 5м → 10м → 60м → день. */
export const INTRADAY_INTERVAL_FALLBACK_CHAIN = [1, 5, 10, 60, 24] as const;

/** MOEX ISS: не более 500 свечей на страницу. */
export const MOEX_CANDLES_PAGE_SIZE = 500;

/** Недельные чанки при historyMode=max. */
const MAX_HISTORY_CHUNK_DAYS = 7;

/** Сколько недель назад пробуем (≈4.5 мес.). */
const MAX_HISTORY_CHUNKS = 18;

/** Потолок 1m-свечей на ногу (защита от таймаута route). */
const MAX_CANDLES_PER_LEG = 80_000;

const candleBordersCache = new Map<
  string,
  { expiresAt: number; intervals: number[]; borders: MoexCandleBorder[] }
>();

type MoexCandleBorder = {
  interval: number;
  begin: string;
  end: string;
};

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

function parseBordersFromPayload(payload: Record<string, unknown>): MoexCandleBorder[] {
  const tables = ["borders", "candleborders", "durations"];
  const borders: MoexCandleBorder[] = [];

  for (const key of tables) {
    const table = payload[key] as { columns?: string[]; data?: unknown[][] } | undefined;
    if (!table?.columns?.length || !table.data?.length) continue;

    const intervalIdx = table.columns.findIndex((c) => c.toLowerCase() === "interval");
    const beginIdx = table.columns.findIndex((c) => c.toLowerCase() === "begin");
    const endIdx = table.columns.findIndex((c) => c.toLowerCase() === "end");
    if (intervalIdx < 0) continue;

    for (const row of table.data) {
      const item = rowToObject(table.columns, row);
      const raw = item.interval ?? item.INTERVAL ?? row[intervalIdx];
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) continue;
      const begin = String(item.begin ?? item.BEGIN ?? (beginIdx >= 0 ? row[beginIdx] : "") ?? "");
      const end = String(item.end ?? item.END ?? (endIdx >= 0 ? row[endIdx] : "") ?? "");
      borders.push({ interval: Math.trunc(n), begin, end });
    }
  }

  return borders;
}

function parseIntervalsFromBorders(borders: MoexCandleBorder[]): number[] {
  return [...new Set(borders.map((b) => b.interval))].sort((a, b) => a - b);
}

function borderBeginKey(border: MoexCandleBorder): string {
  return border.begin.slice(0, 10);
}

/**
 * Доступные интервалы свечей по инструменту (candleborders).
 * При ошибке — пустой список (fallback-цепочка всё равно попробует запрос).
 */
export async function fetchFuturesCandleBorders(secid: string): Promise<number[]> {
  const { intervals } = await fetchFuturesCandleBorderDetails(secid);
  return intervals;
}

export async function fetchFuturesCandleBorderDetails(
  secid: string,
): Promise<{ intervals: number[]; borders: MoexCandleBorder[] }> {
  const key = secid.trim().toUpperCase();
  if (!key) return { intervals: [], borders: [] };

  const cached = candleBordersCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { intervals: cached.intervals, borders: cached.borders };
  }

  try {
    const payload = (await moexGetJson(futuresCandleBordersUrl(key), 120)) as Record<string, unknown>;
    const borders = parseBordersFromPayload(payload);
    const intervals = parseIntervalsFromBorders(borders);
    candleBordersCache.set(key, { expiresAt: Date.now() + 10 * 60_000, intervals, borders });
    return { intervals, borders };
  } catch {
    return { intervals: [], borders: [] };
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

function mergeIntradayPoints(
  target: Map<string, IntradayCandlePoint>,
  points: IntradayCandlePoint[],
): void {
  for (const p of points) {
    target.set(p.timestamp, p);
  }
}

async function fetchCandlesAtIntervalPage(
  secid: string,
  fromStr: string,
  tillStr: string,
  interval: number,
  start: number,
): Promise<{ points: IntradayCandlePoint[]; rawCount: number; candlesUrl: string }> {
  const candlesUrl = futuresCandlesUrl(secid, fromStr, tillStr, interval, start);
  const payload = moexPayloadSchema.parse(await moexGetJson(candlesUrl, 60));
  const candles = payload.candles;
  if (!candles?.data?.length) {
    return { points: [], rawCount: 0, candlesUrl };
  }

  const bars = mapIntradayCandlesBars(candles.columns, candles.data);
  const points = bars
    .map(toIntradayPoint)
    .filter((p): p is IntradayCandlePoint => p != null)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return { points, rawCount: points.length, candlesUrl };
}

async function fetchCandlesAtIntervalPaginated(
  secid: string,
  fromStr: string,
  tillStr: string,
  interval: number,
): Promise<{
  points: IntradayCandlePoint[];
  rawCount: number;
  candlesUrl: string;
  moexPages: number;
  truncated: boolean;
}> {
  let start = 0;
  let moexPages = 0;
  let lastUrl = futuresCandlesUrl(secid, fromStr, tillStr, interval, 0);
  const byTimestamp = new Map<string, IntradayCandlePoint>();

  while (moexPages < 120) {
    const page = await fetchCandlesAtIntervalPage(secid, fromStr, tillStr, interval, start);
    lastUrl = page.candlesUrl;
    moexPages += 1;
    if (!page.points.length) break;
    mergeIntradayPoints(byTimestamp, page.points);
    if (page.rawCount < MOEX_CANDLES_PAGE_SIZE) break;
    start += page.rawCount;
  }

  const points = [...byTimestamp.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const truncated =
    moexPages >= 120 ||
    (points.length > 0 && points.length % MOEX_CANDLES_PAGE_SIZE === 0 && moexPages > 0);

  return {
    points,
    rawCount: points.length,
    candlesUrl: lastUrl,
    moexPages,
    truncated,
  };
}

async function fetchCandlesAtInterval(
  secid: string,
  fromStr: string,
  tillStr: string,
  interval: number,
): Promise<{ points: IntradayCandlePoint[]; rawCount: number; candlesUrl: string; moexPages: number }> {
  const result = await fetchCandlesAtIntervalPaginated(secid, fromStr, tillStr, interval);
  console.info(
    `[quad-hedge candles] SECID=${secid} interval=${interval} from=${fromStr} till=${tillStr} pages=${result.moexPages} rawCount=${result.rawCount} first=${result.points[0]?.timestamp ?? "—"} last=${result.points.at(-1)?.timestamp ?? "—"}`,
  );
  return result;
}

async function fetchMaxHistoryCandles(
  secid: string,
  requestedInterval: number,
  usedInterval: number,
  tillStr: string,
  earliestDateKey: string | null,
): Promise<{
  points: IntradayCandlePoint[];
  moexPages: number;
  moexChunks: number;
  requestedFrom: string;
  requestedTill: string;
  candlesUrl: string;
  moexLimitNotice?: string;
}> {
  const requestedTill = tillStr.slice(0, 10);
  const requestedFrom = earliestDateKey ?? shiftCalendarDaysKey(requestedTill, -(MAX_HISTORY_CHUNKS * MAX_HISTORY_CHUNK_DAYS));

  const byTimestamp = new Map<string, IntradayCandlePoint>();
  let moexPages = 0;
  let moexChunks = 0;
  let lastUrl = futuresCandlesUrl(secid, requestedFrom, requestedTill, usedInterval, 0);
  let chunkEnd = requestedTill;

  while (moexChunks < MAX_HISTORY_CHUNKS && byTimestamp.size < MAX_CANDLES_PER_LEG) {
    const chunkStart = shiftCalendarDaysKey(chunkEnd, -(MAX_HISTORY_CHUNK_DAYS - 1));
    const effectiveStart =
      earliestDateKey && chunkStart < earliestDateKey ? earliestDateKey : chunkStart;

    if (earliestDateKey && chunkEnd < earliestDateKey) break;

    const chunk = await fetchCandlesAtIntervalPaginated(
      secid,
      effectiveStart,
      chunkEnd,
      usedInterval,
    );
    moexPages += chunk.moexPages;
    moexChunks += 1;
    lastUrl = chunk.candlesUrl;

    if (!chunk.points.length) {
      if (moexChunks === 1) break;
      if (earliestDateKey && effectiveStart <= earliestDateKey) break;
      chunkEnd = shiftCalendarDaysKey(effectiveStart, -1);
      continue;
    }

    mergeIntradayPoints(byTimestamp, chunk.points);

    if (earliestDateKey && effectiveStart <= earliestDateKey) break;
    chunkEnd = shiftCalendarDaysKey(effectiveStart, -1);
  }

  const points = [...byTimestamp.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const notices: string[] = [];
  if (byTimestamp.size >= MAX_CANDLES_PER_LEG) {
    notices.push(`лимит ${MAX_CANDLES_PER_LEG} свечей на ногу`);
  }
  if (moexChunks >= MAX_HISTORY_CHUNKS) {
    notices.push(`достигнут предел ${MAX_HISTORY_CHUNKS} недельных чанков`);
  }
  if (points.length > 0 && earliestDateKey && points[0]!.timestamp.slice(0, 10) > earliestDateKey) {
    notices.push(
      `MOEX вернул ${points.length} свечей (с ${points[0]!.timestamp.slice(0, 10)}, запрошено с ${requestedFrom})`,
    );
  } else if (points.length === 0) {
    notices.push("MOEX вернул 0 свечей");
  }

  const moexLimitNotice = notices.length ? notices.join("; ") : undefined;

  return {
    points,
    moexPages,
    moexChunks,
    requestedFrom,
    requestedTill,
    candlesUrl: lastUrl,
    moexLimitNotice,
  };
}

async function fetchSessionsRangeCandles(
  secid: string,
  interval: number,
  fromStr: string,
  tillStr: string,
): Promise<{
  points: IntradayCandlePoint[];
  moexPages: number;
  moexChunks: number;
  candlesUrl: string;
  moexLimitNotice?: string;
}> {
  const byTimestamp = new Map<string, IntradayCandlePoint>();
  let moexPages = 0;
  let moexChunks = 0;
  let lastUrl = futuresCandlesUrl(secid, fromStr, tillStr, interval, 0);
  let chunkEnd = tillStr;

  while (chunkEnd >= fromStr && moexChunks < 6) {
    const chunkStart = shiftCalendarDaysKey(chunkEnd, -(MAX_HISTORY_CHUNK_DAYS - 1));
    const effectiveStart = chunkStart < fromStr ? fromStr : chunkStart;

    const chunk = await fetchCandlesAtIntervalPaginated(
      secid,
      effectiveStart,
      chunkEnd,
      interval,
    );
    moexPages += chunk.moexPages;
    moexChunks += 1;
    lastUrl = chunk.candlesUrl;
    mergeIntradayPoints(byTimestamp, chunk.points);

    if (effectiveStart <= fromStr) break;
    chunkEnd = shiftCalendarDaysKey(effectiveStart, -1);
  }

  const points = [...byTimestamp.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const notices: string[] = [];
  if (points.length > 0 && points.length % MOEX_CANDLES_PAGE_SIZE === 0 && moexPages > 0) {
    notices.push(`MOEX вернул ${points.length} свечей — возможно усечение ISS`);
  }
  if (!points.length) notices.push("MOEX вернул 0 свечей");

  return {
    points,
    moexPages,
    moexChunks,
    candlesUrl: lastUrl,
    moexLimitNotice: notices.length ? notices.join("; ") : undefined,
  };
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

export type FetchFuturesIntradayOptions = {
  historyMode?: SpreadLabHistoryMode;
  dateRange?: { from: string; till: string };
};

/**
 * Интрадей-свечи FORTS за явный диапазон дат (YYYY-MM-DD), с fallback интервала.
 */
export async function fetchFuturesIntradayCandlesForRange(
  ticker: string,
  fromDate: string,
  tillDate: string,
  requestedInterval: number,
  options?: FetchFuturesIntradayOptions,
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

  return fetchFuturesIntradayForRange(
    secid,
    fromDate.slice(0, 10),
    tillDate.slice(0, 10),
    requestedInterval,
    options,
  );
}

/**
 * Интрадей-свечи FORTS с проверкой candleborders и fallback интервала.
 */
export async function fetchFuturesIntradayCandles(
  ticker: string,
  days: number,
  requestedInterval: number,
  dateRange?: { from: string; till: string },
  options?: FetchFuturesIntradayOptions,
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

  const till = dateRange?.till ?? formatDate(new Date());
  const from =
    dateRange?.from ??
    formatDate(new Date(new Date(till).getTime() - Math.max(days, 1) * 24 * 3600 * 1000));

  return fetchFuturesIntradayForRange(secid, from, till, requestedInterval, {
    ...options,
    dateRange: dateRange ?? { from, till },
  });
}

async function fetchFuturesIntradayForRange(
  secid: string,
  fromStr: string,
  tillStr: string,
  requestedInterval: number,
  options?: FetchFuturesIntradayOptions,
): Promise<FetchFuturesIntradayResult> {
  const historyMode = options?.historyMode ?? "days";
  const borderDetails = await fetchFuturesCandleBorderDetails(secid);
  const { chain, notice: bordersNotice } = resolveIntervalChain(
    requestedInterval,
    borderDetails.intervals,
  );

  let lastError: string | undefined;
  let lastDebug: FetchFuturesIntradayResult["debug"];

  for (const interval of chain) {
    try {
      const border = borderDetails.borders.find((b) => b.interval === interval);
      const earliestDateKey = border ? borderBeginKey(border) : null;

      if (historyMode === "max") {
        const maxResult = await fetchMaxHistoryCandles(
          secid,
          requestedInterval,
          interval,
          tillStr,
          earliestDateKey,
        );
        lastDebug = {
          secid,
          from: maxResult.points[0]?.timestamp.slice(0, 10) ?? fromStr,
          till: maxResult.points.at(-1)?.timestamp.slice(0, 10) ?? tillStr,
          requestedFrom: maxResult.requestedFrom,
          requestedTill: maxResult.requestedTill,
          candlesUrl: maxResult.candlesUrl,
          engine: "futures",
          market: "forts",
          rawCount: maxResult.points.length,
          moexPages: maxResult.moexPages,
          moexChunks: maxResult.moexChunks,
          moexLimitNotice: maxResult.moexLimitNotice,
          firstTime: maxResult.points[0]?.timestamp,
          lastTime: maxResult.points.at(-1)?.timestamp,
        };

        if (!maxResult.points.length) continue;

        const intervalNoticeParts: string[] = [];
        if (interval !== requestedInterval) {
          intervalNoticeParts.push(
            bordersNotice ??
              `${formatIntervalLabel(requestedInterval)} недоступен на MOEX FORTS, использован ${formatIntervalLabel(interval)} → агрегация в ${requestedInterval}м на клиенте`,
          );
        } else if (requestedInterval === 5 && interval === 1) {
          intervalNoticeParts.push("MOEX FORTS: native 5m нет, 1m → bucket 5m");
        }
        if (maxResult.moexLimitNotice) intervalNoticeParts.push(maxResult.moexLimitNotice);

        return {
          points: maxResult.points,
          status: "ok",
          requestedInterval,
          usedInterval: interval,
          intervalNotice: intervalNoticeParts.length ? intervalNoticeParts.join(" · ") : bordersNotice,
          debug: lastDebug,
        };
      }

      if (historyMode === "sessions") {
        const sessionsResult = await fetchSessionsRangeCandles(
          secid,
          interval,
          fromStr,
          tillStr,
        );
        lastDebug = {
          secid,
          from: sessionsResult.points[0]?.timestamp.slice(0, 10) ?? fromStr,
          till: sessionsResult.points.at(-1)?.timestamp.slice(0, 10) ?? tillStr,
          requestedFrom: fromStr,
          requestedTill: tillStr,
          candlesUrl: sessionsResult.candlesUrl,
          engine: "futures",
          market: "forts",
          rawCount: sessionsResult.points.length,
          moexPages: sessionsResult.moexPages,
          moexChunks: sessionsResult.moexChunks,
          moexLimitNotice: sessionsResult.moexLimitNotice,
          firstTime: sessionsResult.points[0]?.timestamp,
          lastTime: sessionsResult.points.at(-1)?.timestamp,
        };

        if (!sessionsResult.points.length) continue;

        const intervalNoticeParts: string[] = [];
        if (interval !== requestedInterval) {
          intervalNoticeParts.push(
            bordersNotice ??
              `${formatIntervalLabel(requestedInterval)} → ${formatIntervalLabel(interval)} (bucket ${requestedInterval}м)`,
          );
        }
        if (sessionsResult.moexLimitNotice) intervalNoticeParts.push(sessionsResult.moexLimitNotice);

        return {
          points: sessionsResult.points,
          status: "ok",
          requestedInterval,
          usedInterval: interval,
          intervalNotice: intervalNoticeParts.length ? intervalNoticeParts.join(" · ") : bordersNotice,
          debug: lastDebug,
        };
      }

      const { points, rawCount, candlesUrl, moexPages } = await fetchCandlesAtIntervalPaginated(
        secid,
        fromStr,
        tillStr,
        interval,
      );
      lastDebug = {
        secid,
        from: fromStr,
        till: tillStr,
        requestedFrom: fromStr,
        requestedTill: tillStr,
        candlesUrl,
        engine: "futures",
        market: "forts",
        rawCount,
        moexPages,
        firstTime: points[0]?.timestamp,
        lastTime: points.at(-1)?.timestamp,
        moexLimitNotice:
          rawCount >= MOEX_CANDLES_PAGE_SIZE && moexPages === 1
            ? `MOEX вернул только ${rawCount} свечей (лимит ${MOEX_CANDLES_PAGE_SIZE}/запрос — нужна pagination)`
            : undefined,
      };
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
        debug: lastDebug,
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
    debug: lastDebug,
  };
}

/** Диапазон по умолчанию для Spread Lab max-history (диагностика). */
export function spreadLabMaxHistoryRequestedRange(): { from: string; till: string } {
  const till = moscowTodayKey();
  const from = shiftCalendarDaysKey(till, -(MAX_HISTORY_CHUNKS * MAX_HISTORY_CHUNK_DAYS));
  return { from, till };
}

export { MAX_HISTORY_CHUNK_DAYS, MAX_HISTORY_CHUNKS, MAX_CANDLES_PER_LEG };
