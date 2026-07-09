import type { PriorityFilterSets } from "@/lib/screener/stock-screener-priority-filters";

/** Table Setup column role — one primary badge per row. */
export type StockTablePriorityRole = "focus" | "in_play" | "liquidity" | "volatility" | "risk";

const ROLE_LABEL: Record<StockTablePriorityRole, string> = {
  focus: "Focus",
  in_play: "InPlay",
  liquidity: "Liquidity",
  volatility: "Spike",
  risk: "Risk",
};

export function getStockTablePriorityRoleLabel(role: StockTablePriorityRole): string {
  return ROLE_LABEL[role];
}

/**
 * Priority badge for table Setup column (highest role wins).
 * Focus ⊂ Candidates; liquidity alone is not In Play.
 */
export function resolveStockTablePriorityRole(
  ticker: string,
  sets: PriorityFilterSets,
): StockTablePriorityRole | null {
  if (sets.inPlayFocus.has(ticker)) return "focus";
  if (sets.inPlayCandidates.has(ticker)) return "in_play";
  if (sets.volatility.has(ticker)) return "volatility";
  if (sets.risk.has(ticker)) return "risk";
  if (sets.liquidity.has(ticker)) return "liquidity";
  return null;
}
