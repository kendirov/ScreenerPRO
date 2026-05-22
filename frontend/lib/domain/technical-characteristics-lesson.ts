import type { TechnicalCharacteristicsRow } from "@/lib/materials/contracts";
import { TC_COLUMN_LABELS } from "@/lib/domain/technical-characteristics-labels";
import type { TechnicalPreset } from "@/lib/domain/technical-characteristics-presets";
import { getEntryFriction } from "@/lib/materials/technical-characteristics-view";

export type LessonSuitabilityHint =
  | "для стакана"
  | "для интрадэя"
  | "для наблюдения"
  | "осторожно: широкие издержки";

export type LessonExplanation = {
  lotEconomics: string;
  priceStep: string;
  spread: string;
  activity: string;
  suitability: LessonSuitabilityHint[];
};

export type LessonReadCard = {
  id: "entry" | "error" | "activity" | "comfort";
  title: string;
  fields: string[];
};

export const LESSON_READ_CARDS: LessonReadCard[] = [
  {
    id: "entry",
    title: "Сколько стоит вход?",
    fields: [TC_COLUMN_LABELS.currentPrice, TC_COLUMN_LABELS.lotSize, TC_COLUMN_LABELS.lotPrice],
  },
  {
    id: "error",
    title: "Сколько стоит ошибка?",
    fields: [TC_COLUMN_LABELS.priceStep, TC_COLUMN_LABELS.stepValue, TC_COLUMN_LABELS.commissionToRangeScore],
  },
  {
    id: "activity",
    title: "Есть ли активность?",
    fields: [TC_COLUMN_LABELS.tradesCount, TC_COLUMN_LABELS.turnoverRubMln, TC_COLUMN_LABELS.turnoverPerTradeRubK],
  },
  {
    id: "comfort",
    title: "Удобно ли торговать?",
    fields: [
      TC_COLUMN_LABELS.spreadPct,
      "Комиссия",
      TC_COLUMN_LABELS.intradayUsabilityScore,
      TC_COLUMN_LABELS.entryFriction,
    ],
  },
];

function fmtMoney(value: number, maxDigits = 2) {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: maxDigits }).format(value)} ₽`;
}

function fmtNum(value: number, maxDigits = 4) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: maxDigits }).format(value);
}

function fmtInt(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
}

function lotUnit(row: TechnicalCharacteristicsRow) {
  return row.assetClass === "stock" ? "акций" : "контр.";
}

export function buildLessonExplanation(
  row: TechnicalCharacteristicsRow,
  tradingPreset: TechnicalPreset | null,
): LessonExplanation {
  const lotSize = row.lotSize.value;
  const price = row.currentPrice.value;
  const lotPrice = row.lotPrice.value;
  const step = row.priceStep.value;
  const stepValue = row.stepValue.value;
  const spreadPct = row.spreadPct.value;
  const trades = row.tradesCount.value;
  const turnover = row.turnoverRub.value;
  const turnoverMln = turnover !== null ? turnover / 1_000_000 : null;

  let lotEconomics = "Нет данных по лоту и цене в MOEX ISS.";
  if (lotSize !== null && lotPrice !== null) {
    const sizePart =
      price !== null
        ? `В одном лоте ${row.ticker} — ${fmtInt(lotSize)} ${lotUnit(row)} по цене около ${fmtMoney(price, 4)}.`
        : `В одном лоте ${row.ticker} — ${fmtInt(lotSize)} ${lotUnit(row)}.`;
    lotEconomics = `${sizePart} Цена лота около ${fmtMoney(lotPrice)}.`;
  }

  let priceStepText = "Нет данных по шагу цены в MOEX ISS.";
  if (step !== null && stepValue !== null) {
    priceStepText = `Минимальное движение цены — ${fmtNum(step, 4)} ₽. Для одного лота это ${fmtMoney(stepValue)} (стоимость одного шага).`;
  } else if (step !== null) {
    priceStepText = `Минимальное движение цены — ${fmtNum(step, 4)} ₽. Стоимость шага для лота в источнике не рассчитана.`;
  }

  let spreadText = "Спред недоступен в MOEX ISS.";
  if (spreadPct !== null) {
    spreadText = `Спред около ${fmtNum(spreadPct, 3)}% — расстояние между лучшей покупкой и продажей. Чем он меньше, тем дешевле вход и выход.`;
  }

  let activityText = "Сделки и оборот недоступны.";
  if (trades !== null || turnoverMln !== null) {
    const parts: string[] = [];
    if (trades !== null) parts.push(`${fmtInt(trades)} сделок`);
    if (turnoverMln !== null) parts.push(`оборот около ${fmtNum(turnoverMln, 2)} млн ₽`);
    activityText = `${parts.join(" и ")} — так видно, насколько инструмент «живой» сегодня.`;
  }

  const suitability = buildSuitabilityHints(row, tradingPreset);

  return {
    lotEconomics,
    priceStep: priceStepText,
    spread: spreadText,
    activity: activityText,
    suitability,
  };
}

function buildSuitabilityHints(row: TechnicalCharacteristicsRow, tradingPreset: TechnicalPreset | null): LessonSuitabilityHint[] {
  const hints: LessonSuitabilityHint[] = [];
  const spread = row.spreadPct.value;
  const trades = row.tradesCount.value;
  const friction = getEntryFriction(row);
  const readiness = row.intradayUsabilityScore.value;

  const wideCosts =
    (spread !== null && spread > 0.12) ||
    (friction !== null && friction > 8) ||
    (readiness !== null && readiness < 45);

  if (wideCosts) hints.push("осторожно: широкие издержки");

  if (tradingPreset === "scalping") {
    if (trades !== null && trades >= 3000 && spread !== null && spread <= 0.08) hints.push("для стакана");
    else if (!hints.includes("осторожно: широкие издержки")) hints.push("для наблюдения");
  } else if (tradingPreset === "intraday" || tradingPreset === "in-play") {
    if ((row.turnoverRub.value ?? 0) >= 300_000_000) hints.push("для интрадэя");
    else hints.push("для наблюдения");
  } else if (tradingPreset === "beginner" || tradingPreset === "liquidity") {
    hints.push("для наблюдения");
  } else {
    if (trades !== null && trades >= 5000 && spread !== null && spread <= 0.06) hints.push("для стакана");
    if ((row.turnoverRub.value ?? 0) >= 500_000_000 && spread !== null && spread <= 0.15) hints.push("для интрадэя");
    if (hints.length === 0) hints.push("для наблюдения");
  }

  return [...new Set(hints)].slice(0, 3);
}

export function calcPointMovementRub(lots: number, points: number, stepValuePerLot: number | null): number | null {
  if (!Number.isFinite(lots) || !Number.isFinite(points) || lots <= 0 || points <= 0) return null;
  if (stepValuePerLot === null || stepValuePerLot <= 0) return null;
  return lots * points * stepValuePerLot;
}

export function formatCommissionCoverText(row: TechnicalCharacteristicsRow): {
  kind: "available" | "missing";
  text: string;
} {
  const points = row.pointsToCoverCommission.value;
  const commission = row.commissionRub.value;
  if (points === null || commission === null) {
    return {
      kind: "missing",
      text: "Комиссия не загружена. Можно оценивать только спред и шаг цены.",
    };
  }
  return {
    kind: "available",
    text: `Чтобы окупить оценочную комиссию (~${fmtMoney(commission)} за лот), цене нужно пройти примерно ${fmtNum(points, 2)} шагов относительно стоимости шага.`,
  };
}
