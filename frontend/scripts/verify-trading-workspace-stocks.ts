import { screenerBenchmarkSchema, screenerRowSchema } from "@screenerpro/shared";
import {
  buildTradingWhyReasons,
  deriveTradingMarketState,
  summarizeTradingMarket,
  tradingBenchmarkPosition,
  tradingDayPosition,
  tradingMarketDelta,
} from "@/lib/trading/stocks-radar";

const base = screenerRowSchema.parse({
  ticker: "AAA",
  shortName: "Alpha",
  assetClass: "stock",
  lastPrice: 108,
  previousClose: 100,
  absoluteChange: 8,
  percentChange: 2,
  volume: 1_000,
  turnover: 100,
  open: 100,
  high: 110,
  low: 100,
  tradesCount: 10,
  stockActivityClass: "active",
  tradingStatus: "open",
  lotSize: 10,
  updatedAt: new Date().toISOString(),
  sourceUpdatedAt: null,
  metrics: {
    turnoverRatio: null,
    volumeRatio: null,
    turnoverVsAverage: null,
    rangeVsAverage: null,
    tradesVsAverage: null,
    turnoverPercentile: 96,
    tradesPercentile: 94,
    rangePercentile: 90,
    dayRangePct: 10,
    gapPct: null,
    relativeVolatility20d: null,
    inPlayScore: 88,
    isInPlay: true,
    inPlayTags: [],
    reasonLabel: null,
    currentTurnoverRub: 100,
    previousDayTurnoverRub: null,
    activityRatio: null,
    requiredActivityRatio: null,
    sessionProgress: 0.5,
    baselineIsReliable: true,
    intradayBaselineKind: "intraday-ok",
    baselineMode: "same-time",
    baselineTimeMsk: "14:20",
    avgTurnoverAtTimeRub: 50,
    volumeRatioNow: 2,
    avgTradesAtTimeRub: 5,
    tradesRatioNow: 2,
  },
});

const falling = screenerRowSchema.parse({
  ...base,
  ticker: "BBB",
  shortName: "Beta",
  percentChange: -1,
  turnover: 60,
  tradesCount: 5,
});
const flat = screenerRowSchema.parse({ ...base, ticker: "CCC", percentChange: 0, turnover: 40, tradesCount: null });
const unknown = screenerRowSchema.parse({ ...base, ticker: "DDD", percentChange: null, turnover: null, tradesCount: null });

const summary = summarizeTradingMarket([base, falling, flat, unknown]);
if (summary.rising !== 1 || summary.falling !== 1 || summary.flat !== 1 || summary.unknown !== 1) {
  throw new Error("Breadth must separate rising, falling, flat and unknown rows");
}
if (summary.totalTurnover !== 200 || summary.totalTrades !== 15 || summary.turnoverBalancePct !== 25) {
  throw new Error("Market totals or turnover balance formula are incorrect");
}
if (summarizeTradingMarket([unknown]).totalTurnover !== null) {
  throw new Error("Missing turnover must remain null, not zero");
}
if (tradingDayPosition(base) !== 80) {
  throw new Error("Day position must be calculated inside the real low/high range");
}

const benchmark = screenerBenchmarkSchema.parse({
  code: "IMOEX",
  name: "Индекс МосБиржи",
  market: "stock",
  lastValue: 105,
  previousClose: 100,
  absoluteChange: 5,
  percentChange: 1,
  dayRangePct: 20,
  aggregateTurnover: 200,
  aggregateTrades: 15,
  high: 110,
  low: 90,
  updatedAt: new Date().toISOString(),
  sourceUpdatedAt: new Date().toISOString(),
});

if (tradingBenchmarkPosition(benchmark) !== 75 || tradingMarketDelta(base, benchmark) !== 1) {
  throw new Error("Benchmark position or delta versus market is incorrect");
}

const fallingState = deriveTradingMarketState(
  { ...benchmark, percentChange: -4.3 },
  { ...summary, rising: 40, falling: 211, turnoverBalancePct: -92 },
);
if (fallingState.tone !== "negative" || !fallingState.evidence.includes("40↑ / 211↓")) {
  throw new Error("Computed market state must preserve direction and its numeric evidence");
}

const reasons = buildTradingWhyReasons(base, benchmark, [base, falling, flat, unknown], 8);
for (const code of ["turnover-ratio", "trades-ratio", "market-delta", "day-range", "range-position"]) {
  if (!reasons.some((reason) => reason.code === code)) {
    throw new Error(`Verified numeric reason is missing: ${code}`);
  }
}

const noBaseline = screenerRowSchema.parse({
  ...base,
  ticker: "NOBL",
  metrics: {
    ...base.metrics,
    baselineIsReliable: false,
    intradayBaselineKind: "none",
    baselineMode: "missing",
  },
});
const noBaselineReasons = buildTradingWhyReasons(noBaseline, benchmark, [noBaseline], 8);
if (noBaselineReasons.some((reason) => reason.code === "turnover-ratio" || reason.code === "trades-ratio")) {
  throw new Error("Unreliable same-time ratios must never become reasons");
}

console.log("Trading Workspace stocks radar contracts: OK");
