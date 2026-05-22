import type { GroupedTapeRow } from "@/lib/domain/orderflow-simulator-engine";
import { isLargeTrade } from "@/lib/domain/orderflow-simulator-engine";
import type { AggressorSide, SimOrderBookLevel, SimTradePrint } from "@/lib/domain/orderflow-simulator";
import { formatOrderBookVolume } from "@/lib/formatters/trading";
import type { DomScrollLayout } from "@/lib/domain/dom-tape-layout";
import type { PriceViewport } from "@/lib/domain/orderflow-price-viewport";
import { priceToTopPct, priceViewportEdge } from "@/lib/domain/orderflow-price-viewport";
import { pricesEqual, selectVisibleLevels, type LadderLevelCount } from "@/lib/domain/order-book-ladder-model";

/** 0 = без агрегации */
export type TapeMergeMs = 0 | 50 | 100 | 250;

export const TAPE_MERGE_OPTIONS: { value: TapeMergeMs; label: string }[] = [
  { value: 0, label: "выкл" },
  { value: 50, label: "50мс" },
  { value: 100, label: "100мс" },
  { value: 250, label: "250мс" },
];

export const BUBBLE_LIFETIME_MS = 8000;
export const BUBBLE_FADE_START_MS = 4000;
export const DEFAULT_MAX_VISIBLE_BUBBLES = 48;

export type TapeBubble = GroupedTapeRow & {
  spawnMs: number;
  jitterX: number;
  jitterY: number;
  large: boolean;
  levelLabel: string;
};

export type PriceRange = {
  min: number;
  max: number;
};

export type BubbleLayout = {
  topPct: number;
  leftPct: number;
  inRange: boolean;
  edge: "top" | "bottom" | null;
};

export type ClusterPulse = {
  price: number;
  timestamp: number;
  until: number;
  strong: boolean;
  /** Сколько сделок/тиков усилили вспышку на уровне */
  hits: number;
};

function hashJitter(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return ((h % 17) - 8) / 10;
}

export function groupTapeForBubbles(trades: SimTradePrint[], mergeMs: TapeMergeMs): GroupedTapeRow[] {
  if (trades.length === 0) return [];
  if (mergeMs === 0) {
    return [...trades]
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((t) => ({
        id: t.id,
        timestamp: t.timestamp,
        price: t.price,
        size: t.size,
        aggressorSide: t.aggressorSide,
        printCount: 1,
      }));
  }

  const sorted = [...trades].sort((a, b) => b.timestamp - a.timestamp);
  const grouped: GroupedTapeRow[] = [];

  for (const trade of sorted) {
    const last = grouped[grouped.length - 1];
    if (
      last &&
      last.aggressorSide === trade.aggressorSide &&
      pricesEqual(last.price, trade.price) &&
      Math.abs(last.timestamp - trade.timestamp) <= mergeMs
    ) {
      last.size += trade.size;
      last.printCount += 1;
      last.timestamp = Math.max(last.timestamp, trade.timestamp);
      continue;
    }

    grouped.push({
      id: trade.id,
      timestamp: trade.timestamp,
      price: trade.price,
      size: trade.size,
      aggressorSide: trade.aggressorSide,
      printCount: 1,
    });
  }

  return grouped;
}

export function eatenBookSide(aggressorSide: AggressorSide): "ask" | "bid" {
  return aggressorSide === "buy" ? "ask" : "bid";
}

export function levelEatenLabel(price: number, side: AggressorSide): string {
  if (side === "buy") return `съеден уровень ask @ ${price.toFixed(2)}`;
  return `съеден уровень bid @ ${price.toFixed(2)}`;
}

export function buildActiveBubbles(
  trades: SimTradePrint[],
  mergeMs: TapeMergeMs,
  nowMs: number,
  maxVisible = DEFAULT_MAX_VISIBLE_BUBBLES,
): TapeBubble[] {
  const grouped = groupTapeForBubbles(trades, mergeMs);
  return grouped
    .filter((row) => nowMs - row.timestamp <= BUBBLE_LIFETIME_MS)
    .slice(0, maxVisible)
    .map((row) => ({
      ...row,
      spawnMs: row.timestamp,
      jitterX: hashJitter(`${row.id}-x`),
      jitterY: hashJitter(`${row.id}-y`),
      large: isLargeTrade(row.size),
      levelLabel: levelEatenLabel(row.price, row.aggressorSide),
    }));
}

export type TapeLevelHighlight = {
  price: number;
  bookSide: "ask" | "bid";
  aggressorSide: AggressorSide;
  timestamp: number;
  strong?: boolean;
};

export function buildTapeLevelHighlights(bubbles: TapeBubble[]): TapeLevelHighlight[] {
  return bubbles.map((b) => ({
    price: b.price,
    bookSide: eatenBookSide(b.aggressorSide),
    aggressorSide: b.aggressorSide,
    timestamp: b.timestamp,
    strong: b.large,
  }));
}

/** Смещение по X для цепочки пузырей на одном уровне */
export function computeBubbleChainOffsets(bubbles: TapeBubble[]): Map<string, number> {
  const sorted = [...bubbles].sort((a, b) => a.timestamp - b.timestamp);
  const counters = new Map<string, number>();
  const offsets = new Map<string, number>();

  for (const bubble of sorted) {
    const bucket = `${bubble.price.toFixed(2)}-${bubble.aggressorSide}`;
    const index = counters.get(bucket) ?? 0;
    counters.set(bucket, index + 1);
    const direction = index % 2 === 0 ? -1 : 1;
    const magnitude = Math.ceil((index + 1) / 2);
    offsets.set(`${bubble.id}-${bubble.timestamp}`, direction * magnitude * 11);
  }

  return offsets;
}

export function getVisiblePriceRangeFromViewport(viewport: PriceViewport): PriceRange {
  return { min: viewport.minPrice, max: viewport.maxPrice };
}

export function getVisiblePriceRange(
  levels: SimOrderBookLevel[],
  currentPrice: number,
  levelCount: LadderLevelCount = 40,
): PriceRange {
  const visible = selectVisibleLevels(levels, currentPrice, levelCount);
  if (visible.length === 0) {
    return { min: currentPrice - 0.2, max: currentPrice + 0.2 };
  }
  return {
    min: visible[visible.length - 1]!.price,
    max: visible[0]!.price,
  };
}

export function layoutBubble(
  bubble: TapeBubble,
  range: PriceRange,
): BubbleLayout {
  const span = range.max - range.min || 0.01;
  const inRange = bubble.price >= range.min - 0.001 && bubble.price <= range.max + 0.001;

  if (!inRange) {
    if (bubble.price > range.max) {
      return { topPct: 2, leftPct: bubble.aggressorSide === "buy" ? 72 : 28, inRange: false, edge: "top" };
    }
    return { topPct: 98, leftPct: bubble.aggressorSide === "buy" ? 72 : 28, inRange: false, edge: "bottom" };
  }

  const topPct = ((range.max - bubble.price) / span) * 100;
  const baseLeft = bubble.aggressorSide === "buy" ? 68 : 22;
  const leftPct = Math.min(88, Math.max(8, baseLeft + bubble.jitterX * 6));

  return {
    topPct: Math.min(97, Math.max(2, topPct + bubble.jitterY * 1.5)),
    leftPct,
    inRange: true,
    edge: null,
  };
}

export type LaneBubbleLayoutMode =
  | { kind: "viewport-pct"; viewport: PriceViewport; laneWidthPx: number }
  | { kind: "dom-scroll"; layout: DomScrollLayout; scrollTopPx: number; laneWidthPx: number; viewport: PriceViewport };

export function layoutLaneBubble(
  bubble: TapeBubble,
  chainOffsetPx: number,
  mode: LaneBubbleLayoutMode,
): BubbleLayout & { topPx?: number } {
  if (mode.kind === "dom-scroll") {
    const { layout, scrollTopPx, laneWidthPx, viewport } = mode;
    const edge = priceViewportEdge(bubble.price, viewport);
    const centerPx = layout.priceToTopPx(bubble.price);
    const topPx = centerPx - scrollTopPx;
    const offsetPct = (chainOffsetPx / Math.max(laneWidthPx, 40)) * 100;
    const baseLeft = 72 + (bubble.aggressorSide === "buy" ? 2 : -2);

    if (edge !== "inside" || topPx < -12 || topPx > layout.contentHeightPx + 12) {
      return {
        topPct: edge === "above" || topPx < 0 ? 2 : 98,
        topPx,
        leftPct: baseLeft + offsetPct,
        inRange: false,
        edge: edge === "above" || topPx < 0 ? "top" : "bottom",
      };
    }

    return {
      topPct: (topPx / layout.contentHeightPx) * 100,
      topPx,
      leftPct: Math.min(92, Math.max(48, baseLeft + offsetPct + bubble.jitterX * 3)),
      inRange: true,
      edge: null,
    };
  }

  const { viewport, laneWidthPx } = mode;
  const edge = priceViewportEdge(bubble.price, viewport);
  if (edge !== "inside") {
    return {
      topPct: edge === "above" ? 3 : 97,
      leftPct: 72 + (bubble.aggressorSide === "buy" ? 2 : -2),
      inRange: false,
      edge: edge === "above" ? "top" : "bottom",
    };
  }

  const topPct = priceToTopPct(bubble.price, viewport);
  const offsetPct = (chainOffsetPx / Math.max(laneWidthPx, 40)) * 100;
  const baseLeft = 72 + (bubble.aggressorSide === "buy" ? 2 : -2);

  return {
    topPct,
    leftPct: Math.min(92, Math.max(48, baseLeft + offsetPct + bubble.jitterX * 3)),
    inRange: true,
    edge: null,
  };
}

export function layoutLaneBubbleFromViewport(
  bubble: TapeBubble,
  viewport: PriceViewport,
  chainOffsetPx: number,
  laneWidthPx = 72,
): BubbleLayout {
  return layoutLaneBubble(bubble, chainOffsetPx, { kind: "viewport-pct", viewport, laneWidthPx });
}

export function layoutLaneBubbleFromRange(
  bubble: TapeBubble,
  range: PriceRange,
  chainOffsetPx: number,
  laneWidthPx = 72,
): BubbleLayout {
  const base = layoutBubble(bubble, range);
  if (base.edge) return base;

  const offsetPct = (chainOffsetPx / Math.max(laneWidthPx, 40)) * 100;
  const sideBias = bubble.aggressorSide === "buy" ? 6 : -6;

  return {
    ...base,
    leftPct: Math.min(90, Math.max(10, 50 + sideBias + offsetPct + bubble.jitterX * 4)),
  };
}

export function formatBubbleVolume(size: number): string {
  return formatOrderBookVolume(size);
}

export function bubbleDiameter(size: number, maxSize: number): number {
  const minPx = 14;
  const maxPx = 40;
  const safeMax = Math.max(maxSize, 1);
  const ratio = Math.sqrt(size) / Math.sqrt(safeMax);
  return Math.round(minPx + Math.min(1, ratio) * (maxPx - minPx));
}

export function bubbleOpacity(ageMs: number): number {
  if (ageMs < 0) return 0;
  if (ageMs < BUBBLE_FADE_START_MS) return 1;
  if (ageMs >= BUBBLE_LIFETIME_MS) return 0;
  return 1 - (ageMs - BUBBLE_FADE_START_MS) / (BUBBLE_LIFETIME_MS - BUBBLE_FADE_START_MS);
}

export function bubbleFreshness(ageMs: number): number {
  if (ageMs < 0) return 0;
  if (ageMs <= 1200) return 1;
  if (ageMs >= BUBBLE_LIFETIME_MS) return 0;
  return Math.max(0.35, 1 - (ageMs - 1200) / (BUBBLE_LIFETIME_MS - 1200) * 0.65);
}

export function aggressorLabelRu(side: AggressorSide): string {
  return side === "buy" ? "рыночная покупка" : "рыночная продажа";
}

export function buildClusterPulses(bubbles: TapeBubble[], nowMs: number, maxVolume: number): ClusterPulse[] {
  const byPrice = new Map<number, ClusterPulse>();

  for (const b of bubbles) {
    const hits = b.printCount ?? 1;
    const until = b.timestamp + BUBBLE_LIFETIME_MS;
    const strong = b.large || b.size >= maxVolume * 0.45;
    const existing = byPrice.get(b.price);

    if (existing) {
      existing.until = Math.max(existing.until, until);
      existing.timestamp = Math.max(existing.timestamp, b.timestamp);
      existing.hits += hits;
      existing.strong = existing.strong || strong;
      continue;
    }

    byPrice.set(b.price, {
      price: b.price,
      timestamp: b.timestamp,
      until,
      strong,
      hits,
    });
  }

  return [...byPrice.values()];
}

export function pulseIntensity(pulse: ClusterPulse): number {
  return Math.min(1, 0.35 + pulse.hits * 0.18 + (pulse.strong ? 0.25 : 0));
}

export function pulseForFootprintCell(
  price: number,
  bucketTimestamp: number,
  pulses: ClusterPulse[],
  latestBucket?: number,
): ClusterPulse | undefined {
  const match = pulses.find((p) => pricesEqual(p.price, price));
  if (!match) return undefined;
  if (latestBucket !== undefined && bucketTimestamp === latestBucket) return match;
  if (latestBucket === undefined) return match;
  return undefined;
}

export function findClusterTimestamp(
  clusters: { price: number; timestamp: number }[],
  price: number,
): number | undefined {
  const matches = clusters.filter((c) => pricesEqual(c.price, price));
  if (matches.length === 0) return undefined;
  return matches.reduce((best, c) => (c.timestamp > best.timestamp ? c : best)).timestamp;
}
