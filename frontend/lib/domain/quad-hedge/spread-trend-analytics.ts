import type {
  QuadHedgeSpreadTrend,
  SpreadHoldZone,
  SpreadLabSignalStatus,
  SpreadLastExtreme,
  SpreadTrendEvent,
} from "./types";
import type { QuadHedgePointThresholds } from "./point-thresholds";
import { SPREAD_LAB_POINT_THRESHOLDS } from "./point-thresholds";

export type { SpreadHoldZone, SpreadLastExtreme, SpreadTrendEvent };
export type SpreadTrendEventKind = SpreadTrendEvent["kind"];

export type SpreadTrendAnalytics = {
  currentSpread: number;
  maxSpread: number;
  minSpread: number;
  lastExtreme: SpreadLastExtreme | null;
  /** Signed: high → current−max; low → current−min. */
  distanceFromExtreme: number | null;
  /** Signed: current − lastExtreme.value. */
  collapseFromExtreme: number | null;
  trend: QuadHedgeSpreadTrend;
  trendLookback: number;
  holdDuration: number;
  holdZone: SpreadHoldZone;
  labSignalStatus: SpreadLabSignalStatus;
  events: SpreadTrendEvent[];
};

const MOSCOW_TZ = "Europe/Moscow";

function finiteSeries(series: number[]): number[] {
  return series.filter(Number.isFinite);
}

function formatEventTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: MOSCOW_TZ,
  }).format(new Date(ms));
}

/** Последний по времени экстремум (обновление running max/min). */
export function findLastExtremeEvent(
  series: number[],
  timestamps: string[],
): SpreadLastExtreme | null {
  let runningMax = -Infinity;
  let runningMin = Infinity;
  let last: SpreadLastExtreme | null = null;

  for (let i = 0; i < series.length; i++) {
    const v = series[i]!;
    if (!Number.isFinite(v)) continue;
    const ts = timestamps[i] ?? "";

    if (v >= runningMax) {
      runningMax = v;
      last = { type: "high", value: v, time: ts, index: i };
    }
    if (v <= runningMin) {
      runningMin = v;
      last = { type: "low", value: v, time: ts, index: i };
    }
  }

  return last;
}

function absTrendAt(
  series: number[],
  endIndex: number,
  lookback: number,
): { expanding: number; compressing: number } {
  const slice: number[] = [];
  for (let i = Math.max(0, endIndex - lookback + 1); i <= endIndex; i++) {
    const v = series[i];
    if (Number.isFinite(v)) slice.push(v!);
  }
  if (slice.length < 3) return { expanding: 0, compressing: 0 };

  const absSlice = slice.map(Math.abs);
  let expanding = 0;
  let compressing = 0;
  for (let i = 1; i < absSlice.length; i++) {
    const diff = absSlice[i]! - absSlice[i - 1]!;
    if (diff > 0.5) expanding++;
    if (diff < -0.5) compressing++;
  }
  return { expanding, compressing };
}

export function detectSpreadTrend(
  series: number[],
  current: number,
  maxSpread: number,
  minSpread: number,
  lastExtreme: SpreadLastExtreme | null,
  th: QuadHedgePointThresholds,
): QuadHedgeSpreadTrend {
  if (series.length < th.minTrendPoints) return "stable";

  if (current === maxSpread || current === minSpread) return "new-extreme";

  const lastIdx = series.length - 1;
  const { expanding, compressing } = absTrendAt(series, lastIdx, th.trendLookbackPoints);
  const curAbs = Math.abs(current);
  const prevAbs = Math.abs(series[lastIdx - 1] ?? current);

  const nearExtreme =
    lastExtreme != null &&
    Math.abs(current - lastExtreme.value) <= Math.max(th.noisePoints, 50);

  const wasAtExtreme =
    lastExtreme != null &&
    prevAbs >= Math.abs(lastExtreme.value) * (1 - th.nearExtremePct);

  if (
    (wasAtExtreme || nearExtreme) &&
    curAbs < prevAbs &&
    compressing >= 1
  ) {
    return "pullback";
  }

  if (expanding >= compressing && expanding >= 2) return "expanding";
  if (compressing > expanding && compressing >= 2) return "compressing";
  return "stable";
}

export function calcHoldDuration(
  series: number[],
  th: QuadHedgePointThresholds,
): { holdDuration: number; holdZone: SpreadHoldZone } {
  let holdDuration = 0;
  let holdZone: SpreadHoldZone = "none";

  for (let i = series.length - 1; i >= 0; i--) {
    const v = series[i];
    if (!Number.isFinite(v)) break;
    const abs = Math.abs(v!);

    if (abs >= th.divergencePoints) {
      holdDuration++;
      holdZone = "extreme";
    } else if (abs >= th.watchPoints) {
      holdDuration++;
      if (holdZone === "none") holdZone = "watch";
    } else {
      break;
    }
  }

  return { holdDuration, holdZone };
}

export function deriveSpreadLabSignalStatus(input: {
  current: number;
  trend: QuadHedgeSpreadTrend;
  th: QuadHedgePointThresholds;
  lastExtreme: SpreadLastExtreme | null;
  maxSpread: number;
  minSpread: number;
  collapseFromExtreme: number | null;
}): SpreadLabSignalStatus {
  const { current, trend, th, lastExtreme, collapseFromExtreme } = input;
  const abs = Math.abs(current);

  if (!Number.isFinite(current)) return "NO_DATA";

  if (abs <= th.noisePoints) return "FLAT";

  if (abs >= th.strongPoints || trend === "new-extreme" && abs >= th.divergencePoints) {
    return abs >= th.strongPoints ? "STRONG_EXTREME" : "EXTREME";
  }

  if (abs >= th.divergencePoints) return "EXTREME";

  if (trend === "expanding") return "EXPANDING";

  if (trend === "pullback" || trend === "compressing") return "PULLBACK";

  if (
    lastExtreme != null &&
    abs >= th.watchPoints * 0.65 &&
    Math.abs(current - lastExtreme.value) <= th.divergencePoints * 0.15
  ) {
    return "RETEST";
  }

  if (
    collapseFromExtreme != null &&
    Math.abs(collapseFromExtreme) >= th.noisePoints &&
    abs >= th.watchPoints * 0.8 &&
    lastExtreme?.type === "high" &&
    current > 0
  ) {
    return "RETEST";
  }

  return "NORMAL";
}

function trendAtIndex(
  series: number[],
  index: number,
  maxSpread: number,
  minSpread: number,
  th: QuadHedgePointThresholds,
): QuadHedgeSpreadTrend {
  const v = series[index];
  if (!Number.isFinite(v)) return "stable";
  if (v === maxSpread || v === minSpread) return "new-extreme";
  const { expanding, compressing } = absTrendAt(series, index, th.trendLookbackPoints);
  if (expanding >= compressing && expanding >= 2) return "expanding";
  if (compressing > expanding && compressing >= 2) return "compressing";
  return "stable";
}

/** Мини-лента событий по серии spread. */
export function buildSpreadEventTape(
  series: number[],
  timestamps: string[],
  th: QuadHedgePointThresholds,
  maxSpread: number,
  minSpread: number,
  maxEvents = 8,
): SpreadTrendEvent[] {
  const events: SpreadTrendEvent[] = [];
  let runningMax = -Infinity;
  let runningMin = Infinity;
  let prevTrend: QuadHedgeSpreadTrend = "stable";
  let hadPullback = false;
  let lastCollapseAnnounced = false;

  for (let i = 0; i < series.length; i++) {
    const v = series[i]!;
    if (!Number.isFinite(v)) continue;
    const ts = timestamps[i] ?? "";
    const timeLabel = formatEventTime(ts);

    if (v > runningMax) {
      runningMax = v;
      events.push({
        time: ts,
        timeLabel,
        message: `новый максимум ${formatSpreadLabPoints(v)}`,
        kind: "new-max",
        index: i,
      });
    }
    if (v < runningMin) {
      runningMin = v;
      events.push({
        time: ts,
        timeLabel,
        message: `новый минимум ${formatSpreadLabPoints(v)}`,
        kind: "new-min",
        index: i,
      });
    }

    const trend = trendAtIndex(series, i, maxSpread, minSpread, th);
    if (
      (trend === "compressing" || trend === "pullback") &&
      prevTrend === "expanding" &&
      Math.abs(v) >= th.watchPoints * 0.5
    ) {
      events.push({
        time: ts,
        timeLabel,
        message: "spread начал сужаться",
        kind: "compress-start",
        index: i,
      });
    }
    prevTrend = trend;

    if (trend === "pullback") hadPullback = true;

    const lastExt = findLastExtremeEvent(series.slice(0, i + 1), timestamps.slice(0, i + 1));
    if (
      lastExt &&
      i === series.length - 1 &&
      !lastCollapseAnnounced &&
      Math.abs(v - lastExt.value) >= th.noisePoints
    ) {
      const collapse = v - lastExt.value;
      if (Math.abs(collapse) >= th.noisePoints * 0.5) {
        events.push({
          time: ts,
          timeLabel,
          message: `схлопывание ${formatSpreadLabPoints(collapse)}`,
          kind: "collapse",
          index: i,
        });
        lastCollapseAnnounced = true;
      }
    }

    if (
      hadPullback &&
      Math.abs(v) >= th.divergencePoints * 0.85 &&
      i === series.length - 1
    ) {
      events.push({
        time: ts,
        timeLabel,
        message: `повторный тест зоны ${formatSpreadLabPoints(v)}`,
        kind: "retest",
        index: i,
      });
    }
  }

  return events.slice(-maxEvents);
}

export function analyzeSpreadTrend(
  series: number[],
  timestamps: string[],
  th: QuadHedgePointThresholds = SPREAD_LAB_POINT_THRESHOLDS,
): SpreadTrendAnalytics | null {
  const finite = finiteSeries(series);
  if (finite.length < 2) return null;

  const currentSpread = series[series.length - 1]!;
  if (!Number.isFinite(currentSpread)) return null;

  const maxSpread = Math.max(...finite);
  const minSpread = Math.min(...finite);
  const lastExtreme = findLastExtremeEvent(series, timestamps);

  const distanceFromExtreme =
    lastExtreme?.type === "high"
      ? currentSpread - maxSpread
      : lastExtreme?.type === "low"
        ? currentSpread - minSpread
        : null;

  const collapseFromExtreme =
    lastExtreme != null ? currentSpread - lastExtreme.value : null;

  const trend = detectSpreadTrend(
    series,
    currentSpread,
    maxSpread,
    minSpread,
    lastExtreme,
    th,
  );

  const { holdDuration, holdZone } = calcHoldDuration(series, th);

  const labSignalStatus = deriveSpreadLabSignalStatus({
    current: currentSpread,
    trend,
    th,
    lastExtreme,
    maxSpread,
    minSpread,
    collapseFromExtreme,
  });

  const events = buildSpreadEventTape(
    series,
    timestamps,
    th,
    maxSpread,
    minSpread,
  );

  return {
    currentSpread,
    maxSpread,
    minSpread,
    lastExtreme,
    distanceFromExtreme,
    collapseFromExtreme,
    trend,
    trendLookback: th.trendLookbackPoints,
    holdDuration,
    holdZone,
    labSignalStatus,
    events,
  };
}

export function formatSpreadLabPoints(value: number | null, signed = true): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value);
  if (!signed) return `${Math.abs(rounded)} п.`;
  return `${rounded >= 0 ? "+" : ""}${rounded} п.`;
}

export const SPREAD_LAB_SIGNAL_LABEL: Record<SpreadLabSignalStatus, string> = {
  NORMAL: "NORMAL",
  EXPANDING: "EXPANDING",
  EXTREME: "EXTREME",
  STRONG_EXTREME: "STRONG_EXTREME",
  PULLBACK: "PULLBACK",
  RETEST: "RETEST",
  FLAT: "FLAT",
  NO_DATA: "NO_DATA",
};

export const SPREAD_TREND_LABEL_RU: Record<QuadHedgeSpreadTrend, string> = {
  expanding: "расширяется",
  compressing: "сужается",
  stable: "стабильно",
  pullback: "возврат от экстремума",
  "new-extreme": "новый экстремум",
  /** @deprecated alias pullback */
  "reversing-to-zero": "возврат от экстремума",
};
