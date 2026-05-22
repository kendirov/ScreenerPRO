import type { CurrencyCorrelationFamily } from "@/lib/domain/currency-correlation";
import type { TechnicalCharacteristicsRow } from "@/lib/materials/contracts";

export type SpreadUnitMode = "raw-points" | "normalized-points" | "money-value";

export type ContractPointSpec = {
  ticker: string;
  family: CurrencyCorrelationFamily;
  priceStep?: number | null;
  stepPrice?: number | null;
  lotSize?: number | null;
  quotePrecision?: number | null;
  unitLabel: string;
};

export const SPREAD_UNIT_MODE_LABELS: Record<SpreadUnitMode, string> = {
  "raw-points": "Пункты",
  "normalized-points": "Шаги цены",
  "money-value": "₽ за шаг",
};

export const SPREAD_UNIT_MODE_HINT =
  "Пункты = изменение котировки от старта периода. Это не PnL.";

export const UNIT_FALLBACK_WARNING =
  "Для части контрактов нет стоимости шага, показаны пункты котировки.";

export function hasPriceStep(spec: ContractPointSpec | undefined): boolean {
  const v = spec?.priceStep;
  return v != null && Number.isFinite(v) && v > 0;
}

export function hasStepPrice(spec: ContractPointSpec | undefined): boolean {
  const v = spec?.stepPrice;
  return v != null && Number.isFinite(v) && v > 0;
}

/** Спецификация из строки технических характеристик (MOEX ISS). */
export function contractSpecFromTechnicalRow(
  family: CurrencyCorrelationFamily,
  row: TechnicalCharacteristicsRow,
): ContractPointSpec {
  return {
    ticker: row.ticker,
    family,
    priceStep: row.priceStep.value,
    stepPrice: row.stepValue.value,
    lotSize: row.lotSize.value,
    quotePrecision: null,
    unitLabel: row.instrumentName,
  };
}

/** Сопоставление активных тикеров квадрохеджа со строками теххарактеристик. */
export function buildSpecsByFamily(
  tickersByFamily: Partial<Record<CurrencyCorrelationFamily, string>>,
  techRows: TechnicalCharacteristicsRow[],
): Partial<Record<CurrencyCorrelationFamily, ContractPointSpec>> {
  const byTicker = new Map(techRows.map((r) => [r.ticker.toUpperCase(), r]));
  const specs: Partial<Record<CurrencyCorrelationFamily, ContractPointSpec>> = {};

  for (const family of ["SI", "CNY", "ED"] as const) {
    const ticker = tickersByFamily[family];
    if (!ticker) continue;
    const row = byTicker.get(ticker.toUpperCase());
    if (row) specs[family] = contractSpecFromTechnicalRow(family, row);
  }

  return specs;
}

export function resolveSpreadUnitMode(
  requested: SpreadUnitMode,
  specs: Partial<Record<CurrencyCorrelationFamily, ContractPointSpec>>,
  families: CurrencyCorrelationFamily[],
): { effective: SpreadUnitMode; warning: string | null } {
  if (requested === "raw-points") {
    return { effective: "raw-points", warning: null };
  }

  const active = families.filter((f) => tickersByFamilyHas(specs, f));
  const missingStep = active.filter((f) => !hasPriceStep(specs[f]));
  const missingMoney = active.filter((f) => !hasPriceStep(specs[f]) || !hasStepPrice(specs[f]));

  if (requested === "normalized-points" && missingStep.length > 0) {
    return { effective: "raw-points", warning: UNIT_FALLBACK_WARNING };
  }

  if (requested === "money-value" && missingMoney.length > 0) {
    return { effective: "raw-points", warning: UNIT_FALLBACK_WARNING };
  }

  return { effective: requested, warning: null };
}

function tickersByFamilyHas(
  specs: Partial<Record<CurrencyCorrelationFamily, ContractPointSpec>>,
  family: CurrencyCorrelationFamily,
): boolean {
  return specs[family] != null;
}

/** Сырое движение котировки → значение для отображения. */
export function convertRawPointMove(
  rawMove: number,
  spec: ContractPointSpec | undefined,
  mode: SpreadUnitMode,
): number | null {
  if (!Number.isFinite(rawMove)) return null;
  if (mode === "raw-points") return rawMove;

  if (!hasPriceStep(spec)) return null;

  const normalized = rawMove / spec!.priceStep!;
  if (mode === "normalized-points") return normalized;

  if (!hasStepPrice(spec)) return null;
  return normalized * spec!.stepPrice!;
}

/** Спред пары в выбранных единицах: moveA − hedge×moveB после конверсии каждой ноги. */
export function convertPairSpreadMove(
  rawMoveA: number,
  rawMoveB: number,
  specA: ContractPointSpec | undefined,
  specB: ContractPointSpec | undefined,
  hedgeRatio: number,
  mode: SpreadUnitMode,
): number | null {
  const a = convertRawPointMove(rawMoveA, specA, mode);
  const b = convertRawPointMove(rawMoveB, specB, mode);
  if (a == null || b == null) return null;
  return a - hedgeRatio * b;
}

export function formatUnitValue(value: number | null, mode: SpreadUnitMode): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  switch (mode) {
    case "raw-points":
      return `${sign}${value.toFixed(1)} пунктов`;
    case "normalized-points":
      return `${sign}${value.toFixed(2)} шагов`;
    case "money-value":
      return `${sign}${value.toFixed(2)} ₽`;
  }
}

export function formatUnitValueShort(value: number | null, mode: SpreadUnitMode): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  switch (mode) {
    case "raw-points":
      return `${sign}${value.toFixed(1)} п.`;
    case "normalized-points":
      return `${sign}${value.toFixed(2)} ш.`;
    case "money-value":
      return `${sign}${value.toFixed(2)} ₽`;
  }
}

export function chartPriceFormatter(mode: SpreadUnitMode): (v: number) => string {
  switch (mode) {
    case "raw-points":
      return (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)} п.`;
    case "normalized-points":
      return (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)} ш.`;
    case "money-value":
      return (v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)} ₽`;
  }
}

export type MoveBreakdown = {
  rawPoints: number | null;
  normalizedSteps: number | null;
  moneyRub: number | null;
  displayValue: number | null;
};

export function breakdownPointMove(
  rawMove: number,
  spec: ContractPointSpec | undefined,
  displayMode: SpreadUnitMode,
): MoveBreakdown {
  const rawPoints = Number.isFinite(rawMove) ? rawMove : null;
  const normalizedSteps =
    rawPoints != null && hasPriceStep(spec) ? rawPoints / spec!.priceStep! : null;
  const moneyRub =
    normalizedSteps != null && hasStepPrice(spec) ? normalizedSteps * spec!.stepPrice! : null;

  let displayValue: number | null = null;
  if (rawPoints != null) {
    displayValue = convertRawPointMove(rawPoints, spec, displayMode);
  }

  return { rawPoints, normalizedSteps, moneyRub, displayValue };
}
