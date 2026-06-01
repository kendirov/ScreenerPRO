import {
  isWeekendDateKey,
  moscowTodayKey,
  shiftCalendarDaysKey,
} from "@/lib/domain/trading-calendar";
import type { QuadHedgeWindowScope } from "./window";

/** MOEX FORTS: доступные intraday интервалы (минуты). 15м нет — только 1/10/60. */
export const MOEX_FORTS_INTRADAY_INTERVALS = [1, 10, 60] as const;

export function quadHedgeMoexInterval(preset: "30m" | "60m" | "day" | "5d"): number {
  if (preset === "30m") return 10;
  if (preset === "60m") return 60;
  if (preset === "day") return 60;
  return 60;
}

/**
 * Сколько календарных дней запрашивать у MOEX.
 * Минимум покрывает выходные: «Сегодня» в сб/вс всё равно должно найти пятницу.
 */
export function quadHedgeCandleCalendarDays(
  windowScope: QuadHedgeWindowScope,
  datePreset: "today" | "yesterday" | "pick",
): number {
  if (windowScope === "week") return 14;

  if (windowScope === "yesterday") return 5;

  if (datePreset === "pick") return 8;

  const today = moscowTodayKey();
  if (isWeekendDateKey(today)) return 7;

  return 5;
}

export function resolveQuadHedgeCandleDateRange(calendarDays: number): {
  from: string;
  till: string;
} {
  const till = moscowTodayKey();
  const from = shiftCalendarDaysKey(till, -Math.max(calendarDays, 1));
  return { from, till };
}

export function futuresCandlesPath(secid: string, from: string, till: string, interval: number): string {
  return `/engines/futures/markets/forts/securities/${encodeURIComponent(secid)}/candles.json?from=${from}&till=${till}&interval=${interval}`;
}
