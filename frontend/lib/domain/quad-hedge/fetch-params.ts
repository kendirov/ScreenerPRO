import type { QuadHedgeWindowScope } from "./window";
import { quadHedgeCandleCalendarDays, quadHedgeMoexInterval } from "./candle-fetch";

export type QuadHedgeDatePreset = "today" | "yesterday" | "pick";
export type QuadHedgeIntervalPreset = "30m" | "60m" | "day" | "5d";

/** MOEX ISS intraday interval (минуты). 30м UI → 10м MOEX. */
export function quadHedgeApiInterval(preset: QuadHedgeIntervalPreset): number {
  return quadHedgeMoexInterval(preset);
}

export function resolveQuadHedgeWindowScope(
  datePreset: QuadHedgeDatePreset,
  intervalPreset: QuadHedgeIntervalPreset,
): QuadHedgeWindowScope {
  if (intervalPreset === "5d") return "week";
  if (datePreset === "yesterday") return "yesterday";
  if (datePreset === "pick") return "pick";
  return "today";
}

/** Сколько календарных дней запрашивать у MOEX ISS (с запасом на выходные). */
export function quadHedgeCalendarFetchDays(
  datePreset: QuadHedgeDatePreset,
  intervalPreset: QuadHedgeIntervalPreset,
): number {
  const scope = resolveQuadHedgeWindowScope(datePreset, intervalPreset);
  return quadHedgeCandleCalendarDays(scope, datePreset);
}

export function resolveQuadHedgeFetchParams(
  datePreset: QuadHedgeDatePreset,
  intervalPreset: QuadHedgeIntervalPreset,
): {
  calendarDays: number;
  windowScope: QuadHedgeWindowScope;
  interval: number;
} {
  return {
    calendarDays: quadHedgeCalendarFetchDays(datePreset, intervalPreset),
    windowScope: resolveQuadHedgeWindowScope(datePreset, intervalPreset),
    interval: quadHedgeApiInterval(intervalPreset),
  };
}
