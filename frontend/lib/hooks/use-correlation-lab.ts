"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  CorrelationApiFactorId,
  CorrelationApiInterval,
  CorrelationApiPeriod,
  CorrelationFactorDetailResponse,
  CorrelationOverviewResponse,
  CorrelationPairResponse,
} from "@/lib/domain/correlation-api";
import { isCorrelationApiFactorId } from "@/lib/domain/correlation-api";
import type { CorrelationLabSourcesResponse } from "@/lib/domain/correlation-lab";

const DEFAULT_PERIOD: CorrelationApiPeriod = 20;

function buildQuery(params: Record<string, string | number>) {
  return new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
}

async function fetchOverview(period: CorrelationApiPeriod): Promise<CorrelationOverviewResponse> {
  const res = await fetch(`/api/lab/correlation/overview?period=${period}`);
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? "Не удалось построить матрицу связей");
  }
  return res.json() as Promise<CorrelationOverviewResponse>;
}

async function fetchFactorDetail(
  factorId: CorrelationApiFactorId,
  period: CorrelationApiPeriod,
  interval: CorrelationApiInterval,
): Promise<CorrelationFactorDetailResponse> {
  const qs = buildQuery({ period, interval });
  const res = await fetch(`/api/lab/correlation/factor/${factorId}?${qs}`);
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? "Не удалось загрузить детали фактора");
  }
  return res.json() as Promise<CorrelationFactorDetailResponse>;
}

async function fetchPair(
  stock: string,
  factorId: CorrelationApiFactorId,
  period: CorrelationApiPeriod,
  interval: CorrelationApiInterval,
): Promise<CorrelationPairResponse> {
  const qs = buildQuery({ stock, factor: factorId, period, interval });
  const res = await fetch(`/api/lab/correlation/pair?${qs}`);
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? "Не удалось загрузить пару");
  }
  return res.json() as Promise<CorrelationPairResponse>;
}

async function fetchSources(): Promise<CorrelationLabSourcesResponse> {
  const res = await fetch("/api/lab/correlation-lab/sources");
  if (!res.ok) throw new Error("Не удалось загрузить статус источников");
  return res.json() as Promise<CorrelationLabSourcesResponse>;
}

export function useCorrelationOverview(period: CorrelationApiPeriod = DEFAULT_PERIOD) {
  return useQuery({
    queryKey: ["correlation-overview", period],
    queryFn: () => fetchOverview(period),
    staleTime: 90_000,
    refetchInterval: 120_000,
  });
}

/** @deprecated используйте useCorrelationOverview */
export function useCorrelationLabOverview() {
  return useCorrelationOverview();
}

export function useCorrelationFactorDetail(
  factorId: CorrelationApiFactorId | null,
  period: CorrelationApiPeriod = DEFAULT_PERIOD,
  interval: CorrelationApiInterval = 24,
) {
  return useQuery({
    queryKey: ["correlation-factor", factorId, period, interval],
    queryFn: () => fetchFactorDetail(factorId!, period, interval),
    enabled: factorId != null && isCorrelationApiFactorId(factorId),
    staleTime: 90_000,
  });
}

export function useCorrelationPair(
  stock: string | null,
  factorId: CorrelationApiFactorId | null,
  period: CorrelationApiPeriod = DEFAULT_PERIOD,
  interval: CorrelationApiInterval = 24,
) {
  return useQuery({
    queryKey: ["correlation-pair", stock, factorId, period, interval],
    queryFn: () => fetchPair(stock!, factorId!, period, interval),
    enabled: Boolean(stock && factorId && isCorrelationApiFactorId(factorId)),
    staleTime: 90_000,
  });
}

export function useCorrelationLabSources() {
  return useQuery({
    queryKey: ["correlation-lab-sources"],
    queryFn: fetchSources,
    staleTime: 10 * 60 * 1000,
  });
}
