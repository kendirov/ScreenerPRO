"use client";

import { useQuery } from "@tanstack/react-query";
import type { YesterdayFlowContext, MarketFlowYesterdayResponse } from "@/lib/domain/market-flow-map";

async function fetchYesterdayContext(tickers: string[]): Promise<MarketFlowYesterdayResponse> {
  if (!tickers.length) {
    return {
      asOfMsk: new Date().toISOString(),
      previousTradingDate: "",
      source: "unavailable",
      items: [],
      diagnostics: [],
    };
  }

  const response = await fetch(
    `/api/lab/market-map/yesterday-context?tickers=${encodeURIComponent(tickers.join(","))}`,
    { method: "GET", cache: "no-store" },
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as MarketFlowYesterdayResponse;
}

export function useMarketFlowYesterdayQuery(tickers: string[], enabled: boolean) {
  const key = tickers.slice().sort().join(",");
  return useQuery<MarketFlowYesterdayResponse>({
    queryKey: ["market-flow-yesterday", key],
    queryFn: () => fetchYesterdayContext(tickers),
    enabled: enabled && tickers.length > 0,
    staleTime: 90_000,
    refetchInterval: 120_000,
  });
}
