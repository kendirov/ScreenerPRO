import type {
  StockExpandedChartSeries,
  StockExpandedChartInterval,
} from "@/lib/domain/stock-expanded-chart";
import {
  normalizeStrategyCandles,
  type StrategyCandle,
  type StrategyCandlesDiagnostics,
} from "@/lib/strategies/strategy-candles-normalizer";

export type { StrategyCandle, StrategyCandlesDiagnostics };

export type StrategyTimeframeMinutes = 1 | 5 | 15 | 30 | 60;

export const STRATEGY_DEFAULT_BOARD = "TQBR";

export type StrategyCandlesSource = "intraday" | "daily";

export type StrategyCandlesLoadState =
  | "loading"
  | "live"
  | "partial"
  | "no-data"
  | "error";

const EMPTY_DIAGNOSTICS: StrategyCandlesDiagnostics = {
  rawCount: 0,
  normalizedCount: 0,
  invalidCount: 0,
  duplicateTimeCount: 0,
};

export function strategyCandlesFromExpandedSeries(series: StockExpandedChartSeries): StrategyCandle[] {
  return strategyCandlesWithDiagnosticsFromExpandedSeries(series).candles;
}

type SeriesWithFetchMeta = StockExpandedChartSeries & {
  fetchMeta?: {
    from: string;
    till: string;
    periodId: string;
    board: string;
    fetchRequestCount: number;
    daysLoaded: number;
    rawCount: number;
    capped: boolean;
  };
};

export function strategyCandlesWithDiagnosticsFromExpandedSeries(series: StockExpandedChartSeries): {
  candles: StrategyCandle[];
  diagnostics: StrategyCandlesDiagnostics;
} {
  const raw = series.candles.map((candle) => ({
    time: candle.time,
    begin: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume ?? undefined,
  }));

  const normalized = normalizeStrategyCandles(raw);
  const fetchMeta = (series as SeriesWithFetchMeta).fetchMeta;

  if (!fetchMeta) {
    return normalized;
  }

  return {
    candles: normalized.candles,
    diagnostics: {
      ...normalized.diagnostics,
      fetch: {
        periodId: fetchMeta.periodId,
        from: fetchMeta.from,
        till: fetchMeta.till,
        board: fetchMeta.board,
        daysLoaded: fetchMeta.daysLoaded,
        fetchRequestCount: fetchMeta.fetchRequestCount,
        capped: fetchMeta.capped,
      },
    },
  };
}

export function emptyStrategyCandlesDiagnostics(): StrategyCandlesDiagnostics {
  return { ...EMPTY_DIAGNOSTICS };
}

export function resolveStrategyCandlesLoadState(options: {
  isLoading: boolean;
  isError: boolean;
  series: StockExpandedChartSeries | null;
  candleCount: number;
}): StrategyCandlesLoadState {
  if (options.isLoading) return "loading";
  if (options.isError || options.series?.status === "error") return "error";
  if (!options.series || options.series.status !== "ok" || options.candleCount < 1) return "no-data";
  if (options.candleCount < 3) return "partial";
  return "live";
}

export function strategyCandlesSourceLabel(series: StockExpandedChartSeries | null): string {
  if (!series || series.status !== "ok") return "—";
  if (series.source === "intraday") {
    return `MOEX ISS · intraday ${series.interval}m · ${STRATEGY_DEFAULT_BOARD}`;
  }
  return `MOEX ISS · daily · ${STRATEGY_DEFAULT_BOARD}`;
}

export const STRATEGY_LOAD_STATE_LABEL: Record<StrategyCandlesLoadState, string> = {
  loading: "загрузка",
  live: "онлайн",
  partial: "частично",
  "no-data": "нет свечей",
  error: "ошибка",
};
