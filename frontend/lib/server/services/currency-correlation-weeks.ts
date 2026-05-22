import {
  buildWeeklySpreadSeries,
  type CurrencyCorrelationWeeksResponse,
  WEEKS_DEFAULT_COUNT,
  WEEKS_MAX_COUNT,
  ROLLOVER_TODO_NOTE,
  type WeeklySpreadSeries,
} from "@/lib/domain/currency-correlation-weeks";
import type { PointsPairKey } from "@/lib/domain/currency-pair-config";
import { getPairConfig } from "@/lib/domain/currency-pair-config";
import {
  pickActiveContractForFamily,
} from "@/lib/domain/currency-correlation";
import type { SpreadAnchorMode } from "@/lib/domain/currency-spread-anchor";
import { getPreviousTradingWeeks } from "@/lib/domain/trading-week";
import { fetchFuturesIntradayCandlesForRange } from "@/lib/server/services/moex-futures-candles";
import { getScreenerResponse } from "@/lib/server/services/moex-screener";

type CacheEntry = {
  expiresAt: number;
  body: CurrencyCorrelationWeeksResponse;
};

const weeksCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(
  pair: PointsPairKey,
  interval: number,
  weeks: number,
  anchor: SpreadAnchorMode,
): string {
  return `${pair}|${interval}|${weeks}|${anchor}`;
}

export async function buildCurrencyCorrelationWeeksResponse(options: {
  pairKey: PointsPairKey;
  interval: number;
  weeksCount: number;
  anchor: SpreadAnchorMode;
}): Promise<CurrencyCorrelationWeeksResponse> {
  const weeksCount = Math.min(
    Math.max(1, options.weeksCount || WEEKS_DEFAULT_COUNT),
    WEEKS_MAX_COUNT,
  );
  const key = cacheKey(options.pairKey, options.interval, weeksCount, options.anchor);
  const cached = weeksCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.body;
  }

  const config = getPairConfig(options.pairKey);
  const weekDescriptors = getPreviousTradingWeeks(weeksCount);

  const screener = await getScreenerResponse("future");
  const rows = screener.rows ?? [];
  const leftActive = pickActiveContractForFamily(rows, config.leftInstrument);
  const rightActive = pickActiveContractForFamily(rows, config.rightInstrument);

  const leftTicker = leftActive?.ticker && leftActive.ticker !== "—" ? leftActive.ticker : "";
  const rightTicker =
    rightActive?.ticker && rightActive.ticker !== "—" ? rightActive.ticker : "";

  if (!leftTicker || !rightTicker) {
    const body: CurrencyCorrelationWeeksResponse = {
      pair: options.pairKey,
      interval: options.interval,
      usedInterval: options.interval,
      anchor: options.anchor,
      weeks: weekDescriptors.map((w, i) =>
        buildWeeklySpreadSeries(
          w,
          options.pairKey,
          leftTicker || "—",
          rightTicker || "—",
          [],
          [],
          options.interval,
          options.anchor,
          i,
        ),
      ),
      rolloverTodo: ROLLOVER_TODO_NOTE,
    };
    weeksCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, body });
    return body;
  }

  const fetchFrom = weekDescriptors[weekDescriptors.length - 1]!.weekStart;
  const fetchTill = weekDescriptors[0]!.weekEnd;

  const [leftFetched, rightFetched] = await Promise.all([
    fetchFuturesIntradayCandlesForRange(
      leftTicker,
      fetchFrom,
      fetchTill,
      options.interval,
    ),
    fetchFuturesIntradayCandlesForRange(
      rightTicker,
      fetchFrom,
      fetchTill,
      options.interval,
    ),
  ]);

  const usedInterval = leftFetched.usedInterval || rightFetched.usedInterval || options.interval;

  const seriesList: WeeklySpreadSeries[] = weekDescriptors.map((w, i) =>
    buildWeeklySpreadSeries(
      w,
      options.pairKey,
      leftTicker,
      rightTicker,
      leftFetched.points,
      rightFetched.points,
      usedInterval,
      options.anchor,
      i,
    ),
  );

  const body: CurrencyCorrelationWeeksResponse = {
    pair: options.pairKey,
    interval: options.interval,
    usedInterval,
    anchor: options.anchor,
    weeks: seriesList,
    rolloverTodo: ROLLOVER_TODO_NOTE,
  };

  weeksCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, body });
  return body;
}
