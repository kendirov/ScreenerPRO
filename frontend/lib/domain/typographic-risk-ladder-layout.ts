import type { PositionSide } from "@/lib/domain/perpetual-leverage";
import {
  LADDER_LEVEL_LABELS,
  type EducationalLevelId,
} from "@/lib/domain/liquidation-map-labels";

export type { EducationalLevelId };

export type EducationalLevelSlot = {
  kind: "level";
  id: EducationalLevelId;
  title: string;
  tagline: string;
  price: number;
  percentLabel: string;
  caption: string;
};

export type EducationalAirSlot = {
  kind: "air";
  airAfterStop: number;
};

export type EducationalSlot = EducationalLevelSlot | EducationalAirSlot;

export type EducationalRiskLadderLayout = {
  direction: PositionSide;
  slots: EducationalSlot[];
  dangerIntensity: number;
  liquidationInactive: boolean;
};

function formatSignedPercent(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

function percentFromEntry(price: number, entryPrice: number): number {
  if (entryPrice <= 0) return 0;
  return ((price - entryPrice) / entryPrice) * 100;
}

export function educationalDangerIntensity(leverage: number, liquidationDistancePercent: number): number {
  const fromLev = 1 - Math.min(1, Math.sqrt(leverage) / Math.sqrt(50));
  const fromDist = 1 - Math.min(1, liquidationDistancePercent / 12);
  return Math.min(1, Math.max(0.15, fromLev * 0.55 + fromDist * 0.45));
}

function levelSlot(
  id: EducationalLevelId,
  price: number,
  percentLabel: string,
): EducationalLevelSlot {
  const copy = LADDER_LEVEL_LABELS[id];
  return {
    kind: "level",
    id,
    title: copy.title,
    tagline: copy.tagline,
    price,
    percentLabel,
    caption: copy.hint,
  };
}

export function buildEducationalRiskLadderLayout(params: {
  entryPrice: number;
  takeProfitPrice: number;
  stopPrice: number;
  liquidationPrice: number;
  direction: PositionSide;
  liquidationInactive: boolean;
  riskPercent: number;
  takeProfitR: number;
  liquidationDistancePercent: number;
  leverage: number;
  airAfterStop: number;
}): EducationalRiskLadderLayout {
  const {
    entryPrice,
    takeProfitPrice,
    stopPrice,
    liquidationPrice,
    direction,
    liquidationInactive,
    liquidationDistancePercent,
    leverage,
    airAfterStop,
  } = params;

  const take = levelSlot("take", takeProfitPrice, formatSignedPercent(percentFromEntry(takeProfitPrice, entryPrice)));
  const entry = levelSlot("entry", entryPrice, "0.00%");
  const stop = levelSlot("stop", stopPrice, formatSignedPercent(percentFromEntry(stopPrice, entryPrice)));
  const liquidation = levelSlot(
    "liquidation",
    liquidationPrice,
    formatSignedPercent(percentFromEntry(liquidationPrice, entryPrice)),
  );

  const air: EducationalAirSlot = {
    kind: "air",
    airAfterStop: liquidationInactive ? 0 : airAfterStop,
  };

  let slots: EducationalSlot[];

  if (direction === "long") {
    slots = [take, entry, stop];
    if (!liquidationInactive) {
      slots.push(air, liquidation);
    }
  } else if (liquidationInactive) {
    slots = [stop, entry, take];
  } else {
    slots = [liquidation, air, stop, entry, take];
  }

  const dangerIntensity = liquidationInactive
    ? 0
    : educationalDangerIntensity(leverage, liquidationDistancePercent);

  return {
    direction,
    slots,
    dangerIntensity,
    liquidationInactive,
  };
}

export function buildTypographicRiskLadderLayout(
  params: Parameters<typeof buildEducationalRiskLadderLayout>[0] & {
    takeProfitPercent?: number;
  },
): {
  levels: { id: EducationalLevelId; yPct: number }[];
  entryYPct: number;
  takeYPct: number;
  liquidationYPct: number | null;
  direction: PositionSide;
} {
  const layout = buildEducationalRiskLadderLayout({
    ...params,
    airAfterStop: params.liquidationInactive
      ? 0
      : params.liquidationDistancePercent - params.riskPercent,
  });
  const levelSlots = layout.slots.filter((s): s is EducationalLevelSlot => s.kind === "level");
  const n = levelSlots.length;
  const step = n > 1 ? 84 / (n - 1) : 0;
  const levels = levelSlots.map((level, i) => ({
    id: level.id,
    yPct: 8 + step * i,
  }));
  return {
    levels,
    entryYPct: levels.find((l) => l.id === "entry")?.yPct ?? 50,
    takeYPct: levels.find((l) => l.id === "take")?.yPct ?? 8,
    liquidationYPct: levels.find((l) => l.id === "liquidation")?.yPct ?? null,
    direction: layout.direction,
  };
}

export type TypographicLevelId = EducationalLevelId;
