import type { StrategyCandle } from "@/lib/screener/strategies/strategy-candles";
import type { RoundLevel } from "@/lib/strategies/round-levels-engine";
import type {
  RoundLevelReactionResult,
  RoundLevelTechnicalityStats,
  RoundLevelTouchEvent,
} from "@/lib/strategies/round-level-reaction-engine";

export const PRELIMINARY_STATS_MIN_CANDLES = 100;
export const PRELIMINARY_STATS_MIN_TOUCHES = 20;
export const MAX_REACTION_CHART_MARKERS = 80;
export const MAX_REACTION_CHART_MARKERS_ALL = 120;

const EPS = 1e-6;

const OUTCOME_PRIORITY: Record<RoundLevelTouchEvent["outcome"], number> = {
  bounce: 30,
  false_break: 26,
  breakout: 24,
  chop: 10,
  pending: 0,
};

const IMPORTANCE_PRIORITY: Record<RoundLevel["importance"], number> = {
  psychological: 80,
  major: 60,
  normal: 20,
  minor: -40,
};

export type ReactionTotals = {
  touches: number;
  bounces: number;
  breakouts: number;
  falseBreaks: number;
  chop: number;
  bounceRate: number;
};

export function isPreliminaryReactionStats(candleCount: number, totalTouches: number): boolean {
  return candleCount < PRELIMINARY_STATS_MIN_CANDLES || totalTouches < PRELIMINARY_STATS_MIN_TOUCHES;
}

export function reactionTotalsFromStats(stats: RoundLevelTechnicalityStats[]): ReactionTotals {
  const touches = stats.reduce((sum, item) => sum + item.touches, 0);
  const bounces = stats.reduce((sum, item) => sum + item.bounceCount, 0);
  const breakouts = stats.reduce((sum, item) => sum + item.breakoutCount, 0);
  const falseBreaks = stats.reduce((sum, item) => sum + item.falseBreakCount, 0);
  const chop = stats.reduce((sum, item) => sum + item.chopCount, 0);

  return {
    touches,
    bounces,
    breakouts,
    falseBreaks,
    chop,
    bounceRate: touches > 0 ? bounces / touches : 0,
  };
}

export function reactionTotalsFromResult(result: RoundLevelReactionResult | null): ReactionTotals {
  if (!result) {
    return { touches: 0, bounces: 0, breakouts: 0, falseBreaks: 0, chop: 0, bounceRate: 0 };
  }
  return reactionTotalsFromStats(result.stats);
}

export function isMarkerEligibleLevel(
  level: Pick<RoundLevel, "price" | "importance">,
  selectedLevelPrice: number | null,
): boolean {
  return selectedLevelPrice != null && Math.abs(level.price - selectedLevelPrice) < EPS;
}

function levelMeta(
  touch: RoundLevelTouchEvent,
  levelsByPrice: Map<number, RoundLevel>,
): RoundLevel | null {
  for (const [price, level] of levelsByPrice) {
    if (Math.abs(price - touch.level) < EPS) return level;
  }
  return null;
}

function markerScore(
  touch: RoundLevelTouchEvent,
  levelsByPrice: Map<number, RoundLevel>,
  selectedLevelPrice: number | null,
): number {
  const level = levelMeta(touch, levelsByPrice);
  let score = OUTCOME_PRIORITY[touch.outcome] ?? 0;

  if (level) {
    score += IMPORTANCE_PRIORITY[level.importance] ?? 0;
    if (selectedLevelPrice != null && Math.abs(level.price - selectedLevelPrice) < EPS) {
      score += 200;
    }
  }

  return score;
}

/** Chart markers: selected level only, max 80, drop low-priority when capped. */
export function filterTouchesForChartMarkers(
  touches: RoundLevelTouchEvent[],
  levels: RoundLevel[],
  selectedLevelPrice: number | null,
  maxMarkers = MAX_REACTION_CHART_MARKERS,
  options?: {
    mode?: "selected" | "all";
  },
): RoundLevelTouchEvent[] {
  const levelsByPrice = new Map(levels.map((level) => [level.price, level]));
  const mode = options?.mode ?? "selected";

  const eligible = touches.filter((touch) => {
    if (touch.outcome === "pending") return false;
    const level = levelMeta(touch, levelsByPrice);
    if (!level) return false;
    if (mode === "all") return true;
    return isMarkerEligibleLevel(level, selectedLevelPrice);
  });

  const ranked = [...eligible].sort(
    (a, b) =>
      a.touchIndex - b.touchIndex ||
      markerScore(b, levelsByPrice, selectedLevelPrice) -
        markerScore(a, levelsByPrice, selectedLevelPrice),
  );
  return ranked.slice(-maxMarkers);
}

export type ReactionChartMarker = {
  id: string;
  time: number;
  position: "aboveBar" | "belowBar";
  color: string;
  shape: "circle" | "square" | "arrowUp" | "arrowDown";
  text: string;
};

export function buildReactionChartMarkers(
  touches: RoundLevelTouchEvent[],
  candles: StrategyCandle[],
  focusedTouchEventId?: string | null,
): ReactionChartMarker[] {
  return touches.map((touch) => {
    const decisionIndex =
      touch.barsToDecision != null && Number.isFinite(touch.barsToDecision)
        ? Math.min(candles.length - 1, touch.touchIndex + Math.max(0, touch.barsToDecision))
        : touch.touchIndex;
    const candle = candles[decisionIndex] ?? candles[touch.touchIndex];
    const time = typeof candle?.time === "number" ? candle.time : touch.touchTime;
    const isFocused = focusedTouchEventId != null && touch.id === focusedTouchEventId;

    const color =
      touch.outcome === "bounce"
        ? isFocused
          ? "rgba(34,211,238,0.98)"
          : "rgba(34,197,94,0.82)"
        : touch.outcome === "breakout"
          ? isFocused
            ? "rgba(251,191,36,0.96)"
            : "rgba(248,113,113,0.82)"
          : touch.outcome === "false_break"
            ? isFocused
              ? "rgba(34,211,238,0.98)"
              : "rgba(251,191,36,0.82)"
            : "rgba(148,163,184,0.55)";

    const shape =
      touch.outcome === "bounce"
        ? ("circle" as const)
        : touch.outcome === "breakout"
          ? ("square" as const)
          : touch.outcome === "false_break"
            ? ("arrowUp" as const)
            : ("circle" as const);

    const text =
      touch.outcome === "bounce"
        ? "О"
        : touch.outcome === "breakout"
          ? "П"
          : touch.outcome === "false_break"
            ? "Л"
            : "·";

    return {
      id: touch.id,
      time,
      position:
        touch.outcome === "bounce"
          ? touch.approach === "from_below"
            ? ("aboveBar" as const)
            : ("belowBar" as const)
          : touch.outcome === "breakout"
            ? touch.approach === "from_below"
              ? ("belowBar" as const)
              : ("aboveBar" as const)
            : touch.approach === "from_below"
              ? ("aboveBar" as const)
              : ("belowBar" as const),
      color,
      shape,
      text,
    };
  });
}

export function selectedLevelTouchCount(
  result: RoundLevelReactionResult | null,
  selectedLevelPrice: number | null,
): number {
  if (!result || selectedLevelPrice == null) return 0;
  return result.touches.filter(
    (touch) =>
      touch.outcome !== "pending" && Math.abs(touch.level - selectedLevelPrice) < EPS,
  ).length;
}
