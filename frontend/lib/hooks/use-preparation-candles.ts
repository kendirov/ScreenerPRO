"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  PreparationCandlesResponse,
  ResolvedPreparationInstrument,
} from "@/lib/domain/preparation-watchlist";
import { buildCandlesQueryItems } from "@/lib/domain/preparation-watchlist";

async function fetchPreparationCandles(items: string[], days = 5): Promise<PreparationCandlesResponse> {
  if (!items.length) {
    return { days, source: "unavailable", series: [], diagnostics: ["Нет MOEX-инструментов для запроса"] };
  }

  const params = new URLSearchParams({
    days: String(days),
    interval: "24",
    items: items.join(","),
  });

  const response = await fetch(`/api/lab/preparation/candles?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as PreparationCandlesResponse;
}

export function usePreparationCandles(instruments: ResolvedPreparationInstrument[], days = 5) {
  const queryItems = React.useMemo(() => buildCandlesQueryItems(instruments), [instruments]);
  const queryKey = React.useMemo(() => ["preparation-candles", days, ...queryItems] as const, [days, queryItems]);

  return useQuery<PreparationCandlesResponse>({
    queryKey,
    queryFn: () => fetchPreparationCandles(queryItems, days),
    enabled: queryItems.length > 0,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}
