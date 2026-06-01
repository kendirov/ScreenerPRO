import type { QuadHedgePointThresholds } from "./point-thresholds";

/** Re-exports from spread-trend-analytics + local extrema helper. */
export type { SpreadLabSignalStatus } from "./types";

export type SpreadLabLocalExtreme = {
  index: number;
  time: string;
  value: number;
  type: "high" | "low";
};

function toChartTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(0, 10);
  return String(Math.floor(ms / 1000));
}

/** Локальные экстремумы для маркеров на графике. */
export function findLocalSpreadExtrema(
  series: number[],
  timestamps: string[],
  th: QuadHedgePointThresholds,
): SpreadLabLocalExtreme[] {
  if (series.length < th.minTrendPoints + 2) return [];

  const out: SpreadLabLocalExtreme[] = [];
  const prominence = th.localExtremeMinProminence;
  const minDist = th.localExtremeMinDistance;

  for (let i = 1; i < series.length - 1; i++) {
    const v = series[i]!;
    if (!Number.isFinite(v) || Math.abs(v) < th.noisePoints * 0.5) continue;

    const prev = series[i - 1]!;
    const next = series[i + 1]!;
    if (!Number.isFinite(prev) || !Number.isFinite(next)) continue;

    const isHigh = v > prev && v >= next;
    const isLow = v < prev && v <= next;
    if (!isHigh && !isLow) continue;

    const localMin = Math.min(prev, next);
    const localMax = Math.max(prev, next);
    const prom = isHigh ? v - localMax : localMin - v;
    if (prom < prominence) continue;

    const last = out[out.length - 1];
    if (last && i - last.index < minDist) {
      if (prom > Math.abs(last.value - (series[last.index] ?? 0))) {
        out[out.length - 1] = {
          index: i,
          time: toChartTime(timestamps[i] ?? ""),
          value: v,
          type: isHigh ? "high" : "low",
        };
      }
      continue;
    }

    out.push({
      index: i,
      time: toChartTime(timestamps[i] ?? ""),
      value: v,
      type: isHigh ? "high" : "low",
    });
  }

  return out.slice(-th.localExtremeMaxMarkers);
}

/** @deprecated используйте analyzeSpreadTrend */
export function calcCollapseFromExtreme(
  current: number,
  maxVal: number,
  minVal: number,
): { windowExtremeValue: number; collapseFromExtremePoints: number } {
  const distToMax = Math.abs(current - maxVal);
  const distToMin = Math.abs(current - minVal);
  const windowExtremeValue = distToMax <= distToMin ? maxVal : minVal;
  return {
    windowExtremeValue,
    collapseFromExtremePoints: current - windowExtremeValue,
  };
}
