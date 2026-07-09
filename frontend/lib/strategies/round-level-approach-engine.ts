import type { StrategyCandle } from "@/lib/screener/strategies/strategy-candles";
import { roundToStep } from "@/lib/strategies/round-levels-engine";
import type { ZigZagSegment } from "@/lib/strategies/zigzag-lite-engine";
import {
  buildApproachZone,
  candleEntersZone,
  classifyEventKind,
  type LevelEventKind,
} from "@/lib/strategies/round-approach-zone-engine";

export type RoundLevelApproachDirection = "up" | "down";

export type RoundLevelApproachSegment = {
  id: string;
  level: number;
  direction: RoundLevelApproachDirection;
  fromIndex: number;
  toIndex: number;
  startTime: number;
  endTime: number;
  startPrice: number;
  endPrice: number;
  reactionZone: { from: number; to: number };
  breakZone: { from: number; to: number };
  outcome?: "bounce" | "breakout" | "false_break" | "chop" | "pending";
  relatedPivotFrom?: number;
  relatedPivotTo?: number;
  eventKind?: LevelEventKind;
  approachZone?: { from: number; to: number };
  approachWidth?: number;
  enteredHardBuffer?: boolean;
  enteredApproachZone?: boolean;
  distanceToLevel?: number;
  firstApproachZoneIndex?: number;
};

type MovementSegment = {
  direction: RoundLevelApproachDirection;
  fromIndex: number;
  toIndex: number;
  startPrice: number;
  endPrice: number;
  relatedPivotFrom?: number;
  relatedPivotTo?: number;
};

const EPS = 1e-6;
const DEFAULT_LOOKBACK = 6;
const DEFAULT_MIN_STEP = 0.01;
const HARD_MAX_ACTIVE_ZONES = 120;

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function isFinitePrice(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

function snap(value: number, minStep: number): number {
  return roundToStep(value, minStep);
}

function buildZones(
  level: number,
  direction: RoundLevelApproachDirection,
  buffer: number,
  minStep: number,
): Pick<RoundLevelApproachSegment, "reactionZone" | "breakZone"> {
  if (direction === "up") {
    return {
      reactionZone: { from: snap(level - buffer, minStep), to: snap(level, minStep) },
      breakZone: { from: snap(level, minStep), to: snap(level + buffer, minStep) },
    };
  }
  return {
    reactionZone: { from: snap(level, minStep), to: snap(level + buffer, minStep) },
    breakZone: { from: snap(level - buffer, minStep), to: snap(level, minStep) },
  };
}

function buildMovementSegmentsFromZigZag(
  candles: StrategyCandle[],
  zigzagSegments: ZigZagSegment[],
): MovementSegment[] {
  const movements: MovementSegment[] = [];
  for (const segment of zigzagSegments) {
    const fromIndex = clampInt(segment.from.candleIndex, 0, Math.max(0, candles.length - 1));
    const toIndex = clampInt(segment.to.candleIndex, 0, Math.max(0, candles.length - 1));
    if (toIndex <= fromIndex) continue;
    if (!isFinitePrice(segment.from.price) || !isFinitePrice(segment.to.price)) continue;
    movements.push({
      direction: segment.direction,
      fromIndex,
      toIndex,
      startPrice: segment.from.price,
      endPrice: segment.to.price,
      relatedPivotFrom: segment.from.candleIndex,
      relatedPivotTo: segment.to.candleIndex,
    });
  }
  return movements;
}

function buildFallbackMovementSegments(
  candles: StrategyCandle[],
  lookbackBars: number,
  minStep: number,
): MovementSegment[] {
  if (candles.length < 2) return [];
  const segments: MovementSegment[] = [];
  const safeLookback = Math.max(1, lookbackBars);

  let activeDirection: RoundLevelApproachDirection | null = null;
  let activeFromIndex = 0;
  let activeStartPrice = candles[0]?.close ?? NaN;

  for (let index = safeLookback; index < candles.length; index += 1) {
    const current = candles[index];
    const reference = candles[index - safeLookback];
    if (!current || !reference || !isFinitePrice(current.close) || !isFinitePrice(reference.close)) continue;

    const delta = current.close - reference.close;
    const minDelta = Math.max(minStep, Math.abs(current.close) * 0.0005);
    if (Math.abs(delta) < minDelta) continue;

    const direction: RoundLevelApproachDirection = delta > 0 ? "up" : "down";
    if (activeDirection == null) {
      activeDirection = direction;
      activeFromIndex = index - safeLookback;
      activeStartPrice = reference.close;
      continue;
    }

    if (direction !== activeDirection) {
      const prev = candles[index - 1];
      if (prev && isFinitePrice(prev.close) && isFinitePrice(activeStartPrice)) {
        segments.push({
          direction: activeDirection,
          fromIndex: activeFromIndex,
          toIndex: index - 1,
          startPrice: activeStartPrice,
          endPrice: prev.close,
        });
      }
      activeDirection = direction;
      activeFromIndex = index - safeLookback;
      activeStartPrice = reference.close;
    }
  }

  if (activeDirection != null) {
    const last = candles[candles.length - 1];
    if (last && isFinitePrice(last.close) && isFinitePrice(activeStartPrice)) {
      segments.push({
        direction: activeDirection,
        fromIndex: activeFromIndex,
        toIndex: candles.length - 1,
        startPrice: activeStartPrice,
        endPrice: last.close,
      });
    }
  }

  return segments.filter((segment) => segment.toIndex > segment.fromIndex);
}

function crossedLevelsForMovement(
  sortedLevels: number[],
  candles: StrategyCandle[],
  segment: MovementSegment,
): number[] {
  let lo = Math.min(segment.startPrice, segment.endPrice);
  let hi = Math.max(segment.startPrice, segment.endPrice);
  for (let index = segment.fromIndex; index <= segment.toIndex; index += 1) {
    const candle = candles[index];
    if (!candle) continue;
    if (isFinitePrice(candle.low)) lo = Math.min(lo, candle.low);
    if (isFinitePrice(candle.high)) hi = Math.max(hi, candle.high);
  }
  if (segment.direction === "up") {
    return sortedLevels.filter((level) => level > segment.startPrice + EPS && level <= hi + EPS);
  }
  return sortedLevels
    .filter((level) => level < segment.startPrice - EPS && level >= lo - EPS)
    .sort((a, b) => b - a);
}

function candleTouchesZone(
  candle: StrategyCandle,
  zone: { from: number; to: number },
): boolean {
  if (!isFinitePrice(candle.low) || !isFinitePrice(candle.high)) return false;
  return candle.high >= zone.from - EPS && candle.low <= zone.to + EPS;
}

function firstReactionIndex(
  candles: StrategyCandle[],
  segment: MovementSegment,
  reactionZone: { from: number; to: number },
): number | null {
  for (let i = segment.fromIndex; i <= segment.toIndex; i += 1) {
    const candle = candles[i];
    if (!candle) continue;
    if (candleTouchesZone(candle, reactionZone)) return i;
  }
  return null;
}

function firstZoneEntryIndex(
  candles: StrategyCandle[],
  segment: MovementSegment,
  zone: { from: number; to: number },
): number | null {
  for (let i = segment.fromIndex; i <= segment.toIndex; i += 1) {
    const candle = candles[i];
    if (!candle) continue;
    if (candleEntersZone(candle, zone)) return i;
  }
  return null;
}

function scanZoneEntry(
  candles: StrategyCandle[],
  segment: MovementSegment,
  hardZone: { from: number; to: number },
  approachZone: { from: number; to: number },
): {
  enteredHardBuffer: boolean;
  enteredApproachZone: boolean;
  firstApproachZoneIndex: number | null;
  extremumPrice: number;
  extremumIndex: number;
} {
  let enteredHardBuffer = false;
  let enteredApproachZone = false;
  let firstApproachZoneIndex: number | null = null;
  let extremumPrice = segment.direction === "up" ? Infinity : -Infinity;
  let extremumIndex = segment.fromIndex;

  for (let i = segment.fromIndex; i <= segment.toIndex; i += 1) {
    const candle = candles[i];
    if (!candle) continue;

    if (candleEntersZone(candle, hardZone)) enteredHardBuffer = true;
    if (candleEntersZone(candle, approachZone)) {
      enteredApproachZone = true;
      if (firstApproachZoneIndex == null) firstApproachZoneIndex = i;
    }

    if (segment.direction === "up") {
      if (isFinitePrice(candle.low) && candle.low < extremumPrice) {
        extremumPrice = candle.low;
        extremumIndex = i;
      }
    } else if (isFinitePrice(candle.high) && candle.high > extremumPrice) {
      extremumPrice = candle.high;
      extremumIndex = i;
    }
  }

  return {
    enteredHardBuffer,
    enteredApproachZone,
    firstApproachZoneIndex,
    extremumPrice,
    extremumIndex,
  };
}

function classifyNearMissOutcome(
  candles: StrategyCandle[],
  direction: RoundLevelApproachDirection,
  level: number,
  extremumIndex: number,
  toIndex: number,
): RoundLevelApproachSegment["outcome"] {
  const last = candles[toIndex];
  if (!last || !isFinitePrice(last.close)) return "pending";

  if (direction === "up") {
    if (last.close < level - EPS) return "bounce";
  } else if (last.close > level + EPS) {
    return "bounce";
  }
  return "pending";
}

function classifyOutcome(
  candles: StrategyCandle[],
  direction: RoundLevelApproachDirection,
  level: number,
  reactionZone: { from: number; to: number },
  breakZone: { from: number; to: number },
  fromIndex: number,
  toIndex: number,
): RoundLevelApproachSegment["outcome"] {
  const slice = candles.slice(fromIndex, toIndex + 1);
  if (slice.length === 0) return "pending";

  let touchedReaction = false;
  let touchedBreak = false;
  let movedBackFromLevel = false;
  let returnedInsideReactionAfterBreak = false;

  for (const candle of slice) {
    if (!candle) continue;
    if (candleTouchesZone(candle, reactionZone)) touchedReaction = true;
    if (candleTouchesZone(candle, breakZone)) touchedBreak = true;

    if (direction === "up") {
      if (isFinitePrice(candle.low) && candle.low <= reactionZone.from + EPS) movedBackFromLevel = true;
      if (touchedBreak && isFinitePrice(candle.close) && candle.close <= reactionZone.to + EPS) {
        returnedInsideReactionAfterBreak = true;
      }
    } else {
      if (isFinitePrice(candle.high) && candle.high >= reactionZone.to - EPS) movedBackFromLevel = true;
      if (touchedBreak && isFinitePrice(candle.close) && candle.close >= reactionZone.from - EPS) {
        returnedInsideReactionAfterBreak = true;
      }
    }
  }

  const last = slice[slice.length - 1];
  if (!last || !isFinitePrice(last.close)) return "pending";

  if (!touchedReaction && !touchedBreak) return "pending";

  if (direction === "up") {
    if (touchedBreak && last.close > breakZone.to + EPS) return "breakout";
    if (touchedBreak && returnedInsideReactionAfterBreak) return "false_break";
    if (touchedReaction && movedBackFromLevel && last.close < level - EPS) return "bounce";
    return touchedBreak ? "chop" : "pending";
  }

  if (touchedBreak && last.close < breakZone.from - EPS) return "breakout";
  if (touchedBreak && returnedInsideReactionAfterBreak) return "false_break";
  if (touchedReaction && movedBackFromLevel && last.close > level + EPS) return "bounce";
  return touchedBreak ? "chop" : "pending";
}

export function computeRoundLevelApproaches(options: {
  candles: StrategyCandle[];
  levels: number[];
  buffer: number;
  approachWidth?: number;
  zigzagSegments?: ZigZagSegment[];
  lookbackBars?: number;
  minStep?: number;
  maxSegments?: number;
}): RoundLevelApproachSegment[] {
  const {
    candles,
    levels,
    buffer,
    approachWidth: approachWidthInput,
    zigzagSegments = [],
    lookbackBars = DEFAULT_LOOKBACK,
    minStep = DEFAULT_MIN_STEP,
    maxSegments = HARD_MAX_ACTIVE_ZONES,
  } = options;

  const approachWidth =
    approachWidthInput != null && Number.isFinite(approachWidthInput) && approachWidthInput > buffer
      ? approachWidthInput
      : buffer * 2;

  if (candles.length === 0 || !Number.isFinite(buffer) || buffer <= 0) return [];

  const sortedLevels = [...new Set(levels.filter((level) => isFinitePrice(level)))].sort((a, b) => a - b);
  if (sortedLevels.length === 0) return [];

  const movements =
    zigzagSegments.length > 0
      ? buildMovementSegmentsFromZigZag(candles, zigzagSegments)
      : buildFallbackMovementSegments(candles, lookbackBars, minStep);

  const approaches: RoundLevelApproachSegment[] = [];

  for (const movement of movements) {
    const crossedLevels = crossedLevelsForMovement(sortedLevels, candles, movement);
    if (crossedLevels.length === 0) continue;

    for (const level of crossedLevels) {
      const zones = buildZones(level, movement.direction, buffer, minStep);
      const approachZone = buildApproachZone(level, approachWidth, minStep);
      const hardZone = {
        from: Math.min(zones.reactionZone.from, zones.breakZone.from),
        to: Math.max(zones.reactionZone.to, zones.breakZone.to),
      };

      const zoneScan = scanZoneEntry(candles, movement, hardZone, approachZone);
      const reactionIndex = firstReactionIndex(candles, movement, zones.reactionZone);
      const approachZoneIndex = zoneScan.firstApproachZoneIndex ?? firstZoneEntryIndex(candles, movement, approachZone);

      const fromIndex = clampInt(
        approachZoneIndex ?? movement.fromIndex,
        0,
        candles.length - 1,
      );
      const toIndex = clampInt(reactionIndex ?? movement.toIndex, fromIndex, candles.length - 1);
      const start = candles[fromIndex];
      const end = candles[toIndex];
      if (!start || !end) continue;

      const enteredHardBuffer = zoneScan.enteredHardBuffer;
      const enteredApproachZone = zoneScan.enteredApproachZone;

      if (!enteredHardBuffer && !enteredApproachZone) continue;

      let outcome: RoundLevelApproachSegment["outcome"];
      if (enteredHardBuffer) {
        outcome = classifyOutcome(
          candles,
          movement.direction,
          level,
          zones.reactionZone,
          zones.breakZone,
          fromIndex,
          movement.toIndex,
        );
      } else {
        outcome = classifyNearMissOutcome(
          candles,
          movement.direction,
          level,
          zoneScan.extremumIndex,
          movement.toIndex,
        );
      }

      const distanceToLevel = Math.abs(zoneScan.extremumPrice - level);
      const eventKind = classifyEventKind(outcome, enteredHardBuffer, enteredApproachZone);

      const segment: RoundLevelApproachSegment = {
        id:
          eventKind === "near_miss"
            ? `level_${level}_near_${zoneScan.extremumIndex}`
            : `${movement.direction}-${level}-${fromIndex}-${movement.toIndex}`,
        level,
        direction: movement.direction,
        fromIndex,
        toIndex,
        startTime: start.time,
        endTime: end.time,
        startPrice: movement.startPrice,
        endPrice: end.close,
        reactionZone: zones.reactionZone,
        breakZone: zones.breakZone,
        outcome,
        relatedPivotFrom: movement.relatedPivotFrom,
        relatedPivotTo: movement.relatedPivotTo,
        eventKind,
        approachZone,
        approachWidth,
        enteredHardBuffer,
        enteredApproachZone,
        distanceToLevel,
        firstApproachZoneIndex: approachZoneIndex ?? undefined,
      };

      const numericValues = [
        segment.level,
        segment.fromIndex,
        segment.toIndex,
        segment.startTime,
        segment.endTime,
        segment.startPrice,
        segment.endPrice,
        segment.reactionZone.from,
        segment.reactionZone.to,
        segment.breakZone.from,
        segment.breakZone.to,
      ];
      if (!numericValues.every(Number.isFinite)) continue;
      if (segment.endTime < segment.startTime) continue;
      if (segment.reactionZone.from > segment.reactionZone.to + EPS) continue;
      if (segment.breakZone.from > segment.breakZone.to + EPS) continue;

      approaches.push(segment);
      if (approaches.length >= maxSegments) {
        return approaches.sort((a, b) =>
          a.startTime !== b.startTime ? a.startTime - b.startTime : a.level - b.level,
        );
      }
    }
  }

  return approaches.sort((a, b) =>
    a.startTime !== b.startTime ? a.startTime - b.startTime : a.level - b.level,
  );
}

export function latestApproachForLevel(
  approaches: RoundLevelApproachSegment[],
  level: number | null | undefined,
): RoundLevelApproachSegment | null {
  if (!isFinitePrice(level)) return null;
  const filtered = approaches.filter((approach) => Math.abs(approach.level - level) < EPS);
  return filtered.length > 0 ? filtered[filtered.length - 1] ?? null : null;
}

export function countApproachesForLevel(
  approaches: RoundLevelApproachSegment[],
  level: number | null | undefined,
): number {
  if (!isFinitePrice(level)) return 0;
  return approaches.filter((approach) => Math.abs(approach.level - level) < EPS).length;
}

