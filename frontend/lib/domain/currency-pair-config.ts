import type { CurrencyCorrelationFamily } from "@/lib/domain/currency-correlation";

export type PointsPairKey = "SI/CNY" | "SI/ED" | "CNY/ED";

export type PairCalculationMode = "percent" | "points";

export type PairAvailability = "active" | "experimental";

export type PairAlignmentMode = "exact" | "forwardFill";

export type CurrencyPairConfig = {
  pairKey: PointsPairKey;
  label: string;
  leftInstrument: CurrencyCorrelationFamily;
  rightInstrument: CurrencyCorrelationFamily;
  alignmentMode: PairAlignmentMode;
  calculationMode: PairCalculationMode;
  unit: "%" | "п.";
  /** Короткая подпись для карточек: «проценты» / «пункты». */
  modeLabelRu: string;
  chartTitle: string;
  description: string;
  availability: PairAvailability;
  /** Не показывать уверенные торговые выводы (CNY/ED). */
  showConfidentConclusions: boolean;
};

export const CURRENCY_PAIR_CONFIGS: CurrencyPairConfig[] = [
  {
    pairKey: "SI/CNY",
    label: "SI − CNY",
    leftInstrument: "SI",
    rightInstrument: "CNY",
    alignmentMode: "forwardFill",
    calculationMode: "percent",
    unit: "%",
    modeLabelRu: "проценты",
    chartTitle: "SI−CNY: процентное расхождение от старта периода",
    description:
      "Расхождение в процентах от цены на старте периода: (цена/старт − 1)×100. Контракты разного масштаба — сравниваем относительное движение.",
    availability: "active",
    showConfidentConclusions: true,
  },
  {
    pairKey: "SI/ED",
    label: "SI − ED",
    leftInstrument: "SI",
    rightInstrument: "ED",
    alignmentMode: "forwardFill",
    calculationMode: "points",
    unit: "п.",
    modeLabelRu: "пункты",
    chartTitle: "SI−ED: расхождение в пунктах от старта периода",
    description:
      "Расхождение в пунктах котировки от старта периода: цена − цена_старта. Абсолютное движение контрактов без процентной нормализации.",
    availability: "active",
    showConfidentConclusions: true,
  },
  {
    pairKey: "CNY/ED",
    label: "CNY − ED",
    leftInstrument: "CNY",
    rightInstrument: "ED",
    alignmentMode: "forwardFill",
    calculationMode: "points",
    unit: "п.",
    modeLabelRu: "пункты (эксп.)",
    chartTitle: "CNY−ED: экспериментальная пара",
    description:
      "Экспериментальный режим: пункты от старта периода. Финансовая интерпретация не подтвержена — только наблюдение.",
    availability: "experimental",
    showConfidentConclusions: false,
  },
];

export const CURRENCY_PAIR_CONFIG_BY_KEY: Record<PointsPairKey, CurrencyPairConfig> =
  Object.fromEntries(CURRENCY_PAIR_CONFIGS.map((c) => [c.pairKey, c])) as Record<
    PointsPairKey,
    CurrencyPairConfig
  >;

export const ACTIVE_PAIR_KEYS = CURRENCY_PAIR_CONFIGS.filter(
  (c) => c.availability === "active",
).map((c) => c.pairKey);

/** @deprecated Используйте CURRENCY_PAIR_CONFIGS */
export const PAIR_DEFS = CURRENCY_PAIR_CONFIGS.map((c) => ({
  pairKey: c.pairKey,
  a: c.leftInstrument,
  b: c.rightInstrument,
}));

export function getPairConfig(pairKey: PointsPairKey): CurrencyPairConfig {
  return CURRENCY_PAIR_CONFIG_BY_KEY[pairKey];
}

export function isPairExperimental(pairKey: PointsPairKey): boolean {
  return getPairConfig(pairKey).availability === "experimental";
}
