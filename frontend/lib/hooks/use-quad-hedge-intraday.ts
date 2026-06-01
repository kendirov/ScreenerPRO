"use client";

import { useQuery } from "@tanstack/react-query";
import type { QuadHedgeIntradayResponse } from "@/lib/domain/quad-hedge/analytics";
import type { SpreadLabHistoryDepth } from "@/lib/domain/quad-hedge/spread-lab-config";
import { spreadLabFetchParams } from "@/lib/domain/quad-hedge/spread-lab-config";
import type { QuadHedgeWindowScope } from "@/lib/domain/quad-hedge/window";

export function useQuadHedgeIntraday(
  interval: number,
  historyDepth: SpreadLabHistoryDepth,
  windowScope: QuadHedgeWindowScope = "pick",
  enabled = true,
) {
  const fetchParams = spreadLabFetchParams(historyDepth);

  return useQuery({
    queryKey: ["quad-hedge-intraday", interval, historyDepth, windowScope],
    queryFn: async (): Promise<QuadHedgeIntradayResponse> => {
      const params = new URLSearchParams({
        interval: String(interval),
        days: String(fetchParams.calendarDays),
        windowScope,
        historyDepth,
        historyMode: fetchParams.historyMode,
      });
      const response = await fetch(`/api/lab/quad-hedge/intraday?${params.toString()}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Ошибка загрузки квадрохеджа (${response.status})`);
      }
      return response.json() as Promise<QuadHedgeIntradayResponse>;
    },
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
