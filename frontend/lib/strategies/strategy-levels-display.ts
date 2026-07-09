import type { StrategyCandle } from "@/lib/screener/strategies/strategy-candles";
import {
  computeRoundLevels,
  type RoundLevel,
  type RoundLevelConfig,
  type RoundLevelImportance,
} from "@/lib/strategies/round-levels-engine";
import { formatLevelImportanceShort } from "@/lib/strategies/strategy-lab-labels";

export const STRATEGY_DEFAULT_MIN_STEP = 0.01;
export const STRATEGY_MAX_VISIBLE_LEVELS = 80;

export type CandlePriceRange = {
  minPrice: number;
  maxPrice: number;
  currentPrice: number;
};

export type RoundLevelDisplayOptions = {
  showHalfLevels: boolean;
  showMajorLevels: boolean;
  levelScope?: "important" | "all";
  bufferSize?: number;
  maxVisible?: number;
  selectedLevelPrice?: number | null;
};

export function candlePriceRangeFromCandles(candles: StrategyCandle[]): CandlePriceRange | null {
  if (candles.length === 0) return null;

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let currentPrice = NaN;

  for (const candle of candles) {
    if (Number.isFinite(candle.low)) minPrice = Math.min(minPrice, candle.low);
    if (Number.isFinite(candle.high)) maxPrice = Math.max(maxPrice, candle.high);
    if (Number.isFinite(candle.close)) currentPrice = candle.close;
  }

  if (
    !Number.isFinite(minPrice) ||
    !Number.isFinite(maxPrice) ||
    !Number.isFinite(currentPrice) ||
    minPrice >= maxPrice
  ) {
    return null;
  }

  return { minPrice, maxPrice, currentPrice };
}

export function computeStrategyLevelsFromCandles(
  candles: StrategyCandle[],
  options: Pick<RoundLevelConfig, "minStep" | "bufferSize" | "includeHalfLevels"> & {
    board?: string;
  } = {},
): RoundLevel[] {
  const range = candlePriceRangeFromCandles(candles);
  if (!range) return [];

  const minStep = options.minStep ?? STRATEGY_DEFAULT_MIN_STEP;

  return computeRoundLevels({
    minPrice: range.minPrice,
    maxPrice: range.maxPrice,
    currentPrice: range.currentPrice,
    minStep,
    bufferSize: options.bufferSize,
    includeHalfLevels: options.includeHalfLevels,
  });
}

const IMPORTANCE_RANK: Record<RoundLevelImportance, number> = {
  psychological: 4,
  major: 3,
  normal: 2,
  minor: 1,
};

function nearCurrentPrice(level: RoundLevel, currentPrice: number, band: number): boolean {
  return Math.abs(level.price - currentPrice) <= band;
}

function findClosestLevel(levels: RoundLevel[], price: number): RoundLevel | null {
  if (levels.length === 0 || !Number.isFinite(price)) return null;
  return levels.reduce((best, level) =>
    Math.abs(level.price - price) < Math.abs(best.price - price) ? level : best,
  );
}

/**
 * Default selected level: nearest round/major/psych level to last close,
 * preferring whole-number grid levels over half-levels at equal distance.
 */
export function findDefaultSelectedLevelPrice(levels: RoundLevel[], currentPrice: number): number | null {
  if (levels.length === 0 || !Number.isFinite(currentPrice)) return null;

  const roundLevels = levels.filter((level) => level.importance !== "minor");
  const pool = roundLevels.length > 0 ? roundLevels : levels;
  const closest = findClosestLevel(pool, currentPrice);
  if (!closest) return null;

  const roundStep = closest.step >= 1 ? closest.step : 1;
  const nearestInteger = Math.round(currentPrice / roundStep) * roundStep;
  const integerLevel = pool.find((level) => Math.abs(level.price - nearestInteger) < 1e-6);
  if (integerLevel && Math.abs(integerLevel.price - currentPrice) <= roundStep * 0.55) {
    return integerLevel.price;
  }

  return closest.price;
}

/**
 * Filter levels for chart overlay — respects layer toggles, keeps full local grid.
 */
export function filterRoundLevelsForDisplay(
  levels: RoundLevel[],
  options: RoundLevelDisplayOptions,
  range?: CandlePriceRange | null,
): RoundLevel[] {
  if (levels.length === 0) return [];

  const maxVisible = options.maxVisible ?? STRATEGY_MAX_VISIBLE_LEVELS;
  let filtered = [...levels];

  if (!options.showHalfLevels) {
    filtered = filtered.filter((level) => level.importance !== "minor");
  }

  if (!options.showMajorLevels) {
    filtered = filtered.filter(
      (level) => level.importance !== "major" && level.importance !== "psychological",
    );
  }

  if (options.levelScope === "important") {
    filtered = filtered.filter(
      (level) => level.importance === "major" || level.importance === "psychological",
    );
  }

  if (options.selectedLevelPrice != null && Number.isFinite(options.selectedLevelPrice)) {
    const selected = levels.find((level) => Math.abs(level.price - options.selectedLevelPrice!) < 1e-6);
    if (selected && !filtered.some((level) => level.price === selected.price)) {
      filtered.push(selected);
    }
  }

  if (filtered.length <= maxVisible) {
    return filtered.sort((a, b) => a.price - b.price);
  }

  if (range) {
    const span = Math.max(range.maxPrice - range.minPrice, range.currentPrice * 0.02);
    const band = span * 1.5;
    const near = filtered.filter((level) => nearCurrentPrice(level, range.currentPrice, band));
    if (near.length > 0) {
      filtered = near;
    }
  }

  if (filtered.length > maxVisible) {
    filtered = filtered.filter((level) => level.importance !== "minor");
  }

  if (filtered.length > maxVisible) {
    filtered = [...filtered]
      .sort((a, b) => IMPORTANCE_RANK[b.importance] - IMPORTANCE_RANK[a.importance])
      .slice(0, maxVisible);
  }

  return filtered.sort((a, b) => a.price - b.price);
}

export function importanceLabel(importance: RoundLevelImportance): string {
  return formatLevelImportanceShort(importance);
}
