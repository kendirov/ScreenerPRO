import type { CurrencyCorrelationFamily } from "@/lib/domain/currency-correlation";
import {
  getPairConfig,
  type CurrencyPairConfig,
  type PairCalculationMode,
  type PointsPairKey,
} from "@/lib/domain/currency-pair-config";
import type { AlignedIntradayRow } from "@/lib/domain/currency-intraday-series";
import type { AlignedPairPoint } from "@/lib/domain/currency-time-series-align";
import type { DivergenceAnchorOptions } from "@/lib/domain/currency-spread-anchor";
import { calcSpreadZScore } from "@/lib/domain/currency-intraday-series";

export type { DivergenceAnchorOptions } from "@/lib/domain/currency-spread-anchor";

export const DEFAULT_PAIR_Z_WINDOW = 30;

export type PairDivergenceSeries = {
  pairKey: PointsPairKey;
  config: CurrencyPairConfig;
  legA: number[];
  legB: number[];
  spread: number[];
  zScores: (number | null)[];
  mode: PairCalculationMode;
  unit: "%" | "п.";
  anchorCloseA: number;
  anchorCloseB: number;
  anchorIndex: number;
  anchorTimestamp: string;
};

export type PairZBadge = "норма" | "наблюдение" | "растяжение" | "экстрим" | "—";

function anchorCloseAt(
  aligned: AlignedIntradayRow[],
  instrumentKey: string,
  anchorIndex: number,
): number {
  return aligned[anchorIndex]!.closes[instrumentKey]!;
}

/** Процент от якоря: (price/anchor − 1) × 100. */
export function calcPercentMoveFromAnchor(
  aligned: AlignedIntradayRow[],
  instrumentKey: string,
  anchorIndex = 0,
): number[] {
  if (!aligned.length) return [];
  const start = anchorCloseAt(aligned, instrumentKey, anchorIndex);
  if (!Number.isFinite(start) || start === 0) return [];

  return aligned.map((row) => {
    const close = row.closes[instrumentKey];
    if (!Number.isFinite(close)) return NaN;
    return (close / start - 1) * 100;
  });
}

/** Пункты от якоря: price − anchorClose. */
export function calcPointsMoveFromAnchor(
  aligned: AlignedIntradayRow[],
  instrumentKey: string,
  anchorIndex = 0,
): number[] {
  if (!aligned.length) return [];
  const start = anchorCloseAt(aligned, instrumentKey, anchorIndex);
  if (!Number.isFinite(start)) return [];

  return aligned.map((row) => {
    const close = row.closes[instrumentKey];
    if (!Number.isFinite(close)) return NaN;
    return close - start;
  });
}

/** Нормализация ряда цен в выбранный режим пары (от первой общей точки). */
export function normalizeSeriesForPair(
  aligned: AlignedIntradayRow[],
  instrumentKey: string,
  mode: PairCalculationMode,
  anchorIndex = 0,
): number[] {
  return mode === "percent"
    ? calcPercentMoveFromAnchor(aligned, instrumentKey, anchorIndex)
    : calcPointsMoveFromAnchor(aligned, instrumentKey, anchorIndex);
}

/**
 * Расхождение пары: legA − legB.
 * SI/CNY — проценты; SI/ED и CNY/ED (эксп.) — пункты котировки.
 */
export function calculatePairDivergence(
  aligned: AlignedIntradayRow[],
  pairKey: PointsPairKey,
  hedgeRatio = 1,
  zWindow = DEFAULT_PAIR_Z_WINDOW,
  anchorOptions?: DivergenceAnchorOptions,
): PairDivergenceSeries | null {
  if (aligned.length < 2) return null;

  const anchorIndex = Math.min(
    Math.max(anchorOptions?.anchorIndex ?? 0, 0),
    aligned.length - 1,
  );

  const config = getPairConfig(pairKey);
  const keyA = config.leftInstrument;
  const keyB = config.rightInstrument;

  const startA = anchorCloseAt(aligned, keyA, anchorIndex);
  const startB = anchorCloseAt(aligned, keyB, anchorIndex);
  if (!Number.isFinite(startA) || !Number.isFinite(startB)) return null;

  const legA = normalizeSeriesForPair(aligned, keyA, config.calculationMode, anchorIndex);
  const legB = normalizeSeriesForPair(aligned, keyB, config.calculationMode, anchorIndex);

  const spread: number[] = [];
  for (let i = 0; i < legA.length; i++) {
    const a = legA[i]!;
    const b = legB[i]!;
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      spread.push(NaN);
      continue;
    }
    spread.push(a - hedgeRatio * b);
  }

  const spreadForZ =
    anchorOptions?.zScoreFromAnchor === true
      ? spread.map((v, i) => (i < anchorIndex ? NaN : v))
      : spread;
  const zScores = calculateZScore(spreadForZ, zWindow);

  return {
    pairKey,
    config,
    legA,
    legB,
    spread,
    zScores,
    mode: config.calculationMode,
    unit: config.unit,
    anchorCloseA: startA,
    anchorCloseB: startB,
    anchorIndex,
    anchorTimestamp: aligned[anchorIndex]!.timestamp,
  };
}

/** Скользящий z-score по ряду расхождения. */
export function calculateZScore(
  spread: number[],
  window = DEFAULT_PAIR_Z_WINDOW,
): (number | null)[] {
  return calcSpreadZScore(spread, window);
}

export function getPairStrengthLabel(
  config: CurrencyPairConfig,
  spread: number | null,
): string {
  if (spread == null || !Number.isFinite(spread)) return "—";
  if (!config.showConfidentConclusions) return "эксперимент";

  const left = config.leftInstrument;
  const right = config.rightInstrument;
  if (spread > 0) return `${left} сильнее ${right}`;
  if (spread < 0) return `${right} сильнее ${left}`;
  return "паритет";
}

export function zScoreBadgeFromZ(z: number | null): PairZBadge {
  if (z == null || !Number.isFinite(z)) return "—";
  const abs = Math.abs(z);
  if (abs >= 2) return "экстрим";
  if (abs >= 1.5) return "растяжение";
  if (abs >= 1) return "наблюдение";
  return "норма";
}

export function formatPairLegValue(
  value: number | null,
  config: CurrencyPairConfig,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  if (config.calculationMode === "percent") {
    return `${sign}${value.toFixed(2)}%`;
  }
  return `${sign}${value.toFixed(1)} ${config.unit}`;
}

export function formatPairSpreadValue(
  value: number | null,
  config: CurrencyPairConfig,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  if (config.calculationMode === "percent") {
    return `${sign}${value.toFixed(2)}%`;
  }
  return `${sign}${value.toFixed(1)} ${config.unit}`;
}

export function pairChartPriceFormatter(config: CurrencyPairConfig): (v: number) => string {
  if (config.calculationMode === "percent") {
    return (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
  }
  return (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)} п.`;
}

export function pairChartTitle(
  pairKey: PointsPairKey,
  chartKind: "spread" | "legs" | "zscore",
): string {
  const config = getPairConfig(pairKey);
  if (chartKind === "zscore") {
    return `${config.label}: z-score расхождения`;
  }
  if (chartKind === "legs") {
    return `${config.chartTitle} · ноги`;
  }
  return config.chartTitle;
}

/** Диагностика шкалы ED: первая/последняя цена и шаг котировки. */
function formatTooltipTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

/** Строка ноги в tooltip: значение, время свечи, пометка forward fill. */
export function formatAlignedLegTooltip(
  family: string,
  moveFormatted: string,
  point: AlignedPairPoint | undefined,
  side: "left" | "right",
): string {
  if (!point) return `${family}: ${moveFormatted}`;

  const isLeft = side === "left";
  const orig = isLeft ? point.leftOriginalTimestamp : point.rightOriginalTimestamp;
  const ff = isLeft ? point.leftIsForwardFilled : point.rightIsForwardFilled;
  const stale = point.staleMinutes;

  let line = `${family}: ${moveFormatted} at ${formatTooltipTime(orig)}`;
  if (ff && stale > 0) {
    line += `, протянуто ${Math.round(stale)} мин`;
  }
  return line;
}

export function describeInstrumentScale(
  family: CurrencyCorrelationFamily,
  anchorClose: number,
  lastClose: number,
): string {
  const move = lastClose - anchorClose;
  return `${family}: старт ${anchorClose}, сейчас ${lastClose}, Δ ${move >= 0 ? "+" : ""}${move.toFixed(4)} (сырая котировка MOEX)`;
}
