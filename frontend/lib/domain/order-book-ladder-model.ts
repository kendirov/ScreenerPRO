import type { ExecutedLevelFlash } from "@/lib/domain/orderflow-simulator-engine";
import type { AggressorSide, SimClusterCell, SimOrderBookLevel, SimTradePrint } from "@/lib/domain/orderflow-simulator";
import { TICK_SIZE } from "@/lib/domain/orderflow-simulator";
import { formatOrderBookVolume } from "@/lib/formatters/trading";

export type LadderLevelCount = 20 | 40 | 60 | 80 | 100;
export type LadderLotStep = 1 | 10 | 100 | 400 | 2000;
export type LadderRowHeight = 15 | 16 | 18 | 22;

/** Масштаб горизонтальной подсветки объёма: N лотов = 100% ширины бара */
export type DepthScalePreset = 10000 | 20000 | 50000 | "auto";

export const DEFAULT_DEPTH_SCALE: DepthScalePreset = 20000;
export const LARGE_WALL_LOTS = 10_000;

export type LadderSettings = {
  levelCount: LadderLevelCount;
  lotStep: LadderLotStep;
  rowHeight: LadderRowHeight;
  autoCenter: boolean;
  showProfile: boolean;
  showDensities: boolean;
  showRoundPrints: boolean;
  depthScale: DepthScalePreset;
};

export const DEFAULT_LADDER_SETTINGS: LadderSettings = {
  levelCount: 80,
  lotStep: 1,
  rowHeight: 16,
  autoCenter: true,
  showProfile: true,
  showDensities: true,
  showRoundPrints: true,
  depthScale: DEFAULT_DEPTH_SCALE,
};

/** Настройки по умолчанию для режима «Привод» / «Стакан крупно» (компактный DOM) */
export const DEFAULT_DOM_LADDER_SETTINGS: LadderSettings = {
  ...DEFAULT_LADDER_SETTINGS,
  rowHeight: 16,
  showProfile: true,
  showDensities: true,
  showRoundPrints: true,
  depthScale: 20000,
  autoCenter: true,
};

export type BestBidAsk = {
  bestBid: number | null;
  bestAsk: number | null;
};

export type DepthStats = {
  maxBid: number;
  maxAsk: number;
  bidP90: number;
  askP90: number;
  bidAvg: number;
  askAvg: number;
};

export type LevelZone = "ask" | "bid" | "spread" | "neutral";
export type DomGridLineKind = "none" | "tick10" | "round";

const PRICE_EPS = TICK_SIZE / 2;

export function pricesEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < PRICE_EPS;
}

export function isLargeWall(size: number, flaggedLarge?: boolean): boolean {
  return flaggedLarge === true || size >= LARGE_WALL_LOTS;
}

/** Горизонтальные разделители: каждые 10 тиков; .00 / .50 / .80 — заметнее */
export function getDomGridLineKind(price: number, tickSize = TICK_SIZE): DomGridLineKind {
  const ticksFromInt = Math.round((price % 1) / tickSize);
  if (ticksFromInt === 0 || ticksFromInt === 50 || ticksFromInt === 80) return "round";
  if (ticksFromInt % 10 === 0) return "tick10";
  return "none";
}

export function findBestBidAsk(levels: SimOrderBookLevel[]): BestBidAsk {
  let bestBid: number | null = null;
  let bestAsk: number | null = null;

  for (const level of levels) {
    if (level.bidSize > 0 && (bestBid === null || level.price > bestBid)) {
      bestBid = level.price;
    }
    if (level.askSize > 0 && (bestAsk === null || level.price < bestAsk)) {
      bestAsk = level.price;
    }
  }

  return { bestBid, bestAsk };
}

export function getLevelZone(price: number, best: BestBidAsk): LevelZone {
  const { bestBid, bestAsk } = best;
  if (bestBid !== null && bestAsk !== null && price < bestAsk && price > bestBid) {
    return "spread";
  }
  if (bestAsk !== null && price >= bestAsk) return "ask";
  if (bestBid !== null && price <= bestBid) return "bid";
  if (bestAsk !== null && price > bestAsk) return "ask";
  if (bestBid !== null && price < bestBid) return "bid";
  return "neutral";
}

function percentile90(values: number[]): number {
  const nonZero = values.filter((v) => v > 0);
  if (nonZero.length === 0) return Infinity;
  const sorted = [...nonZero].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));
  return sorted[idx] ?? Infinity;
}

function average(values: number[]): number {
  const nonZero = values.filter((v) => v > 0);
  if (nonZero.length === 0) return 0;
  return nonZero.reduce((sum, v) => sum + v, 0) / nonZero.length;
}

export function computeDepthStats(levels: SimOrderBookLevel[]): DepthStats {
  const bidSizes = levels.map((l) => l.bidSize);
  const askSizes = levels.map((l) => l.askSize);
  return {
    maxBid: Math.max(...bidSizes, 1),
    maxAsk: Math.max(...askSizes, 1),
    bidP90: percentile90(bidSizes),
    askP90: percentile90(askSizes),
    bidAvg: average(bidSizes),
    askAvg: average(askSizes),
  };
}

export function resolveDepthScale(preset: DepthScalePreset, stats: DepthStats): number {
  if (preset === "auto") {
    const peak = Math.max(stats.maxBid, stats.maxAsk, stats.bidP90, stats.askP90);
    if (peak <= 12_000) return 10_000;
    if (peak <= 28_000) return 20_000;
    return 50_000;
  }
  return preset;
}

/** Доля ширины бара: depthScale лотов = 100% */
export function volumeDepthPercent(size: number, depthScale: number): number {
  if (size <= 0 || depthScale <= 0) return 0;
  return Math.min(100, (size / depthScale) * 100);
}

export function isDensitySize(
  size: number,
  side: "bid" | "ask",
  stats: DepthStats,
  flaggedLarge: boolean,
): boolean {
  if (size <= 0) return false;
  if (flaggedLarge) return true;
  const p90 = side === "bid" ? stats.bidP90 : stats.askP90;
  const avg = side === "bid" ? stats.bidAvg : stats.askAvg;
  return size >= p90 || (avg > 0 && size >= avg * 2.5);
}

export function spreadTicks(best: BestBidAsk): number | null {
  const { bestBid, bestAsk } = best;
  if (bestBid === null || bestAsk === null || bestAsk <= bestBid) return null;
  return Math.round((bestAsk - bestBid) / TICK_SIZE);
}

export function volumeBarAlpha(ratio: number): number {
  if (ratio <= 0) return 0;
  return Math.min(0.92, Math.max(0.06, ratio * 0.88));
}

export function selectVisibleLevels(
  levels: SimOrderBookLevel[],
  currentPrice: number,
  levelCount: LadderLevelCount,
): SimOrderBookLevel[] {
  const sorted = [...levels].sort((a, b) => b.price - a.price);
  if (sorted.length <= levelCount) return sorted;

  let centerIdx = sorted.findIndex((l) => pricesEqual(l.price, currentPrice));
  if (centerIdx < 0) {
    centerIdx = sorted.findIndex((l) => l.price <= currentPrice);
    if (centerIdx < 0) centerIdx = sorted.length - 1;
  }

  const half = Math.floor(levelCount / 2);
  let start = Math.max(0, centerIdx - half);
  const end = Math.min(sorted.length, start + levelCount);
  start = Math.max(0, end - levelCount);

  return sorted.slice(start, end);
}

export function formatLots(size: number, _lotStep: LadderLotStep = 1): string {
  return formatOrderBookVolume(size);
}

export function countTradesAtPrice(trades: SimTradePrint[], price: number): number {
  return trades.filter((t) => pricesEqual(t.price, price)).length;
}

export function getClusterAtPrice(clusters: SimClusterCell[], price: number): SimClusterCell | undefined {
  const matches = clusters.filter((c) => pricesEqual(c.price, price));
  if (matches.length === 0) return undefined;
  return matches.reduce((best, cell) => (cell.timestamp > best.timestamp ? cell : best));
}

export type ActiveFlash = ExecutedLevelFlash & { ageMs: number };

export function getActiveFlashes(
  flashes: ExecutedLevelFlash[],
  nowMs: number,
  ttlMs = 600,
): ActiveFlash[] {
  return flashes
    .map((flash) => ({ ...flash, ageMs: nowMs - flash.timestamp }))
    .filter((flash) => flash.ageMs >= 0 && flash.ageMs <= ttlMs);
}

export function flashesAtPrice(
  flashes: ActiveFlash[],
  price: number,
  side: "bid" | "ask",
): ActiveFlash[] {
  return flashes.filter((f) => pricesEqual(f.price, price) && f.side === side);
}

export function cumulativeBidDepth(levels: SimOrderBookLevel[], fromPrice: number): Map<number, number> {
  const sorted = [...levels].filter((l) => l.bidSize > 0 && l.price <= fromPrice).sort((a, b) => b.price - a.price);
  const map = new Map<number, number>();
  let cum = 0;
  for (const level of sorted) {
    cum += level.bidSize;
    map.set(level.price, cum);
  }
  return map;
}

export function cumulativeAskDepth(levels: SimOrderBookLevel[], fromPrice: number): Map<number, number> {
  const sorted = [...levels].filter((l) => l.askSize > 0 && l.price >= fromPrice).sort((a, b) => a.price - b.price);
  const map = new Map<number, number>();
  let cum = 0;
  for (const level of sorted) {
    cum += level.askSize;
    map.set(level.price, cum);
  }
  return map;
}

export function profileWidth(cumulative: number, maxCumulative: number): number {
  if (maxCumulative <= 0 || cumulative <= 0) return 0;
  return Math.min(100, (cumulative / maxCumulative) * 100);
}

export type LevelTooltipData = {
  price: number;
  bidSize: number;
  askSize: number;
  zone: LevelZone;
  bidDensity: boolean;
  askDensity: boolean;
  bidIceberg: boolean;
  askIceberg: boolean;
  tradeCount: number;
  delta: number | null;
  aggressorHint: AggressorSide | null;
};

export type DomLevelTooltipData = LevelTooltipData & {
  side: "ask" | "bid";
  volume: number;
  depthScale: number;
  pctOfScale: number;
  isLarge: boolean;
  isRoundLevel: boolean;
  isMarketMaker: boolean;
};

export function buildLevelTooltip(
  level: SimOrderBookLevel,
  zone: LevelZone,
  stats: DepthStats,
  showDensities: boolean,
  trades: SimTradePrint[],
  clusters: SimClusterCell[],
  recentFlash: ActiveFlash | undefined,
): LevelTooltipData {
  const cluster = getClusterAtPrice(clusters, level.price);
  return {
    price: level.price,
    bidSize: level.bidSize,
    askSize: level.askSize,
    zone,
    bidDensity: showDensities && isDensitySize(level.bidSize, "bid", stats, Boolean(level.bidIsLarge)),
    askDensity: showDensities && isDensitySize(level.askSize, "ask", stats, Boolean(level.askIsLarge)),
    bidIceberg: Boolean(level.bidIsIceberg),
    askIceberg: Boolean(level.askIsIceberg),
    tradeCount: countTradesAtPrice(trades, level.price),
    delta: cluster?.delta ?? null,
    aggressorHint: recentFlash?.aggressorSide ?? null,
  };
}

export function buildDomLevelTooltip(
  level: SimOrderBookLevel,
  side: "ask" | "bid",
  stats: DepthStats,
  settings: LadderSettings,
  trades: SimTradePrint[],
  clusters: SimClusterCell[],
  recentFlash: ActiveFlash | undefined,
  depthScale: number,
): DomLevelTooltipData {
  const volume = side === "ask" ? level.askSize : level.bidSize;
  const base = buildLevelTooltip(
    level,
    side,
    stats,
    settings.showDensities,
    trades,
    clusters,
    recentFlash,
  );
  const isLargeFlag = side === "ask" ? level.askIsLarge : level.bidIsLarge;
  return {
    ...base,
    side,
    volume,
    depthScale,
    pctOfScale: volumeDepthPercent(volume, depthScale),
    isLarge: isLargeWall(volume, isLargeFlag),
    isRoundLevel: Boolean(level.isRoundLevel),
    isMarketMaker: Boolean(level.isMarketMakerLevel),
  };
}
