import type { AlignedIntradayRow } from "@/lib/domain/currency-intraday-series";
import type { AlignedPairPoint } from "@/lib/domain/currency-time-series-align";

export type SpreadAnchorMode = "period-start" | "week-open" | "day-open" | "manual";

export type SpreadAnchorResolution = {
  requestedMode: SpreadAnchorMode;
  effectiveMode: SpreadAnchorMode;
  index: number;
  timestamp: string;
  forwardFilledAtAnchor: boolean;
  fallbackWarning: string | null;
};

export type DivergenceAnchorOptions = {
  anchorIndex?: number;
  /** Z-score только по спреду начиная с якоря (до якоря — null). */
  zScoreFromAnchor?: boolean;
};

export const DEFAULT_SPREAD_ANCHOR_MODE: SpreadAnchorMode = "week-open";

export const SPREAD_ANCHOR_MODE_LABELS: Record<SpreadAnchorMode, string> = {
  "period-start": "старт периода",
  "week-open": "открытие недели",
  "day-open": "открытие дня",
  manual: "выбранная точка",
};

export const SPREAD_ANCHOR_CONTROL_LABELS: Record<SpreadAnchorMode, string> = {
  "period-start": "Старт периода",
  "week-open": "Открытие недели",
  "day-open": "Открытие дня",
  manual: "Выбранная точка",
};

export const SPREAD_ANCHOR_HINT =
  "Спред — разница движений от точки отсчёта. «Открытие недели» — якорь с понедельника; при недоступности — старт периода.";

function parseTs(ts: string): number {
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? ms : NaN;
}

function moscowDateKey(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" });
}

function moscowWeekday(ms: number): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Moscow",
    weekday: "short",
  });
  const wd = fmt.format(new Date(ms));
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd] ?? 0;
}

function mondayKeyForMoscowMs(ms: number): string {
  const daysBack = (moscowWeekday(ms) + 6) % 7;
  return moscowDateKey(ms - daysBack * 86_400_000);
}

function findIndexForWeekOpen(aligned: AlignedIntradayRow[]): number | null {
  if (!aligned.length) return null;
  const lastMs = parseTs(aligned[aligned.length - 1]!.timestamp);
  if (!Number.isFinite(lastMs)) return null;
  const weekMondayKey = mondayKeyForMoscowMs(lastMs);
  for (let i = 0; i < aligned.length; i++) {
    const key = moscowDateKey(parseTs(aligned[i]!.timestamp));
    if (key >= weekMondayKey) return i;
  }
  return null;
}

function findIndexForDayOpen(aligned: AlignedIntradayRow[]): number | null {
  if (!aligned.length) return null;
  const lastMs = parseTs(aligned[aligned.length - 1]!.timestamp);
  if (!Number.isFinite(lastMs)) return null;
  const dayKey = moscowDateKey(lastMs);
  for (let i = 0; i < aligned.length; i++) {
    if (moscowDateKey(parseTs(aligned[i]!.timestamp)) === dayKey) return i;
  }
  return null;
}

function findIndexForManual(
  aligned: AlignedIntradayRow[],
  manualTime: string | null | undefined,
  intervalMinutes: number,
): number | null {
  if (!manualTime) return null;
  const target = parseTs(manualTime);
  if (!Number.isFinite(target)) return null;
  const tolerance = (intervalMinutes * 60 * 1000) / 2;
  let best = -1;
  let bestDelta = Infinity;
  for (let i = 0; i < aligned.length; i++) {
    const delta = Math.abs(parseTs(aligned[i]!.timestamp) - target);
    if (delta <= tolerance && delta < bestDelta) {
      bestDelta = delta;
      best = i;
    }
  }
  return best >= 0 ? best : null;
}

function forwardFilledAtAnchor(
  points: AlignedPairPoint[] | undefined,
  index: number,
): boolean {
  const pt = points?.[index];
  if (!pt) return false;
  return pt.leftIsForwardFilled || pt.rightIsForwardFilled;
}

function periodStartResolution(
  aligned: AlignedIntradayRow[],
  points: AlignedPairPoint[] | undefined,
  mode: SpreadAnchorMode,
): SpreadAnchorResolution {
  return {
    requestedMode: mode,
    effectiveMode: "period-start",
    index: 0,
    timestamp: aligned[0]?.timestamp ?? "",
    forwardFilledAtAnchor: forwardFilledAtAnchor(points, 0),
    fallbackWarning: null,
  };
}

export function resolveSpreadAnchor(
  aligned: AlignedIntradayRow[],
  points: AlignedPairPoint[] | undefined,
  mode: SpreadAnchorMode,
  options: {
    manualAnchorTime?: string | null;
    intervalMinutes?: number;
  } = {},
): SpreadAnchorResolution {
  if (!aligned.length) {
    return {
      requestedMode: mode,
      effectiveMode: "period-start",
      index: 0,
      timestamp: "",
      forwardFilledAtAnchor: false,
      fallbackWarning: null,
    };
  }

  if (mode === "period-start") {
    return periodStartResolution(aligned, points, mode);
  }

  let index: number | null = null;
  let effectiveMode: SpreadAnchorMode = mode;
  let fallbackWarning: string | null = null;

  if (mode === "week-open") {
    index = findIndexForWeekOpen(aligned);
    if (index == null) {
      index = 0;
      effectiveMode = "period-start";
      fallbackWarning = "открытие недели недоступно, использован старт периода";
    }
  } else if (mode === "day-open") {
    index = findIndexForDayOpen(aligned);
    if (index == null) {
      index = 0;
      effectiveMode = "period-start";
      fallbackWarning = "открытие дня недоступно, использован старт периода";
    }
  } else if (mode === "manual") {
    index = findIndexForManual(
      aligned,
      options.manualAnchorTime,
      options.intervalMinutes ?? 10,
    );
    if (index == null) {
      index = 0;
      effectiveMode = "period-start";
      fallbackWarning = "выбранная точка недоступна, использован старт периода";
    }
  }

  const idx = index ?? 0;
  return {
    requestedMode: mode,
    effectiveMode,
    index: idx,
    timestamp: aligned[idx]!.timestamp,
    forwardFilledAtAnchor: forwardFilledAtAnchor(points, idx),
    fallbackWarning,
  };
}

export function divergenceOptionsFromResolution(
  resolution: SpreadAnchorResolution,
): DivergenceAnchorOptions {
  return {
    anchorIndex: resolution.index,
    zScoreFromAnchor: true,
  };
}

export function formatAnchorTimestamp(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function barsBetweenTimestamps(
  fromIso: string,
  toIso: string,
  intervalMinutes: number,
): number {
  const from = parseTs(fromIso);
  const to = parseTs(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  const step = intervalMinutes * 60 * 1000;
  if (step <= 0) return 0;
  return Math.max(0, Math.round((to - from) / step));
}

export function durationLabelFromAnchor(
  bars: number,
  intervalMinutes: number,
): string {
  if (bars <= 0) return "0 св.";
  const minutes = bars * intervalMinutes;
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (rem === 0) return `${hours} ч`;
  return `${hours} ч ${rem} мин`;
}
