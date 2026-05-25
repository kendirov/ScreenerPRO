import type { ScreenerRow } from "@screenerpro/shared";
import { computePositionInRange } from "@/lib/domain/stock-sparkline";
import { parseInPlayReasonTags } from "@/lib/domain/stock-screener-display";

/** Основная сессия MOEX TQBR (МСК), минуты от полуночи — совпадает с stock-activity.ts */
const SESSION_START_MINUTE_MSK = 10 * 60;

export type StockExpandedChartInterval = 5 | 10 | 30 | 24;

export type StockExpandedCandle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

export type StockExpandedChartSeries = {
  secid: string;
  status: "ok" | "no-data" | "error";
  source: "intraday" | "daily";
  interval: StockExpandedChartInterval;
  candles: StockExpandedCandle[];
  candleCount: number;
  error?: string;
  /** true — границы сессии выведены из доступных свечей, не из календаря MOEX */
  sessionFromCandles?: boolean;
};

export type StockExpandedChartResponse = {
  fetchedAt: string;
  series: StockExpandedChartSeries;
};

export const EXPANDED_CHART_INTERVALS: StockExpandedChartInterval[] = [5, 10, 30, 24];

export const EXPANDED_CHART_INTERVAL_LABEL: Record<StockExpandedChartInterval, string> = {
  5: "5м",
  10: "10м",
  30: "30м",
  24: "день",
};

export function formatExpandedChartSourceLabel(series: StockExpandedChartSeries | null | undefined): string | null {
  if (!series || series.status !== "ok") return null;
  if (series.source === "intraday") {
    return `intraday ${series.interval}м · ${series.candleCount} св.`;
  }
  return `дневные · ${series.candleCount} св.`;
}

export function resolveExpandedChartDataStatus(
  series: StockExpandedChartSeries | null | undefined,
  isLoading: boolean,
  isError: boolean,
): "live" | "partial" | "no-candles" | "loading" | "error" {
  if (isLoading) return "loading";
  if (isError || series?.status === "error") return "error";
  if (!series || series.status !== "ok" || series.candleCount < 1) return "no-candles";
  if (series.candleCount < 3) return "partial";
  return "live";
}

export const EXPANDED_DATA_STATUS_LABEL: Record<
  ReturnType<typeof resolveExpandedChartDataStatus>,
  string
> = {
  live: "live",
  partial: "частично",
  "no-candles": "нет свечей",
  loading: "загрузка",
  error: "ошибка",
};

export type StockChartPriceLevel = {
  price: number;
  label: string;
  color: string;
  dashed?: boolean;
};

export function buildStockChartPriceLevels(row: ScreenerRow): StockChartPriceLevel[] {
  const levels: StockChartPriceLevel[] = [];

  if (row.open != null && Number.isFinite(row.open)) {
    levels.push({ price: row.open, label: "Открытие", color: "rgba(148,163,184,0.5)", dashed: true });
  }
  if (row.previousClose != null && Number.isFinite(row.previousClose)) {
    levels.push({
      price: row.previousClose,
      label: "Пред. закр.",
      color: "rgba(100,116,139,0.45)",
      dashed: true,
    });
  }
  if (row.high != null && Number.isFinite(row.high)) {
    levels.push({ price: row.high, label: "High", color: "rgba(52,211,153,0.42)", dashed: true });
  }
  if (row.low != null && Number.isFinite(row.low)) {
    levels.push({ price: row.low, label: "Low", color: "rgba(251,113,133,0.42)", dashed: true });
  }
  if (row.lastPrice != null && Number.isFinite(row.lastPrice)) {
    levels.push({ price: row.lastPrice, label: "Текущая", color: "rgba(34,211,238,0.72)" });
  }

  return levels;
}

export type StockChartSessionLayout = {
  firstCandleTime: string | null;
  mainSessionTime: string | null;
  lastCandleTime: string | null;
  hasPreSessionData: boolean;
  sessionFromCandles: boolean;
  sessionNote: string | null;
  showSessionGuides: boolean;
};

export type StockChartCandleTooltip = {
  timeLabel: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string | null;
  changeFromOpen: string | null;
  rangePosition: string | null;
};

function parseCandleTimeMs(time: string, source: StockExpandedChartSeries["source"]): number {
  if (source === "daily" && !time.includes("T")) {
    return new Date(`${time}T00:00:00+03:00`).getTime();
  }
  return new Date(time).getTime();
}

function moscowDateKeyFromSeries(series: StockExpandedChartSeries, now = new Date()): string {
  const last = series.candles[series.candles.length - 1];
  if (last) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(parseCandleTimeMs(last.time, series.source)));
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function moscowSessionStartIso(dateKey: string): string {
  const hours = Math.floor(SESSION_START_MINUTE_MSK / 60);
  const minutes = SESSION_START_MINUTE_MSK % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dateKey}T${pad(hours)}:${pad(minutes)}:00+03:00`;
}

export function resolveStockChartSessionLayout(
  series: StockExpandedChartSeries,
  now = new Date(),
): StockChartSessionLayout {
  const empty: StockChartSessionLayout = {
    firstCandleTime: null,
    mainSessionTime: null,
    lastCandleTime: null,
    hasPreSessionData: false,
    sessionFromCandles: true,
    sessionNote: null,
    showSessionGuides: false,
  };

  if (series.status !== "ok" || !series.candles.length || series.source !== "intraday") {
    return empty;
  }

  const first = series.candles[0]!;
  const last = series.candles[series.candles.length - 1]!;
  const dateKey = moscowDateKeyFromSeries(series, now);
  const sessionStartMs = new Date(moscowSessionStartIso(dateKey)).getTime();

  let mainSessionTime: string | null = null;
  let sessionFromCandles = Boolean(series.sessionFromCandles);

  for (const candle of series.candles) {
    const ms = parseCandleTimeMs(candle.time, series.source);
    if (Number.isFinite(sessionStartMs) && ms >= sessionStartMs) {
      mainSessionTime = candle.time;
      break;
    }
  }

  if (!mainSessionTime) {
    sessionFromCandles = true;
  }

  const firstMs = parseCandleTimeMs(first.time, series.source);
  const mainMs = mainSessionTime ? parseCandleTimeMs(mainSessionTime, series.source) : null;
  const hasPreSessionData = mainMs != null && firstMs < mainMs;

  return {
    firstCandleTime: first.time,
    mainSessionTime,
    lastCandleTime: last.time,
    hasPreSessionData,
    sessionFromCandles,
    sessionNote: sessionFromCandles ? "границы сессии по доступным свечам" : null,
    showSessionGuides: true,
  };
}

export function formatExpandedChartFetchedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function buildStockChartCandleTooltipIndex(
  series: StockExpandedChartSeries,
  row: ScreenerRow,
): Map<string, StockChartCandleTooltip> {
  const index = new Map<string, StockChartCandleTooltip>();
  if (series.status !== "ok") return index;

  for (const candle of series.candles) {
    const key = chartTimeKey(candle.time, series.source);
    index.set(key, buildStockChartCandleTooltip(candle, row, series.source));
  }

  return index;
}

export function chartTimeKey(
  time: string | number,
  source: StockExpandedChartSeries["source"],
): string {
  if (source === "daily") return String(time);
  if (typeof time === "number") return String(time);
  return String(Math.floor(new Date(time).getTime() / 1000));
}

function buildStockChartCandleTooltip(
  candle: StockExpandedCandle,
  row: ScreenerRow,
  source: StockExpandedChartSeries["source"],
): StockChartCandleTooltip {
  const timeLabel =
    source === "daily"
      ? new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(
          new Date(`${candle.time}T12:00:00+03:00`),
        )
      : new Intl.DateTimeFormat("ru-RU", {
          timeZone: "Europe/Moscow",
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(candle.time));

  let changeFromOpen: string | null = null;
  if (row.open != null && row.open > 0 && Number.isFinite(candle.close)) {
    const pct = ((candle.close - row.open) / row.open) * 100;
    changeFromOpen = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% от откр.`;
  }

  let rangePosition: string | null = null;
  if (row.high != null && row.low != null && row.high > row.low) {
    const pos = (candle.close - row.low) / (row.high - row.low);
    if (pos >= 0.72) rangePosition = "ближе к high";
    else if (pos <= 0.28) rangePosition = "ближе к low";
    else rangePosition = "между high и low";
  }

  const volume =
    candle.volume != null && Number.isFinite(candle.volume) && candle.volume > 0
      ? new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(candle.volume)
      : null;

  return {
    timeLabel,
    open: formatPrice(candle.open),
    high: formatPrice(candle.high),
    low: formatPrice(candle.low),
    close: formatPrice(candle.close),
    volume,
    changeFromOpen,
    rangePosition,
  };
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: value < 10 ? 4 : 2,
  }).format(value);
}

/** @deprecated используйте resolveStockChartSessionLayout */
export type StockChartSessionMarker = {
  time: string;
  label: string;
  color: string;
};

export function buildStockChartSessionMarkers(
  series: StockExpandedChartSeries,
  now = new Date(),
): { markers: StockChartSessionMarker[]; sessionFromCandles: boolean } {
  const layout = resolveStockChartSessionLayout(series, now);
  const markers: StockChartSessionMarker[] = [];

  if (layout.firstCandleTime) {
    markers.push({
      time: layout.firstCandleTime,
      label: "начало ряда",
      color: "rgba(148,163,184,0.55)",
    });
  }
  if (layout.mainSessionTime) {
    markers.push({
      time: layout.mainSessionTime,
      label: "10:00 основная",
      color: "rgba(34,211,238,0.55)",
    });
  }
  if (layout.lastCandleTime) {
    markers.push({
      time: layout.lastCandleTime,
      label: series.source === "intraday" ? "сейчас" : "последний день",
      color: "rgba(34,211,238,0.65)",
    });
  }

  return { markers, sessionFromCandles: layout.sessionFromCandles };
}

export function buildStockPositionSummary(row: ScreenerRow): {
  label: string;
  distanceToHigh: string | null;
  distanceToLow: string | null;
} {
  const position = computePositionInRange(row.lastPrice, row.low, row.high);
  let label = "—";
  if (position != null) {
    if (position >= 0.72) label = "около high";
    else if (position <= 0.28) label = "около low";
    else label = "середина";
  }

  let distanceToHigh: string | null = null;
  let distanceToLow: string | null = null;

  if (row.lastPrice != null && row.high != null && row.high > row.lastPrice) {
    const pct = ((row.high - row.lastPrice) / row.lastPrice) * 100;
    distanceToHigh = `${pct.toFixed(2)}%`;
  }
  if (row.lastPrice != null && row.low != null && row.lastPrice > row.low) {
    const pct = ((row.lastPrice - row.low) / row.lastPrice) * 100;
    distanceToLow = `${pct.toFixed(2)}%`;
  }

  return { label, distanceToHigh, distanceToLow };
}

export function buildStockInclusionReasonTags(row: ScreenerRow): string[] {
  return parseInPlayReasonTags(row);
}
