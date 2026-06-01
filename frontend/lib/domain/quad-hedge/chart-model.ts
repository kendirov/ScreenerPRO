import { DEFAULT_QUAD_HEDGE_SIGNAL_THRESHOLDS } from "./signal-thresholds";
import { DEFAULT_QUAD_HEDGE_POINT_THRESHOLDS } from "./point-thresholds";
import type { QuadHedgeAnalyticsResult, QuadHedgeSpreadUnitMode, QuadHedgeViewMode } from "./types";
import { viewModeToPairKey } from "./types";
import { findSpreadMetric, findZScoreMetric } from "./metrics";
import { findSpreadPointsMetric } from "./spread-points";
import { sessionBoundaryMarkers } from "./window";

export type QuadHedgeChartPoint = { time: string; value: number };

export type QuadHedgeChartSeries = {
  id: string;
  label: string;
  color: string;
  data: QuadHedgeChartPoint[];
  dashed?: boolean;
  lineWidth?: 1 | 2 | 3 | 4;
};

export type QuadHedgeChartPriceLevel = {
  value: number;
  label: string;
  color: string;
  dashed?: boolean;
};

export type QuadHedgeHistogramBar = {
  time: string;
  value: number;
  color: string;
};

export type QuadHedgeDayMarker = {
  time: string;
  label: string;
};

export type QuadHedgeHistogramExtreme = {
  value: number;
  label: string;
  color: string;
};

export type QuadHedgeMainChartModel = {
  canRender: boolean;
  emptyMessage: string;
  lines: QuadHedgeChartSeries[];
  histogram: QuadHedgeHistogramBar[];
  histogramLabel: string;
  histogramUnit: "pp" | "points";
  spreadUnitMode: QuadHedgeSpreadUnitMode;
  priceLevels: QuadHedgeChartPriceLevel[];
  histLevels: QuadHedgeChartPriceLevel[];
  extremeLevels: QuadHedgeHistogramExtreme[];
  legend: Array<{ label: string; color: string; dashed?: boolean }>;
  zAvailable: boolean;
  dayMarkers: QuadHedgeDayMarker[];
  showDayMarkers: boolean;
};

const LEG_COLORS = {
  SI: "#22d3ee",
  EU: "#34d399",
  CN: "#fbbf24",
  basket: "#94a3b8",
} as const;

const MIN_POINTS = 2;

function toChartTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(0, 10);
  return String(Math.floor(ms / 1000));
}

function zipFinite(timestamps: string[], values: number[]): QuadHedgeChartPoint[] {
  const out: QuadHedgeChartPoint[] = [];
  const len = Math.min(timestamps.length, values.length);
  for (let i = 0; i < len; i++) {
    const v = values[i]!;
    if (!Number.isFinite(v)) continue;
    out.push({ time: toChartTime(timestamps[i]!), value: v });
  }
  return out;
}

function zipNullable(timestamps: string[], values: (number | null)[]): QuadHedgeChartPoint[] {
  const out: QuadHedgeChartPoint[] = [];
  const len = Math.min(timestamps.length, values.length);
  for (let i = 0; i < len; i++) {
    const v = values[i];
    if (v == null || !Number.isFinite(v)) continue;
    out.push({ time: toChartTime(timestamps[i]!), value: v });
  }
  return out;
}

function barColor(value: number, z: number | null, th = DEFAULT_QUAD_HEDGE_SIGNAL_THRESHOLDS): string {
  const absZ = z != null ? Math.abs(z) : 0;
  if (absZ >= th.strongDivergenceZ) return "rgba(251,113,133,0.75)";
  if (absZ >= th.divergenceZ) return "rgba(167,139,250,0.7)";
  if (absZ >= th.watchZ || Math.abs(value) >= th.minSpreadWatchPp) return "rgba(251,191,36,0.65)";
  return value >= 0 ? "rgba(52,211,153,0.45)" : "rgba(244,63,94,0.45)";
}

function barColorPoints(value: number, th = DEFAULT_QUAD_HEDGE_POINT_THRESHOLDS): string {
  const abs = Math.abs(value);
  if (abs >= th.strongPoints) return "rgba(251,113,133,0.75)";
  if (abs >= th.divergencePoints) return "rgba(167,139,250,0.7)";
  if (abs >= th.watchPoints) return "rgba(251,191,36,0.65)";
  return value >= 0 ? "rgba(52,211,153,0.45)" : "rgba(244,63,94,0.45)";
}

function emptyModel(partial: Partial<QuadHedgeMainChartModel>): QuadHedgeMainChartModel {
  return {
    canRender: false,
    emptyMessage: "",
    lines: [],
    histogram: [],
    histogramLabel: "",
    histogramUnit: "pp",
    spreadUnitMode: "pct",
    priceLevels: [],
    histLevels: [],
    extremeLevels: [],
    legend: [],
    zAvailable: false,
    dayMarkers: [],
    showDayMarkers: false,
    ...partial,
  };
}

export function buildQuadHedgeMainChartModel(
  analytics: QuadHedgeAnalyticsResult | null,
  viewMode: QuadHedgeViewMode,
  spreadUnitMode: QuadHedgeSpreadUnitMode = "pct",
): QuadHedgeMainChartModel | null {
  if (!analytics) return null;

  const th = DEFAULT_QUAD_HEDGE_SIGNAL_THRESHOLDS;
  const ts = analytics.alignedTimestamps;
  const historyMessage = analytics.history?.message ?? "";

  if (analytics.history?.status === "NO_HISTORY") {
    return emptyModel({
      emptyMessage: historyMessage || "История за неделю не загружена. Нужен historical loader / collector.",
    });
  }

  if (ts.length < MIN_POINTS) {
    return emptyModel({
      emptyMessage: historyMessage || "Данных недостаточно — мало общих точек в окне.",
    });
  }

  const lines: QuadHedgeChartSeries[] = [];
  for (const legId of ["SI", "EU", "CN"] as const) {
    const norm = analytics.normalizedChangePct.find((n) => n.legId === legId);
    if (!norm || norm.status === "no-data") continue;
    const data = zipFinite(ts, norm.seriesPct);
    if (data.length < MIN_POINTS) continue;
    lines.push({
      id: legId,
      label: legId,
      color: LEG_COLORS[legId],
      data,
      lineWidth: 2,
    });
  }

  if (analytics.basket.status === "ok") {
    const data = zipFinite(ts, analytics.basket.series);
    if (data.length >= MIN_POINTS) {
      lines.push({
        id: "basket",
        label: "корзина",
        color: LEG_COLORS.basket,
        data,
        dashed: true,
        lineWidth: 1,
      });
    }
  }

  const pairKey = viewModeToPairKey(viewMode);
  const usePoints = spreadUnitMode === "points" && pairKey != null && viewMode !== "basket";

  let histogramValues: number[] = [];
  let histogramLabel = "";
  let histogramUnit: "pp" | "points" = "pp";
  let focusZ = findZScoreMetric(analytics.zScores, pairKey ?? "SI/CN");
  let spreadPointsMetric = pairKey ? findSpreadPointsMetric(analytics.spreadPoints, pairKey) : null;
  const extremeLevels: QuadHedgeHistogramExtreme[] = [];
  const histLevels: QuadHedgeChartPriceLevel[] = [{ value: 0, label: "0", color: "rgba(148,163,184,0.35)" }];

  if (usePoints && spreadPointsMetric?.status === "ok") {
    histogramValues = spreadPointsMetric.series;
    histogramLabel = `${spreadPointsMetric.pairKey.replace("/", " − ")} · пункты`;
    histogramUnit = "points";
    focusZ = spreadPointsMetric.zScoreStatus === "ok"
      ? { pairKey: spreadPointsMetric.pairKey, status: "ok", current: spreadPointsMetric.zScore, series: [], window: 20 }
      : focusZ;

    const pt = DEFAULT_QUAD_HEDGE_POINT_THRESHOLDS;
    histLevels.push(
      { value: pt.watchPoints, label: `+${pt.watchPoints}`, color: "rgba(251,191,36,0.45)", dashed: true },
      { value: -pt.watchPoints, label: `−${pt.watchPoints}`, color: "rgba(251,191,36,0.45)", dashed: true },
      { value: pt.divergencePoints, label: `+${pt.divergencePoints}`, color: "rgba(167,139,250,0.5)", dashed: true },
      { value: -pt.divergencePoints, label: `−${pt.divergencePoints}`, color: "rgba(167,139,250,0.5)", dashed: true },
    );

    if (spreadPointsMetric.maxSpreadPoints != null) {
      extremeLevels.push({
        value: spreadPointsMetric.maxSpreadPoints,
        label: `MAX ${Math.round(spreadPointsMetric.maxSpreadPoints)} п.`,
        color: "rgba(52,211,153,0.7)",
      });
      histLevels.push({
        value: spreadPointsMetric.maxSpreadPoints,
        label: "MAX",
        color: "rgba(52,211,153,0.55)",
        dashed: true,
      });
    }
    if (spreadPointsMetric.minSpreadPoints != null) {
      extremeLevels.push({
        value: spreadPointsMetric.minSpreadPoints,
        label: `MIN ${Math.round(spreadPointsMetric.minSpreadPoints)} п.`,
        color: "rgba(244,63,94,0.7)",
      });
      histLevels.push({
        value: spreadPointsMetric.minSpreadPoints,
        label: "MIN",
        color: "rgba(244,63,94,0.55)",
        dashed: true,
      });
    }
    if (spreadPointsMetric.currentSpreadPoints != null) {
      extremeLevels.push({
        value: spreadPointsMetric.currentSpreadPoints,
        label: `NOW ${Math.round(spreadPointsMetric.currentSpreadPoints)} п.`,
        color: "rgba(34,211,238,0.85)",
      });
    }
  } else if (viewMode === "basket") {
    const leader = analytics.deviations
      .filter((d) => d.status === "ok")
      .sort((a, b) => Math.abs(b.current ?? 0) - Math.abs(a.current ?? 0))[0];
    histogramValues = leader?.series ?? [];
    histogramLabel = leader
      ? `отклонение ${leader.legId} от корзины`
      : "отклонение от корзины";
    focusZ = findZScoreMetric(analytics.zScores, "SI/CN");
  } else if (pairKey) {
    const spread = findSpreadMetric(analytics.spreads, pairKey);
    histogramValues = spread?.series ?? [];
    histogramLabel = spread?.pairKey.replace("/", " − ") ?? viewMode;
    focusZ = findZScoreMetric(analytics.zScores, pairKey);
  }

  const zSeries = focusZ?.series ?? [];
  const histogram: QuadHedgeHistogramBar[] = [];
  for (let i = 0; i < Math.min(ts.length, histogramValues.length); i++) {
    const v = histogramValues[i]!;
    if (!Number.isFinite(v)) continue;
    const z = zSeries[i] ?? null;
    const isLast = i === Math.min(ts.length, histogramValues.length) - 1;
    histogram.push({
      time: toChartTime(ts[i]!),
      value: v,
      color:
        histogramUnit === "points"
          ? isLast
            ? "rgba(34,211,238,0.85)"
            : barColorPoints(v)
          : barColor(v, z, th),
    });
  }

  const priceLevels: QuadHedgeChartPriceLevel[] = [
    { value: 0, label: "0", color: "rgba(148,163,184,0.35)" },
  ];

  if (focusZ?.status === "ok") {
    priceLevels.push(
      { value: th.divergenceZ, label: "+1.5", color: "rgba(167,139,250,0.55)", dashed: true },
      { value: -th.divergenceZ, label: "−1.5", color: "rgba(167,139,250,0.55)", dashed: true },
      { value: th.strongDivergenceZ, label: "+2", color: "rgba(251,113,133,0.6)", dashed: true },
      { value: -th.strongDivergenceZ, label: "−2", color: "rgba(251,113,133,0.6)", dashed: true },
    );
  }

  const canRenderPoints =
    usePoints && spreadPointsMetric?.status === "ok" && histogram.length >= MIN_POINTS;
  const canRenderPct =
    lines.filter((l) => l.id !== "basket").length >= 2 && histogram.length >= MIN_POINTS;
  const canRender = usePoints ? canRenderPoints : canRenderPct;

  const dayMarkers =
    analytics.windowScope === "week" ? sessionBoundaryMarkers(ts) : [];
  const showDayMarkers = dayMarkers.length > 1;

  let emptyMessage = "";
  if (!canRender) {
    if (usePoints && spreadPointsMetric && spreadPointsMetric.status !== "ok") {
      emptyMessage = spreadPointsMetric.interpretation || "Нет данных для расчёта в пунктах.";
    } else if (analytics.history?.status === "PARTIAL_HISTORY") {
      emptyMessage = historyMessage || "Частичная история — недостаточно общих точек для графика.";
    } else if (usePoints) {
      emptyMessage = "Spread в пунктах: недостаточно общих точек пары.";
    } else {
      emptyMessage = "Нужны минимум две ноги с общими свечами.";
    }
  }

  return {
    canRender,
    emptyMessage,
    lines,
    histogram,
    histogramLabel,
    histogramUnit,
    spreadUnitMode,
    priceLevels,
    histLevels,
    extremeLevels,
    legend: [
      ...lines.map((l) => ({ label: l.label, color: l.color, dashed: l.dashed })),
      { label: histogramLabel, color: "rgba(148,163,184,0.6)" },
    ],
    zAvailable: focusZ?.status === "ok",
    dayMarkers,
    showDayMarkers,
  };
}

/** @deprecated Используйте buildQuadHedgeMainChartModel */
export function buildQuadHedgeChartModel(analytics: QuadHedgeAnalyticsResult | null) {
  return buildQuadHedgeMainChartModel(analytics, analytics?.viewMode ?? "SI-CN");
}

export type QuadHedgeChartModel = QuadHedgeMainChartModel;
