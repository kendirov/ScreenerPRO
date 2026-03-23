"use client";

import { useQuery } from "@tanstack/react-query";
import type { AssetClass, ScreenerApiResponse, ScreenerDiagnosticsResponse } from "@screenerpro/shared";
import { screenerApiResponseSchema, screenerDiagnosticsResponseSchema } from "@screenerpro/shared";

async function fetchJson<T>(url: string, parser: { parse: (payload: unknown) => T }): Promise<T> {
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = (await response.json()) as unknown;
  return parser.parse(payload);
}

export function useScreenerQuery(assetClass: "all" | AssetClass) {
  return useQuery<ScreenerApiResponse>({
    queryKey: ["screener", assetClass],
    queryFn: () => fetchJson(`/api/screener?assetClass=${assetClass}`, screenerApiResponseSchema),
    refetchInterval: 20_000,
    staleTime: 15_000,
  });
}

export function useScreenerDiagnostics() {
  return useQuery<ScreenerDiagnosticsResponse>({
    queryKey: ["screener-diagnostics"],
    queryFn: () => fetchJson("/api/dev/diagnostics", screenerDiagnosticsResponseSchema),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}
