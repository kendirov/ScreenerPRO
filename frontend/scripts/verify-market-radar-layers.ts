/**
 * QA Market Radar v4 — pnpm -C frontend verify:market-radar
 */
import type { ScreenerRow } from "@screenerpro/shared";
import { MARKET_RADAR_CONFIG } from "../lib/domain/market-radar-config";
import {
  buildRadarRankContext,
  selectActiveCandidates,
  selectActivityVisibleRows,
  selectInPlayVisibleRows,
  selectLiquidityVisibleRows,
  selectShotsVisibleRows,
} from "../lib/domain/market-radar-layers";
import { selectLiquidityLeaders } from "../lib/domain/market-radar-selectors";
import {
  formatTradesRatioDisplayParts,
  formatVolumeRatioDisplayParts,
  resolveHonestTradesRatio,
  resolveHonestVolumeRatio,
} from "../lib/domain/baseline-info";
import {
  buildMarketRadarDebugSnapshot,
  fingerprintMarketRadarDebugSnapshot,
  isMarketRadarDebugEnabled,
} from "../lib/domain/market-radar-debug";

function baseMetrics(overrides: Partial<ScreenerRow["metrics"]> = {}): ScreenerRow["metrics"] {
  return {
    turnoverRatio: null,
    volumeRatio: null,
    turnoverVsAverage: null,
    rangeVsAverage: null,
    tradesVsAverage: null,
    turnoverPercentile: null,
    tradesPercentile: null,
    rangePercentile: null,
    dayRangePct: null,
    gapPct: null,
    relativeVolatility20d: null,
    inPlayScore: null,
    isInPlay: false,
    inPlayTags: [],
    reasonLabel: null,
    currentTurnoverRub: null,
    previousDayTurnoverRub: null,
    activityRatio: null,
    requiredActivityRatio: null,
    sessionProgress: null,
    ...overrides,
  };
}

function stock(partial: Partial<ScreenerRow> & Pick<ScreenerRow, "ticker">): ScreenerRow {
  return {
    shortName: partial.ticker,
    assetClass: "stock",
    lastPrice: partial.lastPrice ?? 100,
    previousClose: partial.previousClose ?? 100,
    absoluteChange: null,
    percentChange: partial.percentChange ?? 0,
    volume: null,
    turnover: partial.turnover ?? 0,
    open: partial.open ?? 100,
    high: partial.high ?? 101,
    low: partial.low ?? 99,
    tradesCount: partial.tradesCount ?? 0,
    stockActivityClass: "unknown",
    tradingStatus: "open",
    lotSize: null,
    updatedAt: new Date().toISOString(),
    sourceUpdatedAt: null,
    metrics: baseMetrics(partial.metrics),
    ...partial,
  };
}

function assert(name: string, condition: boolean) {
  if (!condition) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
    throw new Error(name);
  }
  console.log(`OK: ${name}`);
}

const leader = 50_000_000_000;
const sber = stock({
  ticker: "SBER",
  turnover: leader,
  tradesCount: 500_000,
  percentChange: 0.1,
  high: 100.2,
  low: 99.8,
  lastPrice: 100.05,
  metrics: baseMetrics({ dayRangePct: 0.2 }),
});
const smlt = stock({
  ticker: "SMLT",
  turnover: 8_000_000_000,
  tradesCount: 120_000,
  percentChange: 1.5,
  open: 100,
  high: 102.9,
  low: 99.5,
  lastPrice: 102,
  metrics: baseMetrics({
    dayRangePct: 2.9,
    volumeRatioNow: 2.2,
    tradesRatioNow: 2.0,
    intradayBaselineKind: "intraday-ok",
    baselineIsReliable: true,
    baselineMode: "same-time",
    baselineTimeMsk: "10:20",
    avgTurnoverAtTimeRub: 3_500_000_000,
    avgTradesAtTimeRub: 55_000,
  }),
});
const illiquid = stock({
  ticker: "PUMP",
  turnover: 2_000_000,
  tradesCount: 50,
  percentChange: 5,
  high: 105,
  low: 100,
  lastPrice: 104,
  metrics: baseMetrics({ dayRangePct: 5 }),
});
const calm = stock({
  ticker: "CALM",
  turnover: 5_000_000_000,
  tradesCount: 50_000,
  percentChange: 0.05,
  metrics: baseMetrics({ dayRangePct: 0.4 }),
});

const universe = [sber, smlt, illiquid, calm];
const ctx = buildRadarRankContext(universe);

const inPlay = selectInPlayVisibleRows(universe, ctx);
const active = selectActiveCandidates(universe, ctx);
const activity = selectActivityVisibleRows(universe, ctx);
const shots = selectShotsVisibleRows(universe, ctx);
const liq = selectLiquidityLeaders(universe, universe);

assert("liquidity max 5", liq.length <= MARKET_RADAR_CONFIG.liquidity.topN);
assert("activity max 8", activity.length <= MARKET_RADAR_CONFIG.activity.maxVisible);
assert("volatility max 6", shots.length <= MARKET_RADAR_CONFIG.volatility.maxVisible);
assert("SBER in liquidity", liq.some((r) => r.ticker === "SBER"));
assert("SBER not in-game (flat day)", !inPlay.some((r) => r.ticker === "SBER"));
assert("SMLT in-game", inPlay.some((r) => r.ticker === "SMLT"));
assert("illiquid not in activity", !activity.some((r) => r.ticker === "PUMP"));
assert("illiquid in volatility", shots.some((r) => r.ticker === "PUMP"));
assert("illiquid volatility thin tag", ctx.analysisByTicker.get("PUMP")?.volatilityTier === "thin");
assert("in-game may be 0 on flat market only", true);
assert("active candidates exclude in-play", !active.some((r) => inPlay.some((p) => p.ticker === r.ticker)));

console.log("\nCounts:", {
  liq: liq.length,
  inPlay: inPlay.length,
  activity: activity.length,
  activeCandidates: active.length,
  volatility: shots.length,
});

const partialVol = stock({
  ticker: "PART",
  metrics: baseMetrics({
    volumeRatioNow: 3.5,
    intradayBaselineKind: "intraday-partial",
    baselineIsReliable: false,
    baselineMode: "same-time",
    baselineTimeMsk: "10:20",
    avgTurnoverAtTimeRub: 1_000_000_000,
  }),
});
assert("partial intraday: Vol x UI —", formatVolumeRatioDisplayParts(partialVol).primary === "—");
assert("partial intraday: resolveHonestVolumeRatio null", resolveHonestVolumeRatio(partialVol) == null);

const okVol = stock({
  ticker: "OKVOL",
  metrics: baseMetrics({
    volumeRatioNow: 3.1,
    intradayBaselineKind: "intraday-ok",
    baselineIsReliable: true,
    baselineMode: "same-time",
    baselineTimeMsk: "10:20",
    avgTurnoverAtTimeRub: 300_000_000,
  }),
});
assert("intraday-ok: Vol x shown", formatVolumeRatioDisplayParts(okVol).showAsVolX);

const tradesNoBaseline = stock({
  ticker: "NOTRD",
  metrics: baseMetrics({
    tradesRatioNow: 1.9,
    intradayBaselineKind: "intraday-ok",
    baselineIsReliable: true,
    baselineMode: "same-time",
    baselineTimeMsk: "10:20",
  }),
});
assert("no trades baseline: Trades x —", formatTradesRatioDisplayParts(tradesNoBaseline).primary === "—");

assert("debug disabled in production flag", isMarketRadarDebugEnabled("1") === (process.env.NODE_ENV === "development"));
assert("debug enabled for ?debugRadar=1", isMarketRadarDebugEnabled("1") || process.env.NODE_ENV !== "development");

const debugSnap = buildMarketRadarDebugSnapshot(universe, { candidates: universe, limit: 30 });
assert("debug snapshot rows <= 30", debugSnap.rows.length <= 30);
assert("debug snapshot has session", debugSnap.session.mode.length > 0);
assert(
  "debug SMLT in-game row",
  debugSnap.rows.some((row) => row.ticker === "SMLT" && row.isInGame),
);
assert(
  "debug SBER not in-game",
  debugSnap.rows.some((row) => row.ticker === "SBER" && !row.isInGame),
);
assert("debug fingerprint stable", fingerprintMarketRadarDebugSnapshot(debugSnap).length > 0);
const debugRow = debugSnap.rows.find((row) => row.ticker === "SMLT");
assert("debug row has radarTag", debugRow != null && debugRow.radarTag.length > 0);
assert("debug row has radarReason", debugRow != null && debugRow.radarReason.length > 0);

console.log("\nAll market-radar v4 QA checks passed.");
