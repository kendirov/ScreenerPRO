import { SPREAD_LAB_CHART_COLORS, spreadBarColor } from "./spread-lab-chart-theme";
import { SPREAD_LAB_POINT_THRESHOLDS, type QuadHedgePointThresholds } from "./point-thresholds";
import {
  findLocalSpreadExtrema,
  type SpreadLabLocalExtreme,
} from "./spread-lab-signals";
import { SPREAD_ZONE_LABEL_RU } from "./spread-percentile-analytics";
import { findSpreadPointsMetric } from "./spread-points";
import type { QuadHedgeAnalyticsResult, QuadHedgeViewMode } from "./types";
import { viewModeToPairKey } from "./types";

export type SpreadLabChartPoint = { time: string; value: number };

export type SpreadLabChartBar = {
  time: string;
  value: number;
  color: string;
};

export type SpreadLabPriceLevel = {
  value: number;
  label: string;
  color: string;
  lineWidth?: 1 | 2 | 3 | 4;
  dashed?: boolean;
};

export type SpreadLabMarker = {
  time: string;
  value: number;
  label: string;
  color: string;
  shape: "circle" | "arrowUp" | "arrowDown";
};

export type SpreadLabSidePanel = {
  now: string;
  max7S: string;
  min7S: string;
  p90: string;
  p97: string;
  zoneLabel: string;
  percentileAbs: string;
  zoneModeNote: string;
  /** @deprecated legacy */
  max?: string;
  min?: string;
  collapse?: string;
  zones?: Array<{ label: string; color: string }>;
};

export type SpreadLabZoneBand = {
  lower: number;
  upper: number;
  fillColor: string;
};

export type SpreadLabLegsMovementModel = {
  legAId: string;
  legBId: string;
  legALine: SpreadLabChartPoint[];
  legBLine: SpreadLabChartPoint[];
  legANow: string;
  legBNow: string;
};

export type SpreadLabChartModel = {
  canRender: boolean;
  emptyMessage: string;
  pairLabel: string;
  spreadLine: SpreadLabChartPoint[];
  histogram: SpreadLabChartBar[];
  priceLevels: SpreadLabPriceLevel[];
  markers: SpreadLabMarker[];
  sidePanel: SpreadLabSidePanel | null;
  legsMovement: SpreadLabLegsMovementModel | null;
  zoneBands: SpreadLabZoneBand[];
  percentileReliable: boolean;
  localExtrema: SpreadLabLocalExtreme[];
  pointCount: number;
  /** Полных точек в серии (до downsample). */
  fullPointCount: number;
};

const MIN_POINTS = 2;

/** Downsample только для отрисовки; экстремумы считаются по полной серии. */
const MAX_CHART_RENDER_POINTS = 1800;

function downsampleIndices(length: number, maxPoints: number): number[] {
  if (length <= maxPoints) return Array.from({ length }, (_, i) => i);
  const step = length / maxPoints;
  const indices: number[] = [];
  for (let i = 0; i < maxPoints; i++) {
    indices.push(Math.min(length - 1, Math.floor(i * step)));
  }
  const last = length - 1;
  if (indices[indices.length - 1] !== last) indices.push(last);
  return [...new Set(indices)].sort((a, b) => a - b);
}

function toChartTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(0, 10);
  return String(Math.floor(ms / 1000));
}

function pairDisplayLabel(viewMode: QuadHedgeViewMode): string {
  if (viewMode === "SI-CN") return "SI–CN";
  if (viewMode === "SI-EU") return "SI–EU";
  if (viewMode === "EU-CN") return "EU–CN";
  return viewMode;
}

function fmtPt(v: number): string {
  const r = Math.round(v);
  return `${r >= 0 ? "+" : ""}${r} п.`;
}

export function buildSpreadLabChartModel(
  analytics: QuadHedgeAnalyticsResult | null,
  viewMode: QuadHedgeViewMode,
  th: QuadHedgePointThresholds = SPREAD_LAB_POINT_THRESHOLDS,
): SpreadLabChartModel | null {
  const empty: SpreadLabChartModel = {
    canRender: false,
    emptyMessage: "Нет данных.",
    pairLabel: pairDisplayLabel(viewMode),
    spreadLine: [],
    histogram: [],
    priceLevels: [],
    markers: [],
    sidePanel: null,
    legsMovement: null,
    zoneBands: [],
    percentileReliable: false,
    localExtrema: [],
    pointCount: 0,
    fullPointCount: 0,
  };

  if (!analytics) return empty;

  const pairKey = viewModeToPairKey(viewMode);
  if (!pairKey) {
    return { ...empty, emptyMessage: "Выберите пару SI–CN / SI–EU / EU–CN." };
  }

  const metric = findSpreadPointsMetric(analytics.spreadPoints, pairKey);
  const diag = analytics.focusPairDiagnostics;

  if (!metric || metric.status !== "ok" || metric.series.length < MIN_POINTS) {
    const legA = metric?.legA ?? (viewMode.startsWith("SI") ? "SI" : "EU");
    const legB = metric?.legB ?? (viewMode.includes("CN") ? "CN" : "EU");
    const aC = diag?.legACandles ?? 0;
    const bC = diag?.legBCandles ?? 0;
    const aligned = diag?.alignedPoints ?? 0;
    const spread = diag?.spreadFinitePoints ?? 0;
    const reason = metric?.interpretation ?? diag?.reason ?? "spread series пуст";
    return {
      ...empty,
      emptyMessage: [
        `${legA} candles: ${aC}`,
        `${legB} candles: ${bC}`,
        `aligned points: ${aligned}`,
        `spread points: ${spread}`,
        `причина: ${reason}`,
      ].join("\n"),
    };
  }

  const timestamps =
    metric.timestamps?.length === metric.series.length
      ? metric.timestamps
      : analytics.alignedTimestamps.slice(-metric.series.length);

  const fullPointCount = metric.series.filter(Number.isFinite).length;
  const renderIndices = downsampleIndices(metric.series.length, MAX_CHART_RENDER_POINTS);

  const spreadLine: SpreadLabChartPoint[] = [];
  const histogram: SpreadLabChartBar[] = [];
  const legALine: SpreadLabChartPoint[] = [];
  const legBLine: SpreadLabChartPoint[] = [];

  const legADeltas = metric.legADeltaSeries ?? [];
  const legBDeltas = metric.legBDeltaSeries ?? [];

  for (const i of renderIndices) {
    const v = metric.series[i]!;
    if (!Number.isFinite(v)) continue;
    const ts = timestamps[i];
    if (!ts) continue;
    const time = toChartTime(ts);
    spreadLine.push({ time, value: v });
    histogram.push({
      time,
      value: v,
      color: spreadBarColor(v, Math.abs(v), th),
    });

    const dA = legADeltas[i];
    const dB = legBDeltas[i];
    if (Number.isFinite(dA)) legALine.push({ time, value: dA! });
    if (Number.isFinite(dB)) legBLine.push({ time, value: dB! });
  }

  if (spreadLine.length < MIN_POINTS) {
    return { ...empty, emptyMessage: "Spread points: меньше 2 конечных точек." };
  }

  const current = metric.currentSpreadPoints ?? metric.series.filter(Number.isFinite).at(-1) ?? 0;
  const finiteSeries = metric.series.filter(Number.isFinite);
  const maxVal = metric.maxSpreadPoints ?? Math.max(...finiteSeries);
  const minVal = metric.minSpreadPoints ?? Math.min(...finiteSeries);

  const maxIdxFull = metric.series.findIndex((v) => Math.round(v) === Math.round(maxVal));
  const minIdxFull = metric.series.findIndex((v) => Math.round(v) === Math.round(minVal));
  const lastIdxFull = metric.series.length - 1;

  const bounds = metric.percentileReliable
    ? {
        watch: metric.p70 ?? th.noisePoints,
        extreme: metric.p90 ?? th.watchPoints,
        strong: metric.p97 ?? th.divergencePoints,
      }
    : {
        watch: th.noisePoints,
        extreme: th.watchPoints,
        strong: th.divergencePoints,
      };

  const dataAbsMax = Math.max(Math.abs(maxVal), Math.abs(minVal), 1);
  const bandTop = dataAbsMax * 1.08;

  const zoneBands: SpreadLabZoneBand[] = [
    { lower: bounds.watch, upper: bounds.extreme, fillColor: "rgba(251,191,36,0.07)" },
    { lower: bounds.extreme, upper: bounds.strong, fillColor: "rgba(167,139,250,0.08)" },
    { lower: bounds.strong, upper: bandTop, fillColor: "rgba(251,113,133,0.09)" },
  ];

  const priceLevels: SpreadLabPriceLevel[] = [
    {
      value: 0,
      label: "0 п.",
      color: SPREAD_LAB_CHART_COLORS.zeroLine,
      lineWidth: 2,
      dashed: true,
    },
  ];

  if (metric.percentileReliable && metric.p70 != null && metric.p90 != null && metric.p97 != null) {
    priceLevels.push(
      { value: metric.p70, label: `p70 ±${Math.round(metric.p70)}`, color: SPREAD_LAB_CHART_COLORS.watch, dashed: true },
      { value: -metric.p70, label: `−p70`, color: SPREAD_LAB_CHART_COLORS.watch, dashed: true },
      { value: metric.p90, label: `p90 ±${Math.round(metric.p90)}`, color: SPREAD_LAB_CHART_COLORS.extremeLine, dashed: true },
      { value: -metric.p90, label: `−p90`, color: SPREAD_LAB_CHART_COLORS.extremeLine, dashed: true },
      { value: metric.p97, label: `p97 ±${Math.round(metric.p97)}`, color: SPREAD_LAB_CHART_COLORS.strongExtremeLine, dashed: true },
      { value: -metric.p97, label: `−p97`, color: SPREAD_LAB_CHART_COLORS.strongExtremeLine, dashed: true },
    );
  } else {
    priceLevels.push(
      { value: th.watchPoints, label: `+${th.watchPoints}`, color: SPREAD_LAB_CHART_COLORS.watch, dashed: true },
      { value: -th.watchPoints, label: `−${th.watchPoints}`, color: SPREAD_LAB_CHART_COLORS.watch, dashed: true },
      { value: th.divergencePoints, label: `+${th.divergencePoints}`, color: SPREAD_LAB_CHART_COLORS.extremeLine, dashed: true },
      { value: -th.divergencePoints, label: `−${th.divergencePoints}`, color: SPREAD_LAB_CHART_COLORS.extremeLine, dashed: true },
      { value: th.strongPoints, label: `+${th.strongPoints}`, color: SPREAD_LAB_CHART_COLORS.strongExtremeLine, dashed: true },
      { value: -th.strongPoints, label: `−${th.strongPoints}`, color: SPREAD_LAB_CHART_COLORS.strongExtremeLine, dashed: true },
    );
  }

  const lastPt = spreadLine[spreadLine.length - 1]!;
  const maxTime = timestamps[maxIdxFull] ? toChartTime(timestamps[maxIdxFull]!) : lastPt.time;
  const minTime = timestamps[minIdxFull] ? toChartTime(timestamps[minIdxFull]!) : lastPt.time;
  const nowTime = timestamps[lastIdxFull] ? toChartTime(timestamps[lastIdxFull]!) : lastPt.time;

  const markers: SpreadLabMarker[] = [
    {
      time: maxTime,
      value: maxVal,
      label: `MAX ${fmtPt(maxVal)}`,
      color: SPREAD_LAB_CHART_COLORS.maxMarker,
      shape: "arrowUp",
    },
    {
      time: minTime,
      value: minVal,
      label: `MIN ${fmtPt(minVal)}`,
      color: SPREAD_LAB_CHART_COLORS.minMarker,
      shape: "arrowDown",
    },
    {
      time: nowTime,
      value: current,
      label: `NOW ${fmtPt(current)}`,
      color: SPREAD_LAB_CHART_COLORS.now,
      shape: "circle",
    },
  ];

  const localExtrema = findLocalSpreadExtrema(metric.series, timestamps, th);
  for (const ex of localExtrema) {
    if (Math.round(ex.value) === Math.round(maxVal) || Math.round(ex.value) === Math.round(minVal)) {
      continue;
    }
    markers.push({
      time: ex.time,
      value: ex.value,
      label: ex.type === "high" ? "▲" : "▼",
      color: SPREAD_LAB_CHART_COLORS.localExtreme,
      shape: ex.type === "high" ? "arrowUp" : "arrowDown",
    });
  }

  const sidePanel: SpreadLabSidePanel = {
    now: fmtPt(current),
    max7S: fmtPt(maxVal),
    min7S: fmtPt(minVal),
    p90: metric.p90 != null ? `±${Math.round(metric.p90)} п.` : "—",
    p97: metric.p97 != null ? `±${Math.round(metric.p97)} п.` : "—",
    zoneLabel: SPREAD_ZONE_LABEL_RU[metric.currentZone ?? "noise"],
    percentileAbs:
      metric.percentileAbs != null
        ? `${metric.percentileAbs}%`
        : metric.percentileReliable
          ? "—"
          : "n/a",
    zoneModeNote: metric.percentileReliable
      ? "зоны p70/p90/p97"
      : `fixed ${th.noisePoints}/${th.watchPoints}/${th.divergencePoints}/${th.strongPoints}`,
  };

  const legAId = metric.legA;
  const legBId = metric.legB;
  const lastLegA = legADeltas[lastIdxFull];
  const lastLegB = legBDeltas[lastIdxFull];

  const legsMovement: SpreadLabLegsMovementModel | null =
    legALine.length >= MIN_POINTS && legBLine.length >= MIN_POINTS
      ? {
          legAId,
          legBId,
          legALine,
          legBLine,
          legANow: Number.isFinite(lastLegA) ? fmtPt(lastLegA!) : "—",
          legBNow: Number.isFinite(lastLegB) ? fmtPt(lastLegB!) : "—",
        }
      : null;

  return {
    canRender: true,
    emptyMessage: "",
    pairLabel: pairDisplayLabel(viewMode),
    spreadLine,
    histogram,
    priceLevels,
    markers,
    sidePanel,
    legsMovement,
    zoneBands,
    percentileReliable: metric.percentileReliable ?? false,
    localExtrema,
    pointCount: spreadLine.length,
    fullPointCount,
  };
}
