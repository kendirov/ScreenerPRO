export type {
  QuadHedgeAnalyticsInput,
  QuadHedgeAnalyticsResult,
  QuadHedgeDataQuality,
  QuadHedgeDataSource,
  QuadHedgeDirectionAgreement,
  QuadHedgeLegId,
  QuadHedgeLegQuality,
  QuadHedgeLegSeries,
  QuadHedgeMetricStatus,
  QuadHedgeNormalizedChange,
  QuadHedgeSignalState,
  QuadHedgeSpreadMetric,
  QuadHedgeSpreadPairKey,
  QuadHedgeTradeBias,
  QuadHedgeSpreadUnitMode,
  QuadHedgeSpreadTrend,
  QuadHedgeSpreadPointsMetric,
  QuadHedgeSpreadPointsSignalStatus,
  SpreadLabSignalStatus,
  SpreadLastExtreme,
  SpreadTrendEvent,
  SpreadHoldZone,
  QuadHedgeExtremeStatus,
  QuadHedgeViewMode,
  QuadHedgeZScoreMetric,
} from "./types";

export {
  QUAD_HEDGE_DEFAULT_STALE_MINUTES,
  QUAD_HEDGE_DEFAULT_Z_WINDOW,
  QUAD_HEDGE_LEG_META,
  QUAD_HEDGE_MIN_SIGNAL_POINTS,
  QUAD_HEDGE_MIN_Z_WINDOW,
  QUAD_HEDGE_SPREAD_PAIRS,
  normalizeQuadHedgeLegId,
  viewModeToDeviationLeg,
  viewModeToPairKey,
} from "./types";

export {
  QUAD_HEDGE_PRIMARY_LEGS,
  calcAllDeviations,
  calcBasketMeanSeries,
  calcDeviationSeries,
} from "./basket";

export {
  mergeQuadHedgeLegSeries,
  pickActiveEuContract,
  quadHedgeLegFromIntradayPoints,
  quadHedgeLegsFromIntradayInstruments,
  quadHedgePrimaryLegsFromScreener,
  resolveQuadHedgeLeg,
} from "./legs";

export { assessQuadHedgeDataQuality } from "./data-quality";

export {
  alignQuadHedgeLegs,
  buildOptionalSpreadMetrics,
  buildPrimarySpreadMetrics,
  calcDirectionAgreement,
  calcNormalizedChangePctSeries,
  calcSpreadSeries,
  calcZScoreMetric,
  countFadeBars,
  countStretchDuration,
  findSpreadMetric,
  findZScoreMetric,
} from "./metrics";

export {
  DEFAULT_QUAD_HEDGE_SIGNAL_THRESHOLDS,
  QUAD_HEDGE_SIGNAL_CHIP_LABEL_RU,
  QUAD_HEDGE_SIGNAL_OUTPUT_RU,
  QUAD_HEDGE_Z_DIVERGENCE,
  QUAD_HEDGE_Z_STRONG,
  QUAD_HEDGE_Z_WATCH,
  assessSignalGate,
  buildHeadline,
  calcDivergenceScore,
  deriveSignalState,
  deriveTradeBias,
  resolveSignalThresholds,
  signalStateLabelRu,
  signalStateOutputRu,
  tradeBiasLabelRu,
} from "./signals";
export type {
  SignalBlockReason,
  SignalDerivationInput,
  QuadHedgeSignalThresholds,
} from "./signals";

export {
  buildQuadHedgeAnalytics,
  buildQuadHedgeAnalyticsFromIntraday,
} from "./analytics";
export type { QuadHedgeIntradayLegPayload, QuadHedgeIntradayResponse } from "./analytics";

export { interpretDeviation, interpretationFromDeviations } from "./interpret";

export { buildQuadHedgeMainChartModel, buildQuadHedgeChartModel } from "./chart-model";
export type { QuadHedgeMainChartModel, QuadHedgeChartModel, QuadHedgeDayMarker } from "./chart-model";

export {
  signalStateDisplayEn,
  tradeBiasDisplayRu,
  signalStateTone,
  tradeBiasTone,
  resolveDataQualityDisplay,
  resolveHistoryStatusDisplay,
  resolveConfidence,
  resolveDivergingLegLabel,
} from "./display";

export {
  QUAD_HEDGE_WEEK_SESSION_COUNT,
  QUAD_HEDGE_WEEK_FETCH_CALENDAR_DAYS,
  applyQuadHedgeWindow,
  assessQuadHedgeHistoryMeta,
  collectTradingSessionKeys,
  lastNTradingSessions,
  sessionBoundaryMarkers,
} from "./window";
export type {
  QuadHedgeWindowScope,
  QuadHedgeHistoryStatus,
  QuadHedgeHistoryMeta,
} from "./window";

export {
  resolveQuadHedgeFetchParams,
  resolveQuadHedgeWindowScope,
  quadHedgeCalendarFetchDays,
  quadHedgeApiInterval,
} from "./fetch-params";
export {
  SPREAD_LAB_POINT_THRESHOLDS,
  DEFAULT_QUAD_HEDGE_POINT_THRESHOLDS,
  resolvePointThresholds,
  spreadLabThresholdZones,
} from "./point-thresholds";
export type { QuadHedgePointThresholds } from "./point-thresholds";

export {
  buildPrimarySpreadPointsMetrics,
  calcDeltaPointsSeries,
  calcSpreadPointsSeries,
  enrichSpreadPointsMetric,
  findSpreadPointsMetric,
  formatSpreadPoints,
  interpretSpreadPoints,
  SPREAD_POINTS_SIGNAL_LABEL_RU,
} from "./spread-points";
export type { QuadHedgeDeltaPoints } from "./spread-points";

export {
  buildPairSpreadPoints,
  alignPairLegSeries,
  bucketPricePoints,
} from "./pair-spread";
export type { QuadHedgePairSpreadDiagnostics, PairSpreadBuildResult } from "./pair-spread";

export {
  SPREAD_LAB_DISPLAY_INTERVAL,
  SPREAD_LAB_MOEX_INTERVAL,
  SPREAD_LAB_WINDOW_SCOPE,
  SPREAD_LAB_DEFAULT_PAIR,
  SPREAD_LAB_DEFAULT_UNIT,
  SPREAD_LAB_DEFAULT_HISTORY_DEPTH,
  SPREAD_LAB_HISTORY_DEPTH_OPTIONS,
  spreadLabFetchParams,
  spreadLabHistoryDepthLabel,
  spreadLabCalendarDaysForDepth,
} from "./spread-lab-config";
export type { SpreadLabHistoryDepth, SpreadLabHistoryMode } from "./spread-lab-config";

export {
  applySpreadLabHistoryDepth,
  calcSpreadSessionExtrema,
  count5mCandlesInLeg,
  spreadLabEmptyHistoryMessage,
} from "./spread-lab-history";
export type { SpreadLabSessionExtrema } from "./spread-lab-history";

export { buildSpreadLabChartModel } from "./spread-lab-chart-model";
export type {
  SpreadLabChartModel,
  SpreadLabLegsMovementModel,
  SpreadLabSidePanel,
} from "./spread-lab-chart-model";

export { SPREAD_LAB_CHART_COLORS } from "./spread-lab-chart-theme";

export {
  analyzeSpreadTrend,
  buildSpreadEventTape,
  calcHoldDuration,
  deriveSpreadLabSignalStatus,
  detectSpreadTrend,
  findLastExtremeEvent,
  formatSpreadLabPoints,
  SPREAD_LAB_SIGNAL_LABEL,
  SPREAD_TREND_LABEL_RU,
} from "./spread-trend-analytics";
export type { SpreadTrendAnalytics } from "./spread-trend-analytics";

export {
  findLocalSpreadExtrema,
  calcCollapseFromExtreme,
} from "./spread-lab-signals";
export type { SpreadLabLocalExtreme } from "./spread-lab-signals";

export {
  analyzeSpreadPercentiles,
  buildSpreadInterpretationLines,
  countSpreadRetests,
  zoneFromAbsSpread,
  SPREAD_PERCENTILE_MIN_POINTS,
  SPREAD_ZONE_LABEL_RU,
} from "./spread-percentile-analytics";
export type {
  SpreadLabZoneKind,
  SpreadPercentileAnalytics,
} from "./spread-percentile-analytics";
