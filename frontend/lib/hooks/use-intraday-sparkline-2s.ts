"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { IntradaySparkline2sResponse } from "@/lib/domain/intraday-sparkline-2s";
import { intradaySparkline2sToSeries } from "@/lib/domain/intraday-sparkline-2s";
import type { StockSparklineSeries } from "@/lib/domain/stock-sparkline";

const STALE_MS = 45_000;
const GC_MS = 15 * 60_000;

async function fetchIntradaySparkline2s(ticker: string): Promise<IntradaySparkline2sResponse> {
  const params = new URLSearchParams({ ticker: ticker.toUpperCase(), sessions: "2" });
  const response = await fetch(`/api/market/intraday-sparkline?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as IntradaySparkline2sResponse;
}

export function intradaySparkline2sQueryKey(ticker: string, tradingDate: string) {
  return ["intraday-sparkline-2s", ticker.toUpperCase(), tradingDate] as const;
}

export function useIntradaySparkline2s(
  ticker: string | null | undefined,
  tradingDate: string,
  enabled: boolean,
) {
  const normalized = ticker?.trim().toUpperCase() ?? "";

  const query = useQuery({
    queryKey: intradaySparkline2sQueryKey(normalized, tradingDate),
    queryFn: () => fetchIntradaySparkline2s(normalized),
    enabled: enabled && normalized.length > 0,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    retry: 1,
  });

  const series: StockSparklineSeries | null = query.data
    ? intradaySparkline2sToSeries(query.data)
    : null;

  return {
    series,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
  };
}

export function usePrefetchIntradaySparklines2s(
  tickers: string[],
  tradingDate: string,
  enabled: boolean,
) {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!enabled || tickers.length === 0) return;
    for (const raw of tickers) {
      const ticker = raw.trim().toUpperCase();
      if (!ticker) continue;
      void queryClient.prefetchQuery({
        queryKey: intradaySparkline2sQueryKey(ticker, tradingDate),
        queryFn: () => fetchIntradaySparkline2s(ticker),
        staleTime: STALE_MS,
      });
    }
  }, [enabled, tickers, tradingDate, queryClient]);
}
