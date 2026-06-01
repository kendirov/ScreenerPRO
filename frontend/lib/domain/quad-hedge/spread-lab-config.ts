import type { QuadHedgeSpreadUnitMode, QuadHedgeViewMode } from "./types";
import type { QuadHedgeWindowScope } from "./window";

/** Глубина истории Spread Lab (торговые сессии, не календарные дни). */
export type SpreadLabHistoryDepth = "1S" | "3S" | "7S" | "MAX";

/** Режим загрузки MOEX ISS. */
export type SpreadLabHistoryMode = "max" | "sessions" | "days";

/** Целевой таймфрейм UI (минуты). */
export const SPREAD_LAB_DISPLAY_INTERVAL = 5;

/**
 * Интервал запроса к MOEX.
 * FORTS не отдаёт native 5m — берём 1m и агрегируем в 5m.
 */
export const SPREAD_LAB_MOEX_INTERVAL = 1;

/** Без window-filter «Сегодня/Вчера» — фильтр по historyDepth. */
export const SPREAD_LAB_WINDOW_SCOPE: QuadHedgeWindowScope = "pick";

export const SPREAD_LAB_DEFAULT_PAIR: QuadHedgeViewMode = "SI-EU";
export const SPREAD_LAB_DEFAULT_UNIT: QuadHedgeSpreadUnitMode = "points";
export const SPREAD_LAB_DEFAULT_HISTORY_DEPTH: SpreadLabHistoryDepth = "7S";

export const SPREAD_LAB_HISTORY_DEPTH_OPTIONS: Array<{
  id: SpreadLabHistoryDepth;
  label: string;
  sessions: number | null;
}> = [
  { id: "1S", label: "1С", sessions: 1 },
  { id: "3S", label: "3С", sessions: 3 },
  { id: "7S", label: "7С", sessions: 7 },
  { id: "MAX", label: "MAX", sessions: null },
];

/** Календарных дней запроса MOEX (запас на выходные). */
export function spreadLabCalendarDaysForDepth(depth: SpreadLabHistoryDepth): number {
  if (depth === "1S") return 5;
  if (depth === "3S") return 10;
  if (depth === "7S") return 14;
  return 14;
}

export function spreadLabSessionCountForDepth(depth: SpreadLabHistoryDepth): number | null {
  const opt = SPREAD_LAB_HISTORY_DEPTH_OPTIONS.find((o) => o.id === depth);
  return opt?.sessions ?? null;
}

export function spreadLabHistoryModeForDepth(depth: SpreadLabHistoryDepth): SpreadLabHistoryMode {
  return depth === "MAX" ? "max" : "sessions";
}

export function spreadLabFetchParams(depth: SpreadLabHistoryDepth = SPREAD_LAB_DEFAULT_HISTORY_DEPTH): {
  historyDepth: SpreadLabHistoryDepth;
  calendarDays: number;
  sessionCount: number | null;
  windowScope: QuadHedgeWindowScope;
  moexInterval: number;
  displayInterval: number;
  historyMode: SpreadLabHistoryMode;
} {
  return {
    historyDepth: depth,
    calendarDays: spreadLabCalendarDaysForDepth(depth),
    sessionCount: spreadLabSessionCountForDepth(depth),
    windowScope: SPREAD_LAB_WINDOW_SCOPE,
    moexInterval: SPREAD_LAB_MOEX_INTERVAL,
    displayInterval: SPREAD_LAB_DISPLAY_INTERVAL,
    historyMode: spreadLabHistoryModeForDepth(depth),
  };
}

export function spreadLabHistoryDepthLabel(depth: SpreadLabHistoryDepth): string {
  return SPREAD_LAB_HISTORY_DEPTH_OPTIONS.find((o) => o.id === depth)?.label ?? depth;
}

export function parseSpreadLabHistoryDepth(raw: string | null | undefined): SpreadLabHistoryDepth {
  if (raw === "1S" || raw === "3S" || raw === "7S" || raw === "MAX") return raw;
  return SPREAD_LAB_DEFAULT_HISTORY_DEPTH;
}
