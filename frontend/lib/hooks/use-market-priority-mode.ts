"use client";

import * as React from "react";
import {
  DEFAULT_MARKET_PRIORITY_MODE,
  type MarketPriorityMode,
  readMarketPriorityModeFromStorage,
  writeMarketPriorityModeToStorage,
} from "@/lib/screener/market-priority-presets";

export function useMarketPriorityMode(): [MarketPriorityMode, (mode: MarketPriorityMode) => void] {
  const [mode, setModeState] = React.useState<MarketPriorityMode>(DEFAULT_MARKET_PRIORITY_MODE);

  React.useEffect(() => {
    setModeState(readMarketPriorityModeFromStorage());
  }, []);

  const setMode = React.useCallback((next: MarketPriorityMode) => {
    setModeState(next);
    writeMarketPriorityModeToStorage(next);
  }, []);

  return [mode, setMode];
}
