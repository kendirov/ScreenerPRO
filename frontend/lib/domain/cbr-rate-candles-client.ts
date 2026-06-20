/**
 * Client fetch for CBR rate-reaction candles API.
 */

import type { CbrMoexInstrumentSpec } from "@/lib/domain/cbr-rate-instrument-config";
import type { CbrChartTimeframe } from "@/lib/domain/cbr-rate-chart-model";

export type CbrCandlesApiDataStatus = "live" | "fallback" | "error";

export type CbrCandlesApiCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  value?: number;
};

export type CbrCandlesApiResponse = {
  ticker: string;
  resolvedTicker: string;
  engine: string;
  market: string;
  board: string | null;
  date: string;
  interval: number;
  from: string;
  till: string;
  dataStatus: CbrCandlesApiDataStatus;
  source: "moex-iss" | "mock" | "none";
  candles: CbrCandlesApiCandle[];
  error?: string;
  contractSource?: "iss" | "manual" | "direct";
  diagnostics?: string[];
  currencyResolvedType?: "perpetual_futures" | "nearest_futures" | "unresolved";
  currencyDisplayLabel?: string;
};

export async function fetchCbrRateCandlesFromApi(
  spec: CbrMoexInstrumentSpec,
  date: string,
  interval: CbrChartTimeframe,
  options?: { allowFallback?: boolean; signal?: AbortSignal },
): Promise<CbrCandlesApiResponse> {
  const params = new URLSearchParams({
    ticker: spec.secid ?? spec.displayTicker,
    engine: spec.engine,
    market: spec.market,
    date: date.slice(0, 10),
    interval: String(interval),
    allowFallback: options?.allowFallback === true ? "true" : "false",
  });

  if (spec.board) params.set("board", spec.board);
  if (spec.futuresAssetCode) params.set("assetCode", spec.futuresAssetCode);
  if (spec.currencyKey) params.set("currencyKey", spec.currencyKey);

  const res = await fetch(`/api/cbr-rate-reaction/candles?${params.toString()}`, {
    signal: options?.signal,
    cache: "no-store",
  });

  const data = (await res.json()) as CbrCandlesApiResponse & { error?: string };
  if (!res.ok && !data.dataStatus) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return data;
}
