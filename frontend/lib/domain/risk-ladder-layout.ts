import type { PositionSide } from "@/lib/domain/perpetual-leverage";

export type RiskLadderMarkerId = "take" | "entry" | "stop" | "liquidation";

export type RiskLadderMarker = {
  id: RiskLadderMarkerId;
  label: string;
  price: number;
};

export type RiskLadderLayout = {
  markers: Array<RiskLadderMarker & { yPct: number }>;
  airGap: {
    yTopPct: number;
    yBottomPct: number;
    percentOfEntry: number;
  } | null;
  priceMin: number;
  priceMax: number;
};

function clampPct(v: number): number {
  return Math.min(96, Math.max(4, v));
}

function priceToYPct(price: number, top: number, bottom: number): number {
  if (top <= bottom) return 50;
  return clampPct(((top - price) / (top - bottom)) * 100);
}

/** Вертикальная раскладка: сверху вниз — от max цены к min. */
export function buildRiskLadderLayout(params: {
  takeProfitPrice: number;
  entryPrice: number;
  stopPrice: number;
  liquidationPrice: number;
  direction: PositionSide;
  liquidationInactive: boolean;
}): RiskLadderLayout {
  const { takeProfitPrice, entryPrice, stopPrice, liquidationPrice, direction, liquidationInactive } =
    params;

  const prices = liquidationInactive
    ? [takeProfitPrice, entryPrice, stopPrice]
    : [takeProfitPrice, entryPrice, stopPrice, liquidationPrice];

  const coreMin = Math.min(...prices);
  const coreMax = Math.max(...prices);
  const span = coreMax - coreMin || entryPrice * 0.08;
  const pad = Math.max(span * 0.14, entryPrice * 0.04);
  const priceMax = coreMax + pad;
  const priceMin = coreMin - pad;

  const markersRaw: RiskLadderMarker[] =
    direction === "long"
      ? [
          { id: "take", label: "Take Profit", price: takeProfitPrice },
          { id: "entry", label: "Entry", price: entryPrice },
          { id: "stop", label: "Stop-loss", price: stopPrice },
          { id: "liquidation", label: "Liquidation", price: liquidationPrice },
        ]
      : [
          { id: "liquidation", label: "Liquidation", price: liquidationPrice },
          { id: "stop", label: "Stop-loss", price: stopPrice },
          { id: "entry", label: "Entry", price: entryPrice },
          { id: "take", label: "Take Profit", price: takeProfitPrice },
        ];

  const markers = markersRaw
    .filter((m) => m.id !== "liquidation" || !liquidationInactive)
    .map((m) => ({
      ...m,
      yPct: priceToYPct(m.price, priceMax, priceMin),
    }))
    .sort((a, b) => a.yPct - b.yPct);

  let airGap: RiskLadderLayout["airGap"] = null;
  if (!liquidationInactive) {
    const stopY = priceToYPct(stopPrice, priceMax, priceMin);
    const liqY = priceToYPct(liquidationPrice, priceMax, priceMin);
    const yTopPct = Math.min(stopY, liqY);
    const yBottomPct = Math.max(stopY, liqY);
    const percentOfEntry =
      entryPrice > 0 ? (Math.abs(stopPrice - liquidationPrice) / entryPrice) * 100 : 0;
    airGap = { yTopPct, yBottomPct, percentOfEntry };
  }

  return { markers, airGap, priceMin, priceMax };
}
