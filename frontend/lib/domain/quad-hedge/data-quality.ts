import {
  DEFAULT_QUAD_HEDGE_SIGNAL_THRESHOLDS,
  resolveSignalThresholds,
  type QuadHedgeSignalThresholds,
} from "./signal-thresholds";
import type {
  QuadHedgeDataQuality,
  QuadHedgeLegId,
  QuadHedgeLegQuality,
  QuadHedgeLegQualityStatus,
  QuadHedgeLegSeries,
} from "./types";
import { QUAD_HEDGE_PRIMARY_LEGS } from "./basket";
import { QUAD_HEDGE_LEG_META } from "./types";

const TRACKED_LEGS: QuadHedgeLegId[] = ["SI", "EU", "CN", "ED"];

function parseTs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : NaN;
}

function countGaps(points: { timestamp: string }[], intervalMinutes: number): number {
  if (points.length < 2) return 0;
  const maxGapMs = intervalMinutes * 60 * 1000 * 2.5;
  let gaps = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = parseTs(points[i - 1]!.timestamp);
    const cur = parseTs(points[i]!.timestamp);
    if (!Number.isFinite(prev) || !Number.isFinite(cur)) continue;
    if (cur - prev > maxGapMs) gaps++;
  }
  return gaps;
}

function staleMinutes(lastTimestamp: string | null, asOfMs: number): number | null {
  if (!lastTimestamp) return null;
  const last = parseTs(lastTimestamp);
  if (!Number.isFinite(last)) return null;
  return Math.max(0, Math.round((asOfMs - last) / 60_000));
}

function legStatus(
  leg: QuadHedgeLegSeries | undefined,
  pointCount: number,
  staleMin: number | null,
  gapCount: number,
  th: QuadHedgeSignalThresholds,
): QuadHedgeLegQualityStatus {
  if (!leg) return "missing";
  if (leg.source === "demo" || leg.source === "stub") return "demo";
  if (pointCount === 0) return "empty";
  if (pointCount < th.minPoints) return "insufficient";
  if (staleMin != null && staleMin > th.staleMinutes) return "stale";
  if (gapCount > th.maxDataGap) return "gaps";
  return "ok";
}

function legMessage(status: QuadHedgeLegQualityStatus, leg: QuadHedgeLegSeries | undefined): string {
  switch (status) {
    case "missing":
      return "Нога не загружена";
    case "empty":
      return "Нет свечей MOEX ISS";
    case "insufficient":
      return `Мало точек (< ${DEFAULT_QUAD_HEDGE_SIGNAL_THRESHOLDS.minPoints})`;
    case "stale":
      return "Последняя свеча устарела";
    case "gaps":
      return "Есть разрывы в ряду";
    case "demo":
      return leg?.source === "demo" ? "Demo — не для сигналов" : "Stub — не для сигналов";
    case "ok":
      return "OK";
  }
}

/** Минимум 2 primary-ноги (SI/EU/CN) с ok и без demo. */
export function assessQuadHedgeDataQuality(
  legsById: Map<QuadHedgeLegId, QuadHedgeLegSeries>,
  options: {
    intervalMinutes: number;
    staleThresholdMinutes?: number;
    asOfMs: number;
    thresholds?: Partial<QuadHedgeSignalThresholds>;
    historyStatus?: import("./window").QuadHedgeHistoryStatus;
    historyLabel?: string;
  },
): QuadHedgeDataQuality {
  const th = resolveSignalThresholds({
    staleMinutes: options.staleThresholdMinutes ?? DEFAULT_QUAD_HEDGE_SIGNAL_THRESHOLDS.staleMinutes,
    ...options.thresholds,
  });

  const legQualities: QuadHedgeLegQuality[] = [];
  const missingLegs: QuadHedgeLegId[] = [];
  const degradedLegs: QuadHedgeLegId[] = [];

  for (const legId of TRACKED_LEGS) {
    const leg = legsById.get(legId);
    const points = leg?.points ?? [];
    const pointCount = points.length;
    const first = points[0];
    const last = points[points.length - 1];
    const lastTs = last?.timestamp ?? null;
    const stale = staleMinutes(lastTs, options.asOfMs);
    const gaps = leg ? countGaps(points, options.intervalMinutes) : 0;
    const status = legStatus(leg, pointCount, stale, gaps, th);

    if (status === "missing") missingLegs.push(legId);
    if (status !== "ok" && status !== "missing") degradedLegs.push(legId);

    legQualities.push({
      legId,
      ticker: leg?.ticker ?? "—",
      status,
      pointCount,
      staleMinutes: stale,
      gapCount: gaps,
      firstTimestamp: first?.timestamp ?? null,
      lastTimestamp: lastTs,
      source: leg?.source ?? "stub",
      message: legMessage(status, leg),
    });
  }

  const primaryOk = QUAD_HEDGE_PRIMARY_LEGS.filter((id) => {
    const q = legQualities.find((l) => l.legId === id);
    return q?.status === "ok";
  });

  const primaryDemo = QUAD_HEDGE_PRIMARY_LEGS.some((id) => {
    const q = legQualities.find((l) => l.legId === id);
    return q?.status === "demo";
  });

  const canComputeSignals = primaryOk.length >= 2 && !primaryDemo;

  let score = 100;
  for (const q of legQualities) {
    if (q.status === "missing") score -= 8;
    else if (q.status === "empty") score -= 12;
    else if (q.status === "insufficient") score -= 10;
    else if (q.status === "stale") score -= 15;
    else if (q.status === "gaps") score -= 8;
    else if (q.status === "demo") score -= 20;
  }
  score = Math.max(0, Math.min(100, score));

  let summary: string;
  if (!canComputeSignals) {
    if (primaryDemo) {
      summary = "Demo/stub на primary-ногах — только наблюдение.";
    } else if (primaryOk.length < 2) {
      summary = `Нужно минимум 2 из SI/EU/CN — сейчас ok: ${primaryOk.length}.`;
    } else {
      summary = "Недостаточно качественных данных — только наблюдение.";
    }
  } else if (primaryOk.length === 3) {
    summary = "SI / EU / CN — данные достаточны для сигналов.";
  } else {
    const missing = QUAD_HEDGE_PRIMARY_LEGS.filter((id) => !primaryOk.includes(id))
      .map((id) => QUAD_HEDGE_LEG_META[id].label)
      .join(", ");
    summary = `Сигналы по ${primaryOk.length} ногам; нет: ${missing}.`;
  }

  return {
    canComputeSignals,
    primaryLegsOk: primaryOk.length,
    score,
    legs: legQualities,
    missingLegs,
    degradedLegs,
    summary,
    historyStatus: options.historyStatus ?? "NO_HISTORY",
    historyLabel: options.historyLabel ?? "NO HISTORY",
  };
}
