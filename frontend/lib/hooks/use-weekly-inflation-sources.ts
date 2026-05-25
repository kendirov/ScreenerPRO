"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  WeeklyInflationFetchResponse,
  WeeklyInflationSourceStatusResponse,
} from "@/lib/domain/weekly-inflation-sources";

async function fetchSourceStatus(): Promise<WeeklyInflationSourceStatusResponse> {
  const response = await fetch("/api/lab/weekly-inflation/source-status", {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as WeeklyInflationSourceStatusResponse;
}

export function useWeeklyInflationSourceStatus(enabled = true) {
  return useQuery<WeeklyInflationSourceStatusResponse>({
    queryKey: ["weekly-inflation-source-status"],
    queryFn: fetchSourceStatus,
    enabled,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: 1,
  });
}

export async function checkWeeklyInflationSource(
  source: "rosstat" | "fedstat",
  options?: { url?: string; indicatorId?: string },
): Promise<WeeklyInflationFetchResponse> {
  const params = new URLSearchParams({ source });
  if (options?.url?.trim()) params.set("url", options.url.trim());
  if (options?.indicatorId?.trim()) params.set("indicatorId", options.indicatorId.trim());

  const response = await fetch(`/api/lab/weekly-inflation/fetch?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as WeeklyInflationFetchResponse;
}
