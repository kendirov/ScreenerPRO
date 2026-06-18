/**
 * QA Market Radar sessionContext — pnpm -C frontend verify:market-radar-session
 */
import type { ScreenerRow } from "@screenerpro/shared";
import {
  buildRadarSessionContext,
  clampRelativeRatio,
  computeMarketSessionIntensities,
  computeRadarRowSessionMetrics,
  computeSessionIntensity,
  medianOfTopDesc,
  medianPositive,
  resolveSessionModeFromIntensity,
} from "../lib/domain/market-radar-session";

function assert(name: string, condition: boolean) {
  if (!condition) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
    throw new Error(name);
  }
  console.log(`OK: ${name}`);
}

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
    previousClose: 100,
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

assert("medianPositive empty → null", medianPositive([]) === null);
assert("medianPositive [1,3,5] → 3", medianPositive([1, 3, 5]) === 3);
assert("medianOfTopDesc top3", medianOfTopDesc([100, 50, 80, 200, 10], 3) === 100);

assert("clampRelativeRatio caps at 1.2", clampRelativeRatio(2) === 1.2);
assert("clampRelativeRatio floors at 0", clampRelativeRatio(-1) === 0);

assert("mode null intensity → soft", resolveSessionModeFromIntensity(null) === "soft");
assert("mode 0.2 → quiet", resolveSessionModeFromIntensity(0.2) === "quiet");
assert("mode 0.5 → soft", resolveSessionModeFromIntensity(0.5) === "soft");
assert("mode 1.0 → normal", resolveSessionModeFromIntensity(1.0) === "normal");
assert("mode 1.5 → hot", resolveSessionModeFromIntensity(1.5) === "hot");

const quietUniverse = [
  stock({ ticker: "A", turnover: 100_000_000, tradesCount: 10_000 }),
  stock({ ticker: "B", turnover: 80_000_000, tradesCount: 8_000 }),
  stock({ ticker: "C", turnover: 60_000_000, tradesCount: 6_000 }),
];
const quietSession = buildRadarSessionContext(quietUniverse);
assert("no baseline → sessionIntensity null", quietSession.sessionIntensity === null);
assert("no baseline → mode soft", quietSession.mode === "soft");
assert("no baseline → soft minTurnover 30M", quietSession.minTurnover === 30_000_000);
assert("turnoverRef median top3", quietSession.turnoverRef === 80_000_000);
assert("tradesRef median top5", quietSession.tradesRef === 8_000);

const leaderRow = stock({ ticker: "LEAD", turnover: 80_000_000, tradesCount: 8_000 });
const metrics = computeRadarRowSessionMetrics(leaderRow, quietSession);
assert("leader relativeTurnover ~1", Math.abs(metrics.relativeTurnover - 1) < 0.01);
assert("leaderPresenceScore > 0.9", metrics.leaderPresenceScore > 0.9);

const zeroRefSession = { ...quietSession, turnoverRef: 0, tradesRef: 0 };
const zeroMetrics = computeRadarRowSessionMetrics(leaderRow, zeroRefSession);
assert("zero refs → leaderPresenceScore 0", zeroMetrics.leaderPresenceScore === 0);

const baselineUniverse = [
  stock({
    ticker: "X1",
    turnover: 500_000_000,
    tradesCount: 20_000,
    metrics: baseMetrics({
      currentTurnoverRub: 200_000_000,
      avgTurnoverAtTimeRub: 400_000_000,
      avgTradesAtTimeRub: 40_000,
      intradayBaselineKind: "intraday-ok",
      baselineIsReliable: true,
      baselineMode: "same-time",
      baselineTimeMsk: "10:20",
      volumeRatioNow: 0.5,
      tradesRatioNow: 0.5,
    }),
  }),
  stock({
    ticker: "X2",
    turnover: 400_000_000,
    tradesCount: 20_000,
    metrics: baseMetrics({
      currentTurnoverRub: 200_000_000,
      avgTurnoverAtTimeRub: 400_000_000,
      avgTradesAtTimeRub: 40_000,
      intradayBaselineKind: "intraday-ok",
      baselineIsReliable: true,
      baselineMode: "same-time",
      baselineTimeMsk: "10:20",
      volumeRatioNow: 0.5,
      tradesRatioNow: 0.5,
    }),
  }),
];

const intensities = computeMarketSessionIntensities(baselineUniverse);
assert("market turnoverIntensity 0.5", intensities != null && Math.abs(intensities.turnoverIntensity - 0.5) < 0.001);
assert("market tradesIntensity 0.5", intensities != null && Math.abs(intensities.tradesIntensity - 0.5) < 0.001);

const intensity = computeSessionIntensity(intensities);
assert("sessionIntensity 0.5", intensity != null && Math.abs(intensity - 0.5) < 0.001);

const softSession = buildRadarSessionContext(baselineUniverse);
assert("baseline universe mode soft", softSession.mode === "soft");
assert("baseline sessionIntensity set", softSession.sessionIntensity != null);

console.log("\nAll market-radar session QA checks passed.");
