"use client";

import * as React from "react";
import {
  DEFAULT_MARKET_PRIORITY_MODE,
  type MarketPriorityMode,
  readStockScreenerPriorityModeFromStorage,
  writeStockScreenerPriorityModeToStorage,
} from "@/lib/screener/market-priority-presets";

export function useStockScreenerPriorityMode(): [MarketPriorityMode, (mode: MarketPriorityMode) => void] {
  const [mode, setModeState] = React.useState<MarketPriorityMode>(DEFAULT_MARKET_PRIORITY_MODE);

  React.useEffect(() => {
    setModeState(readStockScreenerPriorityModeFromStorage());
  }, []);

  const setMode = React.useCallback((next: MarketPriorityMode) => {
    setModeState(next);
    writeStockScreenerPriorityModeToStorage(next);
  }, []);

  return [mode, setMode];
}
