import { calcSpreadZScore } from "@/lib/domain/currency-intraday-series";
import type {
  QuadHedgeDirectionAgreement,
  QuadHedgeLegId,
  QuadHedgeMetricStatus,
  QuadHedgeNormalizedChange,
  QuadHedgeSpreadMetric,
  QuadHedgeSpreadPairKey,
  QuadHedgeZScoreMetric,
} from "./types";
import {
  QUAD_HEDGE_DEFAULT_Z_WINDOW,
  QUAD_HEDGE_MIN_Z_WINDOW,
  QUAD_HEDGE_SPREAD_PAIRS,
} from "./types";
import { QUAD_HEDGE_PRIMARY_LEGS } from "./basket";

export type AlignedQuadRow = {
  timestamp: string;
  closes: Partial<Record<QuadHedgeLegId, number>>;
};

export function alignQuadHedgeLegs(
  seriesByLeg: Partial<Record<QuadHedgeLegId, { timestamp: string; close: number }[]>>,
  intervalMinutes: number,
): AlignedQuadRow[] {
  const keys = (Object.keys(seriesByLeg) as QuadHedgeLegId[]).filter(
    (k) => (seriesByLeg[k]?.length ?? 0) > 0,
  );
  if (keys.length < 2) return [];

  const bucketMs = Math.max(intervalMinutes, 1) * 60 * 1000;

  function parseTs(ts: string): number {
    const ms = Date.parse(ts);
    return Number.isFinite(ms) ? ms : NaN;
  }

  function bucketKey(ts: string): number {
    const ms = parseTs(ts);
    if (!Number.isFinite(ms)) return NaN;
    return Math.round(ms / bucketMs) * bucketMs;
  }

  const byLegBucket = new Map<QuadHedgeLegId, Map<number, { timestamp: string; close: number }>>();

  for (const key of keys) {
    const buckets = new Map<number, { timestamp: string; close: number }>();
    for (const pt of seriesByLeg[key] ?? []) {
      if (!Number.isFinite(pt.close)) continue;
      const bk = bucketKey(pt.timestamp);
      if (!Number.isFinite(bk)) continue;
      buckets.set(bk, pt);
    }
    byLegBucket.set(key, buckets);
  }

  const allBuckets = new Set<number>();
  for (const buckets of byLegBucket.values()) {
    for (const bk of buckets.keys()) allBuckets.add(bk);
  }

  const rows: AlignedQuadRow[] = [];
  for (const bk of [...allBuckets].sort((a, b) => a - b)) {
    const closes: Partial<Record<QuadHedgeLegId, number>> = {};
    let timestamp = "";
    let matched = 0;

    for (const key of keys) {
      const pt = byLegBucket.get(key)?.get(bk);
      if (pt && Number.isFinite(pt.close)) {
        closes[key] = pt.close;
        if (!timestamp) timestamp = pt.timestamp;
        matched++;
      }
    }

    if (matched >= 2 && timestamp) {
      rows.push({ timestamp, closes });
    }
  }

  return rows;
}

export function calcNormalizedChangePctSeries(
  aligned: AlignedQuadRow[],
  legId: QuadHedgeLegId,
  anchorIndex = 0,
): QuadHedgeNormalizedChange {
  const anchorRow = aligned[anchorIndex];
  const anchorClose = anchorRow?.closes[legId];
  const anchorTimestamp = anchorRow?.timestamp ?? null;

  if (anchorClose == null || !Number.isFinite(anchorClose) || anchorClose === 0) {
    return {
      legId,
      status: "no-data",
      currentPct: null,
      seriesPct: [],
      anchorClose: null,
      anchorTimestamp,
    };
  }

  const seriesPct = aligned.map((row) => {
    const close = row.closes[legId];
    if (close == null || !Number.isFinite(close)) return NaN;
    return (close / anchorClose - 1) * 100;
  });

  const finite = seriesPct.filter(Number.isFinite);
  const status: QuadHedgeMetricStatus = finite.length < 2 ? "insufficient-data" : "ok";
  const last = seriesPct[seriesPct.length - 1];

  return {
    legId,
    status,
    currentPct: Number.isFinite(last) ? last! : null,
    seriesPct,
    anchorClose,
    anchorTimestamp,
  };
}

export function calcSpreadSeries(
  normA: QuadHedgeNormalizedChange,
  normB: QuadHedgeNormalizedChange,
  pairKey: QuadHedgeSpreadPairKey,
): QuadHedgeSpreadMetric {
  if (normA.status === "no-data" || normB.status === "no-data") {
    return { pairKey, status: "no-data", current: null, series: [], unit: "pp" };
  }

  const len = Math.min(normA.seriesPct.length, normB.seriesPct.length);
  const series: number[] = [];
  for (let i = 0; i < len; i++) {
    const a = normA.seriesPct[i]!;
    const b = normB.seriesPct[i]!;
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
    status,
    current: Number.isFinite(last) ? last! : null,
    series,
    unit: "pp",
  };
}

export function calcZScoreMetric(
  spread: QuadHedgeSpreadMetric,
  window = QUAD_HEDGE_DEFAULT_Z_WINDOW,
  pairKey: QuadHedgeZScoreMetric["pairKey"] = spread.pairKey,
): QuadHedgeZScoreMetric {
  if (spread.status === "no-data" || !spread.series.length) {
    return { pairKey, status: "no-data", current: null, series: [], window };
  }

  const finiteCount = spread.series.filter(Number.isFinite).length;
  if (finiteCount < QUAD_HEDGE_MIN_Z_WINDOW) {
    return {
      pairKey,
      status: "insufficient-data",
      current: null,
      series: spread.series.map(() => null),
      window,
    };
  }

  const series = calcSpreadZScore(spread.series, window);
  const last = series[series.length - 1] ?? null;

  return {
    pairKey,
    status: last != null ? "ok" : "insufficient-data",
    current: last,
    series,
    window,
  };
}

const FLAT_THRESHOLD_PCT = 0.03;

function directionFromPct(pct: number | null | undefined): "up" | "down" | "flat" {
  if (pct == null || !Number.isFinite(pct)) return "flat";
  if (Math.abs(pct) < FLAT_THRESHOLD_PCT) return "flat";
  return pct > 0 ? "up" : "down";
}

/** Согласованность SI / EU / CN. */
export function calcDirectionAgreement(
  normalized: QuadHedgeNormalizedChange[],
): QuadHedgeDirectionAgreement {
  const legDirections: Partial<Record<QuadHedgeLegId, "up" | "down" | "flat">> = {};
  const movers: { leg: QuadHedgeLegId; pct: number }[] = [];

  for (const legId of QUAD_HEDGE_PRIMARY_LEGS) {
    const norm = normalized.find((n) => n.legId === legId);
    if (!norm || norm.currentPct == null) continue;
    const dir = directionFromPct(norm.currentPct);
    legDirections[legId] = dir;
    if (dir !== "flat") movers.push({ leg: legId, pct: norm.currentPct });
  }

  if (movers.length < 2) {
    return {
      status: "insufficient-data",
      agreementRatio: null,
      leaderLeg: movers[0]?.leg ?? null,
      isAligned: false,
      legDirections,
      summary: "Мало primary-ног с движением.",
    };
  }

  const leader = movers.reduce((best, m) =>
    Math.abs(m.pct) > Math.abs(best.pct) ? m : best,
  );
  const leaderSign = leader.pct >= 0 ? 1 : -1;
  const sameDir = movers.filter((m) => (m.pct >= 0 ? 1 : -1) === leaderSign);
  const ratio = sameDir.length / movers.length;
  const isAligned = ratio >= 0.75;

  const summary = isAligned
    ? `SI/EU/CN синхронны — общее движение рубля (${Math.round(ratio * 100)}%).`
    : `Одна нога оторвалась от других (согласие ${Math.round(ratio * 100)}%).`;

  return {
    status: "ok",
    agreementRatio: ratio,
    leaderLeg: leader.leg,
    isAligned,
    legDirections,
    summary,
  };
}

export function buildPrimarySpreadMetrics(
  normalized: QuadHedgeNormalizedChange[],
): QuadHedgeSpreadMetric[] {
  const byLeg = new Map(normalized.map((n) => [n.legId, n]));
  const primaryPairs = QUAD_HEDGE_SPREAD_PAIRS.filter((p) =>
    ["SI/CN", "SI/EU", "EU/CN"].includes(p.pairKey),
  );

  return primaryPairs.map(({ pairKey, legA, legB }) => {
    const a = byLeg.get(legA);
    const b = byLeg.get(legB);
    if (!a || !b) {
      return { pairKey, status: "no-data" as const, current: null, series: [], unit: "pp" as const };
    }
    return calcSpreadSeries(a, b, pairKey);
  });
}

export function buildOptionalSpreadMetrics(
  normalized: QuadHedgeNormalizedChange[],
): QuadHedgeSpreadMetric[] {
  const byLeg = new Map(normalized.map((n) => [n.legId, n]));
  const edPair = QUAD_HEDGE_SPREAD_PAIRS.find((p) => p.pairKey === "SI/ED");
  if (!edPair) return [];
  const a = byLeg.get(edPair.legA);
  const b = byLeg.get(edPair.legB);
  if (!a || !b) return [];
  return [calcSpreadSeries(a, b, edPair.pairKey)];
}

export function countStretchDuration(
  zSeries: (number | null)[],
  threshold = 1.5,
): number {
  let duration = 0;
  for (let i = zSeries.length - 1; i >= 0; i--) {
    const z = zSeries[i];
    if (z == null || Math.abs(z) < threshold) break;
    duration++;
  }
  return duration;
}

export function countFadeBars(zSeries: (number | null)[], threshold = 1.0): number {
  if (zSeries.length < 3) return 0;
  let fade = 0;
  for (let i = zSeries.length - 1; i >= 1; i--) {
    const cur = zSeries[i];
    const prev = zSeries[i - 1];
    if (cur == null || prev == null) break;
    if (Math.abs(cur) < Math.abs(prev) && Math.abs(prev) >= threshold) {
      fade++;
    } else break;
  }
  return fade;
}

export function findSpreadMetric(
  spreads: QuadHedgeSpreadMetric[],
  pairKey: QuadHedgeSpreadPairKey,
): QuadHedgeSpreadMetric | undefined {
  return spreads.find((s) => s.pairKey === pairKey);
}

export function findZScoreMetric(
  zScores: QuadHedgeZScoreMetric[],
  pairKey: QuadHedgeZScoreMetric["pairKey"],
): QuadHedgeZScoreMetric | undefined {
  return zScores.find((z) => z.pairKey === pairKey);
}
