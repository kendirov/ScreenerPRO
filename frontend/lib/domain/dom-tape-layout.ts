import { roundPrice } from "@/lib/domain/orderflow-simulator";
import { pricesEqual } from "@/lib/domain/order-book-ladder-model";
import type { PriceViewport } from "@/lib/domain/orderflow-price-viewport";
import { priceViewportEdge } from "@/lib/domain/orderflow-price-viewport";

export type DomScrollLayout = {
  rowHeightPx: number;
  currentRowHeightPx: number;
  contentHeightPx: number;
  priceToTopPx: (price: number) => number;
};

const CURRENT_ROW_EXTRA_PX = 4;

export function buildDomScrollLayout(
  viewport: PriceViewport,
  currentPrice: number,
  rowHeightPx: number,
): DomScrollLayout {
  const tick = viewport.tickSize;
  const roundedCurrent = roundPrice(currentPrice, tick);

  const askPrices = viewport.prices.filter((p) => p > currentPrice + tick / 2);
  const bidPrices = viewport.prices.filter((p) => p < currentPrice - tick / 2);

  const currentRowHeightPx = rowHeightPx + CURRENT_ROW_EXTRA_PX;
  const priceCenters = new Map<number, number>();
  let y = 0;

  for (const price of askPrices) {
    priceCenters.set(price, y + rowHeightPx / 2);
    y += rowHeightPx;
  }

  priceCenters.set(roundedCurrent, y + currentRowHeightPx / 2);
  y += currentRowHeightPx;

  for (const price of bidPrices) {
    priceCenters.set(price, y + rowHeightPx / 2);
    y += rowHeightPx;
  }

  const contentHeightPx = Math.max(y, rowHeightPx * 4);

  const priceToTopPx = (price: number): number => {
    const edge = priceViewportEdge(price, viewport);
    if (edge === "above") return 10;
    if (edge === "below") return contentHeightPx - 10;

    for (const [p, center] of priceCenters) {
      if (pricesEqual(p, price)) return center;
    }

    const yNorm = viewport.priceToY(price);
    return yNorm * contentHeightPx;
  };

  return {
    rowHeightPx,
    currentRowHeightPx,
    contentHeightPx,
    priceToTopPx,
  };
}
