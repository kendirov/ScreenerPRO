"use client";

import { useQuery } from "@tanstack/react-query";
import type { AssetClass, ScreenerApiResponse, ScreenerDiagnosticsResponse } from "@screenerpro/shared";
import { screenerApiResponseSchema, screenerDiagnosticsResponseSchema } from "@screenerpro/shared";

async function fetchJson<T>(
  url: string,
  parser: { safeParse: (payload: unknown) => { success: true; data: T } | { success: false; error: unknown } },
): Promise<T> {
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  const payload = (await response.json()) as unknown;
  if (!response.ok && response.status !== 503) {
    throw new Error(`HTTP ${response.status}`);
  }
  const parsed = parser.safeParse(payload);
  if (!parsed.success) {
    const issue = (parsed.error as { issues?: Array<{ path: unknown[]; message: string }> }).issues?.[0];
    throw new Error(issue ? `Ответ API не прошёл проверку: ${issue.path.join(".")} — ${issue.message}` : "Ответ API не прошёл проверку");
  }
  return parsed.data;
}

/** Первичная загрузка без данных — не смешивать с фоновым refetch. */
export function isScreenerInitialLoading(query: { isPending: boolean; data: unknown | undefined }): boolean {
  return query.isPending && query.data === undefined;
}

export function useScreenerQuery(assetClass: "all" | AssetClass, dateKey?: string | null) {
  const isHistorical = Boolean(dateKey);
  const queryKey = ["screener", assetClass, dateKey ?? "live"] as const;

  return useQuery<ScreenerApiResponse>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({ assetClass });
      if (dateKey) params.set("date", dateKey);
      return fetchJson(`/api/screener?${params.toString()}`, screenerApiResponseSchema);
    },
    refetchInterval: isHistorical
      ? false
      : (query) => (query.state.data ? 45_000 : false),
    staleTime: isHistorical ? 120_000 : 30_000,
    retry: false,
    refetchOnWindowFocus: !isHistorical,
  });
}

export function useScreenerDiagnostics() {
  return useQuery<ScreenerDiagnosticsResponse>({
    queryKey: ["screener-diagnostics"],
    queryFn: () => fetchJson("/api/dev/diagnostics", screenerDiagnosticsResponseSchema),
    refetchInterval: 30_000,
    staleTime: 20_000,
    retry: false,
  });
}
