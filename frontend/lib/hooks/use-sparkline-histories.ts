"use client";

import * as React from "react";
import { useQueries } from "@tanstack/react-query";
import type { InstrumentHistoryBar } from "@screenerpro/shared";

const SPARKLINE_DAYS = 5;
const MAX_TICKERS = 8;
const HISTORY_FETCH_LIMIT = 12;

interface HistoryResponse {
  ticker: string;
  bars: InstrumentHistoryBar[];
}

async function fetchInstrumentHistory(ticker: string): Promise<number[] | null> {
  const response = await fetch(`/api/instruments/${encodeURIComponent(ticker)}/history?limit=${HISTORY_FETCH_LIMIT}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as HistoryResponse;
  const closes = payload.bars
    .map((bar) => bar.close)
    .filter((close): close is number => close !== null && Number.isFinite(close));
  if (closes.length < 2) return null;
  return closes.slice(-SPARKLINE_DAYS);
}

export function useSparklineHistories(tickers: string[]) {
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

  const queries = useQueries({
    queries: uniqueTickers.map((ticker) => ({
      queryKey: ["instrument-history-sparkline", ticker, SPARKLINE_DAYS] as const,
      queryFn: () => fetchInstrumentHistory(ticker),
      staleTime: 5 * 60_000,
      gcTime: 15 * 60_000,
      retry: 1,
    })),
  });

  const seriesByTicker = React.useMemo(() => {
    const map = new Map<string, number[] | null>();
    uniqueTickers.forEach((ticker, index) => {
      map.set(ticker, queries[index]?.data ?? null);
    });
    return map;
  }, [uniqueTickers, queries]);

  const isLoading = queries.some((query) => query.isLoading);

  return { seriesByTicker, isLoading };
}
