import type { PositionSide } from "@/lib/domain/perpetual-leverage";

export type PriceRiskZoneSegment = {
  leftPct: number;
  widthPct: number;
};

export type PriceRiskScaleLayout = {
  min: number;
  max: number;
  entryPct: number;
  stopPct: number;
  liqPct: number;
  profitZone: PriceRiskZoneSegment;
  safeZone: PriceRiskZoneSegment;
  riskZone: PriceRiskZoneSegment;
  liquidationZone: PriceRiskZoneSegment;
  tightLiquidation: boolean;
  liqGlowStrength: number;
};

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function toPct(price: number, min: number, max: number): number {
  if (max <= min) return 50;
  return clampPct(((price - min) / (max - min)) * 100);
}

function segment(fromPct: number, toPct: number): PriceRiskZoneSegment {
  const left = Math.min(fromPct, toPct);
  const right = Math.max(fromPct, toPct);
  return { leftPct: left, widthPct: Math.max(0.5, right - left) };
}

/** Раскладка горизонтальной шкалы — чистая функция для тестов. */
export function buildPriceRiskScaleLayout(params: {
  entryPrice: number;
  stopPrice: number;
  liquidationPrice: number;
  direction: PositionSide;
  leverage: number;
  liquidationDistancePercent: number;
}): PriceRiskScaleLayout {
  const { entryPrice, stopPrice, liquidationPrice, direction, leverage, liquidationDistancePercent } =
    params;

  const entry = Math.max(entryPrice, 1e-9);
  const liq = liquidationPrice;
  const stop = stopPrice;

  const liqDist = Math.abs(entry - liq) / entry;
  const tightLiquidation = liquidationDistancePercent < 8 || liqDist < 0.06;
  const liqGlowStrength = tightLiquidation
    ? Math.min(1, 1 - liquidationDistancePercent / 8)
    : Math.max(0, 0.35 - liquidationDistancePercent / 20);

  const leverageSpan = entry / Math.max(1, leverage);
  const coreMin = Math.min(entry, stop, liq);
  const coreMax = Math.max(entry, stop, liq);
  const coreSpan = coreMax - coreMin;

  const minVisualSpan = Math.max(entry * 0.1, leverageSpan * 2.8, coreSpan * 1.15);
  const profitPad = Math.max(entry * 0.14, minVisualSpan * 0.45);

  let min: number;
  let max: number;

  if (direction === "long") {
    min = coreMin - entry * 0.015;
    max = entry + profitPad;
    if (max - min < minVisualSpan) {
      const center = (entry + liq) / 2;
      min = center - minVisualSpan / 2;
      max = center + minVisualSpan / 2;
      if (max < entry + profitPad * 0.35) max = entry + profitPad * 0.35;
    }
  } else {
    min = entry - profitPad;
    max = coreMax + entry * 0.015;
    if (max - min < minVisualSpan) {
      const center = (entry + liq) / 2;
      min = center - minVisualSpan / 2;
      max = center + minVisualSpan / 2;
      if (min > entry - profitPad * 0.35) min = entry - profitPad * 0.35;
    }
  }

  const entryPct = toPct(entry, min, max);
  const stopPct = toPct(stop, min, max);
  const liqPct = toPct(liq, min, max);

  if (direction === "long") {
    const riskEnd = Math.max(stopPct, liqPct);
    const riskStart = Math.min(stopPct, liqPct);
    return {
      min,
      max,
      entryPct,
      stopPct,
      liqPct,
      profitZone: segment(entryPct, 100),
      safeZone: segment(Math.min(stopPct, entryPct), Math.max(stopPct, entryPct)),
      riskZone: segment(riskStart, riskEnd),
      liquidationZone: segment(0, liqPct),
      tightLiquidation,
      liqGlowStrength,
    };
  }

  const riskStart = Math.min(stopPct, liqPct);
  const riskEnd = Math.max(stopPct, liqPct);
  return {
    min,
    max,
    entryPct,
    stopPct,
    liqPct,
    profitZone: segment(0, entryPct),
    safeZone: segment(Math.min(stopPct, entryPct), Math.max(stopPct, entryPct)),
    riskZone: segment(riskStart, riskEnd),
    liquidationZone: segment(liqPct, 100),
    tightLiquidation,
    liqGlowStrength,
  };
}
