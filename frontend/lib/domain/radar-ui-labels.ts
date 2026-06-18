/**
 * Подписи Market Radar для UI (русский, трейдерский язык).
 */

import type { MarketRadarReasonKey } from "@/lib/domain/market-radar-config";

export const RADAR_SECTION = {
  liquidity: {
    title: "ЛИКВИДНОСТЬ",
    subtitle: "где деньги",
    hint: "Где можно нормально исполниться. Не сигнал на сделку.",
  },
  activity: {
    title: "АКТИВНОСТЬ",
    subtitle: "что торгуют",
    hint: "Рабочий лист — что сейчас торгуют.",
  },
  volatility: {
    title: "ВОЛАТИЛЬНОСТЬ",
    subtitle: "где движение",
    hint: "Прострел, диапазон, пробой high/low.",
  },
  inPlay: {
    badge: "в игре",
  },
} as const;

export const RADAR_HEADER_COUNT = {
  liquidity: "Лик",
  inPlay: "Игр",
  activity: "Акт",
  volatility: "Вол",
} as const;

export const RADAR_METRIC_LABEL = {
  turnoverX: "Оборот x",
  tradesX: "Сделки x",
  range: "Диапазон",
  turnover: "Оборот",
  trades: "Сделки",
  noBaseline: "нет базы",
  baselineOk: "база ок",
} as const;

export const RADAR_METRIC_TOOLTIP = {
  turnoverX: "Оборот сейчас против обычного оборота к этому же времени сессии.",
  tradesX: "Количество сделок сейчас против обычного количества сделок к этому же времени сессии.",
  noBaseline: "Нет надёжной базы сравнения к этому времени.",
} as const;

/** Короткие теги в конце строки радара (нижний регистр). */
export const RADAR_ROW_TAG = {
  money: "деньги",
  active: "актив",
  inPlay: "в игре",
  high: "high",
  low: "low",
  breakoutHigh: "пробой high",
  breakoutLow: "пробой low",
  range: "диапазон",
  noBaseline: "нет базы",
  thin: "тонко",
} as const;

/** Reason labels — активность (колонка тега). */
export const RADAR_ACTIVITY_REASON = {
  leaderRange: "лидер + диапазон",
  volumeTrades: "объём + сделки",
  tradesMove: "сделки + ход",
  noBaseline: RADAR_ROW_TAG.noBaseline,
  active: RADAR_ROW_TAG.active,
} as const;

/** Reason labels — волатильность (колонка тега). */
export const RADAR_VOLATILITY_REASON = {
  range: RADAR_ROW_TAG.range,
  nearHigh: "у high",
  nearLow: "у low",
  breakoutHigh: RADAR_ROW_TAG.breakoutHigh,
  breakoutLow: RADAR_ROW_TAG.breakoutLow,
  thin: RADAR_ROW_TAG.thin,
  noBaseline: RADAR_ROW_TAG.noBaseline,
} as const;

export type RadarRowVariant = "liquidity" | "activity" | "volatility";

export function radarLiquidityTag(): string {
  return RADAR_ROW_TAG.money;
}

/** Fallback по reasonKey — без англ. служебных тегов. */
export function radarRowTag(reasonKey: MarketRadarReasonKey, variant: RadarRowVariant): string {
  if (variant === "liquidity") return RADAR_ROW_TAG.money;
  if (variant === "activity") {
    if (reasonKey === "noBaseline") return RADAR_ROW_TAG.noBaseline;
    return RADAR_ROW_TAG.active;
  }
  if (reasonKey === "breakoutHigh") return RADAR_VOLATILITY_REASON.breakoutHigh;
  if (reasonKey === "breakoutLow") return RADAR_VOLATILITY_REASON.breakoutLow;
  if (reasonKey === "nearHigh") return RADAR_VOLATILITY_REASON.nearHigh;
  if (reasonKey === "nearLow") return RADAR_VOLATILITY_REASON.nearLow;
  return RADAR_VOLATILITY_REASON.range;
}
