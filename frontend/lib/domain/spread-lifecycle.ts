import type { CurrencyCorrelationFamily } from "@/lib/domain/currency-correlation";
import type { PointsPairKey } from "@/lib/domain/currency-correlation-points-model";
import type { AlignedIntradayRow } from "@/lib/domain/currency-intraday-series";
import { calcBarPointChange } from "@/lib/domain/currency-intraday-series";
import { getPairConfig } from "@/lib/domain/currency-pair-config";
import {
  calculatePairDivergence,
  DEFAULT_PAIR_Z_WINDOW,
  getPairStrengthLabel,
  type DivergenceAnchorOptions,
} from "@/lib/domain/currency-pair-divergence";
import type { SpreadAnchorResolution } from "@/lib/domain/currency-spread-anchor";
import {
  OUTSIDE_P10P90_BREAKDOWN_BARS,
  type SpreadWeeklyBarContext,
  type SpreadWeeklyContext,
  WEEKLY_CONTEXT_LABEL_RU,
  weeklyContextLabelAt,
} from "@/lib/domain/spread-lifecycle-weekly";

export type SpreadLifecycleState =
  | "normal"
  | "watch"
  | "stretch"
  | "extreme"
  | "returning"
  | "returned"
  | "breakdown"
  | "outside-week-context";

export type SpreadLifecycleEvent = {
  timestamp: string;
  pair: string;
  state: SpreadLifecycleState;
  spreadPoints: number;
  zScore: number | null;
  durationBars?: number;
  durationBarsToReturn?: number;
  label: string;
  description: string;
  weeklyContextLabel?: string;
  returnReason?: string;
};

export type SpreadLifecycleSensitivity = "soft" | "standard" | "strict";

export type SpreadLifecycleThresholds = {
  watch: number;
  stretch: number;
  extreme: number;
  breakdown: number;
  maxBarsInExtreme: number;
};

export const SPREAD_LIFECYCLE_THRESHOLDS: Record<
  SpreadLifecycleSensitivity,
  SpreadLifecycleThresholds
> = {
  soft: { watch: 1, stretch: 1.2, extreme: 1.8, breakdown: 2.6, maxBarsInExtreme: 12 },
  standard: { watch: 1, stretch: 1.5, extreme: 2, breakdown: 3, maxBarsInExtreme: 12 },
  strict: { watch: 1, stretch: 2, extreme: 2.5, breakdown: 3.5, maxBarsInExtreme: 12 },
};

export const LIFECYCLE_SENSITIVITY_LABELS: Record<SpreadLifecycleSensitivity, string> = {
  soft: "Мягкая",
  standard: "Стандарт",
  strict: "Строгая",
};

export const LIFECYCLE_BREAKDOWN_DISCLAIMER =
  "Невозврат — статистическая зона риска, а не прогноз.";

export type LifecycleMarkerKind =
  | "stretch"
  | "extreme"
  | "return"
  | "breakdown"
  | "outside-week";

export type SpreadLifecycleChartMarker = {
  time: string;
  pairKey: PointsPairKey;
  kind: LifecycleMarkerKind;
  text: string;
  color: string;
  strength: number;
};

export type SpreadPairLifecycleCurrent = {
  pairKey: PointsPairKey;
  pairLabel: string;
  familyA: CurrencyCorrelationFamily;
  familyB: CurrencyCorrelationFamily;
  currentSpread: number | null;
  currentZ: number | null;
  state: SpreadLifecycleState;
  stateLabel: string;
  leaderLabel: string;
  barsInZone: number;
  lastEvent: SpreadLifecycleEvent | null;
  weeklyContextSummary: string;
  weeklyPositionLabel: string;
  returnStatusLabel: string;
  barsOutsideNorm: number;
};

export type SpreadPairLifecycleModel = {
  pairKey: PointsPairKey;
  pairLabel: string;
  familyA: CurrencyCorrelationFamily;
  familyB: CurrencyCorrelationFamily;
  spreadRaw: number[];
  zScores: (number | null)[];
  states: SpreadLifecycleState[];
  events: SpreadLifecycleEvent[];
  chartMarkers: SpreadLifecycleChartMarker[];
  current: SpreadPairLifecycleCurrent;
  anchorResolution?: SpreadAnchorResolution;
};

const MARKER_COLORS: Record<LifecycleMarkerKind, string> = {
  stretch: "#c4b5fd",
  extreme: "#fb923c",
  return: "#34d399",
  breakdown: "#e11d48",
  "outside-week": "#22d3ee",
};

export const LIFECYCLE_STATE_CHART_COLORS: Record<SpreadLifecycleState, string> = {
  normal: "#64748b",
  watch: "#fbbf24",
  stretch: "#c4b5fd",
  extreme: "#fb923c",
  returning: "#34d399",
  returned: "#22c55e",
  breakdown: "#e11d48",
  "outside-week-context": "#22d3ee",
};

export const LIFECYCLE_STATE_LABEL_RU: Record<SpreadLifecycleState, string> = {
  normal: "норма",
  watch: "наблюдение",
  stretch: "растяжение",
  extreme: "экстрим",
  returning: "возврат",
  returned: "возврат",
  breakdown: "невозврат",
  "outside-week-context": "вне недельного контекста",
};

const Z_WINDOW = DEFAULT_PAIR_Z_WINDOW;
const CORR_WINDOW = 15;
const CORR_BREAKDOWN = 0.3;
const RETURN_DROP_RATIO = 0.7;
const RETURN_ABS_Z = 0.5;
const EXPAND_AFTER_EXTREME_BARS = 3;

function rollingCorr(a: number[], b: number[], endIdx: number, window: number): number | null {
  const start = Math.max(0, endIdx - window + 1);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = start; i <= endIdx; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    xs.push(x);
    ys.push(y);
  }
  if (xs.length < 5) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
  const my = ys.reduce((s, v) => s + v, 0) / ys.length;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const vx = xs[i]! - mx;
    const vy = ys[i]! - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  const den = Math.sqrt(dx * dy);
  if (den < 1e-12) return null;
  return num / den;
}

function leaderLabel(pairKey: PointsPairKey, spread: number | null): string {
  return getPairStrengthLabel(getPairConfig(pairKey), spread);
}

function tierFromAbsZ(absZ: number, t: SpreadLifecycleThresholds): SpreadLifecycleState {
  if (absZ >= t.breakdown) return "breakdown";
  if (absZ >= t.extreme) return "extreme";
  if (absZ >= t.stretch) return "stretch";
  if (absZ >= t.watch) return "watch";
  return "normal";
}

function markerKindForState(state: SpreadLifecycleState): LifecycleMarkerKind | null {
  if (state === "stretch") return "stretch";
  if (state === "extreme") return "extreme";
  if (state === "returning" || state === "returned") return "return";
  if (state === "breakdown") return "breakdown";
  if (state === "outside-week-context") return "outside-week";
  return null;
}

function eventMeta(
  state: SpreadLifecycleState,
  z: number | null,
  extras?: { returnReason?: string; weeklyLabel?: string },
): { label: string; description: string } {
  switch (state) {
    case "stretch":
      return {
        label: "растяжение",
        description: "Спред вышел в зону растяжения по z-score.",
      };
    case "extreme":
      return {
        label: "экстрим",
        description: "Сильное статистическое растяжение спреда.",
      };
    case "returning":
      return {
        label: extras?.returnReason ?? "возврат",
        description:
          "После растяжения движение смещается к норме (z-score, недельный коридор или средняя прошлых недель).",
      };
    case "returned":
      return {
        label: extras?.returnReason ?? "возврат",
        description: "Спред вернулся ближе к типичной зоне для этой недели.",
      };
    case "breakdown":
      return {
        label: "зона риска невозврата",
        description:
          "Статистическая зона риска: сильный z, удержание вне недельного коридора, новый экстремум или продолжающееся расширение. Невозврат — статистическая зона риска, а не прогноз.",
      };
    case "outside-week-context":
      return {
        label: "вне недельного контекста",
        description:
          extras?.weeklyLabel
            ? `Движение вышло за привычный недельный контекст (${extras.weeklyLabel}).`
            : "Движение вышло за привычный недельный контекст относительно прошлых недель.",
      };
    default:
      return { label: LIFECYCLE_STATE_LABEL_RU[state], description: "" };
  }
}

function isOutsideWeekContext(w: SpreadWeeklyBarContext | null | undefined): boolean {
  if (!w) return false;
  return (
    w.insideP10P90 === false ||
    w.exceedsPastMinuteRange ||
    w.label === "outside_week_context" ||
    w.label === "new_week_extreme"
  );
}

function crossedMean(
  spread: number,
  prevSpread: number | null,
  mean: number | null,
): boolean {
  if (mean == null || prevSpread == null || !Number.isFinite(prevSpread)) return false;
  return (prevSpread - mean) * (spread - mean) <= 0 && prevSpread !== spread;
}

function returnReasonFromSignals(
  absZ: number,
  weekly: SpreadWeeklyBarContext | null | undefined,
  crossedWeeklyMean: boolean,
): string | null {
  if (weekly?.insideP25P75 === true) return "возврат в недельный коридор";
  if (crossedWeeklyMean) return "возврат к средней зоне";
  if (absZ <= RETURN_ABS_Z) return "возврат к средней зоне";
  return null;
}

function returnStatusLabel(
  state: SpreadLifecycleState,
  wasStretched: boolean,
): string {
  if (state === "returned") return "Вернулось";
  if (state === "returning") return "Возврат в процессе";
  if (state === "breakdown") return "Не вернулось";
  if (wasStretched && (state === "stretch" || state === "extreme")) return "Не вернулось";
  return "—";
}

function toChartTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(0, 10);
  return String(Math.floor(ms / 1000));
}

function selectChartMarkers(
  events: SpreadLifecycleEvent[],
  pairKey: PointsPairKey,
  max = 12,
): SpreadLifecycleChartMarker[] {
  const priority: Record<LifecycleMarkerKind, number> = {
    breakdown: 5,
    extreme: 4,
    return: 3,
    stretch: 2,
    "outside-week": 1,
  };

  const candidates = events
    .map((ev) => {
      const kind = markerKindForState(ev.state);
      if (!kind) return null;
      const meta = eventMeta(ev.state, ev.zScore);
      return {
        time: toChartTime(ev.timestamp),
        pairKey,
        kind,
        text: meta.label,
        color: MARKER_COLORS[kind],
        strength: Math.abs(ev.zScore ?? 0),
        priority: priority[kind],
        ts: Date.parse(ev.timestamp),
      };
    })
    .filter((m): m is NonNullable<typeof m> => m != null);

  candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (b.strength !== a.strength) return b.strength - a.strength;
    return b.ts - a.ts;
  });

  const seen = new Set<string>();
  const out: SpreadLifecycleChartMarker[] = [];
  for (const c of candidates) {
    const key = `${c.time}-${c.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      time: c.time,
      pairKey: c.pairKey,
      kind: c.kind,
      text: c.text,
      color: c.color,
      strength: c.strength,
    });
    if (out.length >= max) break;
  }
  return out;
}

export function analyzeSpreadPairLifecycle(
  aligned: AlignedIntradayRow[],
  pairKey: PointsPairKey,
  familyA: CurrencyCorrelationFamily,
  familyB: CurrencyCorrelationFamily,
  sensitivity: SpreadLifecycleSensitivity = "standard",
  hedgeRatio = 1,
  anchorOptions?: DivergenceAnchorOptions,
  anchorResolution?: SpreadAnchorResolution,
  weeklyContext?: SpreadWeeklyContext | null,
): SpreadPairLifecycleModel | null {
  if (aligned.length < 5) return null;

  const t = SPREAD_LIFECYCLE_THRESHOLDS[sensitivity];
  const pairLabel = pairKey.replace("/", " − ");

  const divergence = calculatePairDivergence(
    aligned,
    pairKey,
    hedgeRatio,
    Z_WINDOW,
    anchorOptions,
  );
  if (!divergence) return null;

  const spreadRaw = divergence.spread;
  const zScores = divergence.zScores;
  const deltaA = calcBarPointChange(aligned, familyA);
  const deltaB = calcBarPointChange(aligned, familyB);

  const n = aligned.length;
  const states: SpreadLifecycleState[] = new Array(n).fill("normal");
  const events: SpreadLifecycleEvent[] = [];

  let peakAbsZ = 0;
  let wasStretched = false;
  let stretchStartIdx: number | null = null;
  let extremeStreak = 0;
  let expandStreak = 0;
  let outsideP10Streak = 0;
  let prevAbsSpread: number | null = null;
  let prevSpread: number | null = null;
  let prevCorr: number | null = null;

  for (let i = 0; i < n; i++) {
    const z = zScores[i];
    const sp = spreadRaw[i]!;
    const absZ = z != null && Number.isFinite(z) ? Math.abs(z) : 0;
    const absSpread = Number.isFinite(sp) ? Math.abs(sp) : 0;
    const weeklyBar = weeklyContext?.perBar[i] ?? null;
    const weeklyLabel = weeklyBar ? WEEKLY_CONTEXT_LABEL_RU[weeklyBar.label] : undefined;

    let state = z != null ? tierFromAbsZ(absZ, t) : "normal";

    if (z != null && absZ >= t.extreme) extremeStreak++;
    else extremeStreak = 0;

    if (z != null && absZ >= t.extreme && prevAbsSpread != null && absSpread > prevAbsSpread) {
      expandStreak++;
    } else if (z != null && absZ >= t.extreme) {
      expandStreak = 1;
    } else {
      expandStreak = 0;
    }

    if (weeklyBar?.insideP10P90 === false) outsideP10Streak++;
    else outsideP10Streak = 0;

    const corr = rollingCorr(deltaA, deltaB, i, CORR_WINDOW);
    const corrCollapse =
      corr != null &&
      prevCorr != null &&
      prevCorr >= 0.45 &&
      corr < CORR_BREAKDOWN;

    const weeklyBreakdown =
      outsideP10Streak >= OUTSIDE_P10P90_BREAKDOWN_BARS ||
      weeklyBar?.isNewWeekExtreme === true;

    const breakdown =
      (z != null && absZ >= t.breakdown) ||
      extremeStreak >= t.maxBarsInExtreme ||
      corrCollapse ||
      expandStreak >= EXPAND_AFTER_EXTREME_BARS ||
      weeklyBreakdown;

    if (absZ >= t.stretch) {
      wasStretched = true;
      peakAbsZ = Math.max(peakAbsZ, absZ);
      if (stretchStartIdx == null) stretchStartIdx = i;
    }

    const weeklyMean = weeklyBar?.historicalMean ?? null;
    const crossedWeeklyMean = crossedMean(sp, prevSpread, weeklyMean);
    const returnReason =
      wasStretched && peakAbsZ >= t.stretch && z != null
        ? returnReasonFromSignals(absZ, weeklyBar, crossedWeeklyMean)
        : null;

    if (wasStretched && peakAbsZ >= t.stretch && z != null) {
      const inWeeklyCorridor = weeklyBar?.insideP25P75 === true;
      if (
        returnReason != null ||
        absZ <= RETURN_ABS_Z ||
        inWeeklyCorridor ||
        crossedWeeklyMean ||
        (z > 0 && zScores[i - 1] != null && z * zScores[i - 1]! < 0)
      ) {
        state =
          absZ <= RETURN_ABS_Z || inWeeklyCorridor || returnReason != null
            ? "returned"
            : "returning";
      } else if (absZ <= peakAbsZ * RETURN_DROP_RATIO && absZ < peakAbsZ) {
        state = "returning";
      }
    }

    if (breakdown) {
      state = "breakdown";
    } else if (
      state === "normal" ||
      state === "watch"
    ) {
      if (isOutsideWeekContext(weeklyBar)) {
        state = "outside-week-context";
      }
    }

    states[i] = state;

    if (i > 0 && state !== states[i - 1]) {
      const notable: SpreadLifecycleState[] = [
        "stretch",
        "extreme",
        "returning",
        "returned",
        "breakdown",
        "outside-week-context",
      ];
      if (notable.includes(state)) {
        const meta = eventMeta(state, z, {
          returnReason: returnReason ?? undefined,
          weeklyLabel,
        });
        let durationBarsToReturn: number | undefined;
        if (
          (state === "returning" || state === "returned") &&
          stretchStartIdx != null
        ) {
          durationBarsToReturn = i - stretchStartIdx;
        }
        events.push({
          timestamp: aligned[i]!.timestamp,
          pair: pairLabel,
          state,
          spreadPoints: sp,
          zScore: z,
          label: meta.label,
          description: meta.description,
          weeklyContextLabel: weeklyLabel,
          returnReason: returnReason ?? undefined,
          durationBarsToReturn,
        });
      }
    }

    prevAbsSpread = absSpread;
    prevSpread = sp;
    prevCorr = corr;
  }

  const lastIdx = n - 1;
  const lastZ = zScores[lastIdx];
  const lastSp = spreadRaw[lastIdx]!;
  const lastState = states[lastIdx]!;

  let barsInZone = 0;
  for (let i = lastIdx; i >= 0; i--) {
    if (states[i] === lastState) barsInZone++;
    else break;
  }

  const lastEvent = events.length ? events[events.length - 1]! : null;

  let barsOutsideNorm = 0;
  for (let i = lastIdx; i >= 0; i--) {
    const w = weeklyContext?.perBar[i];
    if (w && w.label !== "inside_norm") barsOutsideNorm++;
    else if (weeklyContext?.hasHistory) break;
    else if (states[i] === "outside-week-context" || states[i] === "breakdown") barsOutsideNorm++;
    else break;
  }

  const weeklyPositionLabel = weeklyContextLabelAt(weeklyContext, lastIdx);
  const weeklyContextSummary = weeklyContext?.hasHistory
    ? weeklyPositionLabel
    : "мало недель для статистики";

  const current: SpreadPairLifecycleCurrent = {
    pairKey,
    pairLabel,
    familyA,
    familyB,
    currentSpread: Number.isFinite(lastSp) ? lastSp : null,
    currentZ: lastZ,
    state: lastState,
    stateLabel: LIFECYCLE_STATE_LABEL_RU[lastState],
    leaderLabel: leaderLabel(pairKey, lastSp),
    barsInZone,
    lastEvent,
    weeklyContextSummary,
    weeklyPositionLabel,
    returnStatusLabel: returnStatusLabel(lastState, wasStretched),
    barsOutsideNorm,
  };

  return {
    pairKey,
    pairLabel,
    familyA,
    familyB,
    spreadRaw,
    zScores,
    states,
    events,
    chartMarkers: selectChartMarkers(events, pairKey),
    current,
    anchorResolution,
  };
}

export function pickGlobalLifecycleMarkers(
  byPair: Partial<Record<PointsPairKey, SpreadPairLifecycleModel>>,
  selectedPair: PointsPairKey | null,
  max = 12,
): SpreadLifecycleChartMarker[] {
  if (selectedPair && byPair[selectedPair]) {
    return byPair[selectedPair]!.chartMarkers.slice(0, max);
  }
  const all = Object.values(byPair).flatMap((m) => m?.chartMarkers ?? []);
  all.sort((a, b) => b.strength - a.strength);
  return all.slice(0, max);
}

export const LIFECYCLE_ZONE_LEVELS = [
  { z: 0, label: "средняя зона", color: "rgba(34,211,238,0.55)" },
  { z: 1.5, label: "наблюдение", color: "rgba(251,191,36,0.35)" },
  { z: -1.5, label: "наблюдение", color: "rgba(251,191,36,0.35)" },
  { z: 2, label: "растяжение", color: "rgba(167,139,250,0.4)" },
  { z: -2, label: "растяжение", color: "rgba(167,139,250,0.4)" },
  { z: 3, label: "зона слома", color: "rgba(248,113,113,0.45)" },
  { z: -3, label: "зона слома", color: "rgba(248,113,113,0.45)" },
] as const;
