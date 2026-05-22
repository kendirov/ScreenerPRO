"use client";

import { useQuery } from "@tanstack/react-query";
import type { CurrencyCorrelationWeeksResponse } from "@/lib/domain/currency-correlation-weeks";
import type { PointsPairKey } from "@/lib/domain/currency-correlation-points-model";
import type { IntradayIntervalOption } from "@/lib/domain/currency-correlation-intraday";
import type { SpreadAnchorMode } from "@/lib/domain/currency-spread-anchor";

function pairToParam(pair: PointsPairKey): string {
  return pair.replace("/", "-");
}

export function useCurrencyCorrelationWeeks(
  pair: PointsPairKey,
  interval: IntradayIntervalOption,
  weeks: number,
  anchor: SpreadAnchorMode,
  enabled = true,
) {
  return useQuery({
    queryKey: ["currency-correlation-weeks", pair, interval, weeks, anchor],
    queryFn: async (): Promise<CurrencyCorrelationWeeksResponse> => {
      const params = new URLSearchParams({
        pair: pairToParam(pair),
        interval: String(interval),
        weeks: String(weeks),
        anchor,
      });
      const response = await fetch(
        `/api/lab/currency-correlation/weeks?${params.toString()}`,
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Ошибка загрузки недель (${response.status})`);
      }
      return response.json() as Promise<CurrencyCorrelationWeeksResponse>;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}
