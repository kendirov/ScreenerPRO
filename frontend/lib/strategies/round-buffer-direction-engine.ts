import { roundToStep } from "@/lib/strategies/round-levels-engine";

export type ApproachDirection = "up_to_level" | "down_to_level" | "unknown";

export type DirectionalBufferZone = {
  level: number;
  direction: ApproachDirection;
  buffer: number;
  reactionZone: { from: number; to: number; colorRole: "reaction" };
  breakZone: { from: number; to: number; colorRole: "break" };
  candleStartIndex?: number;
  candleEndIndex?: number;
};

const EPS = 1e-6;
const DEFAULT_LOOKBACK = 6;
const DEFAULT_MIN_STEP = 0.01;
const MIN_APPROACH_DELTA_RATIO = 0.0005;

export function minApproachDelta(price: number, minStep = DEFAULT_MIN_STEP): number {
  if (!Number.isFinite(price)) return minStep;
  return Math.max(minStep, Math.abs(price) * MIN_APPROACH_DELTA_RATIO);
}

export function inferApproachDirection(
  candles: Array<Pick<{ close: number }, "close">>,
  lookback = DEFAULT_LOOKBACK,
  minStep = DEFAULT_MIN_STEP,
): ApproachDirection {
  if (candles.length < 2) return "unknown";

  const lastClose = candles[candles.length - 1]?.close;
  const refIndex = Math.max(0, candles.length - 1 - lookback);
  const refClose = candles[refIndex]?.close;

  if (!Number.isFinite(lastClose) || !Number.isFinite(refClose)) return "unknown";

  const delta = lastClose - refClose;
  if (Math.abs(delta) < minApproachDelta(lastClose, minStep)) return "unknown";
  return delta > 0 ? "up_to_level" : "down_to_level";
}

export function inferApproachDirectionToLevel(
  currentPrice: number,
  levelPrice: number,
  minStep = DEFAULT_MIN_STEP,
): ApproachDirection {
  if (!Number.isFinite(currentPrice) || !Number.isFinite(levelPrice)) return "unknown";
  if (Math.abs(currentPrice - levelPrice) < minApproachDelta(levelPrice, minStep)) return "unknown";
  return currentPrice < levelPrice ? "up_to_level" : "down_to_level";
}

export function isDirectionalZoneRangeValid(zone: DirectionalBufferZone): boolean {
  const { reactionZone, breakZone } = zone;
  return (
    Number.isFinite(reactionZone.from) &&
    Number.isFinite(reactionZone.to) &&
    Number.isFinite(breakZone.from) &&
    Number.isFinite(breakZone.to) &&
    reactionZone.from <= reactionZone.to + EPS &&
    breakZone.from <= breakZone.to + EPS
  );
}

export function movementDirectionToApproach(
  direction: "up" | "down" | "unknown" | null | undefined,
): ApproachDirection {
  if (direction === "up") return "up_to_level";
  if (direction === "down") return "down_to_level";
  return "unknown";
}

export function findTargetLevelPrice(
  levels: number[],
  currentPrice: number,
  direction: ApproachDirection,
): number | null {
  if (!Number.isFinite(currentPrice) || levels.length === 0) return null;

  const sorted = [...new Set(levels)].sort((a, b) => a - b);

  if (direction === "up_to_level") {
    return sorted.find((price) => price > currentPrice + EPS) ?? null;
  }

  if (direction === "down_to_level") {
    for (let index = sorted.length - 1; index >= 0; index -= 1) {
      const price = sorted[index]!;
      if (price < currentPrice - EPS) return price;
    }
    return null;
  }

  return sorted.reduce((best, price) =>
    Math.abs(price - currentPrice) < Math.abs(best - currentPrice) ? price : best,
  );
}

export function buildDirectionalBufferZone(
  level: number,
  direction: ApproachDirection,
  buffer: number,
  minStep = DEFAULT_MIN_STEP,
): DirectionalBufferZone | null {
  if (!Number.isFinite(level) || !Number.isFinite(buffer) || buffer <= 0) return null;

  const snap = (value: number) => roundToStep(value, minStep);

  if (direction === "up_to_level") {
    return {
      level,
      direction,
      buffer,
      reactionZone: { from: snap(level - buffer), to: snap(level), colorRole: "reaction" },
      breakZone: { from: snap(level), to: snap(level + buffer), colorRole: "break" },
    };
  }

  if (direction === "down_to_level") {
    return {
      level,
      direction,
      buffer,
      reactionZone: { from: snap(level), to: snap(level + buffer), colorRole: "reaction" },
      breakZone: { from: snap(level - buffer), to: snap(level), colorRole: "break" },
    };
  }

  return {
    level,
    direction: "unknown",
    buffer,
    reactionZone: { from: snap(level - buffer), to: snap(level), colorRole: "reaction" },
    breakZone: { from: snap(level), to: snap(level + buffer), colorRole: "break" },
  };
}

export function resolveActiveDirectionalBuffer(options: {
  candles: Array<Pick<{ close: number }, "close">>;
  levels: number[];
  selectedLevelPrice: number | null;
  buffer: number;
  lookback?: number;
  minStep?: number;
  useZigzagDirection?: boolean;
  zigzagMovementDirection?: "up" | "down" | "unknown" | null;
}): DirectionalBufferZone | null {
  const {
    candles,
    selectedLevelPrice,
    buffer,
    lookback,
    minStep,
    useZigzagDirection,
    zigzagMovementDirection,
  } = options;
  if (selectedLevelPrice == null || !Number.isFinite(selectedLevelPrice)) return null;
  if (!Number.isFinite(buffer) || buffer <= 0) return null;

  const direction =
    useZigzagDirection && zigzagMovementDirection && zigzagMovementDirection !== "unknown"
      ? movementDirectionToApproach(zigzagMovementDirection)
      : inferApproachDirection(candles, lookback);
  return buildDirectionalBufferZone(selectedLevelPrice, direction, buffer, minStep);
}

export function formatDirectionalPriceRange(from: number, to: number): string {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  return `${lo.toFixed(2)}–${hi.toFixed(2)}`;
}
