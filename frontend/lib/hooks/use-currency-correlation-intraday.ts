"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  IntradayCurrencyResponse,
  IntradayDayOption,
  IntradayIntervalOption,
} from "@/lib/domain/currency-correlation-intraday";

export function useCurrencyCorrelationIntraday(
  interval: IntradayIntervalOption,
  days: IntradayDayOption,
  enabled = true,
) {
  return useQuery({
    queryKey: ["currency-correlation-intraday", "coverage", interval, days],
    queryFn: async (): Promise<IntradayCurrencyResponse> => {
      const params = new URLSearchParams({
        interval: String(interval),
        days: String(days),
        coverage: "1",
      });
      const response = await fetch(`/api/lab/currency-correlation/intraday?${params.toString()}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Ошибка загрузки интрадей (${response.status})`);
      }
      return response.json() as Promise<IntradayCurrencyResponse>;
    },
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
