/** Основные торгуемые фьючерсы MOEX + optional context. */
export type QuadHedgeLegId =
  | "SI"
  | "EU"
  | "CN"
  | "ED"
  /** @deprecated Референс, не primary */
  | "USDRUBF"
  /** @deprecated Используйте CN */
  | "CNY"
  /** @deprecated Референс */
  | "CNYRUB";

/** Источник ряда — для честной маркировки demo/stub. */
export type QuadHedgeDataSource = "MOEX ISS" | "external" | "demo" | "stub";

export type QuadHedgePricePoint = {
  timestamp: string;
  close: number;
};

/** Входной ряд одной ноги. */
export type QuadHedgeLegSeries = {
  legId: QuadHedgeLegId;
  ticker: string;
  label: string;
  source: QuadHedgeDataSource;
  points: QuadHedgePricePoint[];
};

/** Ключи пар спреда (нормализованное движение legA − legB). */
export type QuadHedgeSpreadPairKey = "SI/CN" | "SI/EU" | "EU/CN" | "SI/ED";

/** Режим нижней гистограммы / фокуса сигнала. */
export type QuadHedgeViewMode = "basket" | "SI-CN" | "SI-EU" | "EU-CN";

/** Единицы нижней гистограммы spread. */
export type QuadHedgeSpreadUnitMode = "pct" | "points";

export type QuadHedgeSpreadTrend =
  | "expanding"
  | "compressing"
  | "stable"
  | "pullback"
  | "new-extreme"
  /** @deprecated используйте pullback */
  | "reversing-to-zero";

export type QuadHedgeExtremeStatus = "near-extreme" | "new-extreme" | "none";

export type SpreadLabSignalStatus =
  | "NORMAL"
  | "EXPANDING"
  | "EXTREME"
  | "STRONG_EXTREME"
  | "PULLBACK"
  | "RETEST"
  | "FLAT"
  | "NO_DATA";

export type QuadHedgeSpreadPointsSignalStatus =
  | "sync"
  | "watch"
  | "divergence"
  | "extreme"
  | "returning"
  | "insufficient-data";

export type SpreadLabLocalExtremePoint = {
  index: number;
  time: string;
  value: number;
  type: "high" | "low";
};

export type SpreadLastExtreme = {
  type: "high" | "low";
  value: number;
  time: string;
  index: number;
};

export type SpreadTrendEvent = {
  time: string;
  timeLabel: string;
  message: string;
  kind: "new-max" | "new-min" | "compress-start" | "collapse" | "retest";
  index: number;
};

import type { SpreadLabZoneKind } from "./spread-percentile-analytics";

export type { SpreadLabZoneKind };

export type SpreadHoldZone = "none" | "watch" | "extreme";

export type QuadHedgeSpreadPointsMetric = {
  pairKey: QuadHedgeSpreadPairKey;
  legA: QuadHedgeLegId;
  legB: QuadHedgeLegId;
  status: QuadHedgeMetricStatus;
  currentSpreadPoints: number | null;
  series: number[];
  timestamps?: string[];
  /** Delta от anchor: close − start (та же логика, что в spread). */
  legADeltaSeries?: number[];
  legBDeltaSeries?: number[];
  maxSpreadPoints: number | null;
  minSpreadPoints: number | null;
  absMaxSpreadPoints: number | null;
  spreadRangePoints: number | null;
  lastExtremeType: "high" | "low" | "none";
  extremeStatus: QuadHedgeExtremeStatus;
  /** Signed distance от window max/min по типу lastExtreme. */
  distanceFromExtremeSigned: number | null;
  /** @deprecated abs distance — используйте distanceFromExtremeSigned */
  distanceFromExtremePoints: number | null;
  distanceToZeroPoints: number | null;
  collapseFromExtremePoints: number | null;
  windowExtremeValue: number | null;
  lastExtreme: SpreadLastExtreme | null;
  holdDurationBars: number;
  holdZone: SpreadHoldZone;
  trendEvents: SpreadTrendEvent[];
  trend: QuadHedgeSpreadTrend;
  zScore: number | null;
  zScoreStatus: QuadHedgeMetricStatus;
  signalStatus: QuadHedgeSpreadPointsSignalStatus;
  labSignalStatus: SpreadLabSignalStatus;
  localExtrema: SpreadLabLocalExtremePoint[];
  interpretation: string;
  maxTime?: string;
  minTime?: string;
  maxSpreadToday?: number | null;
  minSpreadToday?: number | null;
  maxSpread7S?: number | null;
  minSpread7S?: number | null;
  spreadPercentile?: number | null;
  percentileCurrent?: number | null;
  percentileAbs?: number | null;
  percentileReliable?: boolean;
  zoneMode?: "percentile" | "fixed";
  p70?: number | null;
  p90?: number | null;
  p97?: number | null;
  currentZone?: SpreadLabZoneKind;
  lastExtremeAt?: string | null;
  retestCount?: number;
  interpretationLines?: string[];
};

export type QuadHedgeMetricStatus = "ok" | "no-data" | "insufficient-data";

/** Статус качества одной ноги. */
export type QuadHedgeLegQualityStatus =
  | "ok"
  | "missing"
  | "empty"
  | "insufficient"
  | "stale"
  | "gaps"
  | "demo";

export type QuadHedgeLegQuality = {
  legId: QuadHedgeLegId;
  ticker: string;
  status: QuadHedgeLegQualityStatus;
  pointCount: number;
  staleMinutes: number | null;
  gapCount: number;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  source: QuadHedgeDataSource;
  message: string;
};

export type QuadHedgeDataQuality = {
  canComputeSignals: boolean;
  /** Число primary-ног (SI/EU/CN) с status ok. */
  primaryLegsOk: number;
  score: number;
  legs: QuadHedgeLegQuality[];
  missingLegs: QuadHedgeLegId[];
  degradedLegs: QuadHedgeLegId[];
  summary: string;
  historyStatus: import("./window").QuadHedgeHistoryStatus;
  historyLabel: string;
};

export type QuadHedgeNormalizedChange = {
  legId: QuadHedgeLegId;
  status: QuadHedgeMetricStatus;
  /** % от якорной цены окна: (close/anchor − 1)×100. */
  currentPct: number | null;
  seriesPct: number[];
  anchorClose: number | null;
  anchorTimestamp: string | null;
};

export type QuadHedgeSpreadMetric = {
  pairKey: QuadHedgeSpreadPairKey;
  status: QuadHedgeMetricStatus;
  current: number | null;
  series: number[];
  unit: "pp";
};

export type QuadHedgeZScoreMetric = {
  pairKey: QuadHedgeSpreadPairKey | "basket";
  status: QuadHedgeMetricStatus;
  current: number | null;
  series: (number | null)[];
  window: number;
};

export type QuadHedgeDirectionAgreement = {
  status: QuadHedgeMetricStatus;
  agreementRatio: number | null;
  leaderLeg: QuadHedgeLegId | null;
  isAligned: boolean;
  legDirections: Partial<Record<QuadHedgeLegId, "up" | "down" | "flat">>;
  summary: string;
};

export type QuadHedgeSignalState =
  | "no-data"
  | "sync"
  | "watch"
  | "divergence"
  | "strong-divergence"
  | "fade";

export type QuadHedgeTradeBias =
  | "wait"
  | "watch"
  | "mean-reversion"
  | "sync-move"
  | "fade-watch";

export type QuadHedgeAnalyticsInput = {
  legs: QuadHedgeLegSeries[];
  anchorIndex?: number;
  intervalMinutes?: number;
  zWindow?: number;
  staleThresholdMinutes?: number;
  asOf?: string;
  viewMode?: QuadHedgeViewMode;
  windowScope?: import("./window").QuadHedgeWindowScope;
  historyDepth?: import("./spread-lab-config").SpreadLabHistoryDepth;
  /** Целевой интервал pair-spread (мин). MOEX может отдавать 1м → bucket в 5м. */
  displayIntervalMinutes?: number;
  moexIntervalMinutes?: number;
};

export type QuadHedgeBasketMetric = import("./basket").QuadHedgeBasketMetric;
export type QuadHedgeDeviationMetric = import("./basket").QuadHedgeDeviationMetric;

export type QuadHedgeAnalyticsResult = {
  computedAt: string;
  viewMode: QuadHedgeViewMode;
  focusPair: QuadHedgeSpreadPairKey;
  dataQuality: QuadHedgeDataQuality;
  normalizedChangePct: QuadHedgeNormalizedChange[];
  basket: QuadHedgeBasketMetric;
  deviations: QuadHedgeDeviationMetric[];
  spreads: QuadHedgeSpreadMetric[];
  spreadPoints: QuadHedgeSpreadPointsMetric[];
  focusSpreadPoints: QuadHedgeSpreadPointsMetric | null;
  focusPairDiagnostics: import("./pair-spread").QuadHedgePairSpreadDiagnostics | null;
  zScores: QuadHedgeZScoreMetric[];
  directionAgreement: QuadHedgeDirectionAgreement;
  divergenceScore: number | null;
  stretchDurationBars: number;
  signalState: QuadHedgeSignalState;
  tradeBias: QuadHedgeTradeBias;
  interpretation: string;
  headline: string;
  warnings: string[];
  alignedTimestamps: string[];
  /** ED optional context — только если данные есть. */
  edContext: {
    available: boolean;
    normalizedPct: number | null;
    confirmsBasket: boolean | null;
  };
  history: import("./window").QuadHedgeHistoryMeta;
  windowScope: import("./window").QuadHedgeWindowScope;
  historyDepth?: import("./spread-lab-config").SpreadLabHistoryDepth;
  debug?: import("./debug").QuadHedgePipelineDebug;
};

export const QUAD_HEDGE_MIN_Z_WINDOW = 30;
export const QUAD_HEDGE_DEFAULT_Z_WINDOW = 30;

import { DEFAULT_QUAD_HEDGE_SIGNAL_THRESHOLDS } from "./signal-thresholds";

export const QUAD_HEDGE_MIN_SIGNAL_POINTS = DEFAULT_QUAD_HEDGE_SIGNAL_THRESHOLDS.minPoints;
export const QUAD_HEDGE_DEFAULT_STALE_MINUTES = DEFAULT_QUAD_HEDGE_SIGNAL_THRESHOLDS.staleMinutes;

/** Основные пары SI / EU / CN. */
export const QUAD_HEDGE_SPREAD_PAIRS: Array<{
  pairKey: QuadHedgeSpreadPairKey;
  legA: QuadHedgeLegId;
  legB: QuadHedgeLegId;
  label: string;
  viewMode: QuadHedgeViewMode;
}> = [
  { pairKey: "SI/CN", legA: "SI", legB: "CN", label: "SI − CN", viewMode: "SI-CN" },
  { pairKey: "SI/EU", legA: "SI", legB: "EU", label: "SI − EU", viewMode: "SI-EU" },
  { pairKey: "EU/CN", legA: "EU", legB: "CN", label: "EU − CN", viewMode: "EU-CN" },
  { pairKey: "SI/ED", legA: "SI", legB: "ED", label: "SI − ED (context)", viewMode: "SI-CN" },
];

export const QUAD_HEDGE_LEG_META: Record<
  QuadHedgeLegId,
  { label: string; role: "primary" | "optional" | "deprecated" }
> = {
  SI: { label: "Si USD/RUB", role: "primary" },
  EU: { label: "Eu EUR/RUB", role: "primary" },
  CN: { label: "CN CNY/RUB", role: "primary" },
  ED: { label: "ED EUR/USD (context)", role: "optional" },
  USDRUBF: { label: "USDRUBF", role: "deprecated" },
  CNY: { label: "CNY (legacy)", role: "deprecated" },
  CNYRUB: { label: "CNYRUB", role: "deprecated" },
};

/** Нормализация legacy id → primary id. */
export function normalizeQuadHedgeLegId(legId: QuadHedgeLegId): QuadHedgeLegId {
  if (legId === "CNY") return "CN";
  return legId;
}

export function viewModeToPairKey(mode: QuadHedgeViewMode): QuadHedgeSpreadPairKey | null {
  if (mode === "SI-CN") return "SI/CN";
  if (mode === "SI-EU") return "SI/EU";
  if (mode === "EU-CN") return "EU/CN";
  return null;
}

export function viewModeToDeviationLeg(mode: QuadHedgeViewMode): "SI" | "EU" | "CN" | null {
  if (mode === "basket") return null;
  if (mode === "SI-CN") return "SI";
  if (mode === "SI-EU") return "SI";
  if (mode === "EU-CN") return "EU";
  return null;
}
