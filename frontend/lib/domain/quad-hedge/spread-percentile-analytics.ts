import type { QuadHedgePointThresholds } from "./point-thresholds";
import { SPREAD_LAB_POINT_THRESHOLDS } from "./point-thresholds";
import type { SpreadLastExtreme } from "./types";

/** Минимум точек для надёжных перцентильных зон (≈3+ торг. дня на 5m). */
export const SPREAD_PERCENTILE_MIN_POINTS = 40;

export type SpreadLabZoneKind = "noise" | "watch" | "extreme" | "strong";

export type SpreadPercentileAnalytics = {
  pointCount: number;
  percentileReliable: boolean;
  zoneMode: "percentile" | "fixed";
  minPointsRequired: number;
  percentileCurrent: number | null;
  percentileAbs: number | null;
  p70: number | null;
  p90: number | null;
  p97: number | null;
  currentZone: SpreadLabZoneKind;
  lastExtremeAt: string | null;
  retestCount: number;
  zoneBounds: {
    watch: number;
    extreme: number;
    strong: number;
  };
  interpretationLines: string[];
};

export const SPREAD_ZONE_LABEL_RU: Record<SpreadLabZoneKind, string> = {
  noise: "noise",
  watch: "watch",
  extreme: "extreme",
  strong: "strong",
};

function finiteValues(series: number[]): number[] {
  return series.filter(Number.isFinite);
}

function percentileOfSorted(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

function percentileRank(value: number, sorted: number[]): number | null {
  if (!sorted.length || !Number.isFinite(value)) return null;
  let below = 0;
  for (const v of sorted) {
    if (v <= value) below++;
  }
  return Math.round((below / sorted.length) * 100);
}

export function zoneFromAbsSpread(
  abs: number,
  bounds: { watch: number; extreme: number; strong: number },
): SpreadLabZoneKind {
  if (abs >= bounds.strong) return "strong";
  if (abs >= bounds.extreme) return "extreme";
  if (abs >= bounds.watch) return "watch";
  return "noise";
}

export function countSpreadRetests(
  series: number[],
  threshold: number,
  retestTolerance = 0.12,
): number {
  if (!Number.isFinite(threshold) || threshold <= 0) return 0;

  let count = 0;
  let wasAbove = false;
  let pulledBack = false;

  for (const v of series) {
    if (!Number.isFinite(v)) continue;
    const abs = Math.abs(v);
    if (abs >= threshold) wasAbove = true;
    if (wasAbove && abs < threshold * (1 - retestTolerance)) pulledBack = true;
    if (pulledBack && abs >= threshold * (1 - retestTolerance * 0.5)) {
      count++;
      pulledBack = false;
    }
  }

  return count;
}

function formatExtremeTime(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(11, 16);
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

export function buildSpreadInterpretationLines(input: {
  currentZone: SpreadLabZoneKind;
  zoneMode: "percentile" | "fixed";
  percentileReliable: boolean;
  percentileAbs: number | null;
  p90: number | null;
  p97: number | null;
  collapseFromExtreme: number | null;
  retestCount: number;
  lastExtreme: SpreadLastExtreme | null;
}): string[] {
  const lines: string[] = [];

  if (!input.percentileReliable && input.zoneMode === "fixed") {
    lines.push("Мало точек — зоны по фиксированным порогам (100/300/700/900 п.), перцентили ненадёжны.");
  }

  if (input.zoneMode === "percentile" && input.percentileReliable) {
    if (input.currentZone === "extreme") {
      lines.push("Spread в зоне p90 — рабочее расхождение.");
    }
    if (input.currentZone === "strong") {
      lines.push("Spread выше p97 — экстремальная зона.");
    }
  } else if (input.currentZone === "extreme" || input.currentZone === "strong") {
    lines.push("Spread в зоне экстремума — осторожно без подтверждения схлопывания.");
  }

  if (
    input.collapseFromExtreme != null &&
    Math.abs(input.collapseFromExtreme) >= 30 &&
    input.collapseFromExtreme < 0
  ) {
    const pts = Math.round(Math.abs(input.collapseFromExtreme));
    lines.push(`После экстремума идёт схлопывание на ${pts} п.`);
  }

  if (input.retestCount > 0) {
    lines.push(
      input.retestCount === 1
        ? "Повторный тест экстремума."
        : `Повторный тест экстремума (${input.retestCount}×).`,
    );
  }

  if (input.lastExtreme) {
    lines.push(
      `Последний экстремум: ${input.lastExtreme.type === "high" ? "max" : "min"} ${Math.round(input.lastExtreme.value)} п. · ${formatExtremeTime(input.lastExtreme.time)}`,
    );
  }

  return lines;
}

export function analyzeSpreadPercentiles(
  series: number[],
  current: number,
  lastExtreme: SpreadLastExtreme | null,
  collapseFromExtreme: number | null,
  th: QuadHedgePointThresholds = SPREAD_LAB_POINT_THRESHOLDS,
): SpreadPercentileAnalytics {
  const finite = finiteValues(series);
  const pointCount = finite.length;
  const minPointsRequired = th.minPercentilePoints ?? SPREAD_PERCENTILE_MIN_POINTS;
  const percentileReliable = pointCount >= minPointsRequired;

  const sortedSigned = [...finite].sort((a, b) => a - b);
  const sortedAbs = [...finite].map(Math.abs).sort((a, b) => a - b);

  const percentileCurrent = percentileRank(current, sortedSigned);
  const percentileAbs = percentileRank(Math.abs(current), sortedAbs);

  let zoneMode: "percentile" | "fixed" = "fixed";
  let p70: number | null = null;
  let p90: number | null = null;
  let p97: number | null = null;

  if (percentileReliable) {
    zoneMode = "percentile";
    p70 = percentileOfSorted(sortedAbs, 70);
    p90 = percentileOfSorted(sortedAbs, 90);
    p97 = percentileOfSorted(sortedAbs, 97);
  }

  const zoneBounds = percentileReliable
    ? {
        watch: p70 ?? th.noisePoints,
        extreme: p90 ?? th.watchPoints,
        strong: p97 ?? th.divergencePoints,
      }
    : {
        watch: th.noisePoints,
        extreme: th.watchPoints,
        strong: th.divergencePoints,
      };

  const currentZone = zoneFromAbsSpread(Math.abs(current), {
    watch: zoneBounds.watch,
    extreme: zoneBounds.extreme,
    strong: zoneBounds.strong,
  });

  const retestThreshold = percentileReliable
    ? (p90 ?? th.divergencePoints)
    : th.divergencePoints;
  const retestCount = countSpreadRetests(series, retestThreshold);

  const interpretationLines = buildSpreadInterpretationLines({
    currentZone,
    zoneMode,
    percentileReliable,
    percentileAbs,
    p90,
    p97,
    collapseFromExtreme,
    retestCount,
    lastExtreme,
  });

  return {
    pointCount,
    percentileReliable,
    zoneMode,
    minPointsRequired,
    percentileCurrent,
    percentileAbs,
    p70: percentileReliable ? p70 : null,
    p90: percentileReliable ? p90 : null,
    p97: percentileReliable ? p97 : null,
    currentZone,
    lastExtremeAt: lastExtreme?.time ?? null,
    retestCount,
    zoneBounds,
    interpretationLines,
  };
}
