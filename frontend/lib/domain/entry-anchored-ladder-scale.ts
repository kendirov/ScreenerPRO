import type { PositionSide } from "@/lib/domain/perpetual-leverage";
import type { EducationalLevelId } from "@/lib/domain/liquidation-map-labels";
function formatSignedPercent(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

export type LadderScaleMode = "risk_focus" | "full_range";

export const ENTRY_ANCHOR_Y_PCT = 50;

export const HONEST_PLOT_TOP_PCT = 8;
export const HONEST_PLOT_BOTTOM_PCT = 92;

/** @deprecated — entry-anchored scale; min/max не используются для Y */
export type HonestPriceScale = {
  entryPrice: number;
  minPrice: number;
  maxPrice: number;
  mode: LadderScaleMode;
  direction: PositionSide;
  /** Диапазон % выше Entry (положительные проценты). */
  spanUp: number;
  /** Диапазон % ниже Entry (величина отрицательных %). */
  spanDown: number;
  entryYPct: number;
};

export function getRiskFocusSpans(direction: PositionSide): {
  spanUp: number;
  spanDown: number;
} {
  if (direction === "long") {
    return { spanUp: 5, spanDown: 10 };
  }
  return { spanUp: 10, spanDown: 5 };
}

export function percentFromEntry(price: number, entryPrice: number): number {
  if (entryPrice <= 0) return 0;
  return ((price - entryPrice) / entryPrice) * 100;
}

export function isPercentInView(percent: number, scale: HonestPriceScale): boolean {
  if (percent >= 0) return percent <= scale.spanUp + 1e-9;
  return -percent <= scale.spanDown + 1e-9;
}

/** Entry всегда в центре; % → Y без обрезки (для off-screen). */
export function percentToEntryAnchoredYPct(percent: number, scale: HonestPriceScale): number {
  const top = HONEST_PLOT_TOP_PCT;
  const bottom = HONEST_PLOT_BOTTOM_PCT;
  const entryY = scale.entryYPct;
  const roomAbove = entryY - top;
  const roomBelow = bottom - entryY;

  if (Math.abs(percent) < 1e-9) return entryY;
  if (percent > 0) {
    const t = percent / scale.spanUp;
    return entryY - t * roomAbove;
  }
  const t = -percent / scale.spanDown;
  return entryY + t * roomBelow;
}

export function percentToYPctInView(percent: number, scale: HonestPriceScale): number {
  const top = HONEST_PLOT_TOP_PCT;
  const bottom = HONEST_PLOT_BOTTOM_PCT;
  const entryY = scale.entryYPct;
  const roomAbove = entryY - top;
  const roomBelow = bottom - entryY;

  if (Math.abs(percent) < 1e-9) return entryY;
  if (percent > 0) {
    const t = Math.min(percent / scale.spanUp, 1);
    return entryY - t * roomAbove;
  }
  const t = Math.min(-percent / scale.spanDown, 1);
  return entryY + t * roomBelow;
}

export function buildEntryAnchoredScale(params: {
  mode: LadderScaleMode;
  direction: PositionSide;
  entryPrice: number;
  takeProfitPrice: number;
  stopPrice: number;
  liquidationPrice: number;
  liquidationInactive: boolean;
}): HonestPriceScale {
  const { entryPrice, mode, direction, liquidationInactive } = params;
  const levelPercents = [
    0,
    percentFromEntry(params.takeProfitPrice, entryPrice),
    percentFromEntry(params.stopPrice, entryPrice),
  ];
  if (!liquidationInactive) {
    levelPercents.push(percentFromEntry(params.liquidationPrice, entryPrice));
  }

  const prices = [
    entryPrice,
    params.takeProfitPrice,
    params.stopPrice,
    ...(liquidationInactive ? [] : [params.liquidationPrice]),
  ];

  if (mode === "risk_focus") {
    const { spanUp, spanDown } = getRiskFocusSpans(direction);
    return {
      entryPrice,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      mode,
      direction,
      spanUp,
      spanDown,
      entryYPct: ENTRY_ANCHOR_Y_PCT,
    };
  }

  const positive = levelPercents.filter((p) => p > 0);
  const negative = levelPercents.filter((p) => p < 0).map((p) => -p);
  const pad = 0.75;
  const spanUp = Math.max(2.5, ...(positive.length ? positive : [2.5])) + pad;
  const spanDown = Math.max(2.5, ...(negative.length ? negative : [2.5])) + pad;

  return {
    entryPrice,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    mode,
    direction,
    spanUp,
    spanDown,
    entryYPct: ENTRY_ANCHOR_Y_PCT,
  };
}

export function formatLiquidationFarLabel(percent: number): string {
  return `Ликвидация далеко: ${formatSignedPercent(percent)}`;
}

export type LevelClipState = {
  inView: boolean;
  yPct: number;
  clipEdge?: "top" | "bottom";
  clipLabel?: string;
};

export function resolveLevelClipState(
  percent: number,
  scale: HonestPriceScale,
  levelId: EducationalLevelId,
): LevelClipState {
  const inView = isPercentInView(percent, scale);
  if (inView) {
    return {
      inView: true,
      yPct: levelId === "entry" ? scale.entryYPct : percentToYPctInView(percent, scale),
    };
  }

  const yPct =
    percent > scale.spanUp ? HONEST_PLOT_TOP_PCT + 1 : HONEST_PLOT_BOTTOM_PCT - 1;
  const clipEdge: "top" | "bottom" = percent > scale.spanUp ? "top" : "bottom";
  const clipLabel =
    levelId === "liquidation" ? formatLiquidationFarLabel(percent) : undefined;

  return { inView: false, yPct, clipEdge, clipLabel };
}
