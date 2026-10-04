"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { StockSparklineBatchResponse, StockSparklineSeries } from "@/lib/domain/stock-sparkline";

/** Только тикеры из блоков радара (В игре + Активные + Прострелы), не вся таблица. */
const MAX_TICKERS = 28;
const CHUNK_SIZE = 6;
const REFETCH_MS = 60_000;

async function fetchRadarSparklineChunk(secids: string[]): Promise<StockSparklineBatchResponse> {
  const params = new URLSearchParams({
    secids: secids.join(","),
    interval: "10",
    sessions: "3",
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

async function fetchRadarSparklineBatch(secids: string[]): Promise<StockSparklineBatchResponse> {
  if (secids.length <= CHUNK_SIZE) {
    return fetchRadarSparklineChunk(secids);
  }

  const chunks: string[][] = [];
  for (let i = 0; i < secids.length; i += CHUNK_SIZE) {
    chunks.push(secids.slice(i, i + CHUNK_SIZE));
  }

  const results = await Promise.all(chunks.map((chunk) => fetchRadarSparklineChunk(chunk)));
  return {
    fetchedAt: new Date().toISOString(),
    series: results.flatMap((result) => result.series),
  };
}

/** Свечи 2С только для тикеров радара (В игре / Активные / Прострелы), не для всей таблицы. */
export function useRadarSparklineCandles(tickers: string[], enabled = true) {
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
    queryKey: ["radar-sparkline-candles", ...uniqueTickers] as const,
    queryFn: () => fetchRadarSparklineBatch(uniqueTickers),
    enabled: enabled && uniqueTickers.length > 0,
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
