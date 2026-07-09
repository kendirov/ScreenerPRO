/**
 * QA Market Priority Engine — pnpm -C frontend verify:market-priority
 */
import {
  computeMarketPriority,
  clampScore,
  percentileRank,
  safeNormalizeRank,
  type PriorityInstrument,
} from "../lib/screener/market-priority-engine";

function assert(label: string, condition: boolean): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`OK: ${label}`);
}

function assertNoNaN(label: string, value: number): void {
  assert(`${label} is finite`, Number.isFinite(value));
}

type MockRow = Record<string, unknown>;

function mockRow(overrides: MockRow = {}): MockRow {
  return {
    ticker: "TEST",
    shortName: "Test",
    lastPrice: 100,
    percentChange: 0.5,
    turnover: 50_000_000,
    tradesCount: 5000,
    volume: 100_000,
    high: 101,
    low: 99,
    previousClose: 100,
    metrics: { dayRangePct: 1.0 },
    ...overrides,
  };
}

function hasSecid(list: PriorityInstrument<MockRow>[], secid: string): boolean {
  return list.some((i) => i.secid === secid);
}

function fillerUniverse(): MockRow[] {
  return [
    mockRow({ ticker: "MAGN", turnover: 200_000_000, tradesCount: 3000, metrics: { dayRangePct: 0.6 } }),
    mockRow({ ticker: "AFKS", turnover: 150_000_000, tradesCount: 2500, metrics: { dayRangePct: 0.5 } }),
    mockRow({ ticker: "BSPB", turnover: 100_000_000, tradesCount: 2000, metrics: { dayRangePct: 0.4 } }),
    mockRow({ ticker: "MTSS", turnover: 80_000_000, tradesCount: 1800, metrics: { dayRangePct: 0.7 } }),
    mockRow({ ticker: "LKOH", turnover: 60_000_000, tradesCount: 1500, metrics: { dayRangePct: 0.5 } }),
  ];
}

// --- unit helpers ---
assert("clampScore clamps", clampScore(150) === 100 && clampScore(-5) === 0);
assert("percentileRank max", percentileRank(100, [10, 20, 50, 100]) === 100);
assert("safeNormalizeRank first", safeNormalizeRank(1, 5) === 100);

const STOCK_LIVE = { variant: "stock-live-v0" as const };
const BASELINE = { variant: "baseline-confirmed" as const };

// --- A. SBER-like (baseline) ---
const sberUniverse: MockRow[] = [
  ...fillerUniverse(),
  mockRow({
    ticker: "SBER",
    shortName: "Сбербанк",
    lastPrice: 280,
    percentChange: 0.3,
    turnover: 15_000_000_000,
    tradesCount: 80_000,
    volume: 5_000_000,
    high: 281,
    low: 278,
    metrics: { dayRangePct: 0.8, volumeRatioNow: 1.0, tradesRatioNow: 1.0, intradayBaselineKind: "intraday-ok" },
  }),
];

const sberStrict = computeMarketPriority(sberUniverse, { mode: "strict", ...BASELINE });
assert("A SBER in liquidityLeaders", hasSecid(sberStrict.liquidityLeaders, "SBER"));
assert("A SBER not in strict inPlay", !hasSecid(sberStrict.inPlayLeaders, "SBER"));
const sberInst = sberStrict.all.find((i) => i.secid === "SBER")!;
assertNoNaN("A SBER liquidityScore", sberInst.liquidityScore);
assert("A SBER no confirmedActivityShock", !sberInst.confirmed.confirmedActivityShock);
assert("A SBER no confirmedInPlay", !sberInst.confirmed.confirmedInPlay);

// --- VTBR-like ---
const vtbrUniverse: MockRow[] = [
  ...fillerUniverse(),
  mockRow({
    ticker: "VTBR",
    lastPrice: 0.02,
    percentChange: 0.4,
    turnover: 8_000_000_000,
    tradesCount: 120_000,
    high: 0.021,
    low: 0.019,
    metrics: { dayRangePct: 0.9, volumeRatioNow: 1.05, tradesRatioNow: 1.1, intradayBaselineKind: "intraday-ok" },
  }),
];
assert(
  "A VTBR not in baseline strict inPlay",
  !hasSecid(computeMarketPriority(vtbrUniverse, { mode: "strict", ...BASELINE }).inPlayLeaders, "VTBR"),
);

// --- B. TRUE_INPLAY ---
const trueInPlayRow = mockRow({
  ticker: "TRUEIN",
  shortName: "True In Play",
  lastPrice: 524,
  percentChange: 3.1,
  turnover: 900_000_000,
  tradesCount: 28_000,
  high: 525,
  low: 505,
  spreadPct: 0.25,
  metrics: {
    dayRangePct: 3.4,
    volumeRatioNow: 2.8,
    tradesRatioNow: 2.6,
    intradayBaselineKind: "intraday-ok",
  },
});
const trueUniverse: MockRow[] = [...fillerUniverse(), trueInPlayRow];
const trueStrict = computeMarketPriority(trueUniverse, { mode: "strict", ...BASELINE });
assert("B TRUEIN in strict inPlay", hasSecid(trueStrict.inPlayLeaders, "TRUEIN"));
const trueInst = trueStrict.all.find((i) => i.secid === "TRUEIN")!;
assert("B TRUEIN confirmedActivityShock", trueInst.confirmed.confirmedActivityShock);
assert("B TRUEIN confirmedRangeExpansion", trueInst.confirmed.confirmedRangeExpansion);
assert("B TRUEIN confirmedInPlay", trueInst.confirmed.confirmedInPlay);
assert(
  "B TRUEIN has strong abnormality reason",
  trueInst.reasons.some((r) => r.code === "activity_shock_confirmed" && r.strength === "strong"),
);

// --- C. RANGE_WITHOUT_PARTICIPATION ---
const rangeOnlyRow = mockRow({
  ticker: "RANGEO",
  lastPrice: 15,
  percentChange: 0.5,
  turnover: 800_000,
  tradesCount: 40,
  high: 16.2,
  low: 14.8,
  metrics: { dayRangePct: 5.5 },
});
const rangeStrict = computeMarketPriority([...fillerUniverse(), rangeOnlyRow], { mode: "strict", ...BASELINE });
assert("C RANGEO not in strict inPlay", !hasSecid(rangeStrict.inPlayLeaders, "RANGEO"));
const rangeInst = rangeStrict.all.find((i) => i.secid === "RANGEO")!;
const rangeOk =
  hasSecid(rangeStrict.excluded, "RANGEO") ||
  hasSecid(rangeStrict.volatilityLeaders, "RANGEO") ||
  rangeInst.riskReasons.length > 0;
assert("C RANGEO excluded or volatility/risk", rangeOk);

// --- D. THIN_SPIKE ---
const thinRow = mockRow({
  ticker: "THIN",
  turnover: 400_000,
  tradesCount: 25,
  lastPrice: 12,
  high: 13,
  low: 11,
  percentChange: 4,
  metrics: { dayRangePct: 6 },
});
const thinResult = computeMarketPriority([...fillerUniverse(), thinRow], { mode: "strict", ...BASELINE });
assert("D THIN not in strict inPlay", !hasSecid(thinResult.inPlayLeaders, "THIN"));
assert("D THIN hard excluded or volatility only", hasSecid(thinResult.excluded, "THIN") || hasSecid(thinResult.volatilityLeaders, "THIN"));

const izhRow = mockRow({
  ticker: "IGST",
  turnover: 2_000_000,
  tradesCount: 3,
  lastPrice: 45,
  high: 48,
  low: 40,
  metrics: { dayRangePct: 8 },
});
assert("D IGST hard excluded", hasSecid(computeMarketPriority([...fillerUniverse(), izhRow], BASELINE).excluded, "IGST"));

// --- E. FALLBACK_ACTIVITY_ONLY ---
const noRatioRows: MockRow[] = [
  ...fillerUniverse(),
  mockRow({
    ticker: "NORATIO",
    turnover: 2_000_000_000,
    tradesCount: 45_000,
    percentChange: 0.8,
    metrics: {
      dayRangePct: 0.9,
      inPlayScore: 88,
      turnoverPercentile: 95,
      tradesPercentile: 94,
    },
  }),
];
const noRatioStrict = computeMarketPriority(noRatioRows, { mode: "strict", ...BASELINE });
assert("E NORATIO not in strict inPlay", !hasSecid(noRatioStrict.inPlayLeaders, "NORATIO"));
const noRatioInst = noRatioStrict.all.find((i) => i.secid === "NORATIO")!;
assert("E NORATIO no confirmedActivityShock", !noRatioInst.confirmed.confirmedActivityShock);
assert(
  "E NORATIO fallback is weak not strong",
  !noRatioInst.reasons.some((r) => r.code === "activity_shock_confirmed" && r.strength === "strong"),
);

// --- F. SOFTRISK_MOVING ---
const softRiskRow = mockRow({
  ticker: "SOFTRISK",
  lastPrice: 520,
  percentChange: 3.2,
  turnover: 800_000_000,
  tradesCount: 25_000,
  spreadPct: 0.85,
  high: 525,
  low: 505,
  metrics: {
    dayRangePct: 3.2,
    volumeRatioNow: 2.8,
    tradesRatioNow: 2.4,
    intradayBaselineKind: "intraday-ok",
  },
});
const softUniverse: MockRow[] = [...fillerUniverse(), softRiskRow];
const softStrict = computeMarketPriority(softUniverse, { mode: "strict", ...BASELINE });
const softBalanced = computeMarketPriority(softUniverse, { mode: "balanced", ...BASELINE });
const softWide = computeMarketPriority(softUniverse, { mode: "wide", ...BASELINE });
assert("F SOFTRISK not in strict inPlay", !hasSecid(softStrict.inPlayLeaders, "SOFTRISK"));
assert("F SOFTRISK not in balanced inPlay", !hasSecid(softBalanced.inPlayLeaders, "SOFTRISK"));
const softWideInst = softWide.inPlayLeaders.find((i) => i.secid === "SOFTRISK");
if (softWideInst) {
  assert("F SOFTRISK in wide has risk badge", softWideInst.riskReasons.length > 0);
}

// --- G. EMPTY_IS_VALID ---
const quietUniverse: MockRow[] = [
  ...fillerUniverse(),
  mockRow({
    ticker: "QUIET",
    turnover: 30_000_000,
    tradesCount: 800,
    percentChange: 0.05,
    metrics: { dayRangePct: 0.2 },
  }),
];
const quietStrict = computeMarketPriority(quietUniverse, { mode: "strict", ...BASELINE });
assert("G quiet universe strict can be empty", quietStrict.inPlayLeaders.length === 0);
assert("G stats final matches leaders", quietStrict.stats.finalInPlayCount === quietStrict.inPlayLeaders.length);

// --- H. CAPS saturated ---
const saturated: MockRow[] = [...fillerUniverse()];
for (let i = 0; i < 20; i++) {
  saturated.push(
    mockRow({
      ticker: `HOT${i}`,
      lastPrice: 200 + i,
      percentChange: 2.5 + i * 0.1,
      turnover: 500_000_000 + i * 10_000_000,
      tradesCount: 15_000 + i * 200,
      high: 210 + i,
      low: 190,
      spreadPct: 0.3,
      metrics: {
        dayRangePct: 3.0 + i * 0.05,
        volumeRatioNow: 2.5 + i * 0.05,
        tradesRatioNow: 2.2,
        intradayBaselineKind: "intraday-ok",
      },
    }),
  );
}
const satStrict = computeMarketPriority(saturated, { mode: "strict", ...BASELINE });
const satBalanced = computeMarketPriority(saturated, { mode: "balanced", ...BASELINE });
const satWide = computeMarketPriority(saturated, { mode: "wide", ...BASELINE });
assert("H saturated strict count <= 5", satStrict.inPlayLeaders.length <= 5);
assert("H saturated balanced count <= 8", satBalanced.inPlayLeaders.length <= 8);
assert("H saturated wide count <= 12", satWide.inPlayLeaders.length <= 12);
assert(
  "H saturated strict rejects options.maxInPlay > cap",
  computeMarketPriority(saturated, { mode: "strict", maxInPlay: 99, ...BASELINE }).inPlayLeaders.length <= 5,
);

// --- Mode monotonicity ---
const modeUniverse: MockRow[] = [
  ...fillerUniverse(),
  trueInPlayRow,
  mockRow({
    ticker: "STOCKY",
    lastPrice: 101,
    percentChange: 1.8,
    turnover: 450_000_000,
    tradesCount: 14_000,
    high: 102,
    low: 98,
    metrics: { dayRangePct: 2.6, volumeRatioNow: 2.0, tradesRatioNow: 1.9, intradayBaselineKind: "intraday-ok" },
  }),
];

const strictMode = computeMarketPriority(modeUniverse, { mode: "strict", ...BASELINE });
const balancedMode = computeMarketPriority(modeUniverse, { mode: "balanced", ...BASELINE });
const wideMode = computeMarketPriority(modeUniverse, { mode: "wide", ...BASELINE });

assert("H strict count <= 5", strictMode.inPlayLeaders.length <= 5);
assert("H balanced count <= 8", balancedMode.inPlayLeaders.length <= 8);
assert("H wide count <= 12", wideMode.inPlayLeaders.length <= 12);
assert("wide count >= strict", wideMode.inPlayLeaders.length >= strictMode.inPlayLeaders.length);
assert("balanced count >= strict", balancedMode.inPlayLeaders.length >= strictMode.inPlayLeaders.length);
assert(
  "strict inPlay excludes all softRisk rows",
  strictMode.inPlayLeaders.every((i) => i.riskReasons.length === 0),
);
assert("stats inPlayCandidates >= final", strictMode.stats.inPlayCandidates >= strictMode.stats.finalInPlayCount);
assert("score does not gate alone — TRUEIN passes without minScore preset", hasSecid(strictMode.inPlayLeaders, "TRUEIN"));

// --- Global: no NaN ---
for (const inst of quietStrict.all) {
  assertNoNaN(`${inst.secid} liquidity`, inst.liquidityScore);
  assertNoNaN(`${inst.secid} inPlay`, inst.inPlayScore);
  assertNoNaN(`${inst.secid} volatility`, inst.volatilityScore);
}

function movingLiquidRow(ticker: string, overrides: MockRow = {}): MockRow {
  return mockRow({
    ticker,
    lastPrice: 100,
    percentChange: 1.0,
    turnover: 2_500_000_000,
    tradesCount: 30_000,
    high: 102,
    low: 97,
    metrics: { dayRangePct: 2.1 },
    ...overrides,
  });
}

// --- I. Stock live v0 (no baseline) ---
const stockLiveUniverse: MockRow[] = [
  ...fillerUniverse(),
  mockRow({
    ticker: "SBER",
    turnover: 15_000_000_000,
    tradesCount: 80_000,
    percentChange: 0.2,
    high: 281,
    low: 279,
    metrics: { dayRangePct: 0.4 },
  }),
  movingLiquidRow("VTBR", {
    turnover: 8_000_000_000,
    tradesCount: 120_000,
    percentChange: 0.85,
    metrics: { dayRangePct: 1.35 },
  }),
  movingLiquidRow("TRNFP", { turnover: 1_200_000_000, tradesCount: 18_000, percentChange: 1.4 }),
  movingLiquidRow("IRAO", { turnover: 900_000_000, tradesCount: 12_000, percentChange: -1.1 }),
  movingLiquidRow("SIBN", { turnover: 700_000_000, tradesCount: 9_500, percentChange: 0.95 }),
  mockRow({
    ticker: "THIN",
    turnover: 400_000,
    tradesCount: 25,
    percentChange: 4,
    high: 13,
    low: 11,
    metrics: { dayRangePct: 6 },
  }),
];

const stockLiveStrict = computeMarketPriority(stockLiveUniverse, { mode: "strict", ...STOCK_LIVE });

assert("I SBER liquidity only", hasSecid(stockLiveStrict.liquidityLeaders, "SBER"));
assert("I SBER not focus", !hasSecid(stockLiveStrict.inPlayLeaders, "SBER"));
assert("I SBER not candidate", !stockLiveStrict.inPlayCandidateLeaders.some((i) => i.secid === "SBER"));

for (const ticker of ["VTBR", "TRNFP", "IRAO", "SIBN"] as const) {
  const inst = stockLiveStrict.all.find((i) => i.secid === ticker)!;
  assert(`I ${ticker} inPlayCandidate`, inst.live?.inPlayCandidate === true);
  assert(`I ${ticker} in focus`, hasSecid(stockLiveStrict.inPlayLeaders, ticker));
}

assert("I THIN not candidate", !stockLiveStrict.inPlayCandidateLeaders.some((i) => i.secid === "THIN"));
assert(
  "I THIN volatility or excluded",
  hasSecid(stockLiveStrict.excluded, "THIN") || hasSecid(stockLiveStrict.volatilityLeaders, "THIN"),
);

assert("I strict focus <= 8", stockLiveStrict.inPlayLeaders.length <= 8);
assert(
  "I candidates >= focus",
  stockLiveStrict.stats.inPlayCandidates >= stockLiveStrict.stats.finalInPlayCount,
);
assert("I stock live stats tradable", (stockLiveStrict.stats.tradableCount ?? 0) > 0);
assert("I stock live range signals", (stockLiveStrict.stats.rangeSignalCount ?? 0) > 0);

const stockLiveSaturated = [...fillerUniverse()];
for (let i = 0; i < 25; i++) {
  stockLiveSaturated.push(
    movingLiquidRow(`LIVE${i}`, {
      turnover: 600_000_000 + i * 20_000_000,
      tradesCount: 10_000 + i * 300,
      percentChange: 1.0 + i * 0.05,
      metrics: { dayRangePct: 2.0 + i * 0.05 },
    }),
  );
}
const liveSatStrict = computeMarketPriority(stockLiveSaturated, { mode: "strict", ...STOCK_LIVE });
const liveSatBalanced = computeMarketPriority(stockLiveSaturated, { mode: "balanced", ...STOCK_LIVE });
const liveSatWide = computeMarketPriority(stockLiveSaturated, { mode: "wide", ...STOCK_LIVE });
assert("I saturated stock strict <= 8", liveSatStrict.inPlayLeaders.length <= 8);
assert("I saturated stock balanced <= 12", liveSatBalanced.inPlayLeaders.length <= 12);
assert("I saturated stock wide <= 20", liveSatWide.inPlayLeaders.length <= 20);

const scenarioCount = 9;
console.log(`\n--- verify scenarios: ${scenarioCount} (A–I) ---`);
console.log(`strict: ${strictMode.inPlayLeaders.length} (saturated: ${satStrict.inPlayLeaders.length})`);
console.log(`balanced: ${balancedMode.inPlayLeaders.length} (saturated: ${satBalanced.inPlayLeaders.length})`);
console.log(`wide: ${wideMode.inPlayLeaders.length} (saturated: ${satWide.inPlayLeaders.length})`);
console.log(`trueUniverse strict: ${trueStrict.inPlayLeaders.length}`);
console.log(
  `gate strict: eligible=${strictMode.stats.eligible} candidates=${strictMode.stats.inPlayCandidates} final=${strictMode.stats.finalInPlayCount}`,
);
console.log(
  `stock-live strict: candidates=${stockLiveStrict.stats.inPlayCandidates} focus=${stockLiveStrict.stats.focusFinal} range=${stockLiveStrict.stats.rangeSignalCount}`,
);

console.log("\nAll market-priority-engine checks passed.");
