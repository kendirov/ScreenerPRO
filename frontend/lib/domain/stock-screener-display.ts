import type { ScreenerRow } from "@screenerpro/shared";

export const STOCK_ILLIQUID_RATIO = 0.02;
export const STOCK_ILLIQUID_TURNOVER_FLOOR = 35_000_000;
export const STOCK_ILLIQUID_MIN_TRADES = 1_200;

export type StockActivityDisplayLabel = "Лидер" | "В игре" | "Наблюдение" | "Тихо" | "Неликвид";

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
