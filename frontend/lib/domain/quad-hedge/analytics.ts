import type { IntradayCurrencyResponse } from "@/lib/domain/currency-correlation-intraday";
import type { ResolvedFuturesContract } from "@/lib/domain/futures-contract-resolver";
import type { ScreenerRow } from "@screenerpro/shared";
import type { QuadHedgePipelineDebug } from "./debug";
import { calcAllDeviations, calcBasketMeanSeries, QUAD_HEDGE_PRIMARY_LEGS } from "./basket";
import { assessQuadHedgeDataQuality } from "./data-quality";
import { interpretationFromDeviations } from "./interpret";
import {
  mergeQuadHedgeLegSeries,
  quadHedgeLegFromIntradayPoints,
  quadHedgeLegsFromIntradayInstruments,
} from "./legs";
import {
  alignQuadHedgeLegs,
  buildOptionalSpreadMetrics,
  buildPrimarySpreadMetrics,
  calcDirectionAgreement,
  calcNormalizedChangePctSeries,
  calcZScoreMetric,
  countFadeBars,
  countStretchDuration,
  findSpreadMetric,
  findZScoreMetric,
} from "./metrics";
import {
  buildPrimarySpreadPointsMetrics,
  findSpreadPointsMetric,
} from "./spread-points";
import { bucketPricePoints } from "./pair-spread";
import {
  SPREAD_LAB_DEFAULT_HISTORY_DEPTH,
  SPREAD_LAB_DISPLAY_INTERVAL,
  spreadLabHistoryDepthLabel,
} from "./spread-lab-config";
import { applySpreadLabHistoryDepth } from "./spread-lab-history";
import {
  buildHeadline,
  calcDivergenceScore,
  deriveSignalState,
  deriveTradeBias,
  resolveSignalThresholds,
} from "./signals";
import { DEFAULT_QUAD_HEDGE_SIGNAL_THRESHOLDS } from "./signal-thresholds";
import type {
  QuadHedgeAnalyticsInput,
  QuadHedgeAnalyticsResult,
  QuadHedgeLegId,
  QuadHedgeLegSeries,
  QuadHedgeSpreadPairKey,
  QuadHedgeViewMode,
} from "./types";
import {
  QUAD_HEDGE_DEFAULT_Z_WINDOW,
  viewModeToPairKey,
} from "./types";
import {
  applyQuadHedgeWindow,
  assessQuadHedgeHistoryMeta,
  type QuadHedgeWindowScope,
} from "./window";

function legsToMap(legs: QuadHedgeLegSeries[]): Map<QuadHedgeLegId, QuadHedgeLegSeries> {
  return new Map(legs.map((l) => [l.legId, l]));
}

function collectWarnings(
  dataQuality: ReturnType<typeof assessQuadHedgeDataQuality>,
  legs: QuadHedgeLegSeries[],
): string[] {
  const warnings: string[] = [];
  for (const leg of legs) {
    if (leg.source === "demo") warnings.push(`${leg.ticker} (${leg.legId}): demo.`);
    if (leg.source === "stub") warnings.push(`${leg.legId}: stub.`);
  }
  for (const q of dataQuality.legs) {
    if (q.status === "demo") warnings.push(`${q.legId}: ${q.message}`);
    if (q.status === "stale") warnings.push(`${q.legId}: устарело (${q.staleMinutes} мин).`);
  }
  if (dataQuality.primaryLegsOk < 3) {
    warnings.push(`Primary-ног ok: ${dataQuality.primaryLegsOk}/3 (SI/EU/CN).`);
  }
  return [...new Set(warnings)];
}

function resolveFocusPair(viewMode: QuadHedgeViewMode): QuadHedgeSpreadPairKey {
  return viewModeToPairKey(viewMode) ?? "SI/CN";
}

function emptySpread(pairKey: QuadHedgeSpreadPairKey) {
  return {
    pairKey,
    status: "no-data" as const,
    current: null,
    series: [],
    unit: "pp" as const,
  };
}

function emptyZ(pairKey: QuadHedgeSpreadPairKey, window: number) {
  return {
    pairKey,
    status: "no-data" as const,
    current: null,
    series: [],
    window,
  };
}

export function buildQuadHedgeAnalytics(input: QuadHedgeAnalyticsInput): QuadHedgeAnalyticsResult {
  const intervalMinutes = input.intervalMinutes ?? 5;
  const zWindow = input.zWindow ?? QUAD_HEDGE_DEFAULT_Z_WINDOW;
  const viewMode = input.viewMode ?? "SI-EU";
  const windowScope = input.windowScope ?? "pick";
  const historyDepth = input.historyDepth ?? SPREAD_LAB_DEFAULT_HISTORY_DEPTH;
  const th = resolveSignalThresholds({
    staleMinutes: input.staleThresholdMinutes ?? DEFAULT_QUAD_HEDGE_SIGNAL_THRESHOLDS.staleMinutes,
  });
  const asOfMs = input.asOf ? Date.parse(input.asOf) : Date.now();
  const focusPair = resolveFocusPair(viewMode);

  const merged = mergeQuadHedgeLegSeries(input.legs);
  const windowResult =
    historyDepth != null
      ? applySpreadLabHistoryDepth(merged, historyDepth)
      : applyQuadHedgeWindow(merged, windowScope);
  const windowedLegs = windowResult.legs;
  const legsById = legsToMap(windowedLegs);

  const seriesByLeg: Partial<
    Record<QuadHedgeLegId, { timestamp: string; close: number }[]>
  > = {};
  for (const leg of windowedLegs) {
    seriesByLeg[leg.legId] = leg.points;
  }

  const aligned = alignQuadHedgeLegs(seriesByLeg, intervalMinutes);
  const effectiveAnchor = aligned.length ? Math.min(input.anchorIndex ?? 0, aligned.length - 1) : 0;

  const legIdsInData: QuadHedgeLegId[] = [
    ...QUAD_HEDGE_PRIMARY_LEGS.filter((id) => legsById.has(id)),
    ...(legsById.has("ED") ? (["ED"] as const) : []),
  ];
  const normalizedChangePct = legIdsInData.map((legId) =>
    calcNormalizedChangePctSeries(aligned, legId, effectiveAnchor),
  );

  const basket = calcBasketMeanSeries(normalizedChangePct);
  const deviations = calcAllDeviations(normalizedChangePct, basket);

  const spreads = [...buildPrimarySpreadMetrics(normalizedChangePct), ...buildOptionalSpreadMetrics(normalizedChangePct)];

  const displayInterval =
    input.displayIntervalMinutes ?? intervalMinutes;
  const moexInterval = input.moexIntervalMinutes ?? intervalMinutes;

  const spreadPointsByLeg: Partial<
    Record<QuadHedgeLegId, import("./types").QuadHedgePricePoint[]>
  > = {};
  for (const leg of windowedLegs) {
    let pts = leg.points;
    if (displayInterval > moexInterval && moexInterval > 0) {
      pts = bucketPricePoints(pts, displayInterval);
    }
    spreadPointsByLeg[leg.legId] = pts;
  }

  const { metrics: spreadPoints, diagnosticsByPair } = buildPrimarySpreadPointsMetrics(
    spreadPointsByLeg,
    displayInterval,
  );
  const focusSpreadPoints = findSpreadPointsMetric(spreadPoints, focusPair) ?? null;
  const focusPairDiagnostics = diagnosticsByPair[focusPair] ?? null;

  const zScores = spreads.map((s) => calcZScoreMetric(s, zWindow));

  const directionAgreement = calcDirectionAgreement(normalizedChangePct);

  const focusSpread = findSpreadMetric(spreads, focusPair) ?? emptySpread(focusPair);
  const focusZ = findZScoreMetric(zScores, focusPair) ?? emptyZ(focusPair, zWindow);

  const history = assessQuadHedgeHistoryMeta({
    scope: windowScope,
    windowResult,
    legsAfterWindow: windowedLegs,
    alignedPointCount: aligned.length,
    focusZStatus: focusZ.status,
  });
  history.label = spreadLabHistoryDepthLabel(historyDepth);
  if (windowResult.tradingSessions.length > 0) {
    history.message = `${history.label}: ${windowResult.tradingSessions.length} торг. сессий · ${windowResult.tradingSessions.join(", ")}`;
  }

  const dataQuality = assessQuadHedgeDataQuality(legsById, {
    intervalMinutes,
    staleThresholdMinutes: th.staleMinutes,
    asOfMs,
    thresholds: th,
    historyStatus: history.status,
    historyLabel: history.label,
  });

  const canSignals =
    dataQuality.canComputeSignals && history.status !== "NO_HISTORY";

  const stretchDurationBars =
    focusZ.status === "ok" ? countStretchDuration(focusZ.series, th.divergenceZ) : 0;
  const fadeBars = focusZ.status === "ok" ? countFadeBars(focusZ.series, th.watchZ) : 0;

  const signalInput = {
    canComputeSignals: canSignals,
    viewMode,
    focusSpread,
    focusZ,
    directionAgreement,
    dataQuality: { ...dataQuality, canComputeSignals: canSignals },
    stretchDurationBars,
    fadeBars,
    windowPointCount: aligned.length,
    thresholds: th,
  };

  const divergenceScore = calcDivergenceScore(signalInput);
  const signalState = deriveSignalState(signalInput);
  const tradeBias = deriveTradeBias(signalState, canSignals);
  const interpretation = interpretationFromDeviations(deviations);

  const edNorm = normalizedChangePct.find((n) => n.legId === "ED");
  const edContext = {
    available: edNorm?.status === "ok",
    normalizedPct: edNorm?.currentPct ?? null,
    confirmsBasket:
      edNorm?.currentPct != null && basket.current != null
        ? Math.sign(edNorm.currentPct) === Math.sign(basket.current) || Math.abs(basket.current) < 0.03
        : null,
  };

  const warnings = [...collectWarnings(dataQuality, windowedLegs), history.message];

  return {
    computedAt: new Date(asOfMs).toISOString(),
    viewMode,
    focusPair,
    dataQuality,
    normalizedChangePct,
    basket,
    deviations,
    spreads,
    spreadPoints,
    focusSpreadPoints,
    focusPairDiagnostics,
    zScores,
    directionAgreement,
    divergenceScore,
    stretchDurationBars,
    signalState,
    tradeBias,
    interpretation,
    headline: buildHeadline(signalState, focusZ, directionAgreement, interpretation),
    warnings: [...new Set(warnings)],
    alignedTimestamps: aligned.map((r) => r.timestamp),
    edContext,
    history,
    windowScope,
    historyDepth,
  };
}

export type QuadHedgeIntradayLegPayload = {
  legId: QuadHedgeLegId;
  ticker: string;
  label: string;
  points: Array<{ timestamp: string; close: number }>;
  status: "ok" | "empty" | "error";
  error?: string;
  resolvedContract?: ResolvedFuturesContract;
};

export type QuadHedgeIntradayResponse = {
  source: "MOEX ISS";
  updatedAt: string;
  requestedInterval: number;
  usedInterval: number;
  intervalNotice?: string;
  days: number;
  dateRange?: { from: string; till: string };
  windowScope?: import("./window").QuadHedgeWindowScope;
  contracts?: import("@/lib/domain/futures-contract-resolver").ResolvedFuturesContract[];
  debug?: QuadHedgePipelineDebug;
  legs: QuadHedgeIntradayLegPayload[];
};

export function buildQuadHedgeAnalyticsFromIntraday(
  intraday: IntradayCurrencyResponse | QuadHedgeIntradayResponse,
  options?: {
    screenerRows?: ScreenerRow[];
    screenerSource?: "MOEX ISS" | "demo";
    anchorIndex?: number;
    viewMode?: QuadHedgeViewMode;
    windowScope?: QuadHedgeWindowScope;
    historyDepth?: import("./spread-lab-config").SpreadLabHistoryDepth;
    displayIntervalMinutes?: number;
    moexIntervalMinutes?: number;
    extraLegs?: QuadHedgeLegSeries[];
  },
): QuadHedgeAnalyticsResult {
  const source = options?.screenerSource === "demo" ? "demo" : "MOEX ISS";

  let legs: QuadHedgeLegSeries[];

  if ("legs" in intraday) {
    legs = intraday.legs
      .filter((l) => l.status === "ok" && l.points.length > 0)
      .map((l) =>
        quadHedgeLegFromIntradayPoints(l.legId, l.ticker, l.label, l.points, "MOEX ISS"),
      );
  } else {
    legs = quadHedgeLegsFromIntradayInstruments(intraday.instruments, "MOEX ISS");
  }

  legs = mergeQuadHedgeLegSeries([...legs, ...(options?.extraLegs ?? [])]);

  const intervalMinutes = intraday.usedInterval;
  const asOf = intraday.updatedAt;

  return buildQuadHedgeAnalytics({
    legs,
    anchorIndex: options?.anchorIndex,
    intervalMinutes,
    moexIntervalMinutes: intervalMinutes,
    displayIntervalMinutes:
      options?.displayIntervalMinutes ?? SPREAD_LAB_DISPLAY_INTERVAL,
    asOf,
    viewMode: options?.viewMode,
    windowScope: options?.windowScope,
    historyDepth: options?.historyDepth,
  });
}
