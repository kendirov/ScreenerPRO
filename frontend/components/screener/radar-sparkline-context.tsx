"use client";

import * as React from "react";
import { useIntradaySparkline2s } from "@/lib/hooks/use-intraday-sparkline-2s";

type RadarSparklineContextValue = {
  tradingDate: string;
  sparklinesEnabled: boolean;
  hoveredTicker: string | null;
  selectedTicker: string | null;
  prefetchTickers: ReadonlySet<string>;
  setHoveredTicker: (ticker: string | null) => void;
};

const RadarSparklineContext = React.createContext<RadarSparklineContextValue | null>(null);

export function RadarSparklineProvider({
  tradingDate,
  sparklinesEnabled,
  selectedTicker,
  prefetchTickers,
  children,
}: {
  tradingDate: string;
  sparklinesEnabled: boolean;
  selectedTicker?: string | null;
  prefetchTickers: string[];
  children: React.ReactNode;
}) {
  const [hoveredTicker, setHoveredTicker] = React.useState<string | null>(null);
  const prefetchSet = React.useMemo(
    () => new Set(prefetchTickers.map((t) => t.toUpperCase())),
    [prefetchTickers],
  );

  const value = React.useMemo(
    () => ({
      tradingDate,
      sparklinesEnabled,
      hoveredTicker,
      selectedTicker: selectedTicker?.toUpperCase() ?? null,
      prefetchTickers: prefetchSet,
      setHoveredTicker,
    }),
    [tradingDate, sparklinesEnabled, hoveredTicker, selectedTicker, prefetchSet],
  );

  return <RadarSparklineContext.Provider value={value}>{children}</RadarSparklineContext.Provider>;
}

export function useRadarSparklineContext(): RadarSparklineContextValue {
  const ctx = React.useContext(RadarSparklineContext);
  if (!ctx) {
    throw new Error("useRadarSparklineContext must be used within RadarSparklineProvider");
  }
  return ctx;
}

/** Lazy 2С sparkline: hover, select или prefetch. */
export function useRadarRowSparkline(ticker: string, disabled = false) {
  const ctx = useRadarSparklineContext();
  const key = ticker.toUpperCase();
  const enabled =
    !disabled &&
    ctx.sparklinesEnabled &&
    (ctx.hoveredTicker === key ||
      ctx.selectedTicker === key ||
      ctx.prefetchTickers.has(key));

  return useIntradaySparkline2s(ticker, ctx.tradingDate, enabled);
}
