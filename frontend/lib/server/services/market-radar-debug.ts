import {
  buildMarketRadarDebugSnapshot,
  MARKET_RADAR_DEBUG_DEFAULT_LIMIT,
  type MarketRadarDebugSnapshot,
} from "@/lib/domain/market-radar-debug";
import { getMoexStockRowsForDebug } from "@/lib/server/services/moex-screener";

export async function getMarketRadarDebugSnapshot(
  limit = MARKET_RADAR_DEBUG_DEFAULT_LIMIT,
): Promise<MarketRadarDebugSnapshot> {
  const stocks = await getMoexStockRowsForDebug();
  return buildMarketRadarDebugSnapshot(stocks, { limit, candidates: stocks });
}
