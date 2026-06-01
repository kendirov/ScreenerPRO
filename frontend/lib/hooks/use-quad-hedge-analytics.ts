"use client";

import * as React from "react";
import type { QuadHedgeIntradayResponse } from "@/lib/domain/quad-hedge/analytics";
import {
  buildQuadHedgeAnalyticsFromIntraday,
  type QuadHedgeAnalyticsResult,
} from "@/lib/domain/quad-hedge";
import { buildPipelineSummary } from "@/lib/domain/quad-hedge/debug";
import type { SpreadLabHistoryDepth } from "@/lib/domain/quad-hedge/spread-lab-config";
import type { QuadHedgeViewMode } from "@/lib/domain/quad-hedge/types";
import type { QuadHedgeWindowScope } from "@/lib/domain/quad-hedge/window";
import { SPREAD_LAB_DISPLAY_INTERVAL } from "@/lib/domain/quad-hedge/spread-lab-config";
import type { ScreenerRow } from "@screenerpro/shared";

export function useQuadHedgeAnalytics(
  intraday: QuadHedgeIntradayResponse | undefined,
  screenerRows: ScreenerRow[],
  screenerSource: "MOEX ISS" | "demo" | undefined,
  enabled = true,
  viewMode: QuadHedgeViewMode = "SI-EU",
  windowScope: QuadHedgeWindowScope = "pick",
  historyDepth: SpreadLabHistoryDepth = "7S",
  displayIntervalMinutes = SPREAD_LAB_DISPLAY_INTERVAL,
): QuadHedgeAnalyticsResult | null {
  return React.useMemo(() => {
    if (!enabled || !intraday) return null;
    const source = screenerSource === "demo" ? "demo" : "MOEX ISS";
    const result = buildQuadHedgeAnalyticsFromIntraday(intraday, {
      screenerRows,
      screenerSource: source,
      viewMode,
      windowScope,
      historyDepth,
      displayIntervalMinutes,
      moexIntervalMinutes: intraday.usedInterval,
    });

    if (!result) return null;

    const mergedPointsCount = result.alignedTimestamps.length;
    const okLegs = intraday.debug?.legs.filter((l) => l.status === "ok").length ?? 0;
    const alignedPoints = result.focusPairDiagnostics?.alignedPoints ?? mergedPointsCount;
    const missingPoints = result.focusPairDiagnostics?.missingPoints;
    const tradingSessionsFound = result.history.tradingSessions.length;

    let mergeNote = intraday.debug?.mergeNote;
    if (okLegs >= 2 && mergedPointsCount === 0) {
      mergeNote = "merged points: 0 — после window filter или несовпадающие timestamps.";
    }

    const moexLimitNotice =
      intraday.debug?.moexLimitNotice ??
      intraday.debug?.legs.map((l) => l.moexLimitNotice).find(Boolean);

    const debug = intraday.debug
      ? {
          ...intraday.debug,
          mergedPointsCount,
          alignedPoints,
          missingPoints,
          moexLimitNotice,
          historyDepth,
          tradingSessionsFound,
          tradingSessions: result.history.tradingSessions,
          missingLegs: result.dataQuality.missingLegs,
          mergeNote,
          summary: buildPipelineSummary({
            ...intraday.debug,
            mergedPointsCount,
            alignedPoints,
            missingPoints,
            moexLimitNotice,
            historyDepth,
            tradingSessionsFound,
            tradingSessions: result.history.tradingSessions,
            missingLegs: result.dataQuality.missingLegs.map(String),
            mergeNote,
          }),
        }
      : undefined;

    return { ...result, debug };
  }, [
    enabled,
    intraday,
    screenerRows,
    screenerSource,
    viewMode,
    windowScope,
    historyDepth,
    displayIntervalMinutes,
  ]);
}
