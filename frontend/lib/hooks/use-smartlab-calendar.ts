"use client";

import { useQuery } from "@tanstack/react-query";
import type { SmartLabCalendarResponse } from "@/lib/domain/smartlab-calendar";
import type { BriefingMode } from "@/components/lab/preparation/preparation-types";

async function fetchSmartLabCalendar(mode: BriefingMode): Promise<SmartLabCalendarResponse> {
  const params = new URLSearchParams({
    mode,
    type: "all",
  });

  const response = await fetch(`/api/lab/preparation/smartlab-calendar?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as SmartLabCalendarResponse;
}

export function useSmartLabCalendar(mode: BriefingMode, enabled = true) {
  return useQuery<SmartLabCalendarResponse>({
    queryKey: ["smartlab-calendar", mode],
    queryFn: () => fetchSmartLabCalendar(mode),
    enabled,
    staleTime: 30 * 60_000,
    refetchInterval: 45 * 60_000,
    retry: 1,
  });
}
