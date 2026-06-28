"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { StockSparklineBatchResponse, StockSparklineSeries } from "@/lib/domain/stock-sparkline";

const REFETCH_MS = 120_000;

async function fetchHoverCandles(ticker: string): Promise<StockSparklineSeries | null> {
  const params = new URLSearchParams({
    secids: ticker,
    interval: "10",
    days: "5",
  });
  const response = await fetch(`/api/screener/stocks/candles?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) return null;
  const body = (await response.json()) as StockSparklineBatchResponse;
  return body.series?.[0] ?? null;
}

export function useStockHoverCandles(ticker: string | null) {
  const normalized = ticker?.trim().toUpperCase() ?? "";

  const query = useQuery({
    queryKey: ["stock-hover-candles", normalized] as const,
    queryFn: () => fetchHoverCandles(normalized),
    enabled: normalized.length > 0,
    staleTime: REFETCH_MS,
    gcTime: REFETCH_MS * 3,
    retry: 1,
  });

  return {
    series: query.data ?? null,
    isLoading: query.isLoading,
    pointCount: query.data?.candles?.length ?? 0,
  };
}
