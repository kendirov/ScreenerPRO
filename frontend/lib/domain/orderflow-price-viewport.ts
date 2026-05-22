import { roundPrice, TICK_SIZE } from "@/lib/domain/orderflow-simulator";
import { pricesEqual } from "@/lib/domain/order-book-ladder-model";

export type PriceViewport = {
  minPrice: number;
  maxPrice: number;
  centerPrice: number;
  tickSize: number;
  levelsCount: number;
  /** Дискретные уровни цены сверху вниз (max → min) */
  prices: number[];
  /** 0 = верх (max), 1 = низ (min) */
  priceToY: (price: number) => number;
  yToPrice: (y: number) => number;
};

export type CreatePriceViewportOptions = {
  centerPrice: number;
  tickSize?: number;
  levelsCount: number;
  paddingTicks?: number;
};

const DEFAULT_PADDING_TICKS = 2;
export const VIEWPORT_EDGE_RECENTER_TICKS = 6;

export function createPriceViewport({
  centerPrice,
  tickSize = TICK_SIZE,
  levelsCount,
  paddingTicks = DEFAULT_PADDING_TICKS,
}: CreatePriceViewportOptions): PriceViewport {
  const half = Math.floor(levelsCount / 2);
  const spanTicks = half + paddingTicks;
  const roundedCenter = roundPrice(centerPrice, tickSize);

  const maxPrice = roundPrice(roundedCenter + spanTicks * tickSize, tickSize);
  const minPrice = roundPrice(roundedCenter - spanTicks * tickSize, tickSize);
  const span = maxPrice - minPrice || tickSize;

  const prices: number[] = [];
  for (let price = maxPrice; price >= minPrice - tickSize / 4; price -= tickSize) {
    prices.push(roundPrice(price, tickSize));
  }

  const priceToY = (price: number) => {
    const clamped = clampPriceToViewport(price, { minPrice, maxPrice });
    return (maxPrice - clamped) / span;
  };

  const yToPrice = (y: number) => {
    const normalized = Math.min(1, Math.max(0, y));
    return roundPrice(maxPrice - normalized * span, tickSize);
  };

  return {
    minPrice,
    maxPrice,
    centerPrice: roundedCenter,
    tickSize,
    levelsCount,
    prices,
    priceToY,
    yToPrice,
  };
}

export function priceToRowIndex(price: number, viewport: PriceViewport): number {
  const idx = viewport.prices.findIndex((p) => pricesEqual(p, price));
  if (idx >= 0) return idx;
  const y = viewport.priceToY(price);
  return Math.round(y * Math.max(viewport.prices.length - 1, 0));
}

export function clampPriceToViewport(price: number, viewport: Pick<PriceViewport, "minPrice" | "maxPrice">): number {
  return Math.min(viewport.maxPrice, Math.max(viewport.minPrice, price));
}

export function isPriceInViewport(price: number, viewport: PriceViewport): boolean {
  return price >= viewport.minPrice - viewport.tickSize / 2 && price <= viewport.maxPrice + viewport.tickSize / 2;
}

export function priceViewportEdge(
  price: number,
  viewport: PriceViewport,
): "above" | "below" | "inside" {
  if (price > viewport.maxPrice + viewport.tickSize / 2) return "above";
  if (price < viewport.minPrice - viewport.tickSize / 2) return "below";
  return "inside";
}

/** Y в процентах (0–100) для CSS top */
export function priceToTopPct(price: number, viewport: PriceViewport): number {
  const y = viewport.priceToY(price);
  return Math.min(98, Math.max(2, y * 100));
}

export function formatViewportPrice(price: number, tickSize = TICK_SIZE): string {
  const decimals = tickSize >= 1 ? 0 : tickSize >= 0.1 ? 1 : 2;
  return price.toLocaleString("ru-RU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function shouldSuggestRecenter(currentPrice: number, viewport: PriceViewport): boolean {
  const distTop = (viewport.maxPrice - currentPrice) / viewport.tickSize;
  const distBottom = (currentPrice - viewport.minPrice) / viewport.tickSize;
  return distTop < VIEWPORT_EDGE_RECENTER_TICKS || distBottom < VIEWPORT_EDGE_RECENTER_TICKS;
}
