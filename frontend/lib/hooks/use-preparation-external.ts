"use client";

import { useQuery } from "@tanstack/react-query";
import type { ExternalMarketResponse } from "@/lib/preparation/preparation-types";
import type { PreparationEventsResponse } from "@/lib/preparation/preparation-types";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export function usePreparationExternal() {
  return useQuery({
    queryKey: ["preparation", "external"],
    queryFn: () => fetchJson<ExternalMarketResponse>("/api/preparation/external"),
    staleTime: 4 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function usePreparationEvents() {
  return useQuery({
    queryKey: ["preparation", "events"],
    queryFn: () => fetchJson<PreparationEventsResponse>("/api/preparation/events"),
    staleTime: 10 * 60_000,
    refetchInterval: 15 * 60_000,
  });
}
