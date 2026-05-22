import type { ScreenerRow } from "@screenerpro/shared";
import { formatTurnoverCompact } from "@/lib/domain/screener-overview";
import { isStockIlliquid, isStockInPlay } from "@/lib/domain/stock-screener-display";
import { tradingFormat } from "@/lib/formatters/trading";

export type MarketLabStatus = "в игре" | "ликвидный" | "движение" | "тихо" | "неликвид";

export type MarketLabNode = {
  ticker: string;
  name?: string;
  price?: number | null;
  changePct: number;
  turnoverRub: number;
  tradesCount: number;
  rangePct?: number | null;
  inPlayScore?: number | null;
  isInPlay?: boolean;
  moveWeightRub: number;
  absMoveWeightRub: number;
  liquidityRank: number;
  activityRank: number;
  status: MarketLabStatus;
};

function finiteOrNull(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

function finiteNum(value: number | null | undefined, fallback = 0): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return value;
}

/** Денежный импульс (вес движения): оборот × Δ%, без buy/sell flow. */
export function computeMoveWeightRub(turnoverRub: number | null | undefined, changePct: number | null | undefined): number {
  const turnover = finiteOrNull(turnoverRub);
  const change = finiteOrNull(changePct);
  if (turnover == null || change == null) return 0;
  return turnover * (change / 100);
}

export function classifyMarketLabStatus(row: ScreenerRow, maxTurnover: number): MarketLabStatus {
  if (isStockIlliquid(row, maxTurnover)) return "неликвид";
  if (isStockInPlay(row) || row.metrics.isInPlay) return "в игре";

  const turnoverPct = row.metrics.turnoverPercentile ?? 0;
  const tradesPct = row.metrics.tradesPercentile ?? 0;
  const rangePct = Math.abs(row.metrics.dayRangePct ?? 0);
  const changePct = Math.abs(row.percentChange ?? 0);

  if (turnoverPct >= 70 || tradesPct >= 70 || row.stockActivityClass === "active") {
    return "ликвидный";
  }

  if (rangePct >= 2.5 || changePct >= 1.2 || (row.metrics.rangePercentile ?? 0) >= 70) {
    return "движение";
  }

  if (row.stockActivityClass === "inactive") return "тихо";
  return "тихо";
}

export function buildMarketLabNodeFromRow(
  row: ScreenerRow,
  ranks: { liquidityRank: number; activityRank: number },
  maxTurnover: number,
): MarketLabNode {
  const moveWeightRub = computeMoveWeightRub(row.turnover, row.percentChange);

  return {
    ticker: row.ticker,
    name: row.shortName?.trim() ? row.shortName : undefined,
    price: finiteOrNull(row.lastPrice),
    changePct: finiteNum(row.percentChange, 0),
    turnoverRub: finiteNum(row.turnover, 0),
    tradesCount: finiteNum(row.tradesCount, 0),
    rangePct: finiteOrNull(row.metrics.dayRangePct),
    inPlayScore: finiteOrNull(row.metrics.inPlayScore),
    isInPlay: row.metrics.isInPlay,
    moveWeightRub,
    absMoveWeightRub: Math.abs(moveWeightRub),
    liquidityRank: ranks.liquidityRank,
    activityRank: ranks.activityRank,
    status: classifyMarketLabStatus(row, maxTurnover),
  };
}

/** Акции из ответа `/api/screener` → узлы Lab (без фейковых полей). */
export function stockRowsToMarketLabNodes(rows: ScreenerRow[]): MarketLabNode[] {
  const stocks = rows.filter((row) => row.assetClass === "stock");
  const maxTurnover = stocks.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0);

  const byLiquidity = [...stocks].sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0));
  const liquidityRankByTicker = new Map(byLiquidity.map((row, index) => [row.ticker, index + 1]));

  const byActivity = [...stocks].sort((a, b) => {
    const tradesDiff = (b.tradesCount ?? 0) - (a.tradesCount ?? 0);
    if (tradesDiff !== 0) return tradesDiff;
    return (b.metrics.inPlayScore ?? 0) - (a.metrics.inPlayScore ?? 0);
  });
  const activityRankByTicker = new Map(byActivity.map((row, index) => [row.ticker, index + 1]));

  const fallbackRank = stocks.length || 1;

  return stocks.map((row) =>
    buildMarketLabNodeFromRow(
      row,
      {
        liquidityRank: liquidityRankByTicker.get(row.ticker) ?? fallbackRank,
        activityRank: activityRankByTicker.get(row.ticker) ?? fallbackRank,
      },
      maxTurnover,
    ),
  );
}

/** Краткий формат суммы в ₽ (оборот, денежный импульс). */
export function formatMoneyShort(value: number | null | undefined, options?: { signed?: boolean }): string {
  if (value == null || !Number.isFinite(value)) return "—";

  const signed = options?.signed === true;
  const sign = signed ? (value > 0 ? "+" : value < 0 ? "−" : "") : "";
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) {
    return `${sign}${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(abs / 1_000_000_000)} млрд`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(abs / 1_000_000)} млн`;
  }
  if (abs >= 1_000) {
    return `${sign}${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(abs / 1_000)} тыс`;
  }
  return `${sign}${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(abs)}`;
}

/** Компактный оборот без символа ₽ (как в скринере). */
export function formatMoneyShortTurnover(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return formatTurnoverCompact(value);
}

export function formatSignedPct(value: number | null | undefined): string {
  return tradingFormat.formatSignedPercent(finiteOrNull(value));
}

export function getTopMoney(nodes: MarketLabNode[], limit = 1): MarketLabNode[] {
  return [...nodes]
    .filter((node) => node.turnoverRub > 0)
    .sort((a, b) => b.turnoverRub - a.turnoverRub)
    .slice(0, limit);
}

export function getTopPositiveImpulse(nodes: MarketLabNode[], limit = 1): MarketLabNode[] {
  return [...nodes]
    .filter((node) => node.moveWeightRub > 0)
    .sort((a, b) => b.moveWeightRub - a.moveWeightRub)
    .slice(0, limit);
}

export function getTopNegativePressure(nodes: MarketLabNode[], limit = 1): MarketLabNode[] {
  return [...nodes]
    .filter((node) => node.moveWeightRub < 0)
    .sort((a, b) => a.moveWeightRub - b.moveWeightRub)
    .slice(0, limit);
}

export function movementScore(node: MarketLabNode): number {
  const range = node.rangePct;
  if (range != null && range > 0) return range;
  return Math.abs(node.changePct);
}

export function getTopMovement(nodes: MarketLabNode[], limit = 1): MarketLabNode[] {
  return [...nodes]
    .filter((node) => movementScore(node) > 0)
    .sort((a, b) => movementScore(b) - movementScore(a))
    .slice(0, limit);
}

export type MarketLabLeaders = {
  money: MarketLabNode | null;
  impulse: MarketLabNode | null;
  pressure: MarketLabNode | null;
  movement: MarketLabNode | null;
};

export function buildMarketLabLeaders(nodes: MarketLabNode[]): MarketLabLeaders {
  return {
    money: getTopMoney(nodes, 1)[0] ?? null,
    impulse: getTopPositiveImpulse(nodes, 1)[0] ?? null,
    pressure: getTopNegativePressure(nodes, 1)[0] ?? null,
    movement: getTopMovement(nodes, 1)[0] ?? null,
  };
}
