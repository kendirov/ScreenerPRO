import { calcSpreadZScore } from "@/lib/domain/currency-intraday-series";
import type { AlignedQuadRow } from "./metrics";
import {
  buildPairSpreadPoints,
  bucketPricePoints,
  type QuadHedgePairSpreadDiagnostics,
} from "./pair-spread";
import { analyzeSpreadTrend } from "./spread-trend-analytics";
import { calcSpreadSessionExtrema, sessionKeysFromTimestamps } from "./spread-lab-history";
import { analyzeSpreadPercentiles } from "./spread-percentile-analytics";
import { findLocalSpreadExtrema } from "./spread-lab-signals";
import { SPREAD_LAB_POINT_THRESHOLDS, resolvePointThresholds, type QuadHedgePointThresholds } from "./point-thresholds";
import type {
  QuadHedgeExtremeStatus,
  QuadHedgeLegId,
  QuadHedgeMetricStatus,
  QuadHedgePricePoint,
  QuadHedgeSpreadPairKey,
  QuadHedgeSpreadPointsMetric,
  QuadHedgeSpreadPointsSignalStatus,
  QuadHedgeSpreadTrend,
  SpreadLabSignalStatus,
} from "./types";
import { QUAD_HEDGE_SPREAD_PAIRS } from "./types";

export type QuadHedgeDeltaPoints = {
  legId: QuadHedgeLegId;
  status: QuadHedgeMetricStatus;
  currentPoints: number | null;
  seriesPoints: number[];
  anchorClose: number | null;
  anchorTimestamp: string | null;
};

export function calcDeltaPointsSeries(
  aligned: AlignedQuadRow[],
  legId: QuadHedgeLegId,
  anchorIndex = 0,
): QuadHedgeDeltaPoints {
  const anchorRow = aligned[anchorIndex];
  const anchorClose = anchorRow?.closes[legId];
  const anchorTimestamp = anchorRow?.timestamp ?? null;

  if (anchorClose == null || !Number.isFinite(anchorClose)) {
    return {
      legId,
      status: "no-data",
      currentPoints: null,
      seriesPoints: [],
      anchorClose: null,
      anchorTimestamp,
    };
  }

  const seriesPoints = aligned.map((row) => {
    const close = row.closes[legId];
    if (close == null || !Number.isFinite(close)) return NaN;
    return close - anchorClose;
  });

  const finite = seriesPoints.filter(Number.isFinite);
  const last = seriesPoints[seriesPoints.length - 1];
  const status: QuadHedgeMetricStatus = finite.length < 2 ? "insufficient-data" : "ok";

  return {
    legId,
    status,
    currentPoints: Number.isFinite(last) ? last! : null,
    seriesPoints,
    anchorClose,
    anchorTimestamp,
  };
}

export function calcSpreadPointsSeries(
  deltaA: QuadHedgeDeltaPoints,
  deltaB: QuadHedgeDeltaPoints,
  pairKey: QuadHedgeSpreadPairKey,
): Pick<
  QuadHedgeSpreadPointsMetric,
  "pairKey" | "legA" | "legB" | "status" | "currentSpreadPoints" | "series"
> {
  if (deltaA.status === "no-data" || deltaB.status === "no-data") {
    return emptySpreadPoints(pairKey);
  }

  const len = Math.min(deltaA.seriesPoints.length, deltaB.seriesPoints.length);
  const series: number[] = [];
  for (let i = 0; i < len; i++) {
    const a = deltaA.seriesPoints[i]!;
    const b = deltaB.seriesPoints[i]!;
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      series.push(NaN);
      continue;
    }
    series.push(a - b);
  }

  const finite = series.filter(Number.isFinite);
  const status: QuadHedgeMetricStatus = finite.length < 2 ? "insufficient-data" : "ok";
  const last = series[series.length - 1];

  return {
    pairKey,
    legA: deltaA.legId,
    legB: deltaB.legId,
    status,
    currentSpreadPoints: Number.isFinite(last) ? last! : null,
    series,
  };
}

function emptySpreadPoints(pairKey: QuadHedgeSpreadPairKey): QuadHedgeSpreadPointsMetric {
  const pair = QUAD_HEDGE_SPREAD_PAIRS.find((p) => p.pairKey === pairKey);
  return {
    pairKey,
    legA: pair?.legA ?? "SI",
    legB: pair?.legB ?? "CN",
    status: "no-data",
    currentSpreadPoints: null,
    series: [],
    maxSpreadPoints: null,
    minSpreadPoints: null,
    absMaxSpreadPoints: null,
    spreadRangePoints: null,
    lastExtremeType: "none",
    extremeStatus: "none",
    distanceFromExtremeSigned: null,
    distanceFromExtremePoints: null,
    distanceToZeroPoints: null,
    collapseFromExtremePoints: null,
    windowExtremeValue: null,
    lastExtreme: null,
    holdDurationBars: 0,
    holdZone: "none",
    trendEvents: [],
    trend: "stable",
    zScore: null,
    zScoreStatus: "no-data",
    signalStatus: "insufficient-data",
    labSignalStatus: "NO_DATA",
    localExtrema: [],
    interpretation: "Недостаточно точек для расчёта в пунктах.",
  };
}

function finiteValues(series: number[]): number[] {
  return series.filter(Number.isFinite);
}

function detectTrend(
  series: number[],
  th: QuadHedgePointThresholds,
): QuadHedgeSpreadTrend {
  const lookback = th.trendLookbackPoints;
  if (series.length < th.minTrendPoints) return "stable";

  const finite = finiteValues(series);
  if (finite.length < th.minTrendPoints) return "stable";

  const current = finite[finite.length - 1]!;
  const maxVal = Math.max(...finite);
  const minVal = Math.min(...finite);

  if (current === maxVal || current === minVal) return "new-extreme";

  const tail = finite.slice(-lookback);
  if (tail.length < 3) return "stable";

  const absTail = tail.map(Math.abs);
  let expanding = 0;
  let compressing = 0;
  for (let i = 1; i < absTail.length; i++) {
    const diff = absTail[i]! - absTail[i - 1]!;
    if (diff > 0.5) expanding++;
    if (diff < -0.5) compressing++;
  }

  const prevAbs = Math.abs(finite[finite.length - 2] ?? 0);
  const curAbs = Math.abs(current);
  const wasExtreme =
    prevAbs >= Math.max(Math.abs(maxVal), Math.abs(minVal)) * (1 - th.nearExtremePct);

  if (wasExtreme && curAbs < prevAbs && curAbs < th.watchPoints) return "pullback";
  if (expanding >= compressing && expanding >= 2) return "expanding";
  if (compressing > expanding && compressing >= 2) return "compressing";
  return "stable";
}

function detectExtremeStatus(
  current: number,
  maxVal: number,
  minVal: number,
  range: number,
  th: QuadHedgePointThresholds,
): { lastExtremeType: "high" | "low" | "none"; extremeStatus: QuadHedgeExtremeStatus } {
  if (range <= 0) {
    return { lastExtremeType: "none", extremeStatus: "none" };
  }

  const nearBand = range * th.nearExtremePct;

  if (current === maxVal) {
    return { lastExtremeType: "high", extremeStatus: "new-extreme" };
  }
  if (current === minVal) {
    return { lastExtremeType: "low", extremeStatus: "new-extreme" };
  }
  if (maxVal - current <= nearBand) {
    return { lastExtremeType: "high", extremeStatus: "near-extreme" };
  }
  if (current - minVal <= nearBand) {
    return { lastExtremeType: "low", extremeStatus: "near-extreme" };
  }

  return { lastExtremeType: "none", extremeStatus: "none" };
}

function derivePointsSignalStatus(
  current: number | null,
  absMax: number,
  trend: QuadHedgeSpreadTrend,
  extremeStatus: QuadHedgeExtremeStatus,
  th: QuadHedgePointThresholds,
): QuadHedgeSpreadPointsSignalStatus {
  if (current == null) return "insufficient-data";

  const abs = Math.abs(current);

  if (trend === "reversing-to-zero" || trend === "pullback" || (trend === "compressing" && abs <= th.noisePoints)) {
    return "returning";
  }
  if (extremeStatus === "new-extreme" || extremeStatus === "near-extreme") {
    return "extreme";
  }
  if (abs >= th.divergencePoints || absMax >= th.strongPoints) {
    return "divergence";
  }
  if (abs >= th.watchPoints || trend === "expanding") {
    return "watch";
  }
  if (abs <= th.noisePoints) {
    return "sync";
  }
  return "watch";
}

export function enrichSpreadPointsMetric(
  base: Pick<
    QuadHedgeSpreadPointsMetric,
    "pairKey" | "legA" | "legB" | "status" | "currentSpreadPoints" | "series" | "timestamps"
  >,
  th: QuadHedgePointThresholds = SPREAD_LAB_POINT_THRESHOLDS,
): QuadHedgeSpreadPointsMetric {
  if (base.status !== "ok") {
    return {
      ...emptySpreadPoints(base.pairKey),
      ...base,
      interpretation:
        base.status === "insufficient-data"
          ? "Недостаточно точек для расчёта в пунктах."
          : "Нет данных для расчёта в пунктах.",
    };
  }

  const finite = finiteValues(base.series);
  if (finite.length < th.minTrendPoints) {
    return {
      ...base,
      maxSpreadPoints: null,
      minSpreadPoints: null,
      absMaxSpreadPoints: null,
      spreadRangePoints: null,
      lastExtremeType: "none",
      extremeStatus: "none",
      distanceFromExtremeSigned: null,
      distanceFromExtremePoints: null,
      distanceToZeroPoints: null,
      collapseFromExtremePoints: null,
      windowExtremeValue: null,
      lastExtreme: null,
      holdDurationBars: 0,
      holdZone: "none",
      trendEvents: [],
      trend: "stable",
      zScore: null,
      zScoreStatus: "insufficient-data",
      signalStatus: "insufficient-data",
      labSignalStatus: "NO_DATA",
      localExtrema: [],
      interpretation: "Недостаточно точек для экстремумов и тенденции.",
    };
  }

  const timestamps = base.timestamps ?? [];
  const trendAnalytics = analyzeSpreadTrend(base.series, timestamps, th);

  if (!trendAnalytics) {
    return {
      ...base,
      maxSpreadPoints: null,
      minSpreadPoints: null,
      absMaxSpreadPoints: null,
      spreadRangePoints: null,
      lastExtremeType: "none",
      extremeStatus: "none",
      distanceFromExtremeSigned: null,
      distanceFromExtremePoints: null,
      distanceToZeroPoints: null,
      collapseFromExtremePoints: null,
      windowExtremeValue: null,
      lastExtreme: null,
      holdDurationBars: 0,
      holdZone: "none",
      trendEvents: [],
      trend: "stable",
      zScore: null,
      zScoreStatus: "insufficient-data",
      signalStatus: "insufficient-data",
      labSignalStatus: "NO_DATA",
      localExtrema: [],
      interpretation: "Недостаточно точек для экстремумов и тенденции.",
    };
  }

  const maxSpreadPoints = trendAnalytics.maxSpread;
  const minSpreadPoints = trendAnalytics.minSpread;
  const current = trendAnalytics.currentSpread;
  const absMaxSpreadPoints = Math.max(...finite.map(Math.abs));
  const spreadRangePoints = maxSpreadPoints - minSpreadPoints;

  const { lastExtremeType, extremeStatus } = detectExtremeStatus(
    current,
    maxSpreadPoints,
    minSpreadPoints,
    spreadRangePoints,
    th,
  );

  const distanceFromExtremeSigned = trendAnalytics.distanceFromExtreme;
  const distanceFromExtremePoints =
    distanceFromExtremeSigned != null ? Math.abs(distanceFromExtremeSigned) : null;
  const distanceToZeroPoints = Math.abs(current);
  const trend = trendAnalytics.trend;
  const collapseFromExtremePoints = trendAnalytics.collapseFromExtreme;
  const windowExtremeValue = trendAnalytics.lastExtreme?.value ?? null;
  const labSignalStatus = trendAnalytics.labSignalStatus;
  const holdDurationBars = trendAnalytics.holdDuration;
  const holdZone = trendAnalytics.holdZone;
  const trendEvents = trendAnalytics.events;
  const lastExtreme = trendAnalytics.lastExtreme;

  let zScore: number | null = null;
  let zScoreStatus: QuadHedgeMetricStatus = "insufficient-data";
  if (finite.length >= th.minZScorePoints) {
    const zSeries = calcSpreadZScore(base.series, Math.min(finite.length, 30));
    const lastZ = zSeries[zSeries.length - 1] ?? null;
    zScore = lastZ;
    zScoreStatus = lastZ != null ? "ok" : "insufficient-data";
  }

  const signalStatus = derivePointsSignalStatus(
    current,
    absMaxSpreadPoints,
    trend,
    extremeStatus,
    th,
  );

  const localExtrema = findLocalSpreadExtrema(base.series, timestamps, th).map((e) => ({
    index: e.index,
    time: e.time,
    value: e.value,
    type: e.type,
  }));

  const allSessionKeys = sessionKeysFromTimestamps(timestamps);
  const sessionExtrema = calcSpreadSessionExtrema(base.series, timestamps, allSessionKeys);

  const percentileAnalytics = analyzeSpreadPercentiles(
    base.series,
    current,
    lastExtreme,
    collapseFromExtremePoints,
    th,
  );

  const interpretationBase = interpretSpreadPoints({
    pairKey: base.pairKey,
    legA: base.legA,
    legB: base.legB,
    currentSpreadPoints: current,
    trend,
    extremeStatus,
    signalStatus,
    th,
  });

  const interpretation = [
    interpretationBase,
    ...percentileAnalytics.interpretationLines,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    ...base,
    maxSpreadPoints,
    minSpreadPoints,
    absMaxSpreadPoints,
    spreadRangePoints,
    lastExtremeType,
    extremeStatus,
    distanceFromExtremeSigned,
    distanceFromExtremePoints,
    distanceToZeroPoints,
    collapseFromExtremePoints,
    windowExtremeValue,
    lastExtreme,
    holdDurationBars,
    holdZone,
    trendEvents,
    trend,
    zScore,
    zScoreStatus,
    signalStatus,
    labSignalStatus,
    localExtrema,
    interpretation,
    maxSpreadToday: sessionExtrema.maxSpreadToday,
    minSpreadToday: sessionExtrema.minSpreadToday,
    maxSpread7S: sessionExtrema.maxSpread7S,
    minSpread7S: sessionExtrema.minSpread7S,
    spreadPercentile: sessionExtrema.percentile,
    percentileCurrent: percentileAnalytics.percentileCurrent,
    percentileAbs: percentileAnalytics.percentileAbs,
    percentileReliable: percentileAnalytics.percentileReliable,
    zoneMode: percentileAnalytics.zoneMode,
    p70: percentileAnalytics.p70,
    p90: percentileAnalytics.p90,
    p97: percentileAnalytics.p97,
    currentZone: percentileAnalytics.currentZone,
    lastExtremeAt: percentileAnalytics.lastExtremeAt,
    retestCount: percentileAnalytics.retestCount,
    interpretationLines: percentileAnalytics.interpretationLines,
    maxTime: undefined,
    minTime: undefined,
  };
}

export type { QuadHedgePairSpreadDiagnostics } from "./pair-spread";

export function buildPrimarySpreadPointsMetrics(
  pointsByLeg: Partial<Record<QuadHedgeLegId, QuadHedgePricePoint[]>>,
  intervalMinutes: number,
  th?: QuadHedgePointThresholds,
): {
  metrics: QuadHedgeSpreadPointsMetric[];
  diagnosticsByPair: Partial<Record<QuadHedgeSpreadPairKey, QuadHedgePairSpreadDiagnostics>>;
} {
  const thresholds = th ?? resolvePointThresholds();
  const diagnosticsByPair: Partial<
    Record<QuadHedgeSpreadPairKey, QuadHedgePairSpreadDiagnostics>
  > = {};

  const primaryPairs = QUAD_HEDGE_SPREAD_PAIRS.filter((p) =>
    ["SI/CN", "SI/EU", "EU/CN"].includes(p.pairKey),
  );

  const metrics = primaryPairs.map(({ pairKey, legA, legB }) => {
    const built = buildPairSpreadPoints(
      legA,
      legB,
      pointsByLeg[legA] ?? [],
      pointsByLeg[legB] ?? [],
      pairKey,
      intervalMinutes,
    );
    diagnosticsByPair[pairKey] = built.diagnostics;

    if (built.status !== "ok") {
      return {
        ...emptySpreadPoints(pairKey),
        status: built.status,
        interpretation:
          built.diagnostics.reason ??
          (built.status === "insufficient-data"
            ? "Недостаточно точек для расчёта в пунктах."
            : "Нет данных для расчёта в пунктах."),
      };
    }

    const base = {
      pairKey,
      legA,
      legB,
      status: built.status,
      currentSpreadPoints: built.currentSpreadPoints,
      series: built.series,
      timestamps: built.timestamps,
      legADeltaSeries: built.legADeltaSeries,
      legBDeltaSeries: built.legBDeltaSeries,
    };
    return enrichSpreadPointsMetric(base, thresholds);
  });

  return { metrics, diagnosticsByPair };
}

export function findSpreadPointsMetric(
  metrics: QuadHedgeSpreadPointsMetric[],
  pairKey: QuadHedgeSpreadPairKey,
): QuadHedgeSpreadPointsMetric | undefined {
  return metrics.find((m) => m.pairKey === pairKey);
}

export function formatSpreadPoints(value: number | null, signed = true): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value);
  if (!signed) return `${Math.abs(rounded)} п.`;
  return `${rounded >= 0 ? "+" : ""}${rounded} п.`;
}

export function interpretSpreadPoints(input: {
  pairKey: QuadHedgeSpreadPairKey;
  legA: QuadHedgeLegId;
  legB: QuadHedgeLegId;
  currentSpreadPoints: number;
  trend: QuadHedgeSpreadTrend;
  extremeStatus: QuadHedgeExtremeStatus;
  signalStatus: QuadHedgeSpreadPointsSignalStatus;
  th: QuadHedgePointThresholds;
}): string {
  const { legA, legB, currentSpreadPoints, trend, signalStatus } = input;
  const abs = Math.abs(currentSpreadPoints);

  if (signalStatus === "insufficient-data") {
    return "Недостаточно точек для расчёта в пунктах.";
  }

  if (abs <= input.th.noisePoints) {
    return "Спред около нуля — связка синхронна.";
  }

  const pts = Math.round(abs);
  const base =
    currentSpreadPoints >= 0
      ? `${legA} сильнее ${legB} на ${formatSpreadPoints(currentSpreadPoints)} от старта окна`
      : `${legB} сильнее ${legA} на ${formatSpreadPoints(-currentSpreadPoints)} от старта окна`;

  if (input.extremeStatus === "near-extreme" || input.extremeStatus === "new-extreme") {
    return `${base}. Зона экстремума — не ловить без подтверждения схлопывания.`;
  }

  if (trend === "expanding") {
    return `${base}. Расхождение расширяется — спред продолжает уходить от нуля.`;
  }

  if (trend === "compressing" || trend === "pullback" || trend === "reversing-to-zero") {
    return `${base}. Расхождение сужается — идёт возврат от экстремума.`;
  }

  if (input.signalStatus === "extreme" || abs >= input.th.divergencePoints) {
    return `${base}. Зона экстремума — не ловить без подтверждения схлопывания.`;
  }

  return base;
}

export { SPREAD_TREND_LABEL_RU } from "./spread-trend-analytics";

export const SPREAD_POINTS_SIGNAL_LABEL_RU: Record<
  QuadHedgeSpreadPointsSignalStatus,
  string
> = {
  sync: "синхронно",
  watch: "наблюдение",
  divergence: "расхождение",
  extreme: "экстремум",
  returning: "возврат",
  "insufficient-data": "мало данных",
};
