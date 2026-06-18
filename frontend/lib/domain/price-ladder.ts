import {
  buildHonestPriceScale,
  priceToHonestYPct,
  type HonestPriceScale,
} from "@/lib/domain/honest-price-ladder-scale";
import type { PositionSide } from "@/lib/domain/perpetual-leverage";

export type { HonestPriceScale } from "@/lib/domain/honest-price-ladder-scale";
export { buildHonestPriceScale, priceToHonestYPct } from "@/lib/domain/honest-price-ladder-scale";

export type PriceLadderLevelId = "take" | "entry" | "stop" | "liquidation";

export type PriceMarkerStatus =
  | "profit_zone"
  | "normal_risk"
  | "stop_should_trigger"
  | "danger_zone"
  | "liquidated";

export type PriceMarkerStatusMeta = {
  label: string;
  hint: string;
};

export const PRICE_MARKER_STATUS_META: Record<PriceMarkerStatus, PriceMarkerStatusMeta> = {
  profit_zone: {
    label: "PROFIT ZONE",
    hint: "цена идёт в твою сторону.",
  },
  normal_risk: {
    label: "NORMAL RISK",
    hint: "позиция жива, риск контролируем.",
  },
  stop_should_trigger: {
    label: "STOP SHOULD TRIGGER",
    hint: "по плану здесь надо выйти.",
  },
  danger_zone: {
    label: "DANGER",
    hint: "цена слишком близко к ликвидации.",
  },
  liquidated: {
    label: "LIQUIDATED",
    hint: "биржа принудительно закрыла позицию.",
  },
};

/** Статусы для блока «Симуляция движения цены» в Liquidation Map. */
export const PRICE_SIMULATION_STATUS_RU: Record<PriceMarkerStatus, PriceMarkerStatusMeta> = {
  profit_zone: {
    label: "Цена в зоне прибыли",
    hint: "движение в сторону Take Profit.",
  },
  normal_risk: {
    label: "Цена в зоне риска",
    hint: "между Entry и Stop — позиция ещё жива.",
  },
  stop_should_trigger: {
    label: "Стоп должен закрыть позицию",
    hint: "цена достигла уровня Stop-loss.",
  },
  danger_zone: {
    label: "Опасно: рядом ликвидация",
    hint: "мало запаса до принудительного закрытия.",
  },
  liquidated: {
    label: "Позиция ликвидирована",
    hint: "биржа закрыла позицию по цене ликвидации.",
  },
};

/** @deprecated use PRICE_MARKER_STATUS_META */
export const PRICE_MARKER_STATUS_LABEL: Record<PriceMarkerStatus, string> = {
  profit_zone: PRICE_MARKER_STATUS_META.profit_zone.label,
  normal_risk: PRICE_MARKER_STATUS_META.normal_risk.label,
  stop_should_trigger: PRICE_MARKER_STATUS_META.stop_should_trigger.label,
  danger_zone: PRICE_MARKER_STATUS_META.danger_zone.label,
  liquidated: PRICE_MARKER_STATUS_META.liquidated.label,
};

export type PriceLadderAnchor = {
  id: PriceLadderLevelId;
  price: number;
  yPct: number;
};

const LONG_SLOT_Y: Record<PriceLadderLevelId, number> = {
  take: 10,
  entry: 34,
  stop: 58,
  liquidation: 82,
};

const SHORT_SLOT_Y: Record<PriceLadderLevelId, number> = {
  liquidation: 10,
  stop: 34,
  entry: 58,
  take: 82,
};

export function getPriceLadderSlotY(direction: PositionSide, id: PriceLadderLevelId): number {
  return direction === "long" ? LONG_SLOT_Y[id] : SHORT_SLOT_Y[id];
}

export function buildPriceLadderAnchors(params: {
  direction: PositionSide;
  entryPrice: number;
  takeProfitPrice: number;
  stopPrice: number;
  liquidationPrice: number;
  liquidationInactive: boolean;
}): PriceLadderAnchor[] {
  const { direction, entryPrice, takeProfitPrice, stopPrice, liquidationPrice, liquidationInactive } =
    params;

  if (direction === "long") {
    const anchors: PriceLadderAnchor[] = [
      { id: "take", price: takeProfitPrice, yPct: LONG_SLOT_Y.take },
      { id: "entry", price: entryPrice, yPct: LONG_SLOT_Y.entry },
      { id: "stop", price: stopPrice, yPct: LONG_SLOT_Y.stop },
    ];
    if (!liquidationInactive) {
      anchors.push({ id: "liquidation", price: liquidationPrice, yPct: LONG_SLOT_Y.liquidation });
    }
    return anchors;
  }

  if (liquidationInactive) {
    return [
      { id: "stop", price: stopPrice, yPct: 10 },
      { id: "entry", price: entryPrice, yPct: 34 },
      { id: "take", price: takeProfitPrice, yPct: 82 },
    ];
  }

  return [
    { id: "liquidation", price: liquidationPrice, yPct: SHORT_SLOT_Y.liquidation },
    { id: "stop", price: stopPrice, yPct: SHORT_SLOT_Y.stop },
    { id: "entry", price: entryPrice, yPct: SHORT_SLOT_Y.entry },
    { id: "take", price: takeProfitPrice, yPct: SHORT_SLOT_Y.take },
  ];
}

export function priceToEducationalYPct(price: number, anchors: PriceLadderAnchor[]): number {
  if (anchors.length === 0) return 50;
  const sorted = [...anchors].sort((a, b) => b.price - a.price);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];

  if (price >= top.price) return top.yPct;
  if (price <= bottom.price) return bottom.yPct;

  for (let i = 0; i < sorted.length - 1; i++) {
    const hi = sorted[i];
    const lo = sorted[i + 1];
    if (price <= hi.price && price >= lo.price) {
      const span = hi.price - lo.price;
      if (span <= 0) return hi.yPct;
      const t = (hi.price - price) / span;
      return hi.yPct + t * (lo.yPct - hi.yPct);
    }
  }
  return 50;
}

export function getPriceMarkerStatus(params: {
  direction: PositionSide;
  currentPrice: number;
  entryPrice: number;
  stopPrice: number;
  liquidationPrice: number;
  liquidationInactive: boolean;
}): PriceMarkerStatus {
  const { direction, currentPrice, entryPrice, stopPrice, liquidationPrice, liquidationInactive } =
    params;

  if (direction === "long") {
    if (!liquidationInactive) {
      if (currentPrice <= liquidationPrice) return "liquidated";
      if (currentPrice > liquidationPrice && currentPrice <= liquidationPrice * 1.01) {
        return "danger_zone";
      }
      if (currentPrice <= stopPrice && currentPrice > liquidationPrice) {
        return "stop_should_trigger";
      }
    } else if (currentPrice <= stopPrice) {
      return "stop_should_trigger";
    }

    if (currentPrice > entryPrice) return "profit_zone";
    if (currentPrice <= entryPrice && currentPrice > stopPrice) return "normal_risk";
    return "stop_should_trigger";
  }

  if (!liquidationInactive) {
    if (currentPrice >= liquidationPrice) return "liquidated";
    if (currentPrice >= liquidationPrice * 0.99 && currentPrice < liquidationPrice) {
      return "danger_zone";
    }
    if (currentPrice >= stopPrice && currentPrice < liquidationPrice) {
      return "stop_should_trigger";
    }
  } else if (currentPrice >= stopPrice) {
    return "stop_should_trigger";
  }

  if (currentPrice < entryPrice) return "profit_zone";
  if (currentPrice >= entryPrice && currentPrice < stopPrice) return "normal_risk";
  return "stop_should_trigger";
}

export function computePriceLadderDistances(params: {
  direction: PositionSide;
  currentPrice: number;
  entryPrice: number;
  stopPrice: number;
  liquidationPrice: number;
  liquidationInactive: boolean;
}): { distanceToStopPercent: number; distanceToLiquidationPercent: number | null } {
  const { direction, currentPrice, entryPrice, stopPrice, liquidationPrice, liquidationInactive } =
    params;
  if (entryPrice <= 0) return { distanceToStopPercent: 0, distanceToLiquidationPercent: null };

  const distanceToStopPercent =
    direction === "long"
      ? ((currentPrice - stopPrice) / entryPrice) * 100
      : ((stopPrice - currentPrice) / entryPrice) * 100;

  if (liquidationInactive) {
    return { distanceToStopPercent, distanceToLiquidationPercent: null };
  }

  const distanceToLiquidationPercent =
    direction === "long"
      ? ((currentPrice - liquidationPrice) / entryPrice) * 100
      : ((liquidationPrice - currentPrice) / entryPrice) * 100;

  return { distanceToStopPercent, distanceToLiquidationPercent };
}

export function computePriceLadderPnL(params: {
  direction: PositionSide;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  deposit: number;
}): { pnlPercent: number; pnlUsd: number } {
  const { direction, entryPrice, currentPrice, leverage, deposit } = params;
  if (entryPrice <= 0) return { pnlPercent: 0, pnlUsd: 0 };

  const pnlPercent =
    direction === "long"
      ? ((currentPrice - entryPrice) / entryPrice) * 100 * leverage
      : ((entryPrice - currentPrice) / entryPrice) * 100 * leverage;

  const pnlUsd = (deposit * pnlPercent) / 100;
  return { pnlPercent, pnlUsd };
}

export type PriceSimulationSnapshot = {
  currentPrice: number;
  currentYPct: number;
  status: PriceMarkerStatus;
  pnlPercent: number;
  pnlUsd: number;
  distanceToStopPercent: number;
  distanceToLiquidationPercent: number | null;
};

export function computePriceSimulationSnapshot(params: {
  direction: PositionSide;
  entryPrice: number;
  currentPrice: number;
  stopPrice: number;
  takeProfitPrice: number;
  liquidationPrice: number;
  liquidationInactive: boolean;
  leverage: number;
  deposit: number;
  scale: HonestPriceScale;
}): PriceSimulationSnapshot {
  const {
    direction,
    entryPrice,
    currentPrice,
    stopPrice,
    liquidationPrice,
    liquidationInactive,
    leverage,
    deposit,
    scale,
  } = params;

  const status = getPriceMarkerStatus({
    direction,
    currentPrice,
    entryPrice,
    stopPrice,
    liquidationPrice,
    liquidationInactive,
  });
  const { pnlPercent, pnlUsd } = computePriceLadderPnL({
    direction,
    entryPrice,
    currentPrice,
    leverage,
    deposit,
  });
  const { distanceToStopPercent, distanceToLiquidationPercent } = computePriceLadderDistances({
    direction,
    currentPrice,
    entryPrice,
    stopPrice,
    liquidationPrice,
    liquidationInactive,
  });

  return {
    currentPrice,
    currentYPct: priceToHonestYPct(currentPrice, scale),
    status,
    pnlPercent,
    pnlUsd,
    distanceToStopPercent,
    distanceToLiquidationPercent,
  };
}

export function getPriceLadderSliderBounds(params: {
  direction: PositionSide;
  takeProfitPrice: number;
  liquidationPrice: number;
  liquidationInactive: boolean;
  entryPrice: number;
}): { min: number; max: number } {
  const { takeProfitPrice, liquidationPrice, liquidationInactive, entryPrice } = params;
  const pad = entryPrice * 0.008;

  if (liquidationInactive) {
    const lo = Math.min(takeProfitPrice, entryPrice) - pad;
    const hi = Math.max(takeProfitPrice, entryPrice) + pad;
    return { min: lo, max: hi };
  }

  const min = Math.min(liquidationPrice, takeProfitPrice) - pad;
  const max = Math.max(liquidationPrice, takeProfitPrice) + pad;
  return { min, max };
}
