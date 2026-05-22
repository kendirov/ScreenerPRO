"use client";

import { useQuery } from "@tanstack/react-query";
import type { CurrencyHistoryResponse } from "@/lib/domain/currency-correlation-history";

/** Один запрос на сессию: максимальный горизонт; срез 5/20/60д — на клиенте. */
export const CURRENCY_HISTORY_FETCH_DAYS = 60;

/** История с coverage-aware выбором контрактов на сервере (MOEX candles). */
export function useCurrencyCorrelationHistory(_tickers?: string[], enabled = true) {
  return useQuery({
    queryKey: ["currency-correlation-history", "coverage", CURRENCY_HISTORY_FETCH_DAYS],
    queryFn: async (): Promise<CurrencyHistoryResponse> => {
      const params = new URLSearchParams({
        days: String(CURRENCY_HISTORY_FETCH_DAYS),
        interval: "24",
        coverage: "1",
      });
      const response = await fetch(`/api/lab/currency-correlation/history?${params.toString()}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Ошибка загрузки истории (${response.status})`);
      }
      return response.json() as Promise<CurrencyHistoryResponse>;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}
