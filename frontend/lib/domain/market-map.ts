import type { ScreenerRow } from "@screenerpro/shared";
import {
  buildMarketLabLeaders,
  computeMoveWeightRub,
  formatMoneyShort,
  stockRowsToMarketLabNodes,
} from "@/lib/domain/market-lab";
import { formatTurnoverCompact } from "@/lib/domain/screener-overview";
import {
  getStockActivityDisplayLabel,
  isStockIlliquid,
  type StockActivityDisplayLabel,
} from "@/lib/domain/stock-screener-display";
import { tradingFormat } from "@/lib/formatters/trading";

export type MarketMapMode = "turnover" | "movement" | "impulse";

export type MarketMapTile = {
  row: ScreenerRow;
  ticker: string;
  turnoverRub: number | null;
  changePct: number | null;
  tradesCount: number | null;
  rangePct: number | null;
  moveWeightRub: number | null;
  absMoveWeightRub: number | null;
  statusLabel: StockActivityDisplayLabel;
};

export type MarketMapSummary = {
  money: { ticker: string; value: number | null } | null;
  impulse: { ticker: string; value: number | null } | null;
  pressure: { ticker: string; value: number | null } | null;
};

const MAX_TILES = 60;
const MIN_TURNOVER_FLOOR = 5_000_000;

function num(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

export function buildMarketMapTile(row: ScreenerRow, maxTurnover: number): MarketMapTile {
  const turnoverRub = num(row.turnover);
  const changePct = num(row.percentChange);
  const rangePct = num(row.metrics.dayRangePct);
  const tradesCount = num(row.tradesCount ?? null);

  let moveWeightRub: number | null = null;
  if (turnoverRub != null && changePct != null) {
    moveWeightRub = computeMoveWeightRub(turnoverRub, changePct);
  }
  const absMoveWeightRub = moveWeightRub != null ? Math.abs(moveWeightRub) : null;

  return {
    row,
    ticker: row.ticker,
    turnoverRub,
    changePct,
    tradesCount,
    rangePct,
    moveWeightRub,
    absMoveWeightRub,
    statusLabel: getStockActivityDisplayLabel(row, maxTurnover),
  };
}

export function buildMarketMapTiles(rows: ScreenerRow[], options?: { hideIlliquid?: boolean }): MarketMapTile[] {
  const stocks = rows.filter((row) => row.assetClass === "stock");
  const maxTurnover = stocks.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0);

  return stocks
    .map((row) => buildMarketMapTile(row, maxTurnover))
    .filter((tile) => {
      if (options?.hideIlliquid !== false && isStockIlliquid(tile.row, maxTurnover)) return false;
      const turnover = tile.turnoverRub ?? 0;
      if (turnover < MIN_TURNOVER_FLOOR) return false;
      return true;
    });
}

export function getModeSizeValue(tile: MarketMapTile, mode: MarketMapMode): number {
  if (mode === "turnover") return tile.turnoverRub ?? 0;
  if (mode === "movement") {
    const range = tile.rangePct;
    if (range != null && range > 0) return range;
    return Math.abs(tile.changePct ?? 0);
  }
  return tile.absMoveWeightRub ?? 0;
}

export function sortTilesForMode(tiles: MarketMapTile[], mode: MarketMapMode): MarketMapTile[] {
  return [...tiles].sort((a, b) => getModeSizeValue(b, mode) - getModeSizeValue(a, mode));
}

export function selectMarketMapTiles(tiles: MarketMapTile[], mode: MarketMapMode, limit = MAX_TILES): MarketMapTile[] {
  return sortTilesForMode(tiles, mode)
    .filter((tile) => getModeSizeValue(tile, mode) > 0)
    .slice(0, limit);
}

export function buildMarketMapSummary(tiles: MarketMapTile[]): MarketMapSummary {
  const nodes = stockRowsToMarketLabNodes(tiles.map((tile) => tile.row));
  const leaders = buildMarketLabLeaders(nodes);

  return {
    money: leaders.money ? { ticker: leaders.money.ticker, value: leaders.money.turnoverRub } : null,
    impulse: leaders.impulse ? { ticker: leaders.impulse.ticker, value: leaders.impulse.moveWeightRub } : null,
    pressure: leaders.pressure ? { ticker: leaders.pressure.ticker, value: leaders.pressure.moveWeightRub } : null,
  };
}

export function formatMoveWeightCompact(value: number | null): string {
  return formatMoneyShort(value, { signed: true });
}

export function formatSummaryLine(
  kind: "money" | "impulse" | "pressure",
  entry: { ticker: string; value: number | null } | null,
): string {
  if (!entry) return "—";
  if (kind === "money") return `${entry.ticker} ${formatTurnoverCompact(entry.value)}`;
  return `${entry.ticker} ${formatMoveWeightCompact(entry.value)}`;
}

export function getTileColorPct(tile: MarketMapTile, mode: MarketMapMode): number | null {
  if (mode === "impulse") {
    const w = tile.moveWeightRub;
    if (w == null) return null;
    if (w > 0) return Math.min(5, Math.abs(tile.changePct ?? 0.5) + 0.5);
    if (w < 0) return -Math.min(5, Math.abs(tile.changePct ?? 0.5) + 0.5);
    return 0;
  }
  return tile.changePct;
}

export function colorIntensity(pct: number | null): number {
  if (pct == null) return 0;
  return Math.min(1, Math.abs(pct) / 4);
}

export function tileSurfaceStyle(tile: MarketMapTile, mode: MarketMapMode, maxTrades: number): {
  background: string;
  border: string;
  glow: string;
  textPct: string;
} {
  const pct = getTileColorPct(tile, mode);
  const intensity = colorIntensity(pct);
  const isUp = (pct ?? 0) > 0.08;
  const isDown = (pct ?? 0) < -0.08;
  const trades = tile.tradesCount ?? 0;
  const tradeRatio = maxTrades > 0 ? Math.min(1, trades / maxTrades) : 0;

  let background = "rgba(15,23,42,0.55)";
  let border = "rgba(148,163,184,0.12)";
  let glow = "none";
  let textPct = "text-slate-400";

  if (isUp) {
    background = `rgba(6,78,59,${0.18 + intensity * 0.35})`;
    border = `rgba(52,211,153,${0.15 + intensity * 0.45})`;
    textPct = "text-emerald-300";
  } else if (isDown) {
    background = `rgba(127,29,29,${0.15 + intensity * 0.32})`;
    border = `rgba(251,113,133,${0.14 + intensity * 0.4})`;
    textPct = "text-rose-300";
  }

  if (tradeRatio > 0.35) {
    glow = isUp
      ? `0 0 ${8 + tradeRatio * 18}px rgba(52,211,153,${0.12 + tradeRatio * 0.2})`
      : isDown
        ? `0 0 ${8 + tradeRatio * 18}px rgba(251,113,133,${0.1 + tradeRatio * 0.18})`
        : `0 0 ${6 + tradeRatio * 12}px rgba(148,163,184,0.12)`;
  }

  return { background, border, glow, textPct };
}

export function marketMapCellClass(rank: number): string {
  if (rank === 0) return "col-span-12 sm:col-span-8 md:col-span-5 min-h-[7.5rem]";
  if (rank === 1) return "col-span-12 sm:col-span-4 md:col-span-4 min-h-[6.25rem]";
  if (rank === 2) return "col-span-12 sm:col-span-6 md:col-span-3 min-h-[5.75rem]";
  if (rank < 10) return "col-span-6 sm:col-span-4 md:col-span-3 min-h-[4.75rem]";
  if (rank < 22) return "col-span-4 sm:col-span-3 md:col-span-2 min-h-[4.25rem]";
  return "col-span-4 sm:col-span-3 md:col-span-2 min-h-[3.75rem]";
}

export function tileSubtitle(tile: MarketMapTile, mode: MarketMapMode): string | null {
  if (mode === "movement" && tile.rangePct != null) {
    return `ход ${tradingFormat.formatDayRangeMagnitude(tile.rangePct)}`;
  }
  if (mode === "impulse" && tile.moveWeightRub != null) {
    return `импульс ${formatMoveWeightCompact(tile.moveWeightRub)}`;
  }
  if (mode === "turnover" && tile.rangePct != null) {
    return `ход ${tradingFormat.formatDayRangeMagnitude(tile.rangePct)}`;
  }
  return null;
}

export const MARKET_MAP_MODE_LABELS: Record<MarketMapMode, string> = {
  turnover: "Оборот",
  movement: "Движение",
  impulse: "Импульс",
};
