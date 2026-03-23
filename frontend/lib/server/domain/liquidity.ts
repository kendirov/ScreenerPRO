export type LiquidityClass = "liquid" | "illiquid" | "unknown";

export const STOCK_LIQUIDITY_RULES = {
  minTurnoverRub: 500_000_000,
  minTradesCount: 10_000,
  allowlistTickers: ["SBER", "GAZP", "LKOH", "ROSN", "NVTK", "GMKN", "TATN", "MTLR"] as const,
} as const;

const allowlist = new Set<string>(STOCK_LIQUIDITY_RULES.allowlistTickers);

export function classifyStockLiquidity(input: {
  ticker: string;
  turnover: number | null;
  tradesCount: number | null;
}): LiquidityClass {
  if (allowlist.has(input.ticker.toUpperCase())) return "liquid";
  if ((input.turnover ?? 0) >= STOCK_LIQUIDITY_RULES.minTurnoverRub) return "liquid";
  if ((input.tradesCount ?? 0) >= STOCK_LIQUIDITY_RULES.minTradesCount) return "liquid";
  if (input.turnover === null && input.tradesCount === null) return "unknown";
  return "illiquid";
}
