/**
 * Professional dark-terminal candle palette for Strategy Lab charts.
 * Kept separate from overlays (ZigZag cyan, buffer zones) to avoid visual conflict.
 */
export const STRATEGY_CHART_CANDLE_COLORS = {
  bullish: {
    body: "#2dd4a8",
    border: "#3ecf9e",
    wick: "#1f9a78",
  },
  bearish: {
    body: "#f4728b",
    border: "#e85d7a",
    wick: "#b84a62",
  },
} as const;

export type StrategyChartCandleColors = typeof STRATEGY_CHART_CANDLE_COLORS;

export function getStrategyChartCandlestickSeriesOptions(): {
  upColor: string;
  downColor: string;
  borderUpColor: string;
  borderDownColor: string;
  wickUpColor: string;
  wickDownColor: string;
  priceLineVisible: false;
} {
  const { bullish, bearish } = STRATEGY_CHART_CANDLE_COLORS;
  return {
    upColor: bullish.body,
    downColor: bearish.body,
    borderUpColor: bullish.border,
    borderDownColor: bearish.border,
    wickUpColor: bullish.wick,
    wickDownColor: bearish.wick,
    priceLineVisible: false,
  };
}
