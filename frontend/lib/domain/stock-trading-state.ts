import type { ScreenerRow } from "@screenerpro/shared";
import { computePositionInRange } from "@/lib/domain/stock-sparkline";
import {
  isStockIlliquid,
  isStockInPlay,
  STOCK_ILLIQUID_MIN_TRADES,
  STOCK_ILLIQUID_RATIO,
  STOCK_ILLIQUID_TURNOVER_FLOOR,
} from "@/lib/domain/stock-screener-display";
import { detectStockImpulseEvent } from "@/lib/domain/stocks-screener-signals";

export type StockTradingState =
  | "in_play"
  | "active"
  | "liquid"
  | "momentum"
  | "near_high"
  | "near_low"
  | "dangerous"
  | "dead";

export type StockTradingStateLabel =
  | "В игре"
  | "Активный"
  | "Ликвидный"
  | "Импульс"
  | "У high"
  | "У low"
  | "Осторожно"
  | "Мёртвый";

const STATE_LABEL: Record<StockTradingState, StockTradingStateLabel> = {
  in_play: "В игре",
  active: "Активный",
  liquid: "Ликвидный",
  momentum: "Импульс",
  near_high: "У high",
  near_low: "У low",
  dangerous: "Осторожно",
  dead: "Мёртвый",
};

export function stockTradingStateLabel(state: StockTradingState): StockTradingStateLabel {
  return STATE_LABEL[state];
}

function estimateSpreadRisk(row: ScreenerRow): boolean {
  const turnover = row.turnover ?? 0;
  const trades = row.tradesCount ?? 0;
  if (trades <= 0) return true;
  const perTrade = turnover / trades;
  return perTrade > 8_000_000 && trades < 3_000;
}

export function classifyStockTradingState(row: ScreenerRow, maxTurnover: number): StockTradingState {
  const turnover = row.turnover ?? 0;
  const trades = row.tradesCount ?? 0;
  const range = Math.abs(row.metrics.dayRangePct ?? 0);
  const change = Math.abs(row.percentChange ?? 0);
  const position = computePositionInRange(row.lastPrice, row.low, row.high);

  if (turnover <= 0 && trades <= 0 && range < 0.3) return "dead";

  const illiquid = isStockIlliquid(row, maxTurnover);
  const impulse = detectStockImpulseEvent(row, position);
  const volX = row.metrics.volumeRatioNow ?? row.metrics.turnoverVsAverage ?? null;
  const tradesX = row.metrics.tradesRatioNow ?? row.metrics.tradesVsAverage ?? null;

  if (
    (change >= 2 || range >= 2.5) &&
    (illiquid || trades < STOCK_ILLIQUID_MIN_TRADES || estimateSpreadRisk(row))
  ) {
    return "dangerous";
  }

  if (isStockInPlay(row)) return "in_play";

  if (impulse && (change >= 1.5 || range >= 2)) return "momentum";

  if (position != null && position >= 0.88) return "near_high";
  if (position != null && position <= 0.12) return "near_low";

  if (
    (row.metrics.inPlayScore ?? 0) >= 65 ||
    (row.metrics.turnoverPercentile ?? 0) >= 55 ||
    (volX != null && volX >= 1.2) ||
    (tradesX != null && tradesX >= 1.15)
  ) {
    return "active";
  }

  if (!illiquid && turnover > 0 && trades >= STOCK_ILLIQUID_MIN_TRADES) return "liquid";

  if (illiquid && turnover > 0) return "dangerous";

  return "dead";
}

export function filterStocksByTradingState(
  rows: ScreenerRow[],
  state: StockTradingState,
  maxTurnover: number,
): ScreenerRow[] {
  return rows.filter((row) => classifyStockTradingState(row, maxTurnover) === state);
}

export function illiquidThreshold(maxTurnover: number): number {
  return Math.max(maxTurnover * STOCK_ILLIQUID_RATIO, STOCK_ILLIQUID_TURNOVER_FLOOR);
}

export function filterIlliquidStocks(rows: ScreenerRow[], hideIlliquid: boolean): ScreenerRow[] {
  if (!hideIlliquid || rows.length === 0) return rows;
  const maxTurnover = rows.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0);
  const filtered = rows.filter((row) => !isStockIlliquid(row, maxTurnover));
  if (filtered.length === 0 && rows.length > 0) return rows;
  return filtered;
}
