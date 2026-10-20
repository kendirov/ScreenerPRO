"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  StockExpandedChartInterval,
  StockExpandedChartResponse,
} from "@/lib/domain/stock-expanded-chart";

const REFETCH_MS = 60_000;

async function fetchStockExpandedChart(
  secid: string,
  interval: StockExpandedChartInterval,
  dateKey?: string | null,
): Promise<StockExpandedChartResponse> {
  const params = new URLSearchParams({
    view: "chart",
    secid,
    interval: String(interval),
  });
  if (dateKey) {
    params.set("from", dateKey);
    params.set("till", dateKey);
  }

  const response = await fetch(`/api/screener/stocks/candles?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as StockExpandedChartResponse;
}

export function useStockExpandedCandles(
  secid: string | null,
  interval: StockExpandedChartInterval,
  dateKey?: string | null,
) {
  const ticker = secid?.trim().toUpperCase() ?? "";

  const query = useQuery({
    queryKey: ["stock-expanded-chart", ticker, interval, dateKey ?? "live"] as const,
    queryFn: () => fetchStockExpandedChart(ticker, interval, dateKey),
    enabled: Boolean(ticker),
    staleTime: dateKey ? Number.POSITIVE_INFINITY : REFETCH_MS,
    refetchInterval: dateKey ? false : REFETCH_MS,
    retry: 1,
  });

  return {
    series: query.data?.series ?? null,
    fetchedAt: query.data?.fetchedAt ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
