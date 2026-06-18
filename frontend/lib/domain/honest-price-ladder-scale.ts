import type { PositionSide } from "@/lib/domain/perpetual-leverage";
import type { EducationalLevelId } from "@/lib/domain/liquidation-map-labels";
import { LADDER_LEVEL_LABELS, LADDER_ZONE_LABELS } from "@/lib/domain/liquidation-map-labels";
import {
  buildEntryAnchoredScale,
  ENTRY_ANCHOR_Y_PCT,
  getRiskFocusSpans,
  HONEST_PLOT_BOTTOM_PCT,
  HONEST_PLOT_TOP_PCT,
  isPercentInView,
  percentFromEntry,
  percentToYPctInView,
  resolveLevelClipState,
  type HonestPriceScale,
  type LadderScaleMode,
} from "@/lib/domain/entry-anchored-ladder-scale";

export type { HonestPriceScale, LadderScaleMode };
export {
  ENTRY_ANCHOR_Y_PCT,
  HONEST_PLOT_TOP_PCT,
  HONEST_PLOT_BOTTOM_PCT,
  buildEntryAnchoredScale,
  getRiskFocusSpans,
  isPercentInView,
  percentFromEntry,
};

export type HonestAxisTickRole = "default" | EducationalLevelId;

export type HonestAxisTick = {
  price: number;
  yPct: number;
  percentFromEntry: number;
  percentLabel: string;
  role: HonestAxisTickRole;
};

export type LevelLabelPlacement = {
  side: "left" | "right";
  compact: boolean;
  ultraCompact: boolean;
  nudgePx: number;
};

export type HonestLevelLine = {
  id: EducationalLevelId;
  title: string;
  tagline: string;
  hint: string;
  price: number;
  percentLabel: string;
  percentFromEntry: number;
  yPct: number;
  inView: boolean;
  clipEdge?: "top" | "bottom";
  clipLabel?: string;
  /** Компактная подпись на линии (ликвидация). */
  inlineLabel?: string;
};

export type HonestZoneBand = {
  id: "profit" | "controlled" | "danger_buffer" | "liquidation";
  label: string;
  topYPct: number;
  bottomYPct: number;
};

export function formatSignedPercent(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

export function labelMinGapPctForLeverage(leverage: number): number {
  const L = Math.max(1, Math.round(leverage));
  if (L >= 50) return 4.5;
  if (L >= 30) return 5.5;
  if (L >= 20) return 7;
  return 8.5;
}

const PRICE_MATCH_EPS_RATIO = 0.0004;

function pricesMatch(a: number, b: number, entryPrice: number): boolean {
  return Math.abs(a - b) <= Math.max(entryPrice * PRICE_MATCH_EPS_RATIO, 0.008);
}

function tickRoleForPrice(
  price: number,
  entryPrice: number,
  levels: { id: EducationalLevelId; price: number }[],
): HonestAxisTickRole {
  for (const level of levels) {
    if (pricesMatch(price, level.price, entryPrice)) return level.id;
  }
  return "default";
}

export function buildHonestPriceScale(params: {
  entryPrice: number;
  takeProfitPrice: number;
  stopPrice: number;
  liquidationPrice: number;
  liquidationInactive: boolean;
  direction: PositionSide;
  mode?: LadderScaleMode;
}): HonestPriceScale {
  return buildEntryAnchoredScale({
    mode: params.mode ?? "risk_focus",
    direction: params.direction,
    entryPrice: params.entryPrice,
    takeProfitPrice: params.takeProfitPrice,
    stopPrice: params.stopPrice,
    liquidationPrice: params.liquidationPrice,
    liquidationInactive: params.liquidationInactive,
  });
}

/** Entry зафиксирован в центре; уровни по % от Entry. */
export function priceToHonestYPct(price: number, scale: HonestPriceScale): number {
  if (pricesMatch(price, scale.entryPrice, scale.entryPrice)) {
    return scale.entryYPct;
  }
  const pct = percentFromEntry(price, scale.entryPrice);
  if (!isPercentInView(pct, scale)) {
    return pct > 0 ? HONEST_PLOT_TOP_PCT : HONEST_PLOT_BOTTOM_PCT;
  }
  return percentToYPctInView(pct, scale);
}

function riskFocusTickPercents(scale: HonestPriceScale): number[] {
  const { spanUp, spanDown } = scale;
  return [spanUp, spanUp * 0.5, 0, -spanDown * 0.5, -spanDown];
}

export function buildHonestAxisTicks(
  scale: HonestPriceScale,
  tickCount = 6,
  levelPrices?: { id: EducationalLevelId; price: number }[],
): HonestAxisTick[] {
  const levels = levelPrices ?? [{ id: "entry" as const, price: scale.entryPrice }];
  const percents =
    scale.mode === "risk_focus"
      ? riskFocusTickPercents(scale)
      : buildEvenPercentTicks(scale, tickCount);

  return percents.map((pct) => {
    const price = scale.entryPrice * (1 + pct / 100);
    const role =
      Math.abs(pct) < 1e-9 ? "entry" : tickRoleForPrice(price, scale.entryPrice, levels);
    return {
      price,
      yPct: Math.abs(pct) < 1e-9 ? scale.entryYPct : percentToYPctInView(pct, scale),
      percentFromEntry: pct,
      percentLabel: role === "entry" ? "0.00%" : formatSignedPercent(pct),
      role,
    };
  });
}

function buildEvenPercentTicks(scale: HonestPriceScale, count: number): number[] {
  const n = Math.min(7, Math.max(5, count));
  const maxP = scale.spanUp;
  const minP = -scale.spanDown;
  const step = (maxP - minP) / (n - 1);
  const raw: number[] = [];
  for (let i = 0; i < n; i++) {
    raw.push(maxP - step * i);
  }
  if (!raw.some((p) => Math.abs(p) < 0.01)) {
    const mid = Math.min(n - 1, Math.max(0, Math.round(n / 2) - 1));
    raw[mid] = 0;
  }
  return raw;
}

export function resolveLevelLabelPlacements(
  levels: { id: EducationalLevelId; yPct: number }[],
  options?: { minGapPct?: number; leverage?: number },
): Record<EducationalLevelId, LevelLabelPlacement> {
  const leverage = options?.leverage ?? 10;
  const minGapPct = options?.minGapPct ?? labelMinGapPctForLeverage(leverage);

  const defaults = (): LevelLabelPlacement => ({
    side: "right",
    compact: false,
    ultraCompact: false,
    nudgePx: 0,
  });
  const out = Object.fromEntries(levels.map((l) => [l.id, defaults()])) as Record<
    EducationalLevelId,
    LevelLabelPlacement
  >;

  out.entry = { side: "right", compact: true, ultraCompact: false, nudgePx: 0 };
  if (leverage >= 15) {
    for (const id of ["take", "stop"] as const) {
      if (levels.some((l) => l.id === id)) {
        out[id] = { side: "right", compact: true, ultraCompact: false, nudgePx: 0 };
      }
    }
  }

  const sorted = [...levels].filter((l) => l.id !== "entry").sort((a, b) => a.yPct - b.yPct);
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && sorted[j].yPct - sorted[i].yPct < minGapPct) j++;
    const cluster = sorted.slice(i, j);
    if (cluster.length >= 2) {
      const span = cluster[cluster.length - 1].yPct - cluster[0].yPct;
      const ultraCompact = span < 4.2 || (leverage >= 30 && span < 6.5);
      const tight = ultraCompact || span < 5.5 || leverage >= 30;
      let alt = 0;
      for (const lvl of cluster) {
        const side: "left" | "right" = alt % 2 === 0 ? "right" : "left";
        const nudgeStep = ultraCompact ? 11 : 6;
        out[lvl.id] = {
          side,
          compact: tight,
          ultraCompact,
          nudgePx: alt % 2 === 0 ? -nudgeStep : nudgeStep,
        };
        alt += 1;
      }
    }
    i = j;
  }
  return out;
}

export function buildHonestLevelLines(params: {
  entryPrice: number;
  takeProfitPrice: number;
  stopPrice: number;
  liquidationPrice: number;
  liquidationInactive: boolean;
  scale: HonestPriceScale;
}): HonestLevelLine[] {
  const { entryPrice, takeProfitPrice, stopPrice, liquidationPrice, liquidationInactive, scale } =
    params;

  const defs: { id: EducationalLevelId; price: number }[] = [
    { id: "take", price: takeProfitPrice },
    { id: "entry", price: entryPrice },
    { id: "stop", price: stopPrice },
  ];
  if (!liquidationInactive) {
    defs.push({ id: "liquidation", price: liquidationPrice });
  }

  return defs.map(({ id, price }) => {
    const copy = LADDER_LEVEL_LABELS[id];
    const pct = percentFromEntry(price, entryPrice);
    const clip = resolveLevelClipState(pct, scale, id);

    const inlineLabel =
      id === "liquidation" && clip.inView
        ? `Ликвидация ${formatPriceInline(price)} / ${formatSignedPercent(pct)}`
        : undefined;

    return {
      id,
      title: copy.title,
      tagline: copy.tagline,
      hint: id === "entry" ? "точка отсчёта" : copy.hint,
      price,
      percentLabel: id === "entry" ? "0.00%" : formatSignedPercent(pct),
      percentFromEntry: pct,
      yPct: clip.yPct,
      inView: clip.inView,
      clipEdge: clip.clipEdge,
      clipLabel: clip.clipLabel,
      inlineLabel,
    };
  });
}

function formatPriceInline(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function buildHonestZoneBands(params: {
  direction: PositionSide;
  entryPrice: number;
  stopPrice: number;
  liquidationPrice: number;
  liquidationInactive: boolean;
  scale: HonestPriceScale;
}): HonestZoneBand[] {
  const { direction, liquidationInactive, scale } = params;
  const entryY = scale.entryYPct;
  const stopPct = percentFromEntry(params.stopPrice, scale.entryPrice);
  const stopY = percentToYPctInView(stopPct, scale);
  const liqPct = liquidationInactive
    ? stopPct
    : percentFromEntry(params.liquidationPrice, scale.entryPrice);
  const liqY = liquidationInactive
    ? stopY
    : isPercentInView(liqPct, scale)
      ? percentToYPctInView(liqPct, scale)
      : liqPct < 0
        ? HONEST_PLOT_BOTTOM_PCT
        : HONEST_PLOT_TOP_PCT;

  const top = HONEST_PLOT_TOP_PCT;
  const bottom = HONEST_PLOT_BOTTOM_PCT;

  if (direction === "long") {
    const bands: HonestZoneBand[] = [
      { id: "profit", label: LADDER_ZONE_LABELS.profit, topYPct: top, bottomYPct: entryY },
      {
        id: "controlled",
        label: LADDER_ZONE_LABELS.controlled,
        topYPct: Math.min(entryY, stopY),
        bottomYPct: Math.max(entryY, stopY),
      },
    ];
    if (!liquidationInactive) {
      bands.push({
        id: "danger_buffer",
        label: LADDER_ZONE_LABELS.danger_buffer,
        topYPct: Math.min(stopY, liqY),
        bottomYPct: Math.max(stopY, liqY),
      });
      bands.push({
        id: "liquidation",
        label: LADDER_ZONE_LABELS.liquidation,
        topYPct: Math.max(stopY, liqY),
        bottomYPct: bottom,
      });
    }
    return bands;
  }

  const bands: HonestZoneBand[] = [
    { id: "profit", label: LADDER_ZONE_LABELS.profit, topYPct: entryY, bottomYPct: bottom },
    {
      id: "controlled",
      label: LADDER_ZONE_LABELS.controlled,
      topYPct: Math.min(entryY, stopY),
      bottomYPct: Math.max(entryY, stopY),
    },
  ];
  if (!liquidationInactive) {
    bands.unshift({
      id: "liquidation",
      label: LADDER_ZONE_LABELS.liquidation,
      topYPct: top,
      bottomYPct: Math.min(entryY, liqY),
    });
    bands.push({
      id: "danger_buffer",
      label: LADDER_ZONE_LABELS.danger_buffer,
      topYPct: Math.min(stopY, liqY),
      bottomYPct: Math.max(stopY, liqY),
    });
  }
  return bands;
}

export function entryLiquidationVisualGapYPct(
  entryPrice: number,
  liquidationPrice: number,
  scale: HonestPriceScale,
): number {
  const liqPct = percentFromEntry(liquidationPrice, entryPrice);
  const liqY = isPercentInView(liqPct, scale)
    ? percentToYPctInView(liqPct, scale)
    : liqPct < 0
      ? HONEST_PLOT_BOTTOM_PCT
      : HONEST_PLOT_TOP_PCT;
  return Math.abs(liqY - scale.entryYPct);
}
