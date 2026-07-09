"use client";

import { useQuery } from "@tanstack/react-query";
import type { StockExpandedChartResponse } from "@/lib/domain/stock-expanded-chart";
import {
  STRATEGY_MAX_CANDLES,
  strategyCandlesNoDataMessage,
  type StrategyCandlePeriodId,
} from "@/lib/screener/strategies/strategy-candle-range";
import {
  emptyStrategyCandlesDiagnostics,
  resolveStrategyCandlesLoadState,
  strategyCandlesSourceLabel,
  strategyCandlesWithDiagnosticsFromExpandedSeries,
  type StrategyCandle,
  type StrategyTimeframeMinutes,
  STRATEGY_DEFAULT_BOARD,
} from "@/lib/screener/strategies/strategy-candles";

const REFETCH_MS = 60_000;

async function fetchStrategyCandles(
  secid: string,
  interval: StrategyTimeframeMinutes,
  period: StrategyCandlePeriodId,
  board: string,
): Promise<StockExpandedChartResponse> {
  const params = new URLSearchParams({
    view: "chart",
    secid,
    interval: String(interval),
    board,
    period,
    limit: String(STRATEGY_MAX_CANDLES),
  });

  const response = await fetch(`/api/screener/stocks/candles?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `HTTP ${response.status}`);
  }

  return (await response.json()) as StockExpandedChartResponse;
}

export function useStrategyCandles(
  secid: string,
  interval: StrategyTimeframeMinutes,
  period: StrategyCandlePeriodId,
  enabled = true,
) {
  const ticker = secid.trim().toUpperCase();
  const board = STRATEGY_DEFAULT_BOARD;

  const query = useQuery({
    queryKey: ["strategy-candles", ticker, interval, board, period] as const,
    queryFn: () => fetchStrategyCandles(ticker, interval, period, board),
    enabled: enabled && Boolean(ticker),
    staleTime: REFETCH_MS,
    refetchInterval: REFETCH_MS,
    retry: 1,
  });

  const series = query.data?.series ?? null;
  const normalized = series
    ? strategyCandlesWithDiagnosticsFromExpandedSeries(series)
    : { candles: [] as StrategyCandle[], diagnostics: emptyStrategyCandlesDiagnostics() };
  const candles = normalized.candles;
  const diagnostics = normalized.diagnostics;
  const loadState = resolveStrategyCandlesLoadState({
    isLoading: query.isLoading,
    isError: query.isError,
    series,
    candleCount: candles.length,
  });

  const noDataMessage =
    loadState === "no-data" && ticker
      ? strategyCandlesNoDataMessage(ticker, period)
      : series?.error ?? null;

  return {
    candles,
    diagnostics,
    series,
    candleCount: candles.length,
    board,
    period,
    sourceLabel: strategyCandlesSourceLabel(series),
    loadState,
    fetchedAt: query.data?.fetchedAt ?? null,
    errorMessage:
      query.error instanceof Error
        ? query.error.message
        : loadState === "error"
          ? series?.error ?? "Ошибка загрузки свечей"
          : noDataMessage,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError || loadState === "error",
    refetch: query.refetch,
  };
}
