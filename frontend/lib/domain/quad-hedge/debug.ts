import type { FuturesContractBase } from "@/lib/domain/futures-contract-resolver";
import type { SpreadLabHistoryDepth, SpreadLabHistoryMode } from "./spread-lab-config";

export type QuadHedgeLegDebugStatus =
  | "ok"
  | "no-candles"
  | "request-error"
  | "stale"
  | "not-resolved";

export type QuadHedgeLegDebug = {
  base: FuturesContractBase;
  secid: string;
  boardId?: string;
  engine?: string;
  market?: string;
  candlesUrl?: string;
  interval?: number;
  usedInterval?: number;
  requestedFrom?: string;
  requestedTill?: string;
  from?: string;
  till?: string;
  rawCandlesCount: number;
  moexPages?: number;
  moexChunks?: number;
  moexLimitNotice?: string;
  firstCandleTime?: string;
  lastCandleTime?: string;
  normalizedPointsCount: number;
  mergedPointsCount?: number;
  error?: string;
  status: QuadHedgeLegDebugStatus;
};

export type QuadHedgePipelineDebug = {
  legs: QuadHedgeLegDebug[];
  mergedPointsCount: number;
  alignedLegsCount: number;
  alignedPoints?: number;
  missingPoints?: number;
  windowScope?: string;
  calendarDays?: number;
  historyMode?: SpreadLabHistoryMode;
  historyDepth?: SpreadLabHistoryDepth;
  tradingSessionsFound?: number;
  tradingSessions?: string[];
  missingLegs?: string[];
  requestedFrom?: string;
  requestedTill?: string;
  usedInterval?: number;
  moexLimitNotice?: string;
  mergeNote?: string;
  summary?: string;
};

export function buildPipelineSummary(debug: QuadHedgePipelineDebug): string {
  const parts = debug.legs.map(
    (l) => `${l.base}: ${l.rawCandlesCount} свечей (${l.status})`,
  );
  parts.push(`merged: ${debug.mergedPointsCount}`);
  if (debug.alignedPoints != null) parts.push(`aligned: ${debug.alignedPoints}`);
  if (debug.missingPoints != null) parts.push(`missing: ${debug.missingPoints}`);
  if (debug.historyDepth) parts.push(`depth: ${debug.historyDepth}`);
  if (debug.tradingSessionsFound != null) parts.push(`sessions: ${debug.tradingSessionsFound}`);
  if (debug.moexLimitNotice) parts.push(debug.moexLimitNotice);
  return parts.join(" · ");
}
