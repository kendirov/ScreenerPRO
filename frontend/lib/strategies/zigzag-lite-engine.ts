import type { StrategyCandle } from "@/lib/screener/strategies/strategy-candles";

export type ZigZagPivotType = "high" | "low";

export type ZigZagPivot = {
  type: ZigZagPivotType;
  candleIndex: number;
  time: number | string;
  price: number;
  confirmedAtIndex: number;
};

export type ZigZagSegment = {
  from: ZigZagPivot;
  to: ZigZagPivot;
  direction: "up" | "down";
  changePct: number;
  bars: number;
};

export type ZigZagMovementDirection = "up" | "down" | "unknown";

export type ZigZagLiteResult = {
  pivots: ZigZagPivot[];
  segments: ZigZagSegment[];
  lastPivot: ZigZagPivot | null;
  lastSegment: ZigZagSegment | null;
  movementDirection: ZigZagMovementDirection;
};

export type ZigZagLiteOptions = {
  left?: number;
  right?: number;
  minMovePct?: number;
  minMoveAbs?: number;
  maxPivots?: number;
  minBarsBetweenPivots?: number;
};

const EPS = 1e-6;
const DEFAULT_LEFT = 3;
const DEFAULT_RIGHT = 3;
const DEFAULT_MIN_MOVE_PCT = 0.4;
const DEFAULT_MAX_PIVOTS = 60;
const DEFAULT_MIN_BARS_BETWEEN_PIVOTS = 0;

type FractalCandidate = {
  type: ZigZagPivotType;
  candleIndex: number;
  time: number | string;
  price: number;
  confirmedAtIndex: number;
};

function candleAt(candles: StrategyCandle[], index: number): StrategyCandle | null {
  if (index < 0 || index >= candles.length) return null;
  return candles[index] ?? null;
}

function isSupportedTime(value: unknown): value is number | string {
  return (typeof value === "number" && Number.isFinite(value)) || (typeof value === "string" && value.trim().length > 0);
}

function isFractalHigh(candles: StrategyCandle[], index: number, left: number, right: number): boolean {
  const candle = candleAt(candles, index);
  if (!candle || !Number.isFinite(candle.high)) return false;

  const pivotHigh = candle.high;
  for (let offset = index - left; offset <= index + right; offset += 1) {
    if (offset === index) continue;
    const other = candleAt(candles, offset);
    if (!other || !Number.isFinite(other.high)) return false;
    if (other.high > pivotHigh + EPS) return false;
  }
  return true;
}

function isFractalLow(candles: StrategyCandle[], index: number, left: number, right: number): boolean {
  const candle = candleAt(candles, index);
  if (!candle || !Number.isFinite(candle.low)) return false;

  const pivotLow = candle.low;
  for (let offset = index - left; offset <= index + right; offset += 1) {
    if (offset === index) continue;
    const other = candleAt(candles, offset);
    if (!other || !Number.isFinite(other.low)) return false;
    if (other.low < pivotLow - EPS) return false;
  }
  return true;
}

function findFractalCandidates(
  candles: StrategyCandle[],
  left: number,
  right: number,
): FractalCandidate[] {
  const candidates: FractalCandidate[] = [];

  for (let index = left; index < candles.length - right; index += 1) {
    const candle = candles[index]!;
    if (!isSupportedTime(candle.time)) continue;

    if (isFractalHigh(candles, index, left, right)) {
      candidates.push({
        type: "high",
        candleIndex: index,
        time: candle.time,
        price: candle.high,
        confirmedAtIndex: index + right,
      });
      continue;
    }

    if (isFractalLow(candles, index, left, right)) {
      candidates.push({
        type: "low",
        candleIndex: index,
        time: candle.time,
        price: candle.low,
        confirmedAtIndex: index + right,
      });
    }
  }

  return candidates;
}

function minMoveThreshold(
  referencePrice: number,
  minMovePct: number,
  minMoveAbs: number,
): number {
  const pctMove = Math.abs(referencePrice) * (minMovePct / 100);
  return Math.max(pctMove, minMoveAbs, EPS);
}

function isMoreExtreme(
  candidate: Pick<FractalCandidate, "type" | "price">,
  existing: Pick<FractalCandidate, "type" | "price">,
): boolean {
  if (candidate.type === "high") return candidate.price > existing.price + EPS;
  return candidate.price < existing.price - EPS;
}

function toPivot(candidate: FractalCandidate): ZigZagPivot {
  return {
    type: candidate.type,
    candleIndex: candidate.candleIndex,
    time: candidate.time,
    price: candidate.price,
    confirmedAtIndex: candidate.confirmedAtIndex,
  };
}

export function filterZigZagPivots(
  candidates: FractalCandidate[],
  minMovePct: number,
  minMoveAbs: number,
  minBarsBetweenPivots = DEFAULT_MIN_BARS_BETWEEN_PIVOTS,
): ZigZagPivot[] {
  const pivots: ZigZagPivot[] = [];

  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.price)) continue;

    const last = pivots[pivots.length - 1];
    if (!last) {
      pivots.push(toPivot(candidate));
      continue;
    }

    if (candidate.type === last.type) {
      if (isMoreExtreme(candidate, last)) {
        pivots[pivots.length - 1] = toPivot(candidate);
      }
      continue;
    }

    const move = Math.abs(candidate.price - last.price);
    const threshold = minMoveThreshold(last.price, minMovePct, minMoveAbs);
    if (move + EPS < threshold) continue;
    if (candidate.candleIndex - last.candleIndex < minBarsBetweenPivots) continue;

    pivots.push(toPivot(candidate));
  }

  return pivots;
}

export function buildZigZagSegments(pivots: ZigZagPivot[]): ZigZagSegment[] {
  const segments: ZigZagSegment[] = [];

  for (let index = 0; index < pivots.length - 1; index += 1) {
    const from = pivots[index]!;
    const to = pivots[index + 1]!;
    if (!Number.isFinite(from.price) || !Number.isFinite(to.price) || from.price === 0) continue;

    const direction: ZigZagSegment["direction"] = to.price > from.price + EPS ? "up" : "down";
    const changePct = ((to.price - from.price) / from.price) * 100;
    const bars = Math.max(0, to.candleIndex - from.candleIndex);

    segments.push({ from, to, direction, changePct, bars });
  }

  return segments;
}

export function inferZigZagMovementDirection(
  lastPivot: ZigZagPivot | null,
  currentPrice: number,
): ZigZagMovementDirection {
  if (!lastPivot || !Number.isFinite(currentPrice)) return "unknown";

  if (lastPivot.type === "low" && currentPrice > lastPivot.price + EPS) return "up";
  if (lastPivot.type === "high" && currentPrice < lastPivot.price - EPS) return "down";
  return "unknown";
}

export function computeZigZagLite(
  candles: StrategyCandle[],
  options: ZigZagLiteOptions = {},
): ZigZagLiteResult {
  const left = options.left ?? DEFAULT_LEFT;
  const right = options.right ?? DEFAULT_RIGHT;
  const minMovePct = options.minMovePct ?? DEFAULT_MIN_MOVE_PCT;
  const minMoveAbs = options.minMoveAbs ?? 0;
  const maxPivots = options.maxPivots ?? DEFAULT_MAX_PIVOTS;
  const minBarsBetweenPivots = options.minBarsBetweenPivots ?? DEFAULT_MIN_BARS_BETWEEN_PIVOTS;

  if (candles.length < left + right + 1) {
    return {
      pivots: [],
      segments: [],
      lastPivot: null,
      lastSegment: null,
      movementDirection: "unknown",
    };
  }

  const candidates = findFractalCandidates(candles, left, right);
  const filtered = filterZigZagPivots(candidates, minMovePct, minMoveAbs, minBarsBetweenPivots);
  const pivots = filtered.slice(-maxPivots);
  const segments = buildZigZagSegments(pivots);
  const lastPivot = pivots.length > 0 ? pivots[pivots.length - 1]! : null;
  const lastSegment = segments.length > 0 ? segments[segments.length - 1]! : null;
  const currentPrice = candles[candles.length - 1]?.close;
  const movementDirection = inferZigZagMovementDirection(
    lastPivot,
    Number.isFinite(currentPrice) ? currentPrice! : NaN,
  );

  return {
    pivots,
    segments,
    lastPivot,
    lastSegment,
    movementDirection,
  };
}

export function nearestRoundLevelDistance(
  currentPrice: number,
  levels: number[],
): { level: number; distance: number } | null {
  if (!Number.isFinite(currentPrice) || levels.length === 0) return null;

  let bestLevel: number | null = null;
  let bestDistance = Infinity;

  for (const level of levels) {
    if (!Number.isFinite(level)) continue;
    const distance = Math.abs(level - currentPrice);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestLevel = level;
    }
  }

  if (bestLevel == null || !Number.isFinite(bestDistance)) return null;
  return { level: bestLevel, distance: bestDistance };
}
