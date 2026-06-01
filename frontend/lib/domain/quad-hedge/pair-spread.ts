import type {
  QuadHedgeLegId,
  QuadHedgeMetricStatus,
  QuadHedgePricePoint,
  QuadHedgeSpreadPairKey,
} from "./types";

export type PairAlignedRow = {
  timestamp: string;
  closeA: number;
  closeB: number;
};

export type QuadHedgePairSpreadDiagnostics = {
  pairKey: QuadHedgeSpreadPairKey;
  legA: QuadHedgeLegId;
  legB: QuadHedgeLegId;
  legACandles: number;
  legBCandles: number;
  alignedPoints: number;
  /** Бакеты union − intersection (одна нога без пары). */
  missingPoints: number;
  spreadFinitePoints: number;
  anchorTimestamp: string | null;
  reason?: string;
};

export type PairSpreadBuildResult = {
  status: QuadHedgeMetricStatus;
  currentSpreadPoints: number | null;
  series: number[];
  legADeltaSeries: number[];
  legBDeltaSeries: number[];
  timestamps: string[];
  diagnostics: QuadHedgePairSpreadDiagnostics;
};

function bucketKey(ts: string, bucketMs: number): number | null {
  const ms = Date.parse(ts);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / bucketMs) * bucketMs;
}

/** Агрегация свечей в более крупный интервал (последний close в бакете). */
export function bucketPricePoints(
  points: QuadHedgePricePoint[],
  bucketMinutes: number,
): QuadHedgePricePoint[] {
  if (bucketMinutes <= 1 || points.length === 0) return points;

  const bucketMs = bucketMinutes * 60 * 1000;
  const byBucket = new Map<number, QuadHedgePricePoint>();

  for (const p of points) {
    const bk = bucketKey(p.timestamp, bucketMs);
    if (bk == null || !Number.isFinite(p.close)) continue;
    byBucket.set(bk, { timestamp: new Date(bk).toISOString(), close: p.close });
  }

  return [...byBucket.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, p]) => p);
}

function legBucketMap(
  points: QuadHedgePricePoint[],
  intervalMinutes: number,
): Map<number, QuadHedgePricePoint> {
  const bucketMs = Math.max(intervalMinutes, 1) * 60 * 1000;
  const map = new Map<number, QuadHedgePricePoint>();
  for (const p of points) {
    const bk = bucketKey(p.timestamp, bucketMs);
    if (bk == null || !Number.isFinite(p.close)) continue;
    map.set(bk, p);
  }
  return map;
}

/** Выравнивание двух ног по времени — только общие бакеты (intersection). */
export function alignPairLegSeries(
  pointsA: QuadHedgePricePoint[],
  pointsB: QuadHedgePricePoint[],
  intervalMinutes: number,
): PairAlignedRow[] {
  const mapA = legBucketMap(pointsA, intervalMinutes);
  const mapB = legBucketMap(pointsB, intervalMinutes);
  const keys = [...mapA.keys()].filter((k) => mapB.has(k)).sort((a, b) => a - b);

  return keys.map((bk) => ({
    timestamp: new Date(bk).toISOString(),
    closeA: mapA.get(bk)!.close,
    closeB: mapB.get(bk)!.close,
  }));
}

/**
 * Pair-spread pipeline:
 * resolved candles A + B → align → delta от общего anchor → spreadPoints series.
 */
export function buildPairSpreadPoints(
  legA: QuadHedgeLegId,
  legB: QuadHedgeLegId,
  pointsA: QuadHedgePricePoint[],
  pointsB: QuadHedgePricePoint[],
  pairKey: QuadHedgeSpreadPairKey,
  intervalMinutes: number,
): PairSpreadBuildResult {
  const diagnostics: QuadHedgePairSpreadDiagnostics = {
    pairKey,
    legA,
    legB,
    legACandles: pointsA.length,
    legBCandles: pointsB.length,
    alignedPoints: 0,
    missingPoints: 0,
    spreadFinitePoints: 0,
    anchorTimestamp: null,
  };

  if (pointsA.length === 0 || pointsB.length === 0) {
    const missing = pointsA.length === 0 ? legA : legB;
    diagnostics.reason = `${missing}: нет свечей после загрузки MOEX.`;
    return {
      status: "no-data",
      currentSpreadPoints: null,
      series: [],
      legADeltaSeries: [],
      legBDeltaSeries: [],
      timestamps: [],
      diagnostics,
    };
  }

  const mapA = legBucketMap(pointsA, intervalMinutes);
  const mapB = legBucketMap(pointsB, intervalMinutes);
  const unionKeys = new Set([...mapA.keys(), ...mapB.keys()]);

  const aligned = alignPairLegSeries(pointsA, pointsB, intervalMinutes);
  diagnostics.alignedPoints = aligned.length;
  diagnostics.missingPoints = Math.max(0, unionKeys.size - aligned.length);

  if (aligned.length < 2) {
    diagnostics.reason =
      aligned.length === 0
        ? "Нет общих timestamps — ноги не пересекаются по времени."
        : "Мало общих точек (<2) после align.";
    return {
      status: "insufficient-data",
      currentSpreadPoints: null,
      series: [],
      legADeltaSeries: [],
      legBDeltaSeries: [],
      timestamps: [],
      diagnostics,
    };
  }

  const anchor = aligned[0]!;
  diagnostics.anchorTimestamp = anchor.timestamp;

  const startA = anchor.closeA;
  const startB = anchor.closeB;

  const series: number[] = [];
  const legADeltaSeries: number[] = [];
  const legBDeltaSeries: number[] = [];
  const timestamps: string[] = [];

  for (const row of aligned) {
    const deltaA = row.closeA - startA;
    const deltaB = row.closeB - startB;
    legADeltaSeries.push(deltaA);
    legBDeltaSeries.push(deltaB);
    series.push(deltaA - deltaB);
    timestamps.push(row.timestamp);
  }

  const finite = series.filter(Number.isFinite);
  diagnostics.spreadFinitePoints = finite.length;

  if (finite.length < 2) {
    diagnostics.reason = "Spread series: меньше 2 конечных точек.";
    return {
      status: "insufficient-data",
      currentSpreadPoints: null,
      series,
      legADeltaSeries,
      legBDeltaSeries,
      timestamps,
      diagnostics,
    };
  }

  const last = series[series.length - 1]!;
  return {
    status: "ok",
    currentSpreadPoints: Number.isFinite(last) ? last : null,
    series,
    legADeltaSeries,
    legBDeltaSeries,
    timestamps,
    diagnostics,
  };
}
