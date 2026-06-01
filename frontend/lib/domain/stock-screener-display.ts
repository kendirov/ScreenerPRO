import type { ScreenerRow } from "@screenerpro/shared";

export const STOCK_ILLIQUID_RATIO = 0.02;
export const STOCK_ILLIQUID_TURNOVER_FLOOR = 35_000_000;
export const STOCK_ILLIQUID_MIN_TRADES = 1_200;

export type StockActivityDisplayLabel = "Лидер" | "В игре" | "Наблюдение" | "Тихо" | "Неликвид";

export type StockTableStatus = "Ликвид" | "В игре" | "Импульс" | "Давление" | "Тонкий разгон" | "Пассив";

const REASON_PART_TO_TAG: Record<string, string> = {
  Объем: "оборот",
  Сделки: "сделки",
  Диапазон: "диапазон",
};

export function isStockIlliquid(row: ScreenerRow, maxTurnover: number): boolean {
  const threshold = Math.max(maxTurnover * STOCK_ILLIQUID_RATIO, STOCK_ILLIQUID_TURNOVER_FLOOR);
  const turnover = row.turnover ?? 0;
  const tradesCount = row.tradesCount ?? 0;
  return turnover < threshold && tradesCount < STOCK_ILLIQUID_MIN_TRADES;
}

export function isStockInPlay(row: ScreenerRow): boolean {
  return (row.metrics.inPlayTags ?? []).includes("IN_PLAY");
}

export function parseInPlayReasonTags(row: ScreenerRow): string[] {
  const reasonLabel = row.metrics.reasonLabel;
  if (reasonLabel) {
    const fromLabel = reasonLabel
      .split("+")
      .map((part) => REASON_PART_TO_TAG[part.trim()] ?? null)
      .filter((tag): tag is string => Boolean(tag));
    if (fromLabel.length) return fromLabel.slice(0, 2);
  }

  const tags: string[] = [];
  if ((row.metrics.turnoverPercentile ?? 0) >= 70) tags.push("оборот");
  if ((row.metrics.tradesPercentile ?? 0) >= 70) tags.push("сделки");
  if ((row.metrics.rangePercentile ?? 0) >= 70) tags.push("диапазон");
  if (Math.abs(row.percentChange ?? 0) >= 1.2) tags.push("импульс");
  return tags.slice(0, 2);
}

export function getStockActivityDisplayLabel(row: ScreenerRow, maxTurnover: number): StockActivityDisplayLabel {
  if (isStockInPlay(row)) return "В игре";
  if (isStockIlliquid(row, maxTurnover)) return "Неликвид";

  const inPlayTags = row.metrics.inPlayTags ?? [];
  if (inPlayTags.includes("MONEY") || row.stockActivityClass === "active") return "Лидер";
  if (row.stockActivityClass === "has_activity") return "Наблюдение";
  if (row.stockActivityClass === "inactive") return "Тихо";
  return "Наблюдение";
}

export const stockActivityDisplayBadgeClass: Record<StockActivityDisplayLabel, string> = {
  Лидер: "border-emerald-700/30 bg-emerald-900/20 text-emerald-300/85",
  "В игре": "border-cyan-700/35 bg-cyan-950/25 text-cyan-200/90",
  Наблюдение: "border-slate-700/50 bg-slate-900/35 text-slate-300/85",
  Тихо: "border-slate-800/60 bg-slate-950/45 text-slate-500/85",
  Неликвид: "border-rose-900/35 bg-rose-950/20 text-rose-300/75",
};

const IMPULSE_CHANGE = 1.0;
const PRESSURE_CHANGE = -1.0;
const STRONG_RANGE = 2.0;
const ACTIVITY_PERCENTILE = 65;
const THIN_TURNOVER_CAP = 45;

/** Статус строки таблицы акций — не путать с «Лидер» по обороту. */
export function getStockTableStatus(row: ScreenerRow, maxTurnover: number): StockTableStatus {
  if (isStockInPlay(row)) return "В игре";

  const change = row.percentChange ?? 0;
  const range = Math.abs(row.metrics.dayRangePct ?? 0);
  const turnoverPct = row.metrics.turnoverPercentile ?? 0;
  const tradesPct = row.metrics.tradesPercentile ?? 0;
  const rangePct = row.metrics.rangePercentile ?? 0;
  const activityHigh = turnoverPct >= ACTIVITY_PERCENTILE || tradesPct >= ACTIVITY_PERCENTILE;
  const moveStrong = range >= STRONG_RANGE || Math.abs(change) >= IMPULSE_CHANGE || rangePct >= 70;

  if (moveStrong && turnoverPct < THIN_TURNOVER_CAP && tradesPct < THIN_TURNOVER_CAP) {
    return "Тонкий разгон";
  }

  if (change >= IMPULSE_CHANGE && activityHigh) return "Импульс";
  if (change <= PRESSURE_CHANGE && (activityHigh || range >= STRONG_RANGE)) return "Давление";

  if (isStockIlliquid(row, maxTurnover)) return "Пассив";

  if (turnoverPct >= 52 || tradesPct >= 52 || row.stockActivityClass === "active") {
    return "Ликвид";
  }

  return "Пассив";
}

export const stockTableStatusBadgeClass: Record<StockTableStatus, string> = {
  Ликвид: "border-emerald-700/30 bg-emerald-950/25 text-emerald-200/85",
  "В игре": "border-cyan-700/35 bg-cyan-950/30 text-cyan-200/90",
  Импульс: "border-amber-700/35 bg-amber-950/28 text-amber-200/90",
  Давление: "border-rose-800/35 bg-rose-950/28 text-rose-200/90",
  "Тонкий разгон": "border-violet-700/30 bg-violet-950/25 text-violet-200/85",
  Пассив: "border-slate-700/45 bg-slate-900/40 text-slate-400/90",
};

export function buildStockRowFilterHints(
  row: ScreenerRow,
  maxTurnover: number,
  options?: { hideIlliquid?: boolean },
): string[] {
  const hints: string[] = [];
  if (options?.hideIlliquid) hints.push("прошёл фильтр ликвидности");
  if (isStockInPlay(row)) hints.push("в игре");
  if ((row.metrics.turnoverPercentile ?? 0) >= 70) hints.push("топ оборот");
  if ((row.metrics.tradesPercentile ?? 0) >= 70) hints.push("топ сделки");
  if ((row.metrics.rangePercentile ?? 0) >= 70) hints.push("широкий диапазон");
  if (isStockIlliquid(row, maxTurnover) && !options?.hideIlliquid) hints.push("неликвид");
  return hints.slice(0, 4);
}

/** Колонка dayRangePct в `/screener/stocks` — диапазон high–low, не классическая волатильность. */
export const STOCK_DAY_RANGE_COLUMN_LABEL = "Диапазон";

export const STOCK_DAY_RANGE_HEADER_TOOLTIP =
  "Диапазон текущей сессии: high − low в процентах. Это простой прокси внутридневной волатильности, но не классическая волатильность.";

export const STOCK_DAY_RANGE_DETAIL_HINT = "Ход дня = диапазон high–low";

/** Краткая причина для колонки таблицы. */
export function getStockReasonSummary(row: ScreenerRow, maxTurnover: number): string {
  if (row.metrics.reasonLabel) {
    return row.metrics.reasonLabel.replace(/\+/g, " · ");
  }

  const tags = parseInPlayReasonTags(row);
  if (tags.length) {
    const labels: Record<string, string> = {
      оборот: "высокий оборот",
      сделки: "активная лента",
      диапазон: "широкий ход",
      импульс: "импульс",
    };
    return tags.map((tag) => labels[tag] ?? tag).join(" · ");
  }

  const status = getStockTableStatus(row, maxTurnover);
  if (status === "В игре") return "в игре";
  if (status === "Импульс") return "импульс дня";
  if (status === "Давление") return "давление";
  if (status === "Тонкий разгон") return "тонкий разгон";
  if (status === "Ликвид") return "лидер ликвидности";
  return "—";
}

/**
 * TODO (отдельная метрика "Волатильность", не смешивать с dayRangePct):
 * - ATR intraday;
 * - диапазон относительно среднего за 20 сессий;
 * - volatility ratio;
 * - не смешивать с простым диапазоном дня.
 */
