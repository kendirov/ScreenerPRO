export type RoundLevelImportance = "minor" | "normal" | "major" | "psychological";

export type RoundLevel = {
  price: number;
  label: string;
  importance: RoundLevelImportance;
  step: number;
  upperBuffer: {
    from: number;
    to: number;
  };
  lowerBuffer: {
    from: number;
    to: number;
  };
};

export type RoundLevelConfig = {
  minPrice: number;
  maxPrice: number;
  currentPrice?: number;
  minStep?: number;
  roundStep?: number;
  halfStep?: number;
  majorStep?: number;
  bufferSize?: number;
  includeHalfLevels?: boolean;
  includeMajorLevels?: boolean;
};

const MAX_LEVELS = 200;
const EPS = 1e-8;

function isFinitePositive(value: number | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}

function decimalPlaces(step: number): number {
  const text = step.toString();
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

/** Snap value to the nearest multiple of `step` (stable for MOEX tick sizes). */
export function roundToStep(value: number, step: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return NaN;
  const places = decimalPlaces(step);
  const scaled = Math.round(value / step);
  return Number((scaled * step).toFixed(places));
}

function inferRoundStep(referencePrice: number): number {
  if (referencePrice < 10) return 0.1;
  if (referencePrice < 50) return 0.5;
  if (referencePrice < 200) return 1;
  if (referencePrice < 1000) return 5;
  if (referencePrice < 5000) return 50;
  return 100;
}

function inferMajorStep(referencePrice: number, roundStep: number): number {
  return referencePrice >= 1000 ? roundStep * 10 : roundStep * 5;
}

function inferMinStep(roundStep: number): number {
  if (roundStep >= 1) return 0.01;
  if (roundStep >= 0.1) return 0.01;
  return roundStep / 10;
}

function inferBufferSize(currentPrice: number, minStep: number): number {
  const raw = Math.max(3 * minStep, currentPrice * 0.0015);
  return roundToStep(raw, minStep);
}

function computeLevelPadding(minPrice: number, maxPrice: number, roundStep: number): number {
  const visibleRange = Math.max(maxPrice - minPrice, roundStep);
  const visibleRangePct = visibleRange * 0.25;
  return Math.max(2 * roundStep, visibleRangePct);
}

function computeLevelBounds(
  minPrice: number,
  maxPrice: number,
  halfStep: number,
  roundStep: number,
): { levelMin: number; levelMax: number } {
  const padding = computeLevelPadding(minPrice, maxPrice, roundStep);
  return {
    levelMin: snapDown(minPrice - padding, halfStep),
    levelMax: snapUp(maxPrice + padding, halfStep),
  };
}

function snapDown(price: number, step: number): number {
  return roundToStep(Math.floor(price / step + EPS) * step, step);
}

function snapUp(price: number, step: number): number {
  return roundToStep(Math.ceil(price / step - EPS) * step, step);
}

function isOnGrid(price: number, step: number): boolean {
  const rounded = roundToStep(price, step);
  return Math.abs(price - rounded) < EPS || Math.abs(price / step - Math.round(price / step)) < EPS;
}

function isPsychologicalLevel(price: number, majorStep: number): boolean {
  const rounded = roundToStep(price, 0.01);
  if (Math.abs(rounded - Math.round(rounded)) > EPS) return false;

  const integer = Math.round(rounded);
  if (integer >= 1000 && integer % 1000 === 0) return true;
  if (integer >= 100 && integer % 100 === 0) return true;
  return false;
}

function resolveImportance(
  price: number,
  roundStep: number,
  halfStep: number,
  majorStep: number,
  isHalfLevel: boolean,
): RoundLevelImportance {
  if (isPsychologicalLevel(price, majorStep)) return "psychological";
  if (isOnGrid(price, majorStep)) return "major";
  if (isHalfLevel) return "minor";
  if (isOnGrid(price, roundStep)) return "normal";
  return "normal";
}

export function formatRoundLevelLabel(price: number, minStep: number): string {
  const places = Math.max(decimalPlaces(minStep), decimalPlaces(price));
  const normalized = roundToStep(price, minStep);
  const text = normalized.toFixed(places);
  return text.replace(/\.?0+$/, "");
}

function buildBufferZones(
  price: number,
  bufferSize: number,
  minStep: number,
): Pick<RoundLevel, "upperBuffer" | "lowerBuffer"> {
  const upperTo = roundToStep(price + bufferSize, minStep);
  const lowerFrom = roundToStep(price - bufferSize, minStep);

  return {
    upperBuffer: { from: price, to: upperTo },
    lowerBuffer: { from: lowerFrom, to: price },
  };
}

/**
 * Build round price levels with buffer zones for Strategy Lab.
 * Pure function — no UI, no market data dependencies.
 */
export function computeRoundLevels(config: RoundLevelConfig): RoundLevel[] {
  const { minPrice, maxPrice } = config;

  if (
    !Number.isFinite(minPrice) ||
    !Number.isFinite(maxPrice) ||
    minPrice >= maxPrice ||
    minPrice <= 0 ||
    maxPrice <= 0
  ) {
    return [];
  }

  const referencePrice = isFinitePositive(config.currentPrice)
    ? config.currentPrice
    : (minPrice + maxPrice) / 2;

  if (!Number.isFinite(referencePrice) || referencePrice <= 0) return [];

  const roundStep = config.roundStep ?? inferRoundStep(referencePrice);
  const halfStep = config.halfStep ?? roundStep / 2;
  const majorStep = config.majorStep ?? inferMajorStep(referencePrice, roundStep);
  const minStep = config.minStep ?? inferMinStep(roundStep);

  if (
    !Number.isFinite(roundStep) ||
    !Number.isFinite(halfStep) ||
    !Number.isFinite(majorStep) ||
    !Number.isFinite(minStep) ||
    roundStep <= 0 ||
    halfStep <= 0 ||
    majorStep <= 0 ||
    minStep <= 0
  ) {
    return [];
  }

  const bufferSize = config.bufferSize ?? inferBufferSize(referencePrice, minStep);
  if (!Number.isFinite(bufferSize) || bufferSize <= 0) return [];

  const includeHalfLevels = config.includeHalfLevels !== false;
  const gridStep = includeHalfLevels ? halfStep : roundStep;

  const { levelMin, levelMax } = computeLevelBounds(minPrice, maxPrice, halfStep, roundStep);

  if (!Number.isFinite(levelMin) || !Number.isFinite(levelMax) || levelMin > levelMax) return [];

  const seen = new Set<number>();
  const levels: RoundLevel[] = [];

  for (let cursor = levelMin; cursor <= levelMax + gridStep / 2 && levels.length < MAX_LEVELS; cursor += gridStep) {
    const price = roundToStep(cursor, minStep);
    if (!Number.isFinite(price) || price < levelMin - EPS || price > levelMax + EPS) continue;
    if (seen.has(price)) continue;
    seen.add(price);

    const onRound = isOnGrid(price, roundStep);
    const onHalf = includeHalfLevels && isOnGrid(price, halfStep) && !onRound;

    if (!onRound && !onHalf) continue;

    const isHalfLevel = onHalf;
    const step = isHalfLevel ? halfStep : roundStep;
    const buffers = buildBufferZones(price, bufferSize, minStep);

    if (
      !Number.isFinite(buffers.upperBuffer.to) ||
      !Number.isFinite(buffers.lowerBuffer.from) ||
      buffers.upperBuffer.to < buffers.upperBuffer.from ||
      buffers.lowerBuffer.to < buffers.lowerBuffer.from
    ) {
      continue;
    }

    levels.push({
      price,
      label: formatRoundLevelLabel(price, minStep),
      importance: resolveImportance(price, roundStep, halfStep, majorStep, isHalfLevel),
      step,
      upperBuffer: buffers.upperBuffer,
      lowerBuffer: buffers.lowerBuffer,
    });
  }

  return levels.sort((a, b) => a.price - b.price);
}

/** Convenience helper for chart overlays — derive config from candle range. */
export function roundLevelsFromPriceRange(
  minPrice: number,
  maxPrice: number,
  currentPrice?: number,
  overrides?: Partial<RoundLevelConfig>,
): RoundLevel[] {
  return computeRoundLevels({
    minPrice,
    maxPrice,
    currentPrice,
    ...overrides,
  });
}
