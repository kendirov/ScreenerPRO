import {
  getPreviousTradingDayKey,
  isWeekendDateKey,
  MOSCOW_TZ,
  moscowTodayKey,
  formatTradingDateLabel,
} from "@/lib/domain/trading-calendar";
import { QUAD_HEDGE_PRIMARY_LEGS } from "./basket";
import type { QuadHedgeLegId, QuadHedgeLegSeries, QuadHedgePricePoint } from "./types";

/** Сколько торговых сессий в режиме 5Д. */
export const QUAD_HEDGE_WEEK_SESSION_COUNT = 5;

/** Календарных дней для запроса MOEX (с запасом на выходные). */
export const QUAD_HEDGE_WEEK_FETCH_CALENDAR_DAYS = 12;

export type QuadHedgeWindowScope = "today" | "yesterday" | "pick" | "week";

export type QuadHedgeHistoryStatus =
  | "LIVE"
  | "HIST"
  | "WEEK"
  | "NO_HISTORY"
  | "PARTIAL_HISTORY";

export function moscowSessionKeyFromIso(iso: string): string | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MOSCOW_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

/** Уникальные торговые даты (без сб/вс) из всех точек ног. */
export function collectTradingSessionKeys(legs: QuadHedgeLegSeries[]): string[] {
  const keys = new Set<string>();
  for (const leg of legs) {
    for (const p of leg.points) {
      const key = moscowSessionKeyFromIso(p.timestamp);
      if (!key || isWeekendDateKey(key)) continue;
      keys.add(key);
    }
  }
  return [...keys].sort();
}

/** Последние N торговых сессий из доступных дат. */
export function lastNTradingSessions(keys: string[], n = QUAD_HEDGE_WEEK_SESSION_COUNT): string[] {
  return keys.slice(-n);
}

export function filterPointsToSessions(
  points: QuadHedgePricePoint[],
  allowed: Set<string>,
): QuadHedgePricePoint[] {
  return points.filter((p) => {
    const key = moscowSessionKeyFromIso(p.timestamp);
    return key != null && allowed.has(key);
  });
}

export function filterLegsToSessions(
  legs: QuadHedgeLegSeries[],
  sessionKeys: string[],
): QuadHedgeLegSeries[] {
  const allowed = new Set(sessionKeys);
  return legs.map((leg) => ({
    ...leg,
    points: filterPointsToSessions(leg.points, allowed),
  }));
}

export type QuadHedgeWindowApplyResult = {
  legs: QuadHedgeLegSeries[];
  scope: QuadHedgeWindowScope;
  tradingSessions: string[];
  allSessionsFound: string[];
};

/** Обрезка рядов под выбранное окно (today / yesterday / week / pick). */
export function applyQuadHedgeWindow(
  legs: QuadHedgeLegSeries[],
  scope: QuadHedgeWindowScope,
): QuadHedgeWindowApplyResult {
  const allSessionsFound = collectTradingSessionKeys(legs);

  if (!allSessionsFound.length) {
    return { legs, scope, tradingSessions: [], allSessionsFound: [] };
  }

  if (scope === "week") {
    const tradingSessions = lastNTradingSessions(allSessionsFound);
    return {
      legs: filterLegsToSessions(legs, tradingSessions),
      scope,
      tradingSessions,
      allSessionsFound,
    };
  }

  if (scope === "today") {
    const today = moscowTodayKey();
    const hasToday = allSessionsFound.includes(today);
    const target = hasToday ? today : allSessionsFound[allSessionsFound.length - 1]!;
    return {
      legs: filterLegsToSessions(legs, [target]),
      scope,
      tradingSessions: [target],
      allSessionsFound,
    };
  }

  if (scope === "yesterday") {
    const prev = getPreviousTradingDayKey(moscowTodayKey());
    const hasPrev = allSessionsFound.includes(prev);
    const fallback = allSessionsFound.length >= 2
      ? allSessionsFound[allSessionsFound.length - 2]!
      : allSessionsFound[allSessionsFound.length - 1]!;
    const target = hasPrev ? prev : fallback;
    return {
      legs: filterLegsToSessions(legs, [target]),
      scope,
      tradingSessions: [target],
      allSessionsFound,
    };
  }

  return {
    legs,
    scope,
    tradingSessions: allSessionsFound,
    allSessionsFound,
  };
}

export type QuadHedgeHistoryMeta = {
  status: QuadHedgeHistoryStatus;
  label: string;
  message: string;
  tradingSessions: string[];
  sessionLabels: string[];
  zScoreLimited: boolean;
  missingPrimaryLegs: QuadHedgeLegId[];
};

export function assessQuadHedgeHistoryMeta(input: {
  scope: QuadHedgeWindowScope;
  windowResult: QuadHedgeWindowApplyResult;
  legsAfterWindow: QuadHedgeLegSeries[];
  alignedPointCount: number;
  focusZStatus: "ok" | "no-data" | "insufficient-data";
}): QuadHedgeHistoryMeta {
  const { scope, windowResult, legsAfterWindow, alignedPointCount, focusZStatus } = input;

  const primaryPresent = QUAD_HEDGE_PRIMARY_LEGS.filter((id) => {
    const leg = legsAfterWindow.find((l) => l.legId === id);
    return leg != null && leg.points.length >= 2;
  });

  const missingPrimaryLegs = QUAD_HEDGE_PRIMARY_LEGS.filter(
    (id) => !primaryPresent.includes(id),
  );

  const sessionLabels = windowResult.tradingSessions.map((k) => formatTradingDateLabel(k));
  const zScoreLimited = focusZStatus === "insufficient-data";

  if (!windowResult.allSessionsFound.length || alignedPointCount < 2) {
    return {
      status: "NO_HISTORY",
      label: "NO HISTORY",
      message: "История за неделю не загружена. Нужен historical loader / collector.",
      tradingSessions: windowResult.tradingSessions,
      sessionLabels,
      zScoreLimited: true,
      missingPrimaryLegs,
    };
  }

  if (scope === "week") {
    const partial =
      windowResult.tradingSessions.length < QUAD_HEDGE_WEEK_SESSION_COUNT ||
      missingPrimaryLegs.length > 0;

    if (partial) {
      const missingText =
        missingPrimaryLegs.length > 0
          ? `Частичная история: ${primaryPresent.join(", ")} есть; ${missingPrimaryLegs.join(", ")} отсутствуют.`
          : `Частичная история: ${windowResult.tradingSessions.length} из ${QUAD_HEDGE_WEEK_SESSION_COUNT} торговых дней.`;

      return {
        status: "PARTIAL_HISTORY",
        label: "PARTIAL",
        message: missingText,
        tradingSessions: windowResult.tradingSessions,
        sessionLabels,
        zScoreLimited,
        missingPrimaryLegs,
      };
    }

    let message = `5 торговых дней: ${sessionLabels.join(" · ")}.`;
    if (zScoreLimited) {
      message += " Недостаточно точек для z-score, показываем normalized spread.";
    }

    return {
      status: "WEEK",
      label: "WEEK",
      message,
      tradingSessions: windowResult.tradingSessions,
      sessionLabels,
      zScoreLimited,
      missingPrimaryLegs,
    };
  }

  const isLive = scope === "today" && windowResult.tradingSessions[0] === moscowTodayKey();

  if (missingPrimaryLegs.length > 0) {
    return {
      status: "PARTIAL_HISTORY",
      label: "PARTIAL",
      message: `Частичная история: ${primaryPresent.join(", ")} есть; ${missingPrimaryLegs.join(", ")} отсутствуют.`,
      tradingSessions: windowResult.tradingSessions,
      sessionLabels,
      zScoreLimited,
      missingPrimaryLegs,
    };
  }

  let message = isLive ? "Live-сессия MOEX ISS." : `Исторический день ${sessionLabels[0] ?? ""}.`.trim();
  if (zScoreLimited) {
    message += " Недостаточно точек для z-score, показываем normalized spread.";
  }

  return {
    status: isLive ? "LIVE" : "HIST",
    label: isLive ? "LIVE" : "HIST",
    message,
    tradingSessions: windowResult.tradingSessions,
    sessionLabels,
    zScoreLimited,
    missingPrimaryLegs,
  };
}

/** Первая точка каждой торговой сессии — для маркеров на графике. */
export function sessionBoundaryMarkers(
  timestamps: string[],
): Array<{ time: string; label: string }> {
  const markers: Array<{ time: string; label: string }> = [];
  let prevKey: string | null = null;

  for (const ts of timestamps) {
    const key = moscowSessionKeyFromIso(ts);
    if (!key || key === prevKey) continue;
    prevKey = key;
    const ms = Date.parse(ts);
    if (!Number.isFinite(ms)) continue;
    markers.push({
      time: String(Math.floor(ms / 1000)),
      label: formatTradingDateLabel(key),
    });
  }

  return markers;
}
