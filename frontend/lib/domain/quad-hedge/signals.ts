import type {
  QuadHedgeDataQuality,
  QuadHedgeDeviationMetric,
  QuadHedgeDirectionAgreement,
  QuadHedgeSignalState,
  QuadHedgeSpreadMetric,
  QuadHedgeTradeBias,
  QuadHedgeViewMode,
  QuadHedgeZScoreMetric,
} from "./types";
import {
  countFadeBars,
  countStretchDuration,
} from "./metrics";
import {
  DEFAULT_QUAD_HEDGE_SIGNAL_THRESHOLDS,
  QUAD_HEDGE_SIGNAL_CHIP_LABEL_RU,
  QUAD_HEDGE_SIGNAL_OUTPUT_RU,
  resolveSignalThresholds,
  type QuadHedgeSignalThresholds,
} from "./signal-thresholds";

export {
  DEFAULT_QUAD_HEDGE_SIGNAL_THRESHOLDS,
  QUAD_HEDGE_SIGNAL_CHIP_LABEL_RU,
  QUAD_HEDGE_SIGNAL_OUTPUT_RU,
  QUAD_HEDGE_Z_DIVERGENCE,
  QUAD_HEDGE_Z_STRONG,
  QUAD_HEDGE_Z_WATCH,
  resolveSignalThresholds,
} from "./signal-thresholds";
export type { QuadHedgeSignalThresholds } from "./signal-thresholds";

export type SignalDerivationInput = {
  canComputeSignals: boolean;
  viewMode: QuadHedgeViewMode;
  focusSpread: QuadHedgeSpreadMetric;
  focusZ: QuadHedgeZScoreMetric;
  directionAgreement: QuadHedgeDirectionAgreement;
  dataQuality: QuadHedgeDataQuality;
  stretchDurationBars: number;
  fadeBars: number;
  windowPointCount: number;
  thresholds?: QuadHedgeSignalThresholds;
};

export type SignalBlockReason =
  | "missing-leg"
  | "insufficient-points"
  | "stale-timestamp"
  | "data-gaps"
  | "demo-data"
  | "no-window"
  | "metrics-unavailable";

export function assessSignalGate(input: SignalDerivationInput): {
  allowed: boolean;
  reason: SignalBlockReason | null;
} {
  const th = resolveSignalThresholds(input.thresholds);

  if (!input.canComputeSignals) {
    if (input.dataQuality.primaryLegsOk < 2) {
      return { allowed: false, reason: "missing-leg" };
    }
    const primary = input.dataQuality.legs.filter((l) =>
      ["SI", "EU", "CN"].includes(l.legId),
    );
    if (primary.some((l) => l.status === "demo")) {
      return { allowed: false, reason: "demo-data" };
    }
    if (primary.some((l) => l.status === "insufficient")) {
      return { allowed: false, reason: "insufficient-points" };
    }
    if (primary.some((l) => l.status === "stale")) {
      return { allowed: false, reason: "stale-timestamp" };
    }
    if (primary.some((l) => l.gapCount > th.maxDataGap)) {
      return { allowed: false, reason: "data-gaps" };
    }
    return { allowed: false, reason: "metrics-unavailable" };
  }

  if (input.windowPointCount < th.minPoints) {
    return { allowed: false, reason: "insufficient-points" };
  }

  if (input.focusSpread.status === "no-data") {
    return { allowed: false, reason: "no-window" };
  }

  return { allowed: true, reason: null };
}

function absSpread(spread: QuadHedgeSpreadMetric): number {
  const v = spread.current;
  return v != null && Number.isFinite(v) ? Math.abs(v) : 0;
}

function isSpreadExpanding(series: number[]): boolean {
  const finite = series.filter(Number.isFinite);
  if (finite.length < 3) return false;
  const tail = finite.slice(-3).map(Math.abs);
  return tail[2]! > tail[1]! && tail[1]! >= tail[0]!;
}

export function calcDivergenceScore(input: SignalDerivationInput): number | null {
  const gate = assessSignalGate(input);
  if (!gate.allowed) return null;
  if (input.focusSpread.status !== "ok") return null;

  const z = input.focusZ.current;
  const spread = input.focusSpread.current;
  let score = 0;
  if (z != null && Number.isFinite(z)) score += Math.min(45, Math.abs(z) * 18);
  if (spread != null && Number.isFinite(spread)) score += Math.min(25, Math.abs(spread) * 4);
  score += Math.min(20, input.stretchDurationBars * 2.5);
  score *= input.dataQuality.score / 100;
  return Math.round(Math.max(0, Math.min(100, score)));
}

/** Приоритет: no-data → fade → strong → divergence → watch → sync. */
export function deriveSignalState(input: SignalDerivationInput): QuadHedgeSignalState {
  const th = resolveSignalThresholds(input.thresholds);
  const gate = assessSignalGate(input);
  if (!gate.allowed) return "no-data";

  const z = input.focusZ.current;
  const absZ = z != null && Number.isFinite(z) ? Math.abs(z) : 0;
  const spreadAbs = absSpread(input.focusSpread);
  const duration = input.stretchDurationBars;
  const expanding = isSpreadExpanding(input.focusSpread.series);
  const aligned = input.directionAgreement.isAligned;

  if (
    input.fadeBars >= th.minFadeBars &&
    absZ >= th.watchZ &&
    absZ < th.divergenceZ &&
    !expanding
  ) {
    return "fade";
  }

  if (
    absZ >= th.strongDivergenceZ &&
    spreadAbs >= th.minSpreadStrongPp &&
    duration >= th.minDurationPoints
  ) {
    return "strong-divergence";
  }

  if (
    absZ >= th.divergenceZ &&
    spreadAbs >= th.minSpreadDivergencePp &&
    duration >= th.minDurationPoints
  ) {
    return "divergence";
  }

  const approachingZ = absZ >= th.watchZ * th.watchZApproachRatio && absZ < th.divergenceZ;
  if (
    approachingZ ||
    (absZ >= th.watchZ && absZ < th.divergenceZ) ||
    (expanding && spreadAbs >= th.minSpreadWatchPp) ||
    !aligned
  ) {
    return "watch";
  }

  if (aligned && absZ <= th.watchZ && spreadAbs <= th.spreadNormMaxPp) {
    return "sync";
  }

  return "sync";
}

export function deriveTradeBias(
  signalState: QuadHedgeSignalState,
  canComputeSignals: boolean,
): QuadHedgeTradeBias {
  if (!canComputeSignals || signalState === "no-data") return "wait";
  if (signalState === "fade") return "fade-watch";
  if (signalState === "strong-divergence" || signalState === "divergence") return "mean-reversion";
  if (signalState === "watch") return "watch";
  if (signalState === "sync") return "sync-move";
  return "wait";
}

export function signalStateLabelRu(state: QuadHedgeSignalState): string {
  return QUAD_HEDGE_SIGNAL_CHIP_LABEL_RU[state] ?? state;
}

export function signalStateOutputRu(state: QuadHedgeSignalState): string {
  return QUAD_HEDGE_SIGNAL_OUTPUT_RU[state] ?? state;
}

export function tradeBiasLabelRu(bias: QuadHedgeTradeBias): string {
  const map: Record<QuadHedgeTradeBias, string> = {
    wait: "ждать",
    watch: "наблюдение",
    "mean-reversion": "mean reversion",
    "sync-move": "синхронное движение",
    "fade-watch": "схлопывание — наблюдение",
  };
  return map[bias];
}

export function buildHeadline(
  signalState: QuadHedgeSignalState,
  focusZ: QuadHedgeZScoreMetric,
  directionAgreement: QuadHedgeDirectionAgreement,
  interpretation: string,
): string {
  if (signalState === "no-data") {
    return signalStateOutputRu("no-data");
  }
  const output = signalStateOutputRu(signalState);
  const zText =
    focusZ.current != null && Number.isFinite(focusZ.current)
      ? ` (z=${focusZ.current.toFixed(2)})`
      : "";
  return `${output}${zText}. ${interpretation || directionAgreement.summary}`;
}

export { countStretchDuration, countFadeBars };
