"use client";

import { useQuery } from "@tanstack/react-query";
import type { TradingMarketContextResponse } from "@/lib/domain/trading-market-context";

async function fetchTradingMarketContext(dateKey: string): Promise<TradingMarketContextResponse> {
  const response = await fetch(`/api/trading/stocks/market-context?date=${encodeURIComponent(dateKey)}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as TradingMarketContextResponse;
}

export function useTradingMarketContext(dateKey: string) {
  return useQuery({
    queryKey: ["trading-stock-market-context", dateKey] as const,
    queryFn: () => fetchTradingMarketContext(dateKey),
    staleTime: 120_000,
    retry: 1,
  });
}
