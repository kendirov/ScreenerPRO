import type { ScreenerRow } from "@screenerpro/shared";
import { classifyStockTradingState, filterStocksByTradingState } from "@/lib/domain/stock-trading-state";
import { isStockInPlay } from "@/lib/domain/stock-screener-display";
import { detectStockImpulseEvent } from "@/lib/domain/stocks-screener-signals";
import { computePositionInRange } from "@/lib/domain/stock-sparkline";
import { inferFutureMarketSegment } from "@/lib/domain/screener-overview";
import { buildFuturesBaseMap } from "@/lib/domain/screener-overview";

export type ScreenerPresetSort = "score" | "turnover" | "trades" | "range" | "change";

export type ScreenerPreset<T extends string> = {
  id: T;
  label: string;
  description: string;
  sort: ScreenerPresetSort;
};

export const STOCK_SCREENER_PRESETS = [
  { id: "in-play", label: "В игре", description: "HARD in-play — деньги + лента + ход", sort: "score" },
  { id: "scalp", label: "Для скальпа", description: "Ликвидность + сделки + нормальный спред", sort: "trades" },
  { id: "top-turnover", label: "Топ оборота", description: "Где сейчас основные деньги", sort: "turnover" },
  { id: "momentum", label: "Импульс", description: "Широкий ход и ускорение", sort: "range" },
  { id: "near-high", label: "У high", description: "У максимума дня", sort: "change" },
  { id: "near-low", label: "У low", description: "У минимума дня", sort: "change" },
  { id: "volume-above", label: "Объём выше нормы", description: "Vol x / оборот выше baseline", sort: "score" },
  { id: "dangerous", label: "Опасные", description: "Движение без нормальной ликвидности", sort: "range" },
] as const satisfies readonly ScreenerPreset<string>[];

export type StockPresetId = (typeof STOCK_SCREENER_PRESETS)[number]["id"];

export const FUTURES_SCREENER_PRESETS = [
  { id: "in-play", label: "В игре", description: "Активные контракты с оборотом", sort: "turnover" },
  { id: "fx", label: "Валюта", description: "Si · CNY · ED · Eu", sort: "turnover" },
  { id: "index", label: "Индекс", description: "MX · MIX · IMOEX", sort: "turnover" },
  { id: "commodity", label: "Сырьё", description: "BR · NG · металлы", sort: "turnover" },
  { id: "top-turnover", label: "Топ оборота", description: "Максимальный оборот", sort: "turnover" },
  { id: "momentum", label: "Импульс", description: "Широкий диапазон дня", sort: "range" },
  { id: "far", label: "Дальние", description: "Дальние контракты с оборотом", sort: "turnover" },
  { id: "caution", label: "Осторожно", description: "Движение при слабом обороте", sort: "range" },
] as const satisfies readonly ScreenerPreset<string>[];

export type FuturesPresetId = (typeof FUTURES_SCREENER_PRESETS)[number]["id"];

function sortRows(rows: ScreenerRow[], sort: ScreenerPresetSort): ScreenerRow[] {
  return [...rows].sort((a, b) => {
    if (sort === "turnover") return (b.turnover ?? 0) - (a.turnover ?? 0);
    if (sort === "trades") return (b.tradesCount ?? 0) - (a.tradesCount ?? 0);
    if (sort === "range") return Math.abs(b.metrics.dayRangePct ?? 0) - Math.abs(a.metrics.dayRangePct ?? 0);
    if (sort === "change") return Math.abs(b.percentChange ?? 0) - Math.abs(a.percentChange ?? 0);
    return (b.metrics.inPlayScore ?? 0) - (a.metrics.inPlayScore ?? 0);
  });
}

export function applyStockPreset(rows: ScreenerRow[], presetId: StockPresetId, maxTurnover: number): ScreenerRow[] {
  let filtered: ScreenerRow[];
  const preset = STOCK_SCREENER_PRESETS.find((p) => p.id === presetId)!;

  switch (presetId) {
    case "in-play":
      filtered = rows.filter((r) => isStockInPlay(r));
      break;
    case "scalp":
      filtered = rows.filter((r) => {
        const state = classifyStockTradingState(r, maxTurnover);
        return (state === "liquid" || state === "in_play") && (r.tradesCount ?? 0) >= 3_000;
      });
      break;
    case "top-turnover":
      filtered = rows.filter((r) => (r.turnover ?? 0) > 0);
      break;
    case "momentum":
      filtered = rows.filter((r) => detectStockImpulseEvent(r) != null);
      break;
    case "near-high":
      filtered = rows.filter((r) => {
        const pos = computePositionInRange(r.lastPrice, r.low, r.high);
        return pos != null && pos >= 0.85;
      });
      break;
    case "near-low":
      filtered = rows.filter((r) => {
        const pos = computePositionInRange(r.lastPrice, r.low, r.high);
        return pos != null && pos <= 0.15;
      });
      break;
    case "volume-above":
      filtered = rows.filter((r) => {
        const volX = r.metrics.volumeRatioNow ?? r.metrics.turnoverVsAverage;
        return volX != null && volX >= 1.2;
      });
      break;
    case "dangerous":
      filtered = filterStocksByTradingState(rows, "dangerous", maxTurnover);
      break;
    default:
      filtered = rows;
  }

  return sortRows(filtered, preset.sort);
}

function futureSegmentMatch(row: ScreenerRow, baseMap: Map<string, string>, segment: string): boolean {
  const base = baseMap.get(row.ticker) ?? row.shortName;
  const seg = inferFutureMarketSegment(base, row.ticker);
  return seg === segment;
}

export function applyFuturesPreset(rows: ScreenerRow[], presetId: FuturesPresetId): ScreenerRow[] {
  const preset = FUTURES_SCREENER_PRESETS.find((p) => p.id === presetId)!;
  const baseMap = buildFuturesBaseMap(rows);
  let filtered: ScreenerRow[];

  switch (presetId) {
    case "in-play":
      filtered = rows.filter((r) => (r.turnover ?? 0) > 0 && (r.tradesCount ?? 0) > 50);
      break;
    case "fx":
      filtered = rows.filter((r) => futureSegmentMatch(r, baseMap, "Валюта"));
      break;
    case "index":
      filtered = rows.filter((r) => futureSegmentMatch(r, baseMap, "Индекс"));
      break;
    case "commodity":
      filtered = rows.filter((r) => {
        const seg = inferFutureMarketSegment(baseMap.get(r.ticker) ?? r.shortName, r.ticker);
        return seg === "Нефть" || seg === "Металл";
      });
      break;
    case "far":
      filtered = rows.filter((r) => {
        const days = r.expiryDate ? daysToExpiry(r.expiryDate) : null;
        return days != null && days > 45 && (r.turnover ?? 0) > 0;
      });
      break;
    case "caution":
      filtered = rows.filter((r) => Math.abs(r.percentChange ?? 0) >= 1.5 && (r.turnover ?? 0) < medianTurnover(rows) * 0.15);
      break;
    case "top-turnover":
    case "momentum":
      filtered = rows;
      break;
    default:
      filtered = rows;
  }

  if (presetId === "momentum") {
    filtered = filtered.filter((r) => Math.abs(r.metrics.dayRangePct ?? 0) >= 1.5);
  }

  return sortRows(filtered, preset.sort);
}

function daysToExpiry(expiryDate: string): number | null {
  const exp = new Date(expiryDate);
  if (Number.isNaN(exp.getTime())) return null;
  return Math.ceil((exp.getTime() - Date.now()) / 86_400_000);
}

function medianTurnover(rows: ScreenerRow[]): number {
  const vals = rows.map((r) => r.turnover ?? 0).filter((v) => v > 0).sort((a, b) => a - b);
  if (!vals.length) return 0;
  return vals[Math.floor(vals.length / 2)] ?? 0;
}
