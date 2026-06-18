/**
 * @deprecated Импортируйте из `@/lib/domain/market-radar-config`.
 * Файл оставлен для обратной совместимости.
 */
export { MARKET_RADAR_CONFIG } from "@/lib/domain/market-radar-config";
export {
  MARKET_RADAR_REASON_LABELS,
  getMarketRadarReasonLabel,
  getMarketRadarReasonDetail,
  type MarketRadarReasonKey,
} from "@/lib/domain/trader-signal-labels";

import { MARKET_RADAR_CONFIG } from "@/lib/domain/market-radar-config";

/** @deprecated Используйте MARKET_RADAR_CONFIG.liquidity */
export const MARKET_RADAR_LIQUIDITY = {
  limit: MARKET_RADAR_CONFIG.liquidity.topN,
} as const;

/** @deprecated Используйте MARKET_RADAR_CONFIG.inPlay */
export const MARKET_RADAR_IN_PLAY = {
  minScore: MARKET_RADAR_CONFIG.inPlay.minScore,
  fallbackMinSignals: 0,
  fallbackMinTurnoverPercentile: 70,
  fallbackMinTradesPercentile: 100,
  fallbackMinRangePercentile: 0,
  fallbackMinDayRangePct: MARKET_RADAR_CONFIG.inPlay.confluence.minDayRangePct,
  fallbackNearExtreme: MARKET_RADAR_CONFIG.structure.nearExtremePosition,
  fallbackBreakoutChangePct: MARKET_RADAR_CONFIG.structure.breakoutMinChangePct,
} as const;

/** @deprecated Используйте MARKET_RADAR_CONFIG.shots */
export const MARKET_RADAR_VOLATILITY = {
  minDayRangePct: MARKET_RADAR_CONFIG.shots.signal.minDayRangePct,
  highlightMinAbsChangePct: MARKET_RADAR_CONFIG.shots.signal.minAbsChangePct,
  wideDayRangePct: MARKET_RADAR_CONFIG.shots.signal.minDayRangePct,
  wideDayRangePercentile: 72,
  riskMaxTurnoverPercentile: 42,
  riskMaxTradesPercentile: 42,
  riskMinDayRangePct: MARKET_RADAR_CONFIG.shots.signal.minDayRangePct,
} as const;

/** @deprecated Используйте MARKET_RADAR_CONFIG.layout */
export const MARKET_RADAR_LAYOUT = MARKET_RADAR_CONFIG.layout;
