/**
 * Dev / query-flag диагностика gate «В игре».
 */

import type { MarketPriorityResult } from "@/lib/screener/market-priority-engine";

export const MARKET_PRIORITY_DEBUG_QUERY_PARAM = "debugPriority";

export function isMarketPriorityDebugQueryEnabled(
  searchParam: string | null | undefined,
): boolean {
  if (searchParam == null) return false;
  const normalized = searchParam.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function isMarketPriorityDebugVisible(
  searchParam: string | null | undefined,
): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return isMarketPriorityDebugQueryEnabled(searchParam);
}

export type InPlayGateDebugStats = Pick<
  MarketPriorityResult["stats"],
  | "mode"
  | "total"
  | "eligible"
  | "inPlayCandidates"
  | "finalInPlayCount"
  | "confirmedActivityCount"
  | "confirmedRangeCount"
  | "fallbackOnlyRejected"
  | "tradableCount"
  | "rangeSignalCount"
  | "moveSignalCount"
  | "participationSignalCount"
  | "focusFinal"
>;

function formatCount(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return String(Math.round(value));
}

/** Stock screener live v0 funnel — dev / ?debugPriority=1 */
export function formatFocusCandidatesDebugLine(focus: number, candidates: number): string {
  return `focus ${focus} / candidates ${candidates}`;
}

export function formatStockLiveInPlayDiagnosticsLine(stats: InPlayGateDebugStats): string | null {
  if (stats.tradableCount == null && stats.rangeSignalCount == null) return null;

  const segments: string[] = [];
  const stocks = formatCount(stats.total);
  if (stocks != null) segments.push(`stocks ${stocks}`);
  const tradable = formatCount(stats.tradableCount);
  if (tradable != null) segments.push(`tradable ${tradable}`);
  const range = formatCount(stats.rangeSignalCount);
  if (range != null) segments.push(`range ${range}`);
  const move = formatCount(stats.moveSignalCount);
  if (move != null) segments.push(`move ${move}`);
  const participation = formatCount(stats.participationSignalCount);
  if (participation != null) segments.push(`participation ${participation}`);
  const candidates = formatCount(stats.inPlayCandidates);
  if (candidates != null) segments.push(`candidates ${candidates}`);
  const focus = formatCount(stats.focusFinal ?? stats.finalInPlayCount);
  if (focus != null) segments.push(`focus ${focus}`);

  if (segments.length < 3) return null;
  return segments.join(" · ");
}

export function formatInPlayGateDiagnosticsLine(stats: InPlayGateDebugStats): string | null {
  const stockLive = formatStockLiveInPlayDiagnosticsLine(stats);
  if (stockLive) return stockLive;

  const mode =
    stats.mode === "strict"
      ? "Strict"
      : stats.mode === "balanced"
        ? "Balanced"
        : stats.mode === "wide"
          ? "Wide"
          : null;
  if (!mode) return null;

  const segments: string[] = [mode];

  const total = formatCount(stats.total);
  if (total != null) segments.push(`total ${total}`);

  const eligible = formatCount(stats.eligible);
  if (eligible != null) segments.push(`eligible ${eligible}`);

  const candidates = formatCount(stats.inPlayCandidates);
  if (candidates != null) segments.push(`candidates ${candidates}`);

  const final = formatCount(stats.finalInPlayCount);
  if (final != null) segments.push(`final ${final}`);

  if (segments.length <= 1) return null;
  return segments.join(" · ");
}

export const IN_PLAY_GATE_DEBUG_TOOLTIP = [
  "Stock live v0: stocks → tradable → range/move/participation → candidates → focus.",
  "Market Lab: total → eligible → candidates → final (baseline-confirmed gate).",
].join("\n");
