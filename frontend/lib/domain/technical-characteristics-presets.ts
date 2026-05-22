import type { TechnicalCharacteristicsRow } from "@/lib/materials/contracts";
import { getEntryFriction } from "@/lib/materials/technical-characteristics-view";

export type TechnicalPreset = "scalping" | "intraday" | "liquidity" | "beginner" | "in-play";

export type PresetReasonTag =
  | "много сделок"
  | "узкий спред"
  | "дешёвый шаг"
  | "высокий оборот"
  | "есть диапазон"
  | "низкая цена ошибки"
  | "подходит для стакана"
  | "подходит для графика"
  | "удобен для отбора"
  | "активный поток"
  | "понятный лот";

export type PresetWarningTag = "дорогой лот" | "широкий спред" | "мало сделок" | "данные неполные" | "дорогой шаг";

export type PresetEvaluation = {
  presetScore: number;
  presetReasonTags: PresetReasonTag[];
  presetWarnings: PresetWarningTag[];
};

export type RankedPresetRow = {
  row: TechnicalCharacteristicsRow;
  evaluation: PresetEvaluation;
  rank: number;
};

export const TECHNICAL_PRESET_CARDS: Array<{
  id: TechnicalPreset;
  title: string;
  description: string;
}> = [
  {
    id: "scalping",
    title: "Скальпинг / стакан",
    description: "Нужны сделки, узкий спред, понятный шаг цены и плотность в стакане.",
  },
  {
    id: "intraday",
    title: "Интрадей по графику",
    description: "Нужны оборот, диапазон и движение внутри дня.",
  },
  {
    id: "liquidity",
    title: "Самые ликвидные",
    description: "Где сегодня больше всего денег и сделок.",
  },
  {
    id: "beginner",
    title: "Для новичка",
    description: "Понятные, ликвидные и не слишком дорогие по ошибке инструменты.",
  },
  {
    id: "in-play",
    title: "В игре",
    description: "Где сейчас есть активность, движение и повышенный интерес.",
  },
];

export const TECHNICAL_PRESET_LABELS: Record<TechnicalPreset, string> = {
  scalping: "Скальпинг / стакан",
  intraday: "Интрадей по графику",
  liquidity: "Самые ликвидные",
  beginner: "Для новичка",
  "in-play": "В игре",
};

type MetricKey =
  | "trades"
  | "spreadPct"
  | "stepValue"
  | "turnover"
  | "lotPrice"
  | "turnoverPerTrade"
  | "readiness"
  | "costErrorScore"
  | "entryFriction"
  | "confidence"
  | "dayRangeProxy"
  | "inPlayProxy"
  | "slippage";

type MetricDirection = "higher" | "lower";

type WeightedMetric = { key: MetricKey; weight: number; direction: MetricDirection };

const PRESET_WEIGHTS: Record<TechnicalPreset, WeightedMetric[]> = {
  scalping: [
    { key: "trades", weight: 0.22, direction: "higher" },
    { key: "spreadPct", weight: 0.2, direction: "lower" },
    { key: "stepValue", weight: 0.12, direction: "lower" },
    { key: "turnover", weight: 0.15, direction: "higher" },
    { key: "costErrorScore", weight: 0.12, direction: "higher" },
    { key: "readiness", weight: 0.12, direction: "higher" },
    { key: "entryFriction", weight: 0.07, direction: "lower" },
  ],
  intraday: [
    { key: "turnover", weight: 0.22, direction: "higher" },
    { key: "dayRangeProxy", weight: 0.18, direction: "higher" },
    { key: "turnoverPerTrade", weight: 0.12, direction: "higher" },
    { key: "trades", weight: 0.15, direction: "higher" },
    { key: "readiness", weight: 0.15, direction: "higher" },
    { key: "spreadPct", weight: 0.08, direction: "lower" },
    { key: "inPlayProxy", weight: 0.1, direction: "higher" },
  ],
  liquidity: [
    { key: "turnover", weight: 0.45, direction: "higher" },
    { key: "trades", weight: 0.35, direction: "higher" },
    { key: "spreadPct", weight: 0.2, direction: "lower" },
  ],
  beginner: [
    { key: "turnover", weight: 0.2, direction: "higher" },
    { key: "trades", weight: 0.18, direction: "higher" },
    { key: "spreadPct", weight: 0.18, direction: "lower" },
    { key: "costErrorScore", weight: 0.15, direction: "higher" },
    { key: "lotPrice", weight: 0.12, direction: "lower" },
    { key: "confidence", weight: 0.12, direction: "higher" },
    { key: "readiness", weight: 0.05, direction: "higher" },
  ],
  "in-play": [
    { key: "turnover", weight: 0.25, direction: "higher" },
    { key: "trades", weight: 0.2, direction: "higher" },
    { key: "dayRangeProxy", weight: 0.18, direction: "higher" },
    { key: "inPlayProxy", weight: 0.2, direction: "higher" },
    { key: "readiness", weight: 0.12, direction: "higher" },
    { key: "slippage", weight: 0.05, direction: "higher" },
  ],
};

type RowMetrics = Record<MetricKey, number | null>;

type BatchStats = {
  percentiles: Partial<Record<MetricKey, { p30: number; p40: number; p55: number; p60: number; p70: number; p75: number }>>;
  norms: Partial<Record<MetricKey, { min: number; max: number }>>;
};

function num(value: number | null | undefined): number | null {
  return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
}

function extractMetrics(row: TechnicalCharacteristicsRow): RowMetrics {
  const turnover = num(row.turnoverRub.value);
  const trades = num(row.tradesCount.value);
  const readiness = num(row.intradayUsabilityScore.value);
  const inPlayProxy =
    readiness ??
    (turnover !== null && trades !== null && trades > 0
      ? Math.log10(Math.max(turnover, 1)) * 12 + Math.log10(Math.max(trades, 1)) * 10
      : null);

  return {
    trades,
    spreadPct: num(row.spreadPct.value),
    stepValue: num(row.stepValue.value),
    turnover,
    lotPrice: num(row.lotPrice.value),
    turnoverPerTrade: num(row.turnoverPerTradeRub.value),
    readiness,
    costErrorScore: num(row.commissionToRangeScore.value),
    entryFriction: getEntryFriction(row),
    confidence: row.availabilityConfidence,
    dayRangeProxy: num(row.commissionToRangeScore.value),
    inPlayProxy,
    slippage: num(row.slippageSensitivity.value),
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

function buildBatchStats(rows: TechnicalCharacteristicsRow[]): BatchStats {
  const byMetric: Partial<Record<MetricKey, number[]>> = {};
  for (const row of rows) {
    const m = extractMetrics(row);
    for (const key of Object.keys(m) as MetricKey[]) {
      const v = m[key];
      if (v === null || key === "confidence") continue;
      if (!byMetric[key]) byMetric[key] = [];
      byMetric[key]!.push(v);
    }
  }

  const percentiles: BatchStats["percentiles"] = {};
  const norms: BatchStats["norms"] = {};
  for (const key of Object.keys(byMetric) as MetricKey[]) {
    const sorted = [...(byMetric[key] ?? [])].sort((a, b) => a - b);
    if (sorted.length === 0) continue;
    percentiles[key] = {
      p30: percentile(sorted, 0.3),
      p40: percentile(sorted, 0.4),
      p55: percentile(sorted, 0.55),
      p60: percentile(sorted, 0.6),
      p70: percentile(sorted, 0.7),
      p75: percentile(sorted, 0.75),
    };
    norms[key] = { min: sorted[0]!, max: sorted[sorted.length - 1]! };
  }
  return { percentiles, norms };
}

function normalize(value: number | null, norm: { min: number; max: number } | undefined, direction: MetricDirection): number | null {
  if (value === null || !norm) return null;
  if (norm.max === norm.min) return 0.5;
  const raw = (value - norm.min) / (norm.max - norm.min);
  const score = direction === "higher" ? raw : 1 - raw;
  return Math.max(0, Math.min(1, score));
}

function buildReasonTags(preset: TechnicalPreset, m: RowMetrics, stats: BatchStats): PresetReasonTag[] {
  const tags: PresetReasonTag[] = [];
  const p = stats.percentiles;

  if (m.trades !== null && p.trades && m.trades >= p.trades.p60) tags.push("много сделок");
  if (m.spreadPct !== null && p.spreadPct && m.spreadPct <= p.spreadPct.p40) tags.push("узкий спред");
  if (m.stepValue !== null && p.stepValue && m.stepValue <= p.stepValue.p40) tags.push("дешёвый шаг");
  if (m.turnover !== null && p.turnover && m.turnover >= p.turnover.p60) tags.push("высокий оборот");
  if (m.dayRangeProxy !== null && m.dayRangeProxy >= 50) tags.push("есть диапазон");
  if (m.costErrorScore !== null && p.costErrorScore && m.costErrorScore >= p.costErrorScore.p55) tags.push("низкая цена ошибки");
  if (m.lotPrice !== null && p.lotPrice && m.lotPrice <= p.lotPrice.p40) tags.push("понятный лот");

  if (preset === "scalping" && tags.includes("много сделок") && tags.includes("узкий спред")) {
    tags.push("подходит для стакана");
  }
  if (preset === "intraday" && tags.includes("есть диапазон") && (tags.includes("высокий оборот") || tags.includes("много сделок"))) {
    tags.push("подходит для графика");
  }
  if (m.readiness !== null && p.readiness && m.readiness >= p.readiness.p55) tags.push("удобен для отбора");
  if (preset === "in-play" && m.inPlayProxy !== null && p.inPlayProxy && m.inPlayProxy >= p.inPlayProxy.p55) {
    tags.push("активный поток");
  }

  return [...new Set(tags)].slice(0, 4);
}

function buildWarnings(m: RowMetrics, stats: BatchStats): PresetWarningTag[] {
  const warnings: PresetWarningTag[] = [];
  const p = stats.percentiles;

  if (m.lotPrice !== null && p.lotPrice && m.lotPrice >= p.lotPrice.p75) warnings.push("дорогой лот");
  if (m.spreadPct !== null && p.spreadPct && m.spreadPct >= p.spreadPct.p70) warnings.push("широкий спред");
  if (m.trades !== null && p.trades && m.trades <= p.trades.p30) warnings.push("мало сделок");
  if (m.stepValue !== null && p.stepValue && m.stepValue >= p.stepValue.p75) warnings.push("дорогой шаг");
  if ((m.confidence ?? 100) < 65) warnings.push("данные неполные");

  return [...new Set(warnings)];
}

export function evaluateRowForPreset(
  row: TechnicalCharacteristicsRow,
  preset: TechnicalPreset,
  stats: BatchStats,
): PresetEvaluation {
  const metrics = extractMetrics(row);
  const weights = PRESET_WEIGHTS[preset];
  let totalWeight = 0;
  let weightedSum = 0;

  for (const { key, weight, direction } of weights) {
    const value = metrics[key];
    const part =
      key === "confidence"
        ? Math.max(0, Math.min(1, (metrics.confidence ?? 0) / 100))
        : normalize(value, stats.norms[key], direction);
    if (part === null) continue;
    weightedSum += part * weight;
    totalWeight += weight;
  }

  const presetScore = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
  return {
    presetScore,
    presetReasonTags: buildReasonTags(preset, metrics, stats),
    presetWarnings: buildWarnings(metrics, stats),
  };
}

export function rankRowsForPreset(rows: TechnicalCharacteristicsRow[], preset: TechnicalPreset): RankedPresetRow[] {
  if (rows.length === 0) return [];
  const stats = buildBatchStats(rows);
  const ranked = rows.map((row) => ({
    row,
    evaluation: evaluateRowForPreset(row, preset, stats),
    rank: 0,
  }));
  ranked.sort((a, b) => b.evaluation.presetScore - a.evaluation.presetScore);
  return ranked.map((item, index) => ({ ...item, rank: index + 1 }));
}

export function buildPresetEvaluationMap(
  rows: TechnicalCharacteristicsRow[],
  preset: TechnicalPreset,
): Map<string, PresetEvaluation> {
  const ranked = rankRowsForPreset(rows, preset);
  return new Map(ranked.map((item) => [item.row.ticker, item.evaluation]));
}

export function getTopPresetRows(rows: TechnicalCharacteristicsRow[], preset: TechnicalPreset, limit = 5): RankedPresetRow[] {
  return rankRowsForPreset(rows, preset).slice(0, limit);
}
