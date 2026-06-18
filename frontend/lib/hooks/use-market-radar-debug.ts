"use client";

import * as React from "react";
import type { ScreenerRow } from "@screenerpro/shared";
import {
  buildMarketRadarDebugSnapshot,
  fingerprintMarketRadarDebugSnapshot,
  isMarketRadarDebugEnabled,
  MARKET_RADAR_DEBUG_QUERY_PARAM,
  type MarketRadarDebugSnapshot,
} from "@/lib/domain/market-radar-debug";

export function readMarketRadarDebugFromSearchParams(searchParams: URLSearchParams | null): boolean {
  return isMarketRadarDebugEnabled(searchParams?.get(MARKET_RADAR_DEBUG_QUERY_PARAM));
}

/** console.table в development при ?debugRadar=1 */
export function useMarketRadarDebugConsole(
  universe: ScreenerRow[],
  candidates: ScreenerRow[],
  enabled: boolean,
): MarketRadarDebugSnapshot | null {
  const snapshot = React.useMemo(() => {
    if (!enabled || process.env.NODE_ENV !== "development") return null;
    if (universe.length === 0) return null;
    return buildMarketRadarDebugSnapshot(universe, { candidates });
  }, [universe, candidates, enabled]);

  const lastFingerprint = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!snapshot || process.env.NODE_ENV !== "development") return;

    const fingerprint = fingerprintMarketRadarDebugSnapshot(snapshot);
    if (lastFingerprint.current === fingerprint) return;
    lastFingerprint.current = fingerprint;

    console.groupCollapsed("[Market Radar] debug (?debugRadar=1)");
    console.log("session", snapshot.session);
    console.log("board", snapshot.board);
    console.table(snapshot.rows);
    console.groupEnd();
  }, [snapshot]);

  return snapshot;
}
