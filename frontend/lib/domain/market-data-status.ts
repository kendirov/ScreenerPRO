import type { ScreenerRow } from "@screenerpro/shared";
import type {
  PreparationCandle,
  PreparationCandleSeries,
  PreparationCandlesResponse,
  ResolvedPreparationInstrument,
} from "@/lib/domain/preparation-watchlist";
import { findCandleSeries } from "@/lib/domain/preparation-watchlist";
import { getSessionPulseInfo } from "@/lib/domain/session-phase";

export type MarketDataFreshness =
  | "live"
  | "delayed"
  | "last-available"
  | "closed"
  | "no-data"
  | "error";

export type InstrumentDataStatus = {
  freshness: MarketDataFreshness;
  lastTimestamp: string | null;
  lastTradingDate: string | null;
  reason: string;
  label: string;
};

export type PreparationChangeMetrics = {
  change1d: number | null;
  change5d: number | null;
  change1dHint: string | null;
  change5dHint: string | null;
};

export type PreparationCandlesDiagnostics = {
  moexLabel: string;
  withHistory: number;
  withoutHistory: number;
  usesLastAvailable: boolean;
  usesFallback: boolean;
  summaryLine: string;
};

const INSUFFICIENT_HISTORY = "недостаточно истории";

function moscowDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow" }).format(now);
}

function moscowWeekday(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Moscow",
    weekday: "short",
  }).formatToParts(now);
  const day = parts.find((part) => part.type === "weekday")?.value ?? "Mon";
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  return map[day] ?? 1;
}

function isWeekendMoscow(now = new Date()): boolean {
  const day = moscowWeekday(now);
  return day === 0 || day === 6;
}

function formatRussianDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatLastCandleLabel(dateKey: string, now = new Date()): string {
  const date = formatRussianDate(dateKey);
  return `Последняя свеча ${date}`;
}

export function computeChangePct(
  from: number | null | undefined,
  to: number | null | undefined,
): number | null {
  if (from == null || to == null || !Number.isFinite(from) || !Number.isFinite(to)) return null;
  if (from === 0 || to === 0) return null;
  const value = ((to - from) / Math.abs(from)) * 100;
  if (!Number.isFinite(value) || Math.abs(value) >= 99.95) return null;
  return value;
}

function validCandles(candles: PreparationCandle[]): PreparationCandle[] {
  return candles.filter(
    (candle) => candle.close != null && Number.isFinite(candle.close) && candle.close !== 0,
  );
}

export function resolveInstrumentDataStatus(input: {
  candleSeries: PreparationCandleSeries | null;
  screenerRow: ScreenerRow | null;
  hasLiveMoex: boolean;
  isExternal: boolean;
  now?: Date;
}): InstrumentDataStatus {
  const { candleSeries, screenerRow, hasLiveMoex, isExternal, now = new Date() } = input;

  if (isExternal) {
    return {
      freshness: "no-data",
      lastTimestamp: null,
      lastTradingDate: null,
      reason: "external",
      label: "внешний источник не подключён",
    };
  }

  if (candleSeries?.status === "error") {
    return {
      freshness: "error",
      lastTimestamp: null,
      lastTradingDate: null,
      reason: candleSeries.error ?? "error",
      label: "ошибка загрузки свечей",
    };
  }

  if (!candleSeries || candleSeries.status === "unavailable") {
    return {
      freshness: "no-data",
      lastTimestamp: null,
      lastTradingDate: null,
      reason: "no_series",
      label: "история недоступна",
    };
  }

  const candles = validCandles(candleSeries.candles);
  if (!candles.length) {
    return {
      freshness: "no-data",
      lastTimestamp: null,
      lastTradingDate: null,
      reason: "empty_candles",
      label: "история недоступна",
    };
  }

  const today = moscowDateKey(now);
  const lastCandle = candles[candles.length - 1]!;
  const lastDate = lastCandle.date;
  const session = getSessionPulseInfo(now);
  const marketClosedBySchedule = session.phase === "Закрыто" || session.phase === "До открытия";
  const hasTodayCandle = lastDate === today;
  const tradingStatus = screenerRow?.tradingStatus;

  if (isWeekendMoscow(now) && !hasTodayCandle) {
    return {
      freshness: "closed",
      lastTimestamp: lastDate,
      lastTradingDate: lastDate,
      reason: "weekend",
      label: formatLastCandleLabel(lastDate, now),
    };
  }

  if (hasTodayCandle && hasLiveMoex && tradingStatus === "open") {
    return {
      freshness: "live",
      lastTimestamp: screenerRow?.updatedAt ?? lastDate,
      lastTradingDate: lastDate,
      reason: "session_open",
      label: "онлайн MOEX",
    };
  }

  if (hasTodayCandle && hasLiveMoex && (tradingStatus === "auction" || tradingStatus === "halted")) {
    return {
      freshness: "delayed",
      lastTimestamp: screenerRow?.updatedAt ?? lastDate,
      lastTradingDate: lastDate,
      reason: "session_delayed",
      label: formatLastCandleLabel(lastDate, now),
    };
  }

  if (hasTodayCandle && hasLiveMoex) {
    return {
      freshness: "delayed",
      lastTimestamp: screenerRow?.updatedAt ?? lastDate,
      lastTradingDate: lastDate,
      reason: "today_candle",
      label: formatLastCandleLabel(lastDate, now),
    };
  }

  if (marketClosedBySchedule && !hasTodayCandle) {
    return {
      freshness: "closed",
      lastTimestamp: lastDate,
      lastTradingDate: lastDate,
      reason: "market_closed",
      label: formatLastCandleLabel(lastDate, now),
    };
  }

  if (!hasTodayCandle) {
    return {
      freshness: "last-available",
      lastTimestamp: lastDate,
      lastTradingDate: lastDate,
      reason: "no_today_candle",
      label: `Данных сегодня нет · ${formatLastCandleLabel(lastDate, now)}`,
    };
  }

  return {
    freshness: "last-available",
    lastTimestamp: lastDate,
    lastTradingDate: lastDate,
    reason: "fallback",
    label: formatLastCandleLabel(lastDate, now),
  };
}

export function computePreparationChanges(
  candles: PreparationCandle[],
  dataStatus: InstrumentDataStatus,
  screenerRow: ScreenerRow | null,
): PreparationChangeMetrics {
  const series = validCandles(candles);

  if (series.length < 2) {
    return {
      change1d: null,
      change5d: null,
      change1dHint: series.length === 1 ? INSUFFICIENT_HISTORY : null,
      change5dHint: INSUFFICIENT_HISTORY,
    };
  }

  const last = series[series.length - 1]!;
  const prev = series[series.length - 2]!;

  let change1d: number | null = null;
  let change1dHint: string | null = null;

  if (
    dataStatus.freshness === "live" &&
    screenerRow?.percentChange != null &&
    Number.isFinite(screenerRow.percentChange) &&
    Math.abs(screenerRow.percentChange) < 99.95 &&
    screenerRow.lastPrice != null &&
    screenerRow.lastPrice > 0
  ) {
    change1d = screenerRow.percentChange;
  } else {
    change1d = computeChangePct(prev.close, last.close);
    if (change1d == null) change1dHint = INSUFFICIENT_HISTORY;
  }

  let change5d: number | null = null;
  let change5dHint: string | null = null;

  if (series.length >= 5) {
    const anchor = series[series.length - 5]!;
    change5d = computeChangePct(anchor.close, last.close);
    if (change5d == null) change5dHint = INSUFFICIENT_HISTORY;
  } else {
    change5dHint = INSUFFICIENT_HISTORY;
  }

  return { change1d, change5d, change1dHint, change5dHint };
}

export function summarizePreparationCandlesDiagnostics(
  response: PreparationCandlesResponse | undefined,
  watchlist: ResolvedPreparationInstrument[],
  isLoading?: boolean,
): PreparationCandlesDiagnostics {
  const moexItems = watchlist.filter(
    (item) => item.market === "moex-stock" || item.market === "moex-future",
  );
  const series = response?.series ?? [];

  const withHistory = moexItems.filter((item) => {
    const candleSeries = findCandleSeries(series, item);
    return candleSeries?.status === "ok" && candleSeries.candles.length > 0;
  }).length;

  const withoutHistory = moexItems.length - withHistory;

  let moexLabel = "ожидание MOEX ISS";
  if (isLoading) {
    moexLabel = "загрузка свечей…";
  } else if (response?.source === "moex") {
    moexLabel = "свечи загружены";
  } else if (withHistory > 0) {
    moexLabel = "fallback";
  } else if (response) {
    moexLabel = "нет свечей";
  }

  const usesFallback = response?.source === "unavailable" && withHistory > 0;
  const usesLastAvailable = withHistory > 0;

  const summaryLine = [
    `MOEX ISS: ${moexLabel}`,
    `${withHistory} с историей`,
    `${withoutHistory} без истории`,
    usesLastAvailable ? "используется последняя доступная сессия" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    moexLabel,
    withHistory,
    withoutHistory,
    usesLastAvailable,
    usesFallback,
    summaryLine,
  };
}

export function shouldShowLiveScreenerMetrics(status: InstrumentDataStatus): boolean {
  return status.freshness === "live" || status.freshness === "delayed";
}

export const MARKET_DATA_FRESHNESS_LABELS: Record<MarketDataFreshness, string> = {
  live: "онлайн",
  delayed: "с задержкой",
  "last-available": "Последняя свеча",
  closed: "Последняя свеча",
  "no-data": "Данных сегодня нет",
  error: "ошибка",
};
