import type { StrategyCandle } from "@/lib/screener/strategies/strategy-candles";
import type { RoundLevel, RoundLevelImportance } from "@/lib/strategies/round-levels-engine";

export type RoundLevelOutcome =
  | "bounce"
  | "breakout"
  | "false_break"
  | "chop"
  | "pending";

export type RoundLevelApproach = "from_above" | "from_below" | "inside";

export type RoundLevelTouchEvent = {
  id: string;
  level: number;
  levelType: RoundLevelImportance;
  touchTime: number;
  touchIndex: number;
  approach: RoundLevelApproach;

  entryPrice: number;
  bufferFrom: number;
  bufferTo: number;

  maxDiveAbs: number;
  maxDivePct: number;
  maxBounceAbs: number;
  maxBouncePct: number;

  barsToMaxDive?: number;
  barsToMaxBounce?: number;
  barsToDecision?: number;

  outcome: RoundLevelOutcome;
  volumeRatio?: number;
  cleanlinessScore: number;
};

export type RoundLevelTechnicalityStats = {
  level: number;
  touches: number;
  bounceCount: number;
  breakoutCount: number;
  falseBreakCount: number;
  chopCount: number;
  bounceRate: number;
  breakoutRate: number;
  falseBreakRate: number;
  chopRate: number;
  avgMaxDiveAbs: number;
  avgMaxDivePct: number;
  avgMaxBounceAbs: number;
  avgMaxBouncePct: number;
  avgBarsToDecision: number;
  avgVolumeRatio?: number;
  technicalityScore: number;
};

export type RoundLevelReactionSummary = {
  totalTouches: number;
  bounceRate: number;
  breakoutRate: number;
  falseBreakRate: number;
  chopRate: number;
  avgBounce: number;
  avgDive: number;
  bestLevels: RoundLevelTechnicalityStats[];
  worstLevels: RoundLevelTechnicalityStats[];
  instrumentTechnicalityScore: number;
  scoreComponents: {
    levels: number;
    sample: number;
    clarity: number;
    lowChop: number;
    speed: number;
  };
  sampleWarning?: string;
};

export type RoundLevelReactionOptions = {
  intervalMinutes?: 5 | 10 | 30;
  reactionWindow?: number;
  volumeLookback?: number;
  minTouchesForRanking?: number;
  bestWorstLimit?: number;
};

export type RoundLevelReactionResult = {
  touches: RoundLevelTouchEvent[];
  stats: RoundLevelTechnicalityStats[];
  summary: RoundLevelReactionSummary;
};

/** @deprecated use RoundLevelApproach */
export type LevelTouchDirection = RoundLevelApproach;
/** @deprecated use RoundLevelOutcome */
export type LevelReactionType = RoundLevelOutcome;
/** @deprecated use RoundLevelTouchEvent */
export type LevelTouch = RoundLevelTouchEvent;
/** @deprecated use RoundLevelTechnicalityStats */
export type LevelReactionStats = RoundLevelTechnicalityStats;

const SAMPLE_MIN_CANDLES = 100;
const SAMPLE_MIN_TOUCHES = 20;

const DEFAULT_OPTIONS: Required<Omit<RoundLevelReactionOptions, "intervalMinutes">> & {
  intervalMinutes: 5 | 10 | 30;
} = {
  intervalMinutes: 5,
  reactionWindow: 8,
  volumeLookback: 20,
  minTouchesForRanking: 1,
  bestWorstLimit: 3,
};

const BOUNCE_MULT = 1.5;
const DIVE_MAX_MULT = 1.2;
const FALSE_BOUNCE_MULT = 1.2;
const CONTINUATION_MULT = 1.5;

function isValidCandle(candle: StrategyCandle): boolean {
  return [candle.open, candle.high, candle.low, candle.close].every(
    (value) => typeof value === "number" && Number.isFinite(value),
  );
}

function reactionWindowForInterval(intervalMinutes: 5 | 10 | 30): number {
  if (intervalMinutes === 10) return 6;
  if (intervalMinutes === 30) return 4;
  return 8;
}

function levelBufferSize(level: RoundLevel): number {
  return level.upperBuffer.to - level.price;
}

function touchZone(level: RoundLevel): { low: number; high: number } {
  const buffer = levelBufferSize(level);
  return { low: level.price - buffer, high: level.price + buffer };
}

function candleIntersectsTouchZone(candle: StrategyCandle, level: RoundLevel): boolean {
  const zone = touchZone(level);
  return candle.high >= zone.low && candle.low <= zone.high;
}

function resolveApproach(prevClose: number, level: RoundLevel): RoundLevelApproach {
  const zone = touchZone(level);
  if (prevClose > zone.high) return "from_above";
  if (prevClose < zone.low) return "from_below";
  return "inside";
}

function medianVolume(candles: StrategyCandle[], index: number, lookback: number): number | null {
  const start = Math.max(0, index - lookback + 1);
  const slice = candles
    .slice(start, index + 1)
    .map((candle) => candle.volume)
    .filter((volume): volume is number => volume != null && Number.isFinite(volume) && volume > 0);

  if (slice.length === 0) return null;

  const sorted = [...slice].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function pctOfLevel(value: number, levelPrice: number): number {
  if (!Number.isFinite(value) || levelPrice <= 0) return 0;
  return (value / levelPrice) * 100;
}

function isConsolidatedBelow(level: RoundLevel, future: StrategyCandle[], buffer: number): boolean {
  const breakLine = level.lowerBuffer.from;
  const closesBeyond = future.filter((candle) => candle.close < breakLine);
  if (closesBeyond.length >= 2) return true;
  const last = future[future.length - 1];
  if (!last) return false;
  return last.close < breakLine && breakLine - last.close >= buffer * CONTINUATION_MULT;
}

function isConsolidatedAbove(level: RoundLevel, future: StrategyCandle[], buffer: number): boolean {
  const breakLine = level.upperBuffer.to;
  const closesBeyond = future.filter((candle) => candle.close > breakLine);
  if (closesBeyond.length >= 2) return true;
  const last = future[future.length - 1];
  if (!last) return false;
  return last.close > breakLine && last.close - breakLine >= buffer * CONTINUATION_MULT;
}

type MovementMetrics = {
  maxDiveAbs: number;
  maxBounceAbs: number;
  barsToMaxDive?: number;
  barsToMaxBounce?: number;
};

function measureFromAbove(level: RoundLevel, future: StrategyCandle[]): MovementMetrics {
  const breakLine = level.lowerBuffer.from;
  let maxDiveAbs = 0;
  let maxBounceAbs = 0;
  let barsToMaxDive: number | undefined;
  let barsToMaxBounce: number | undefined;

  for (let offset = 0; offset < future.length; offset++) {
    const candle = future[offset]!;
    const dive = Math.max(0, breakLine - candle.low, level.price - candle.low);
    if (dive > maxDiveAbs) {
      maxDiveAbs = dive;
      barsToMaxDive = offset + 1;
    }

    const bounce = Math.max(0, candle.high - level.price);
    if (bounce > maxBounceAbs) {
      maxBounceAbs = bounce;
      barsToMaxBounce = offset + 1;
    }
  }

  return { maxDiveAbs, maxBounceAbs, barsToMaxDive, barsToMaxBounce };
}

function measureFromBelow(level: RoundLevel, future: StrategyCandle[]): MovementMetrics {
  const breakLine = level.upperBuffer.to;
  let maxDiveAbs = 0;
  let maxBounceAbs = 0;
  let barsToMaxDive: number | undefined;
  let barsToMaxBounce: number | undefined;

  for (let offset = 0; offset < future.length; offset++) {
    const candle = future[offset]!;
    const dive = Math.max(0, candle.high - breakLine, candle.high - level.price);
    if (dive > maxDiveAbs) {
      maxDiveAbs = dive;
      barsToMaxDive = offset + 1;
    }

    const bounce = Math.max(0, level.price - candle.low);
    if (bounce > maxBounceAbs) {
      maxBounceAbs = bounce;
      barsToMaxBounce = offset + 1;
    }
  }

  return { maxDiveAbs, maxBounceAbs, barsToMaxDive, barsToMaxBounce };
}

function measureInside(level: RoundLevel, future: StrategyCandle[]): MovementMetrics {
  let maxDiveAbs = 0;
  let maxBounceAbs = 0;
  let barsToMaxDive: number | undefined;
  let barsToMaxBounce: number | undefined;

  for (let offset = 0; offset < future.length; offset++) {
    const candle = future[offset]!;
    const diveDown = Math.max(0, level.lowerBuffer.from - candle.low);
    const diveUp = Math.max(0, candle.high - level.upperBuffer.to);
    const dive = Math.max(diveDown, diveUp);
    if (dive > maxDiveAbs) {
      maxDiveAbs = dive;
      barsToMaxDive = offset + 1;
    }

    const bounce = Math.max(
      Math.max(0, candle.high - level.price),
      Math.max(0, level.price - candle.low),
    );
    if (bounce > maxBounceAbs) {
      maxBounceAbs = bounce;
      barsToMaxBounce = offset + 1;
    }
  }

  return { maxDiveAbs, maxBounceAbs, barsToMaxDive, barsToMaxBounce };
}

function returnedAfterFalseBreakFromAbove(
  level: RoundLevel,
  future: StrategyCandle[],
  buffer: number,
): boolean {
  const breakLine = level.lowerBuffer.from;
  let dove = false;
  for (const candle of future) {
    if (candle.low < breakLine) dove = true;
    if (dove && candle.close > level.price) return true;
  }
  return dove && (future.at(-1)?.close ?? 0) > level.price - buffer * 0.5;
}

function returnedAfterFalseBreakFromBelow(
  level: RoundLevel,
  future: StrategyCandle[],
  buffer: number,
): boolean {
  const breakLine = level.upperBuffer.to;
  let dove = false;
  for (const candle of future) {
    if (candle.high > breakLine) dove = true;
    if (dove && candle.close < level.price) return true;
  }
  return dove && (future.at(-1)?.close ?? level.price) < level.price + buffer * 0.5;
}

type ClassifiedTouch = {
  outcome: RoundLevelOutcome;
  barsToDecision?: number;
};

function classifyOutcome(
  approach: RoundLevelApproach,
  level: RoundLevel,
  future: StrategyCandle[],
  metrics: MovementMetrics,
): ClassifiedTouch {
  const buffer = levelBufferSize(level);
  const bounceMin = buffer * BOUNCE_MULT;
  const diveMax = buffer * DIVE_MAX_MULT;
  const falseBounceMin = buffer * FALSE_BOUNCE_MULT;

  if (approach === "from_above") {
    if (isConsolidatedBelow(level, future, buffer)) {
      const continuation = Math.max(
        0,
        level.lowerBuffer.from - Math.min(...future.map((candle) => candle.close)),
      );
      if (continuation >= buffer * CONTINUATION_MULT) {
        return { outcome: "breakout", barsToDecision: metrics.barsToMaxDive };
      }
    }

    if (
      metrics.maxDiveAbs > diveMax &&
      metrics.maxBounceAbs >= falseBounceMin &&
      returnedAfterFalseBreakFromAbove(level, future, buffer)
    ) {
      return { outcome: "false_break", barsToDecision: metrics.barsToMaxBounce };
    }

    if (
      metrics.maxBounceAbs >= bounceMin &&
      metrics.maxDiveAbs <= diveMax &&
      !isConsolidatedBelow(level, future, buffer)
    ) {
      return { outcome: "bounce", barsToDecision: metrics.barsToMaxBounce };
    }

    return { outcome: "chop", barsToDecision: metrics.barsToMaxBounce ?? metrics.barsToMaxDive };
  }

  if (approach === "from_below") {
    if (isConsolidatedAbove(level, future, buffer)) {
      const continuation = Math.max(
        0,
        Math.max(...future.map((candle) => candle.close)) - level.upperBuffer.to,
      );
      if (continuation >= buffer * CONTINUATION_MULT) {
        return { outcome: "breakout", barsToDecision: metrics.barsToMaxDive };
      }
    }

    if (
      metrics.maxDiveAbs > diveMax &&
      metrics.maxBounceAbs >= falseBounceMin &&
      returnedAfterFalseBreakFromBelow(level, future, buffer)
    ) {
      return { outcome: "false_break", barsToDecision: metrics.barsToMaxBounce };
    }

    if (
      metrics.maxBounceAbs >= bounceMin &&
      metrics.maxDiveAbs <= diveMax &&
      !isConsolidatedAbove(level, future, buffer)
    ) {
      return { outcome: "bounce", barsToDecision: metrics.barsToMaxBounce };
    }

    return { outcome: "chop", barsToDecision: metrics.barsToMaxBounce ?? metrics.barsToMaxDive };
  }

  const below = isConsolidatedBelow(level, future, buffer);
  const above = isConsolidatedAbove(level, future, buffer);
  if (below && !above) return { outcome: "breakout", barsToDecision: metrics.barsToMaxDive };
  if (above && !below) return { outcome: "breakout", barsToDecision: metrics.barsToMaxDive };
  if (metrics.maxBounceAbs >= bounceMin && metrics.maxDiveAbs <= diveMax) {
    return { outcome: "bounce", barsToDecision: metrics.barsToMaxBounce };
  }
  return { outcome: "chop", barsToDecision: metrics.barsToMaxBounce ?? metrics.barsToMaxDive };
}

function cleanlinessScore(
  outcome: RoundLevelOutcome,
  metrics: MovementMetrics,
  buffer: number,
  barsToDecision: number | undefined,
  volumeRatio: number | undefined,
): number {
  let score = 50;

  if (outcome === "bounce") score += 28;
  if (outcome === "false_break") score += 8;
  if (outcome === "breakout") score -= 12;
  if (outcome === "chop") score -= 28;
  if (outcome === "pending") score -= 18;

  const bounceRatio = buffer > 0 ? metrics.maxBounceAbs / buffer : 0;
  const diveRatio = buffer > 0 ? metrics.maxDiveAbs / buffer : 0;
  score += Math.min(22, bounceRatio * 10);
  score -= Math.min(28, diveRatio * 12);

  if (barsToDecision != null && Number.isFinite(barsToDecision)) {
    score += Math.max(0, 12 - barsToDecision * 1.5);
  }

  if (volumeRatio != null && Number.isFinite(volumeRatio) && volumeRatio > 1) {
    score += Math.min(12, (volumeRatio - 1) * 18);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function technicalityScoreForLevel(events: RoundLevelTouchEvent[]): number {
  const resolved = events.filter((event) => event.outcome !== "pending");
  if (resolved.length === 0) return 0;

  const bounceRate = resolved.filter((e) => e.outcome === "bounce").length / resolved.length;
  const breakoutRate = resolved.filter((e) => e.outcome === "breakout").length / resolved.length;
  const falseBreakRate = resolved.filter((e) => e.outcome === "false_break").length / resolved.length;
  const chopRate = resolved.filter((e) => e.outcome === "chop").length / resolved.length;
  const avgClean =
    resolved.reduce((sum, event) => sum + event.cleanlinessScore, 0) / resolved.length;

  const score =
    bounceRate * 40 +
    (1 - chopRate) * 20 +
    (1 - falseBreakRate) * 15 +
    (1 - breakoutRate) * 10 +
    avgClean * 0.15;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function touchSampleQuality(totalTouches: number): number {
  if (totalTouches >= 50) return 100;
  if (totalTouches >= 25) return 70;
  if (totalTouches >= 10) return 40;
  return 15;
}

function bounceBreakClarityScore(options: {
  bounceRate: number;
  breakoutRate: number;
  falseBreakRate: number;
  chopRate: number;
}): number {
  const resolvedQuality =
    options.bounceRate * 100 * 0.5 +
    options.breakoutRate * 100 * 0.25 +
    (1 - options.falseBreakRate) * 100 * 0.1 +
    (1 - options.chopRate) * 100 * 0.15;
  return Math.max(0, Math.min(100, resolvedQuality));
}

function reactionSpeedQuality(avgBarsToDecision: number): number {
  if (!Number.isFinite(avgBarsToDecision) || avgBarsToDecision <= 0) return 35;
  if (avgBarsToDecision <= 4) return 100;
  if (avgBarsToDecision <= 8) {
    const normalized = (avgBarsToDecision - 4) / 4;
    return 80 - normalized * 20;
  }
  if (avgBarsToDecision <= 12) {
    const normalized = (avgBarsToDecision - 8) / 4;
    return 60 - normalized * 25;
  }
  return 25;
}

function instrumentTechnicalityComponents(options: {
  stats: RoundLevelTechnicalityStats[];
  totalTouches: number;
  bounceRate: number;
  breakoutRate: number;
  falseBreakRate: number;
  chopRate: number;
}): {
  levels: number;
  sample: number;
  clarity: number;
  lowChop: number;
  speed: number;
} {
  const topLevels = options.stats
    .filter((stat) => stat.touches >= 3)
    .sort((a, b) => b.technicalityScore - a.technicalityScore)
    .slice(0, 5);
  const levels =
    topLevels.length > 0 ? average(topLevels.map((stat) => stat.technicalityScore)) : 0;
  const sample = touchSampleQuality(options.totalTouches);
  const clarity = bounceBreakClarityScore({
    bounceRate: options.bounceRate,
    breakoutRate: options.breakoutRate,
    falseBreakRate: options.falseBreakRate,
    chopRate: options.chopRate,
  });
  const lowChop = Math.max(0, Math.min(100, 100 - options.chopRate * 100));
  const avgBarsToDecision = average(
    options.stats
      .map((stat) => stat.avgBarsToDecision)
      .filter((value) => Number.isFinite(value) && value > 0),
  );
  const speed = reactionSpeedQuality(avgBarsToDecision);

  return {
    levels: Math.round(levels),
    sample: Math.round(sample),
    clarity: Math.round(clarity),
    lowChop: Math.round(lowChop),
    speed: Math.round(speed),
  };
}

function instrumentTechnicalityScoreFromModel(options: {
  stats: RoundLevelTechnicalityStats[];
  totalTouches: number;
  bounceRate: number;
  breakoutRate: number;
  falseBreakRate: number;
  chopRate: number;
}): number {
  const components = instrumentTechnicalityComponents(options);

  const score =
    components.levels * 0.3 +
    components.sample * 0.2 +
    components.clarity * 0.2 +
    components.lowChop * 0.15 +
    components.speed * 0.15;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildStats(touches: RoundLevelTouchEvent[], levels: RoundLevel[]): RoundLevelTechnicalityStats[] {
  return levels.map((level) => {
    const levelTouches = touches.filter(
      (touch) => Math.abs(touch.level - level.price) < 1e-6 && touch.outcome !== "pending",
    );

    const bounceCount = levelTouches.filter((touch) => touch.outcome === "bounce").length;
    const breakoutCount = levelTouches.filter((touch) => touch.outcome === "breakout").length;
    const falseBreakCount = levelTouches.filter((touch) => touch.outcome === "false_break").length;
    const chopCount = levelTouches.filter((touch) => touch.outcome === "chop").length;
    const resolved = levelTouches.length;

    const volumeRatios = levelTouches
      .map((touch) => touch.volumeRatio)
      .filter((value): value is number => value != null && Number.isFinite(value));

    return {
      level: level.price,
      touches: resolved,
      bounceCount,
      breakoutCount,
      falseBreakCount,
      chopCount,
      bounceRate: resolved > 0 ? bounceCount / resolved : 0,
      breakoutRate: resolved > 0 ? breakoutCount / resolved : 0,
      falseBreakRate: resolved > 0 ? falseBreakCount / resolved : 0,
      chopRate: resolved > 0 ? chopCount / resolved : 0,
      avgMaxDiveAbs: average(levelTouches.map((touch) => touch.maxDiveAbs)),
      avgMaxDivePct: average(levelTouches.map((touch) => touch.maxDivePct)),
      avgMaxBounceAbs: average(levelTouches.map((touch) => touch.maxBounceAbs)),
      avgMaxBouncePct: average(levelTouches.map((touch) => touch.maxBouncePct)),
      avgBarsToDecision: average(
        levelTouches
          .map((touch) => touch.barsToDecision)
          .filter((value): value is number => value != null && Number.isFinite(value)),
      ),
      avgVolumeRatio: volumeRatios.length > 0 ? average(volumeRatios) : undefined,
      technicalityScore: technicalityScoreForLevel(levelTouches),
    };
  });
}

function buildSummary(
  touches: RoundLevelTouchEvent[],
  stats: RoundLevelTechnicalityStats[],
  candleCount: number,
  options: Required<Omit<RoundLevelReactionOptions, "intervalMinutes">> & { intervalMinutes: 5 | 10 | 30 },
): RoundLevelReactionSummary {
  const resolved = touches.filter((touch) => touch.outcome !== "pending");
  const totalTouches = resolved.length;

  const bounceCount = resolved.filter((touch) => touch.outcome === "bounce").length;
  const breakoutCount = resolved.filter((touch) => touch.outcome === "breakout").length;
  const falseBreakCount = resolved.filter((touch) => touch.outcome === "false_break").length;
  const chopCount = resolved.filter((touch) => touch.outcome === "chop").length;

  const ranked = stats
    .filter((item) => item.touches >= options.minTouchesForRanking)
    .sort((a, b) => b.technicalityScore - a.technicalityScore || b.touches - a.touches);

  const bounceRate = totalTouches > 0 ? bounceCount / totalTouches : 0;
  const breakoutRate = totalTouches > 0 ? breakoutCount / totalTouches : 0;
  const falseBreakRate = totalTouches > 0 ? falseBreakCount / totalTouches : 0;
  const chopRate = totalTouches > 0 ? chopCount / totalTouches : 0;
  const instrumentTechnicalityScore =
    resolved.length > 0
      ? instrumentTechnicalityScoreFromModel({
          stats,
          totalTouches,
          bounceRate,
          breakoutRate,
          falseBreakRate,
          chopRate,
        })
      : 0;
  const scoreComponents =
    resolved.length > 0
      ? instrumentTechnicalityComponents({
          stats,
          totalTouches,
          bounceRate,
          breakoutRate,
          falseBreakRate,
          chopRate,
        })
      : { levels: 0, sample: 0, clarity: 0, lowChop: 0, speed: 0 };

  let sampleWarning: string | undefined;
  if (candleCount < SAMPLE_MIN_CANDLES || totalTouches < SAMPLE_MIN_TOUCHES) {
    sampleWarning = "Статистика предварительная: мало истории";
  }

  return {
    totalTouches,
    bounceRate,
    breakoutRate,
    falseBreakRate,
    chopRate,
    avgBounce: average(resolved.map((touch) => touch.maxBounceAbs)),
    avgDive: average(resolved.map((touch) => touch.maxDiveAbs)),
    bestLevels: ranked.slice(0, options.bestWorstLimit),
    worstLevels: [...ranked].reverse().slice(0, options.bestWorstLimit),
    instrumentTechnicalityScore,
    scoreComponents,
    sampleWarning,
  };
}

function emptySummary(): RoundLevelReactionSummary {
  return {
    totalTouches: 0,
    bounceRate: 0,
    breakoutRate: 0,
    falseBreakRate: 0,
    chopRate: 0,
    avgBounce: 0,
    avgDive: 0,
    bestLevels: [],
    worstLevels: [],
    instrumentTechnicalityScore: 0,
    scoreComponents: { levels: 0, sample: 0, clarity: 0, lowChop: 0, speed: 0 },
  };
}

/**
 * Touch/reaction technicality analytics for round levels — heuristic, no PnL.
 */
export function analyzeRoundLevelReactions(
  candles: StrategyCandle[],
  levels: RoundLevel[],
  options: RoundLevelReactionOptions = {},
): RoundLevelReactionResult {
  const intervalMinutes = options.intervalMinutes ?? 5;
  const resolvedOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    intervalMinutes,
    reactionWindow: options.reactionWindow ?? reactionWindowForInterval(intervalMinutes),
  };

  if (candles.length === 0 || levels.length === 0) {
    return { touches: [], stats: [], summary: emptySummary() };
  }

  const validCandles = candles.filter(isValidCandle);
  if (validCandles.length === 0) {
    return { touches: [], stats: [], summary: emptySummary() };
  }

  const touches: RoundLevelTouchEvent[] = [];
  const inCluster = new Map<number, boolean>();

  for (let index = 0; index < validCandles.length; index++) {
    const candle = validCandles[index]!;

    for (const level of levels) {
      if (!candleIntersectsTouchZone(candle, level)) {
        inCluster.set(level.price, false);
        continue;
      }

      if (inCluster.get(level.price)) continue;

      const zone = touchZone(level);
      const buffer = levelBufferSize(level);
      const prevClose = index > 0 ? validCandles[index - 1]!.close : candle.open;
      const approach = resolveApproach(prevClose, level);

      const windowEnd = Math.min(validCandles.length - 1, index + resolvedOptions.reactionWindow);
      const future = validCandles.slice(index + 1, windowEnd + 1);

      let outcome: RoundLevelOutcome = "pending";
      let metrics: MovementMetrics = {
        maxDiveAbs: 0,
        maxBounceAbs: 0,
      };
      let barsToDecision: number | undefined;

      if (future.length === 0) {
        outcome = "pending";
      } else {
        if (approach === "from_above") metrics = measureFromAbove(level, future);
        else if (approach === "from_below") metrics = measureFromBelow(level, future);
        else metrics = measureInside(level, future);

        const classified = classifyOutcome(approach, level, future, metrics);
        outcome = classified.outcome;
        barsToDecision = classified.barsToDecision;
      }

      const median = medianVolume(validCandles, index, resolvedOptions.volumeLookback);
      const volumeRatio =
        median != null && candle.volume != null && median > 0 ? candle.volume / median : undefined;

      const touchTime = typeof candle.time === "number" ? candle.time : Number(candle.time);

      touches.push({
        id: `${level.price}-${index}-${touchTime}`,
        level: level.price,
        levelType: level.importance,
        touchTime,
        touchIndex: index,
        approach,
        entryPrice: candle.close,
        bufferFrom: zone.low,
        bufferTo: zone.high,
        maxDiveAbs: metrics.maxDiveAbs,
        maxDivePct: pctOfLevel(metrics.maxDiveAbs, level.price),
        maxBounceAbs: metrics.maxBounceAbs,
        maxBouncePct: pctOfLevel(metrics.maxBounceAbs, level.price),
        barsToMaxDive: metrics.barsToMaxDive,
        barsToMaxBounce: metrics.barsToMaxBounce,
        barsToDecision,
        outcome,
        volumeRatio: volumeRatio != null && Number.isFinite(volumeRatio) ? volumeRatio : undefined,
        cleanlinessScore: cleanlinessScore(outcome, metrics, buffer, barsToDecision, volumeRatio),
      });

      inCluster.set(level.price, true);
    }
  }

  const stats = buildStats(touches, levels);
  const summary = buildSummary(touches, stats, validCandles.length, resolvedOptions);

  return { touches, stats, summary };
}

export function statsForLevel(
  stats: RoundLevelTechnicalityStats[],
  levelPrice: number,
): RoundLevelTechnicalityStats | null {
  return stats.find((item) => Math.abs(item.level - levelPrice) < 1e-6) ?? null;
}

export function formatBounceRate(rate: number): string {
  if (!Number.isFinite(rate)) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function formatTechnicalityScore(score: number): string {
  if (!Number.isFinite(score)) return "—";
  return String(Math.round(score));
}
