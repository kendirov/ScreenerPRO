"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { StockSparklineBatchResponse, StockSparklineSeries } from "@/lib/domain/stock-sparkline";

const MAX_TICKERS = 8;
const REFETCH_MS = 60_000;

async function fetchInPlayStockCandles(secids: string[]): Promise<StockSparklineBatchResponse> {
  const params = new URLSearchParams({
    secids: secids.join(","),
    interval: "10",
    days: "5",
  });

  const response = await fetch(`/api/screener/stocks/candles?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as StockSparklineBatchResponse;
}

export function useInPlayStockCandles(tickers: string[]) {
  const uniqueTickers = React.useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const raw of tickers) {
      const ticker = raw.trim().toUpperCase();
      if (!ticker || seen.has(ticker)) continue;
      seen.add(ticker);
      list.push(ticker);
      if (list.length >= MAX_TICKERS) break;
    }
    return list;
  }, [tickers]);

  const query = useQuery({
    queryKey: ["in-play-stock-candles", ...uniqueTickers] as const,
    queryFn: () => fetchInPlayStockCandles(uniqueTickers),
    enabled: uniqueTickers.length > 0,
    staleTime: REFETCH_MS,
    refetchInterval: REFETCH_MS,
    retry: 1,
  });

  const seriesByTicker = React.useMemo(() => {
    const map = new Map<string, StockSparklineSeries>();
    for (const series of query.data?.series ?? []) {
      map.set(series.secid.toUpperCase(), series);
    }
    return map;
  }, [query.data?.series]);

  return { seriesByTicker, isLoading: query.isLoading, isError: query.isError };
}
