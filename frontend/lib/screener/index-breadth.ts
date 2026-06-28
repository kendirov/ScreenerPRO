import type { ScreenerRow } from "@screenerpro/shared";
import {
  IMOEX_COMPONENTS,
  IMOEX_COMPONENTS_SOURCE,
} from "@/lib/screener/imoex-components";
import { RADAR_THRESHOLDS } from "@/lib/screener/radar-thresholds";

export type IndexBreadthDiagnostics = {
  source: typeof IMOEX_COMPONENTS_SOURCE;
  componentsCount: number;
  matchedCount: number;
  missingTickers: string[];
  rising: number;
  falling: number;
  flat: number;
  sum: number;
};

export type MarketBreadthDiagnostics = {
  universeCount: number;
  rising: number;
  falling: number;
  flat: number;
  sum: number;
};

export type IndexBreadthSummary = {
  rising: number;
  falling: number;
  flat: number;
  matchedCount: number;
  available: boolean;
};

function classifyIndexBreadth(changePct: number | null): "rising" | "falling" | "flat" {
  const threshold = RADAR_THRESHOLDS.breadthFlatPct;
  const ch = changePct ?? 0;
  if (ch > threshold) return "rising";
  if (ch < -threshold) return "falling";
  return "flat";
}

export function computeIndexBreadth(stocks: readonly ScreenerRow[]): IndexBreadthDiagnostics {
  const byTicker = new Map(stocks.map((row) => [row.ticker, row]));
  const matched: ScreenerRow[] = [];

  for (const ticker of IMOEX_COMPONENTS) {
    const row = byTicker.get(ticker);
    if (row) matched.push(row);
  }

  let rising = 0;
  let falling = 0;
  let flat = 0;
  for (const row of matched) {
    const bucket = classifyIndexBreadth(row.percentChange);
    if (bucket === "rising") rising++;
    else if (bucket === "falling") falling++;
    else flat++;
  }

  const missingTickers = IMOEX_COMPONENTS.filter((ticker) => !byTicker.has(ticker));

  return {
    source: IMOEX_COMPONENTS_SOURCE,
    componentsCount: IMOEX_COMPONENTS.length,
    matchedCount: matched.length,
    missingTickers,
    rising,
    falling,
    flat,
    sum: rising + falling + flat,
  };
}

export function toIndexBreadthSummary(diag: IndexBreadthDiagnostics): IndexBreadthSummary {
  return {
    rising: diag.rising,
    falling: diag.falling,
    flat: diag.flat,
    matchedCount: diag.matchedCount,
    available: diag.matchedCount > 0,
  };
}

/** @deprecated use IMOEX_COMPONENTS from imoex-components */
export { IMOEX_COMPONENTS_SET } from "@/lib/screener/imoex-components";
