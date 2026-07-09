import type { StrategyCandle, StrategyTimeframeMinutes } from "@/lib/screener/strategies/strategy-candles";
import type { StrategyCandlePeriodId } from "@/lib/screener/strategies/strategy-candle-range";

export type StrategyAssetClass = "stock" | "future";

export type StrategyRunInput = {
  secid: string;
  board: string;
  assetClass: StrategyAssetClass;
  timeframe: `${StrategyTimeframeMinutes}m`;
  period: Exclude<StrategyCandlePeriodId, "today">;
  candles: StrategyCandle[];
};

export type StrategyRunBadge = "excellent" | "good" | "medium" | "noisy";

export type StrategyRunResult = {
  strategyId: string;
  secid: string;
  board: string;
  timeframe: string;
  period: string;
  score: number;
  badge: StrategyRunBadge;
  metrics: Record<string, number | string>;
  bestLevels?: number[];
  weakPoint?: string;
  sampleWarning?: string;
  updatedAt: string;
};

export type StrategyAdapter = {
  id: string;
  version: string;
  run(input: StrategyRunInput): StrategyRunResult;
};

export type StrategyScanSnapshot = {
  generatedAt: string;
  strategyId: string;
  assetClass: StrategyAssetClass;
  timeframe: string;
  period: string;
  universeCount: number;
  successCount: number;
  failedCount: number;
  results: StrategyRunResult[];
  errors?: Array<{ secid: string; message: string }>;
};
