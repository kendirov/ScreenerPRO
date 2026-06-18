import {
  isPercentInView,
  percentFromEntry,
  percentToYPctInView,
  type HonestPriceScale,
} from "@/lib/domain/entry-anchored-ladder-scale";
import type { PositionSide } from "@/lib/domain/perpetual-leverage";

/** Популярные плечи для ориентиров на Price Ladder. */
export const LIQUIDATION_GHOST_LEVERAGES = [10, 20, 30, 50] as const;

export type LiquidationGhostLeverage = (typeof LIQUIDATION_GHOST_LEVERAGES)[number];

export type LiquidationGhostLine = {
  leverage: LiquidationGhostLeverage;
  percentFromEntry: number;
  price: number;
  yPct: number;
  inView: boolean;
  isActive: boolean;
  labelNudgePx: number;
};

/** % от Entry до ликвидации (Long — отрицательный, Short — положительный). */
export function liquidationPercentFromEntry(
  leverage: number,
  direction: PositionSide,
): number {
  const move = 100 / Math.max(1, leverage);
  return direction === "long" ? -move : move;
}

export function liquidationPriceFromEntry(
  entryPrice: number,
  leverage: number,
  direction: PositionSide,
): number {
  const pct = liquidationPercentFromEntry(leverage, direction);
  return entryPrice * (1 + pct / 100);
}

const GHOST_LABEL_MIN_GAP_PCT = 3.2;

export function resolveGhostLabelNudges(
  lines: Pick<LiquidationGhostLine, "leverage" | "yPct">[],
): Map<LiquidationGhostLeverage, number> {
  const sorted = [...lines].sort((a, b) => a.yPct - b.yPct);
  const out = new Map<LiquidationGhostLeverage, number>();
  let lastY = -Infinity;
  let clusterIndex = 0;

  for (const line of sorted) {
    if (lastY !== -Infinity && line.yPct - lastY < GHOST_LABEL_MIN_GAP_PCT) {
      clusterIndex += 1;
      const step = 9;
      out.set(line.leverage, clusterIndex % 2 === 0 ? step : -step);
    } else {
      clusterIndex = 0;
      out.set(line.leverage, 0);
    }
    lastY = line.yPct;
  }

  return out;
}

export function buildLiquidationGhostLines(params: {
  entryPrice: number;
  direction: PositionSide;
  activeLeverage: number;
  scale: HonestPriceScale;
  liquidationInactive: boolean;
}): LiquidationGhostLine[] {
  const { entryPrice, direction, activeLeverage, scale, liquidationInactive } = params;
  if (liquidationInactive || entryPrice <= 0) return [];

  const active = Math.round(activeLeverage);
  const raw: Omit<LiquidationGhostLine, "labelNudgePx">[] = [];

  for (const lev of LIQUIDATION_GHOST_LEVERAGES) {
    const percentFromEntryVal = liquidationPercentFromEntry(lev, direction);
    const price = liquidationPriceFromEntry(entryPrice, lev, direction);
    const inView = isPercentInView(percentFromEntryVal, scale);
    if (!inView) continue;

    raw.push({
      leverage: lev,
      percentFromEntry: percentFromEntryVal,
      price,
      yPct: percentToYPctInView(percentFromEntryVal, scale),
      inView: true,
      isActive: active === lev,
    });
  }

  const nudges = resolveGhostLabelNudges(raw);
  return raw.map((line) => ({
    ...line,
    labelNudgePx: nudges.get(line.leverage) ?? 0,
  }));
}

/** Проверка: ghost совпадает с фактической ценой ликвидации (для тестов). */
export function ghostMatchesLiquidationPrice(
  entryPrice: number,
  liquidationPrice: number,
  leverage: number,
  direction: PositionSide,
): boolean {
  const expected = liquidationPriceFromEntry(entryPrice, leverage, direction);
  const pctDiff = Math.abs(percentFromEntry(liquidationPrice, entryPrice) - liquidationPercentFromEntry(leverage, direction));
  return Math.abs(expected - liquidationPrice) <= entryPrice * 0.0001 && pctDiff < 0.05;
}
