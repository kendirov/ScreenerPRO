/**
 * QA Situation Engine v0 — pnpm -C frontend verify:situation-engine
 */
import type { ScreenerRow } from "@screenerpro/shared";
import { computeInstrumentSituation } from "../lib/screener/situation-engine";

function assert(label: string, condition: boolean): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`OK: ${label}`);
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

function stockRow(overrides: Partial<ScreenerRow> = {}): ScreenerRow {
  return {
    ticker: "SBER",
    shortName: "Сбербанк",
    assetClass: "stock",
    lastPrice: 280,
    previousClose: 275,
    absoluteChange: 5,
    percentChange: 1.8,
    volume: 1_000_000,
    turnover: 120_000_000,
    open: 276,
    high: 281,
    low: 275,
    tradesCount: 12_000,
    stockActivityClass: "active",
    tradingStatus: "open",
    lotSize: 10,
    updatedAt: new Date().toISOString(),
    sourceUpdatedAt: null,
    metrics: baseMetrics({
      dayRangePct: 2.8,
      volumeRatioNow: 2.2,
      tradesRatioNow: 1.9,
      turnoverPercentile: 88,
      tradesPercentile: 82,
      inPlayScore: 84,
    }),
    ...overrides,
  };
}

const hot = computeInstrumentSituation(stockRow());
assert("hot row has volume_ignition", hot.tags.includes("volume_ignition"));
assert("hot row has range_expansion", hot.tags.includes("range_expansion"));
assert("hot row score in range", hot.score > 40 && hot.score <= 100);
assert("hot row has reasons", hot.reasons.length >= 2);
assert("no NaN score", Number.isFinite(hot.score));

const quiet = computeInstrumentSituation(
  stockRow({
    percentChange: 0.1,
    turnover: 1_000_000,
    tradesCount: 50,
    high: 300,
    low: 260,
    lastPrice: 280,
    metrics: baseMetrics({ dayRangePct: 0.2, volumeRatioNow: null, tradesRatioNow: null, inPlayScore: null }),
  }),
);
assert("quiet row defaults to quiet tag", quiet.primaryTag === "quiet");

const spreadRisk = computeInstrumentSituation(stockRow(), { spreadPct: 0.9 });
assert("spread_risk only with spreadPct context", spreadRisk.tags.includes("spread_risk"));

const noSpread = computeInstrumentSituation(stockRow());
assert("no spread without context", !noSpread.tags.includes("spread_risk"));

const breakout = computeInstrumentSituation(
  stockRow({
    lastPrice: 280.9,
    high: 281,
    low: 270,
    percentChange: 1.5,
    metrics: baseMetrics({ dayRangePct: 3.2, volumeRatioNow: 2.0 }),
  }),
);
assert("breakout_attempt when near high + range + up", breakout.tags.includes("breakout_attempt"));

console.log("\nAll situation-engine checks passed.");
