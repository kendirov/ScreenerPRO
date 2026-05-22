import type { PointsPairKey } from "@/lib/domain/currency-correlation-points-model";
import type { AlignedIntradayRow } from "@/lib/domain/currency-intraday-series";
import {
  LIFECYCLE_BREAKDOWN_DISCLAIMER,
  LIFECYCLE_STATE_LABEL_RU,
  type SpreadLifecycleEvent,
  type SpreadLifecycleState,
  type SpreadPairLifecycleModel,
} from "@/lib/domain/spread-lifecycle";
import {
  barsBetweenTimestamps,
  durationLabelFromAnchor,
  SPREAD_ANCHOR_MODE_LABELS,
} from "@/lib/domain/currency-spread-anchor";
import { LIFECYCLE_STATE_CHART_COLORS } from "@/lib/domain/spread-lifecycle";

export type TrajectoryPathStep = {
  stageKey: string;
  stageLabel: string;
  timeLabel: string;
  timestamp: string;
  zScore: number | null;
  spreadPoints: number;
  durationBars: number;
};

export type TrajectoryReturnStats = {
  stretchCount: number;
  returnCount: number;
  breakdownCount: number;
  avgBarsToReturn: number | null;
  maxAbsZ: number | null;
  avgSpreadOnStretch: number | null;
  fewObservations: boolean;
};

export type TrajectoryJournalRow = {
  timestamp: string;
  timeLabel: string;
  pair: string;
  eventLabel: string;
  state: SpreadLifecycleState;
  spreadPoints: number;
  zScore: number | null;
  durationBars: number | null;
  durationBarsToReturn: number | null;
  anchorModeLabel: string;
  durationFromAnchor: string;
  spreadFromAnchor: number;
  weeklyContextLabel: string;
};

export type TrajectoryTooltipSnapshot = {
  timeLabel: string;
  spreadPoints: number | null;
  zScore: number | null;
  state: SpreadLifecycleState;
  stateLabel: string;
  barsInState: number;
  nearestZone: string;
};

export type TrajectorySegmentSeries = {
  state: SpreadLifecycleState;
  color: string;
  label: string;
  data: { time: string; value: number }[];
};

export type SpreadTrajectoryBundle = {
  pairKey: PointsPairKey;
  pairLabel: string;
  pathSteps: TrajectoryPathStep[];
  pathSummary: string;
  returnStats: TrajectoryReturnStats;
  journal: TrajectoryJournalRow[];
  segmentSeries: TrajectorySegmentSeries[];
  tooltipIndex: Map<string, TrajectoryTooltipSnapshot>;
};

const PATH_STAGE_LABEL: Record<string, string> = {
  start: "старт",
  stretch: "растяжение",
  extreme: "экстрим",
  returning: "возврат",
  returned: "возврат",
  breakdown: "невозврат",
  "outside-week-context": "вне недельного контекста",
};

function formatTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toChartTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(0, 10);
  return String(Math.floor(ms / 1000));
}

export function nearestZoneLabel(z: number | null): string {
  if (z == null || !Number.isFinite(z)) return "—";
  const abs = Math.abs(z);
  if (abs >= 3) return "зона слома";
  if (abs >= 2) return "растяжение";
  if (abs >= 1.5) return "наблюдение";
  if (abs < 0.5) return "возврат к средней";
  return "средняя зона";
}

function eventDurationBars(
  eventIdx: number,
  events: SpreadLifecycleEvent[],
  states: SpreadLifecycleState[],
  totalBars: number,
): number {
  const ts = Date.parse(events[eventIdx]!.timestamp);
  const next = events[eventIdx + 1];
  if (next) {
    const endTs = Date.parse(next.timestamp);
    return Math.max(1, Math.round((endTs - ts) / 60_000));
  }
  let count = 0;
  const st = events[eventIdx]!.state;
  for (let i = states.length - 1; i >= 0; i--) {
    if (states[i] === st) count++;
    else if (count > 0) break;
  }
  return count || 1;
}

function buildPathSteps(
  lifecycle: SpreadPairLifecycleModel,
  aligned: AlignedIntradayRow[],
  chartTimes: string[],
): TrajectoryPathStep[] {
  const steps: TrajectoryPathStep[] = [];
  if (!aligned.length) return steps;

  const firstZ = lifecycle.zScores[0];
  const firstSp = lifecycle.spreadRaw[0]!;
  steps.push({
    stageKey: "start",
    stageLabel: PATH_STAGE_LABEL.start!,
    timeLabel: formatTimeLabel(aligned[0]!.timestamp).slice(-5),
    timestamp: aligned[0]!.timestamp,
    zScore: firstZ,
    spreadPoints: firstSp,
    durationBars: 0,
  });

  const seen = new Set<string>(["start"]);
  for (let i = 0; i < lifecycle.events.length; i++) {
    const ev = lifecycle.events[i]!;
    const key =
      ev.state === "returning" || ev.state === "returned"
        ? "return"
        : ev.state === "breakdown"
          ? "breakdown"
          : ev.state === "outside-week-context"
            ? "outside-week-context"
            : ev.state;
    if (seen.has(key) && key !== "extreme") continue;
    seen.add(key);

    steps.push({
      stageKey: key,
      stageLabel: PATH_STAGE_LABEL[key] ?? ev.label,
      timeLabel: formatTimeLabel(ev.timestamp).slice(-5),
      timestamp: ev.timestamp,
      zScore: ev.zScore,
      spreadPoints: ev.spreadPoints,
      durationBars: eventDurationBars(i, lifecycle.events, lifecycle.states, aligned.length),
    });
  }

  const lastState = lifecycle.states[lifecycle.states.length - 1]!;
  if (lastState === "breakdown" && !seen.has("breakdown")) {
    const idx = lifecycle.states.length - 1;
    steps.push({
      stageKey: "breakdown",
      stageLabel: PATH_STAGE_LABEL.breakdown!,
      timeLabel: formatTimeLabel(aligned[idx]!.timestamp).slice(-5),
      timestamp: aligned[idx]!.timestamp,
      zScore: lifecycle.zScores[idx],
      spreadPoints: lifecycle.spreadRaw[idx]!,
      durationBars: lifecycle.current.barsInZone,
    });
  }

  return steps;
}

function buildPathSummary(steps: TrajectoryPathStep[]): string {
  const chain: string[] = [];
  for (const s of steps) {
    const label = s.stageLabel;
    if (chain.length === 0 || chain[chain.length - 1] !== label) {
      chain.push(label);
    }
  }
  return chain.join(" → ");
}

function computeReturnStats(lifecycle: SpreadPairLifecycleModel): TrajectoryReturnStats {
  const { states, spreadRaw, zScores, events } = lifecycle;

  const stretchCount = events.filter((e) => e.state === "stretch").length;
  const returnCount = events.filter(
    (e) => e.state === "returning" || e.state === "returned",
  ).length;
  const breakdownCount = events.filter((e) => e.state === "breakdown").length;

  let episodeBars = 0;
  let episodes = 0;
  let maxAbsZ = 0;
  const stretchSpreads: number[] = [];

  for (let i = 0; i < states.length; i++) {
    const z = zScores[i];
    if (z != null && Number.isFinite(z)) maxAbsZ = Math.max(maxAbsZ, Math.abs(z));
    if (states[i] === "stretch" || states[i] === "extreme") {
      const sp = spreadRaw[i]!;
      if (Number.isFinite(sp)) stretchSpreads.push(Math.abs(sp));
    }
  }

  let i = 0;
  while (i < states.length) {
    if (states[i] === "stretch" || states[i] === "extreme") {
      const start = i;
      let j = i + 1;
      while (j < states.length) {
        const s = states[j]!;
        if (s === "breakdown") break;
        if (s === "returning" || s === "returned") {
          episodeBars += j - start;
          episodes++;
          i = j;
          break;
        }
        j++;
      }
      if (j >= states.length) break;
      if (states[j] !== "returning" && states[j] !== "returned") i++;
    } else {
      i++;
    }
  }

  const totalNotable = stretchCount + returnCount + breakdownCount;
  const fewObservations = totalNotable < 2 && episodes === 0;

  const avgSpreadOnStretch =
    stretchSpreads.length > 0
      ? stretchSpreads.reduce((a, b) => a + b, 0) / stretchSpreads.length
      : null;

  return {
    stretchCount,
    returnCount,
    breakdownCount,
    avgBarsToReturn: episodes > 0 ? Math.round(episodeBars / episodes) : null,
    maxAbsZ: maxAbsZ > 0 ? maxAbsZ : null,
    avgSpreadOnStretch,
    fewObservations,
  };
}

export function buildLifecycleJournal(
  lifecycle: SpreadPairLifecycleModel,
  intervalMinutes: number,
): TrajectoryJournalRow[] {
  const anchor = lifecycle.anchorResolution;
  const anchorTs = anchor?.timestamp ?? lifecycle.events[0]?.timestamp ?? "";
  const anchorModeLabel = anchor
    ? SPREAD_ANCHOR_MODE_LABELS[anchor.effectiveMode]
    : SPREAD_ANCHOR_MODE_LABELS["period-start"];

  return lifecycle.events.map((ev, i) => {
    const barsFromAnchor = anchorTs
      ? barsBetweenTimestamps(anchorTs, ev.timestamp, intervalMinutes)
      : 0;
    return {
      timestamp: ev.timestamp,
      timeLabel: formatTimeLabel(ev.timestamp),
      pair: ev.pair,
      eventLabel: ev.returnReason ?? ev.label,
      state: ev.state,
      spreadPoints: ev.spreadPoints,
      zScore: ev.zScore,
      durationBars: eventDurationBars(
        i,
        lifecycle.events,
        lifecycle.states,
        lifecycle.states.length,
      ),
      durationBarsToReturn: ev.durationBarsToReturn ?? null,
      anchorModeLabel,
      durationFromAnchor: durationLabelFromAnchor(barsFromAnchor, intervalMinutes),
      spreadFromAnchor: ev.spreadPoints,
      weeklyContextLabel: ev.weeklyContextLabel ?? "—",
    };
  });
}

export { LIFECYCLE_BREAKDOWN_DISCLAIMER };

export function buildSegmentSeries(
  chartTimes: string[],
  zScores: (number | null)[],
  states: SpreadLifecycleState[],
): TrajectorySegmentSeries[] {
  if (!chartTimes.length) return [];

  const segments: TrajectorySegmentSeries[] = [];
  let runState = states[0] ?? "normal";
  let runStart = 0;

  const pushSegment = (state: SpreadLifecycleState, from: number, to: number) => {
    const data: { time: string; value: number }[] = [];
    for (let j = from; j <= to; j++) {
      const z = zScores[j];
      if (z == null || !Number.isFinite(z)) continue;
      data.push({ time: chartTimes[j]!, value: z });
    }
    if (data.length < 1) return;
    segments.push({
      state,
      color: LIFECYCLE_STATE_CHART_COLORS[state],
      label: LIFECYCLE_STATE_LABEL_RU[state],
      data,
    });
  };

  for (let i = 1; i <= chartTimes.length; i++) {
    const nextState = i < chartTimes.length ? states[i] : null;
    if (i === chartTimes.length || nextState !== runState) {
      pushSegment(runState, runStart, i - 1);
      if (i < chartTimes.length && nextState != null) {
        const z = zScores[i - 1];
        const zNext = zScores[i];
        if (
          z != null &&
          zNext != null &&
          Number.isFinite(z) &&
          Number.isFinite(zNext) &&
          segments.length > 0
        ) {
          const last = segments[segments.length - 1]!;
          last.data.push({ time: chartTimes[i]!, value: zNext });
        }
        runState = nextState;
        runStart = i - 1;
      }
    }
  }

  return segments;
}

function buildTooltipIndex(
  aligned: AlignedIntradayRow[],
  chartTimes: string[],
  lifecycle: SpreadPairLifecycleModel,
): Map<string, TrajectoryTooltipSnapshot> {
  const map = new Map<string, TrajectoryTooltipSnapshot>();
  for (let i = 0; i < aligned.length; i++) {
    const state = lifecycle.states[i] ?? "normal";
    let barsInState = 0;
    for (let j = i; j >= 0; j--) {
      if (lifecycle.states[j] === state) barsInState++;
      else break;
    }
    const z = lifecycle.zScores[i];
    map.set(chartTimes[i]!, {
      timeLabel: formatTimeLabel(aligned[i]!.timestamp),
      spreadPoints: lifecycle.spreadRaw[i] ?? null,
      zScore: z,
      state,
      stateLabel: LIFECYCLE_STATE_LABEL_RU[state],
      barsInState,
      nearestZone: nearestZoneLabel(z),
    });
  }
  return map;
}

export function buildSpreadTrajectoryBundle(
  lifecycle: SpreadPairLifecycleModel | null | undefined,
  aligned: AlignedIntradayRow[],
  chartTimes: string[],
  intervalMinutes = 10,
): SpreadTrajectoryBundle | null {
  if (!lifecycle || !aligned.length || chartTimes.length < 2) return null;

  const pathSteps = buildPathSteps(lifecycle, aligned, chartTimes);
  return {
    pairKey: lifecycle.pairKey,
    pairLabel: lifecycle.pairLabel,
    pathSteps,
    pathSummary: buildPathSummary(pathSteps),
    returnStats: computeReturnStats(lifecycle),
    journal: buildLifecycleJournal(lifecycle, intervalMinutes),
    segmentSeries: buildSegmentSeries(chartTimes, lifecycle.zScores, lifecycle.states),
    tooltipIndex: buildTooltipIndex(aligned, chartTimes, lifecycle),
  };
}

export type JournalFilter = "all" | "return" | "breakdown" | "extreme";

export function filterJournal(
  rows: TrajectoryJournalRow[],
  filter: JournalFilter,
): TrajectoryJournalRow[] {
  if (filter === "all") return rows;
  if (filter === "return") {
    return rows.filter((r) => r.state === "returning" || r.state === "returned");
  }
  if (filter === "breakdown") {
    return rows.filter(
      (r) => r.state === "breakdown" || r.state === "outside-week-context",
    );
  }
  return rows.filter((r) => r.state === "extreme");
}
