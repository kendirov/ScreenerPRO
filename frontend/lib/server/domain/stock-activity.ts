import type { StockActivityClass } from "@screenerpro/shared";

export const STOCK_ACTIVITY_THRESHOLDS = {
  activeRatioThreshold: 0.2,
  minTurnoverFloorRub: 120_000_000,
  minTradesFloor: 1_200,
  partialActivityFloorRub: 25_000_000,
  sessionStartMinuteMsk: 10 * 60,
  sessionEndMinuteMsk: 18 * 60 + 45,
  minProgressFactor: 0.25,
} as const;

type Input = {
  currentTurnoverRub: number | null;
  previousDayTurnoverRub: number | null;
  tradesCount: number | null;
};

function moscowMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Moscow",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getSessionProgress(now = new Date()): number {
  const minutes = moscowMinutes(now);
  const { sessionStartMinuteMsk, sessionEndMinuteMsk } = STOCK_ACTIVITY_THRESHOLDS;
  if (minutes <= sessionStartMinuteMsk) return 0;
  if (minutes >= sessionEndMinuteMsk) return 1;
  return (minutes - sessionStartMinuteMsk) / (sessionEndMinuteMsk - sessionStartMinuteMsk);
}

export function getRequiredActivityRatio(now = new Date()): number {
  const progress = getSessionProgress(now);
  const progressFactor = Math.max(progress, STOCK_ACTIVITY_THRESHOLDS.minProgressFactor);
  return STOCK_ACTIVITY_THRESHOLDS.activeRatioThreshold * progressFactor;
}

function safeRatio(value: number | null, baseline: number | null): number | null {
  if (value === null || baseline === null || baseline <= 0) return null;
  return value / baseline;
}

export function deriveStockActivityMetrics(input: Input, now = new Date()) {
  const activityRatio = safeRatio(input.currentTurnoverRub, input.previousDayTurnoverRub);
  const sessionProgress = getSessionProgress(now);
  const requiredActivityRatio = getRequiredActivityRatio(now);
  return {
    currentTurnoverRub: input.currentTurnoverRub,
    previousDayTurnoverRub: input.previousDayTurnoverRub,
    activityRatio,
    requiredActivityRatio,
    sessionProgress,
  };
}

export function classifyStockActivity(input: Input, now = new Date()): StockActivityClass {
  const currentTurnover = input.currentTurnoverRub ?? 0;
  const tradesCount = input.tradesCount ?? 0;
  const { minTurnoverFloorRub, minTradesFloor, partialActivityFloorRub } = STOCK_ACTIVITY_THRESHOLDS;
  const activityRatio = safeRatio(input.currentTurnoverRub, input.previousDayTurnoverRub);
  const requiredActivityRatio = getRequiredActivityRatio(now);

  const reachesActiveRatio = (activityRatio ?? 0) >= requiredActivityRatio;
  const reachesActiveFloor = currentTurnover >= minTurnoverFloorRub || tradesCount >= minTradesFloor;
  if (reachesActiveRatio && reachesActiveFloor) return "active";

  const hasPartialActivity = currentTurnover >= partialActivityFloorRub || tradesCount >= Math.max(1, Math.floor(minTradesFloor * 0.2));
  if (hasPartialActivity) return "has_activity";

  if (input.currentTurnoverRub === null && input.tradesCount === null) return "unknown";
  return "inactive";
}
