import { getPairConfig, type PointsPairKey } from "@/lib/domain/currency-pair-config";
import { formatPairSpreadValue } from "@/lib/domain/currency-pair-divergence";
import type { WeeklySpreadPoint, WeeklySpreadSeries } from "@/lib/domain/currency-correlation-weeks";

export type WeekCompareBandPoint = {
  minuteOfWeek: number;
  p10: number | null;
  p25: number | null;
  mean: number | null;
  p75: number | null;
  p90: number | null;
  sampleCount: number;
};

export type WeekCompareMarkerKind =
  | "exit_corridor"
  | "return_corridor"
  | "week_extreme";

export type WeekCompareMarker = {
  minuteOfWeek: number;
  timestamp: string;
  kind: WeekCompareMarkerKind;
  label: string;
  spreadPoints: number;
  strength: number;
};

export type WeekCompareSnapshot = {
  minuteOfWeek: number;
  currentSpread: number | null;
  historicalMean: number | null;
  deviationFromMean: number | null;
};

export type WeekCompareStats = {
  hasEnoughHistory: boolean;
  historyWeekCount: number;
  currentSpread: number | null;
  historicalMeanAtNow: number | null;
  deviationFromMean: number | null;
  currentWeekMax: number | null;
  currentWeekMin: number | null;
  outsideCorridorPct: number | null;
  formatted: {
    currentSpread: string;
    historicalMean: string;
    deviation: string;
    max: string;
    min: string;
    outsidePct: string;
  };
};

export type WeekCompareModel = {
  pairKey: PointsPairKey;
  currentWeek: WeeklySpreadSeries | null;
  pastWeeks: WeeklySpreadSeries[];
  bands: WeekCompareBandPoint[];
  markers: WeekCompareMarker[];
  stats: WeekCompareStats;
  diagnostics: string[];
};

const MIN_HISTORY_WEEKS = 2;

function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

function spreadsAtMinute(weeks: WeeklySpreadSeries[], minute: number): number[] {
  const out: number[] = [];
  for (const w of weeks) {
    const pt = w.points.find((p) => p.minuteOfWeek === minute);
    if (pt && Number.isFinite(pt.spreadPoints)) out.push(pt.spreadPoints);
  }
  return out;
}

function allMinutes(weeks: WeeklySpreadSeries[]): number[] {
  const set = new Set<number>();
  for (const w of weeks) {
    for (const p of w.points) {
      set.add(p.minuteOfWeek);
    }
  }
  return [...set].sort((a, b) => a - b);
}

export function buildWeekCompareBands(pastWeeks: WeeklySpreadSeries[]): WeekCompareBandPoint[] {
  if (pastWeeks.length < MIN_HISTORY_WEEKS) return [];

  const minutes = allMinutes(pastWeeks);
  const bands: WeekCompareBandPoint[] = [];

  for (const minute of minutes) {
    const values = spreadsAtMinute(pastWeeks, minute).sort((a, b) => a - b);
    if (values.length < MIN_HISTORY_WEEKS) continue;
    bands.push({
      minuteOfWeek: minute,
      p10: percentile(values, 0.1),
      p25: percentile(values, 0.25),
      mean: values.reduce((s, v) => s + v, 0) / values.length,
      p75: percentile(values, 0.75),
      p90: percentile(values, 0.9),
      sampleCount: values.length,
    });
  }

  return bands;
}

function bandAtMinute(
  bands: WeekCompareBandPoint[],
  minute: number,
): WeekCompareBandPoint | null {
  return bands.find((b) => b.minuteOfWeek === minute) ?? null;
}

function isInsideCorridor(spread: number, band: WeekCompareBandPoint | null): boolean {
  if (!band || band.p25 == null || band.p75 == null) return true;
  return spread >= band.p25 && spread <= band.p75;
}

export function buildWeekCompareMarkers(
  current: WeeklySpreadSeries,
  bands: WeekCompareBandPoint[],
  max = 10,
): WeekCompareMarker[] {
  if (!current.points.length || bands.length < 2) return [];

  const markers: WeekCompareMarker[] = [];
  let weekMaxAbs = 0;
  let weekMaxPt: WeeklySpreadPoint | null = null;

  for (const pt of current.points) {
    const abs = Math.abs(pt.spreadPoints);
    if (abs > weekMaxAbs) {
      weekMaxAbs = abs;
      weekMaxPt = pt;
    }
  }

  if (weekMaxPt) {
    markers.push({
      minuteOfWeek: weekMaxPt.minuteOfWeek,
      timestamp: weekMaxPt.timestamp,
      kind: "week_extreme",
      label: "новый экстремум недели",
      spreadPoints: weekMaxPt.spreadPoints,
      strength: weekMaxAbs,
    });
  }

  let prevInside = true;
  for (let i = 0; i < current.points.length; i++) {
    const pt = current.points[i]!;
    const band = bandAtMinute(bands, pt.minuteOfWeek);
    const inside = isInsideCorridor(pt.spreadPoints, band);

    if (prevInside && !inside) {
      markers.push({
        minuteOfWeek: pt.minuteOfWeek,
        timestamp: pt.timestamp,
        kind: "exit_corridor",
        label: "выход за коридор",
        spreadPoints: pt.spreadPoints,
        strength: Math.abs(pt.spreadPoints),
      });
    } else if (!prevInside && inside) {
      markers.push({
        minuteOfWeek: pt.minuteOfWeek,
        timestamp: pt.timestamp,
        kind: "return_corridor",
        label: "возврат в коридор",
        spreadPoints: pt.spreadPoints,
        strength: Math.abs(pt.spreadPoints),
      });
    }
    prevInside = inside;
  }

  const seen = new Set<string>();
  return markers
    .filter((m) => {
      const id = `${m.kind}-${m.minuteOfWeek}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((a, b) => b.strength - a.strength)
    .slice(0, max);
}

export function buildWeekCompareStats(
  current: WeeklySpreadSeries | null,
  pastWeeks: WeeklySpreadSeries[],
  bands: WeekCompareBandPoint[],
  pairKey: PointsPairKey,
): WeekCompareStats {
  const config = getPairConfig(pairKey);
  const fmt = (v: number | null) =>
    v != null && Number.isFinite(v) ? formatPairSpreadValue(v, config) : "—";

  const historyWeekCount = pastWeeks.filter((w) => w.points.length >= 5).length;
  const hasEnoughHistory = historyWeekCount >= MIN_HISTORY_WEEKS;

  if (!current?.points.length) {
    return {
      hasEnoughHistory,
      historyWeekCount,
      currentSpread: null,
      historicalMeanAtNow: null,
      deviationFromMean: null,
      currentWeekMax: null,
      currentWeekMin: null,
      outsideCorridorPct: null,
      formatted: {
        currentSpread: "—",
        historicalMean: "—",
        deviation: "—",
        max: "—",
        min: "—",
        outsidePct: "—",
      },
    };
  }

  const spreads = current.points.map((p) => p.spreadPoints).filter(Number.isFinite);
  const last = current.points[current.points.length - 1]!;
  const lastBand = bandAtMinute(bands, last.minuteOfWeek);
  const historicalMeanAtNow = lastBand?.mean ?? null;
  const currentSpread = last.spreadPoints;
  const deviationFromMean =
    historicalMeanAtNow != null && Number.isFinite(currentSpread)
      ? currentSpread - historicalMeanAtNow
      : null;

  let outside = 0;
  let comparable = 0;
  for (const pt of current.points) {
    const band = bandAtMinute(bands, pt.minuteOfWeek);
    if (!band || band.p25 == null || band.p75 == null) continue;
    comparable++;
    if (!isInsideCorridor(pt.spreadPoints, band)) outside++;
  }

  const outsideCorridorPct =
    comparable > 0 ? Math.round((outside / comparable) * 100) : null;

  return {
    hasEnoughHistory,
    historyWeekCount,
    currentSpread,
    historicalMeanAtNow,
    deviationFromMean,
    currentWeekMax: spreads.length ? Math.max(...spreads) : null,
    currentWeekMin: spreads.length ? Math.min(...spreads) : null,
    outsideCorridorPct,
    formatted: {
      currentSpread: fmt(currentSpread),
      historicalMean: fmt(historicalMeanAtNow),
      deviation:
        deviationFromMean != null && Number.isFinite(deviationFromMean)
          ? `${deviationFromMean >= 0 ? "+" : ""}${formatPairSpreadValue(deviationFromMean, config).replace(/^\+/, "")}`
          : "—",
      max: fmt(spreads.length ? Math.max(...spreads) : null),
      min: fmt(spreads.length ? Math.min(...spreads) : null),
      outsidePct:
        outsideCorridorPct != null ? `${outsideCorridorPct}%` : "—",
    },
  };
}

export function buildWeekCompareModel(
  weeks: WeeklySpreadSeries[],
  pairKey: PointsPairKey,
): WeekCompareModel {
  const currentWeek = weeks[0] ?? null;
  const pastWeeks = weeks.slice(1);
  const bands = buildWeekCompareBands(pastWeeks);
  const stats = buildWeekCompareStats(currentWeek, pastWeeks, bands, pairKey);
  const markers = currentWeek
    ? buildWeekCompareMarkers(currentWeek, bands, 10)
    : [];

  const diagnostics: string[] = [];
  for (const w of weeks) {
    const n = w.points.length;
    const line = `${w.weekLabel}: ${n > 0 ? `${n} точек` : "нет данных"}`;
    diagnostics.push(
      w.diagnostics.contractNote ? `${line} — ${w.diagnostics.contractNote}` : line,
    );
  }
  if (!stats.hasEnoughHistory) {
    diagnostics.push("мало недель для статистики (нужно минимум 2 прошлые недели с данными).");
  }

  return {
    pairKey,
    currentWeek,
    pastWeeks,
    bands,
    markers,
    stats,
    diagnostics,
  };
}

export function snapshotAtMinute(
  model: WeekCompareModel,
  minuteOfWeek: number,
): WeekCompareSnapshot | null {
  const pt = model.currentWeek?.points.find((p) => p.minuteOfWeek === minuteOfWeek);
  if (!pt) return null;
  const band = bandAtMinute(model.bands, minuteOfWeek);
  const historicalMean = band?.mean ?? null;
  return {
    minuteOfWeek,
    currentSpread: pt.spreadPoints,
    historicalMean,
    deviationFromMean:
      historicalMean != null ? pt.spreadPoints - historicalMean : null,
  };
}
