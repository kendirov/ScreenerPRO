import type { ScreenerRow } from "@screenerpro/shared";

export type SectorKStockSortKey = "price" | "change" | "turnover" | "trades" | "range";
export type SectorKSortDirection = "asc" | "desc";

export type SectorKStockActivity = {
  row: ScreenerRow;
  turnoverPercentile: number;
  tradesPercentile: number;
  liquidityPercentile: number;
};

const ILLIQUID_BOTTOM_TAIL = 42;

function stockSortValue(row: ScreenerRow, key: SectorKStockSortKey): number | null {
  if (key === "price") return row.lastPrice;
  if (key === "change") return row.percentChange;
  if (key === "turnover") return row.turnover;
  if (key === "trades") return row.tradesCount ?? null;
  return row.metrics.dayRangePct;
}

export function sortSectorKStocks(
  rows: ScreenerRow[],
  key: SectorKStockSortKey,
  direction: SectorKSortDirection,
): ScreenerRow[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const leftValue = stockSortValue(left, key);
    const rightValue = stockSortValue(right, key);
    if (leftValue == null && rightValue == null) return left.ticker.localeCompare(right.ticker);
    if (leftValue == null) return 1;
    if (rightValue == null) return -1;
    const diff = (leftValue - rightValue) * multiplier;
    return diff || left.ticker.localeCompare(right.ticker);
  });
}

function finiteOrZero(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function percentileRanks(values: number[]): number[] {
  if (!values.length) return [];
  if (values.length === 1) return [100];
  const sorted = [...values].sort((a, b) => a - b);
  return values.map((value) => {
    const first = sorted.indexOf(value);
    const last = sorted.lastIndexOf(value);
    const rank = (first + last) / 2;
    return Math.round((rank / (values.length - 1)) * 10_000) / 100;
  });
}

export function buildSectorKStockActivity(rows: ScreenerRow[]): SectorKStockActivity[] {
  const turnoverRanks = percentileRanks(rows.map((row) => finiteOrZero(row.turnover)));
  const tradesRanks = percentileRanks(rows.map((row) => finiteOrZero(row.tradesCount)));

  return rows.map((row, index) => {
    const turnoverPercentile = turnoverRanks[index] ?? 0;
    const tradesPercentile = tradesRanks[index] ?? 0;
    return {
      row,
      turnoverPercentile,
      tradesPercentile,
      liquidityPercentile: Math.min(turnoverPercentile, tradesPercentile),
    };
  });
}

/** Hide only the bottom tail on both turnover and trades; no fixed ruble threshold. */
export function getSectorKLiquidTickers(activity: SectorKStockActivity[]): Set<string> {
  return new Set(
    activity
      .filter((item) => item.turnoverPercentile >= ILLIQUID_BOTTOM_TAIL || item.tradesPercentile >= ILLIQUID_BOTTOM_TAIL)
      .map((item) => item.row.ticker),
  );
}

export function getSectorKTotalTrades(rows: ScreenerRow[]): number {
  return rows.reduce((sum, row) => sum + (row.tradesCount ?? 0), 0);
}

export function getSectorKMarketBreadth(rows: ScreenerRow[]): {
  advancing: number;
  declining: number;
  unchanged: number;
  breadthPct: number | null;
} {
  const observed = rows.filter((row) => row.assetClass === "stock" && row.percentChange != null);
  const advancing = observed.filter((row) => (row.percentChange ?? 0) > 0.05).length;
  const declining = observed.filter((row) => (row.percentChange ?? 0) < -0.05).length;
  const unchanged = Math.max(0, observed.length - advancing - declining);
  const breadthPct = observed.length ? ((advancing - declining) / observed.length) * 100 : null;
  return { advancing, declining, unchanged, breadthPct };
}

export function formatSectorKTurnover(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} млрд`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} млн`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)} тыс`;
  return Math.round(value).toLocaleString("ru-RU");
}

export function formatSectorKPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const digits = Math.abs(value) < 10 ? 3 : Math.abs(value) < 100 ? 2 : 1;
  return value.toLocaleString("ru-RU", { maximumFractionDigits: digits });
}

export function formatSectorKPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function formatSectorKMagnitudePercent(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.abs(value).toFixed(digits)}%`;
}
