"use client";

import { useQuery } from "@tanstack/react-query";
import type { MaterialsAssetClassFilter, TechnicalCharacteristicsResponse } from "@/lib/materials/contracts";
import { technicalCharacteristicsResponseSchema } from "@/lib/materials/contracts";

async function fetchJson<T>(url: string, parser: { parse: (payload: unknown) => T }): Promise<T> {
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = (await response.json()) as unknown;
  return parser.parse(payload);
}

export function useTechnicalCharacteristicsQuery(assetClass: MaterialsAssetClassFilter, liquidity: "liquid" | "all") {
  return useQuery<TechnicalCharacteristicsResponse>({
    queryKey: ["materials", "technical-characteristics", assetClass, liquidity],
    queryFn: () =>
      fetchJson(
        `/api/materials/technical-characteristics?assetClass=${assetClass}&liquidity=${liquidity}`,
        technicalCharacteristicsResponseSchema,
      ),
    refetchInterval: 20_000,
    staleTime: 12_000,
  });
}
