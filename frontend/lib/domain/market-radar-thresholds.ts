/**
 * @deprecated Импортируйте из `@/lib/domain/market-radar-config`.
 * Файл оставлен для обратной совместимости.
 */
export {
  MARKET_RADAR_CONFIG,
  MARKET_RADAR_REASON_LABELS,
  getMarketRadarReasonLabel,
  type MarketRadarReasonKey,
} from "@/lib/domain/market-radar-config";

import { MARKET_RADAR_CONFIG } from "@/lib/domain/market-radar-config";

/** @deprecated Используйте MARKET_RADAR_CONFIG.liquidity */
export const MARKET_RADAR_LIQUIDITY = {
  limit: MARKET_RADAR_CONFIG.liquidity.topN,
} as const;

/** @deprecated Используйте MARKET_RADAR_CONFIG.inPlay */
export const MARKET_RADAR_IN_PLAY = {
  minScore: MARKET_RADAR_CONFIG.inPlay.minInPlayScore,
  fallbackMinSignals: MARKET_RADAR_CONFIG.inPlay.fallbackMinSignals,
  fallbackMinTurnoverPercentile: MARKET_RADAR_CONFIG.inPlay.fallbackMinTurnoverPercentile,
  fallbackMinTradesPercentile: MARKET_RADAR_CONFIG.inPlay.fallbackMinTradesPercentile,
  fallbackMinRangePercentile: MARKET_RADAR_CONFIG.inPlay.fallbackMinRangePercentile,
  fallbackMinDayRangePct: MARKET_RADAR_CONFIG.inPlay.fallbackMinDayRangePct,
  fallbackNearExtreme: MARKET_RADAR_CONFIG.inPlay.nearExtremePosition,
  fallbackBreakoutChangePct: MARKET_RADAR_CONFIG.inPlay.breakoutMinChangePct,
} as const;

/** @deprecated Используйте MARKET_RADAR_CONFIG.volatility */
export const MARKET_RADAR_VOLATILITY = {
  minDayRangePct: MARKET_RADAR_CONFIG.volatility.minRangePct,
  highlightMinAbsChangePct: MARKET_RADAR_CONFIG.volatility.highlightMinAbsChangePct,
  wideDayRangePct: MARKET_RADAR_CONFIG.volatility.wideDayRangePct,
  wideDayRangePercentile: MARKET_RADAR_CONFIG.volatility.wideDayRangePercentile,
  riskMaxTurnoverPercentile: MARKET_RADAR_CONFIG.volatility.riskMaxTurnoverPercentile,
  riskMaxTradesPercentile: MARKET_RADAR_CONFIG.volatility.riskMaxTradesPercentile,
  riskMinDayRangePct: MARKET_RADAR_CONFIG.volatility.riskMinDayRangePct,
} as const;

/** @deprecated Используйте MARKET_RADAR_CONFIG.layout */
export const MARKET_RADAR_LAYOUT = MARKET_RADAR_CONFIG.layout;
