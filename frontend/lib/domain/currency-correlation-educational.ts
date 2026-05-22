import { CURRENCY_FAMILY_META, type CurrencyCorrelationFamily } from "@/lib/domain/currency-correlation";
import type {
  CurrencyHistoryInstrument,
  CurrencyHistoryPairKey,
  CurrencyHistoryResponse,
} from "@/lib/domain/currency-correlation-history";

export type BundleReasonCode =
  | "не найден активный контракт"
  | "нет свечей"
  | "мало точек"
  | "разные даты"
  | "история есть"
  | "ошибка загрузки";

export type FamilyBundleStatus = {
  family: CurrencyCorrelationFamily;
  label: string;
  found: boolean;
  ticker: string;
  pointsCount: number;
  reason: BundleReasonCode;
};

export type PairBundleStatus = {
  pairKey: CurrencyHistoryPairKey;
  label: string;
  commonDates: number;
  canBuildPartial: boolean;
  families: [CurrencyCorrelationFamily, CurrencyCorrelationFamily];
};

const PAIR_META: Array<{
  key: CurrencyHistoryPairKey;
  label: string;
  families: [CurrencyCorrelationFamily, CurrencyCorrelationFamily];
}> = [
  { key: "SI/CNY", label: "SI ↔ CNY", families: ["SI", "CNY"] },
  { key: "SI/ED", label: "SI ↔ ED", families: ["SI", "ED"] },
  { key: "CNY/ED", label: "CNY ↔ ED", families: ["CNY", "ED"] },
];

const MIN_PAIR_DATES = 2;

function classifyReason(inst: CurrencyHistoryInstrument | undefined, sel?: { excludedFromChart: boolean }): BundleReasonCode {
  if (!inst || inst.ticker === "—") return "не найден активный контракт";
  if (inst.status === "error") return "ошибка загрузки";
  const n = inst.pointsCount ?? inst.points.length;
  if (n === 0 || inst.coverageStatus === "empty") return "нет свечей";
  if (inst.coverageStatus === "sparse" || n < 5) return "мало точек";
  if (inst.coverageStatus === "no_overlap" || sel?.excludedFromChart) return "разные даты";
  return "история есть";
}

export function buildFamilyBundleStatuses(history: CurrencyHistoryResponse): FamilyBundleStatus[] {
  const families: CurrencyCorrelationFamily[] = ["SI", "CNY", "ED"];
  return families.map((family) => {
    const inst = history.instruments.find((i) => i.family === family);
    const sel = history.contractSelections?.find((s) => s.family === family);
    const meta = CURRENCY_FAMILY_META[family];
    const found = Boolean(inst && inst.ticker !== "—" && inst.status !== "empty");
    return {
      family,
      label: meta.label,
      found,
      ticker: inst?.activeNowTicker ?? inst?.ticker ?? "—",
      pointsCount: inst?.pointsCount ?? inst?.points.length ?? 0,
      reason: classifyReason(inst, sel),
    };
  });
}

export function buildPairBundleStatuses(history: CurrencyHistoryResponse): PairBundleStatus[] {
  return PAIR_META.map(({ key, label, families }) => {
    const commonDates = history.commonDatesByPair[key] ?? 0;
    return {
      pairKey: key,
      label,
      commonDates,
      canBuildPartial: commonDates >= MIN_PAIR_DATES,
      families,
    };
  });
}

export function findBestBuildablePair(history: CurrencyHistoryResponse): PairBundleStatus | null {
  const pairs = buildPairBundleStatuses(history).filter((p) => p.canBuildPartial);
  if (!pairs.length) return null;
  return pairs.reduce((best, p) => (p.commonDates > best.commonDates ? p : best));
}

export const WHY_CHART_EMPTY = [
  "Фьючерсы живут сериями, и активный контракт может недавно смениться.",
  "Для корреляции нужны общие даты, а не просто текущие котировки.",
  "Если один контракт не отдаёт историю, можно строить частичный график по двум доступным.",
] as const;

export const CALCULATION_STEPS = [
  "Берём close по датам.",
  "Нормализуем: первая точка = 100.",
  "Считаем дневные изменения.",
  "Считаем корреляцию по изменениям.",
  "Находим расхождения от корзины.",
] as const;
