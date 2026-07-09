/**
 * QA stock-only universe filter — pnpm -C frontend verify:stock-universe
 */
import type { ScreenerRow } from "@screenerpro/shared";
import { classifyStockUniverse, filterValidStockUniverse } from "../lib/screener/stock-universe-filter";

function assert(label: string, condition: boolean): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`OK: ${label}`);
}

function stockRow(overrides: Partial<ScreenerRow> & { ticker: string }): ScreenerRow {
  const { ticker, shortName, moexSecType, ...rest } = overrides;
  return {
    ticker,
    shortName: shortName ?? ticker,
    assetClass: "stock",
    lastPrice: 100,
    previousClose: 99,
    absoluteChange: 1,
    percentChange: 1,
    volume: 1000,
    turnover: 5_000_000,
    open: 99,
    high: 101,
    low: 98,
    tradesCount: 500,
    stockActivityClass: "active",
    tradingStatus: "open",
    lotSize: 10,
    moexSecType: moexSecType ?? "1",
    updatedAt: new Date().toISOString(),
    sourceUpdatedAt: null,
    metrics: {
      turnoverRatio: null,
      volumeRatio: null,
      turnoverVsAverage: null,
      rangeVsAverage: null,
      tradesVsAverage: null,
      turnoverPercentile: 50,
      tradesPercentile: 50,
      rangePercentile: 50,
      dayRangePct: 1.5,
      gapPct: null,
      relativeVolatility20d: null,
      inPlayScore: 50,
      isInPlay: false,
      inPlayTags: [],
      reasonLabel: null,
      currentTurnoverRub: 5_000_000,
      previousDayTurnoverRub: null,
      activityRatio: null,
      requiredActivityRatio: null,
      sessionProgress: 0.5,
    },
    ...rest,
  };
}

function expectInclude(ticker: string, row: unknown, category?: "stock" | "preferred_stock") {
  const d = classifyStockUniverse(row);
  assert(`${ticker} include (${d.category})`, d.isStock === true);
  if (category) assert(`${ticker} category ${category}`, d.category === category);
}

function expectExclude(ticker: string, row: unknown, category: string) {
  const d = classifyStockUniverse(row);
  assert(`${ticker} exclude as ${category}`, d.isStock === false && d.category === category);
}

// INCLUDE — ordinary and preferred shares
expectInclude("SBER", stockRow({ ticker: "SBER", moexSecType: "1" }), "stock");
expectInclude("SBERP", stockRow({ ticker: "SBERP", moexSecType: "2" }), "preferred_stock");
expectInclude("TRNFP", stockRow({ ticker: "TRNFP", moexSecType: "2" }), "preferred_stock");
expectInclude("SNGSP", stockRow({ ticker: "SNGSP", moexSecType: "2" }), "preferred_stock");
expectInclude("TATNP", stockRow({ ticker: "TATNP", moexSecType: "2" }), "preferred_stock");
expectInclude("VTBR", stockRow({ ticker: "VTBR" }), "stock");
expectInclude("IRAO", stockRow({ ticker: "IRAO" }), "stock");
expectInclude("SIBN", stockRow({ ticker: "SIBN" }), "stock");
expectInclude("X5", stockRow({ ticker: "X5", shortName: "КЦ ИКС 5", moexSecType: "1" }), "stock");

// EXCLUDE — ISIN / RU000 without share metadata
expectExclude(
  "RU000A101NK4",
  { ticker: "RU000A101NK4", shortName: "RU000A101NK4", assetClass: "stock", lastPrice: 100, turnover: 1_000_000, tradesCount: 10 },
  "bond",
);

// EXCLUDE — ETF / fund / bond rows
expectExclude(
  "AKAI",
  stockRow({ ticker: "AKAI", shortName: "AKAI ETF", moexSecType: "J", turnover: 50_000_000 }),
  "etf",
);
expectExclude(
  "FUND1",
  stockRow({ ticker: "FUND1", shortName: "БПИФ Ликвидность", moexSecType: "9" }),
  "fund",
);
expectExclude(
  "BOND1",
  stockRow({ ticker: "RU000A0JPZL7", shortName: "АкБрс-Инв", moexSecType: "B" }),
  "bond",
);
expectExclude(
  "OKEY",
  stockRow({ ticker: "OKEY", shortName: "OKEY-гдр", moexSecType: "D" }),
  "unknown",
);

// Unknown without board/type — exclude from main universe
const unknownRow = {
  ticker: "ZZZZZ",
  shortName: "ZZZZZ",
  assetClass: "stock",
  lastPrice: null,
  turnover: null,
  tradesCount: null,
};
const unknownDecision = classifyStockUniverse(unknownRow);
assert("unknown without trading data excluded", unknownDecision.isStock === false);

// filterValidStockUniverse dedup + counts
const mixed: ScreenerRow[] = [
  stockRow({ ticker: "SBER" }),
  stockRow({ ticker: "AKAI", shortName: "AKAI ETF", moexSecType: "J" }),
  stockRow({ ticker: "RU000A0JPZL7", shortName: "АкБрс-Инв", moexSecType: "B" }),
  stockRow({ ticker: "TRNFP", moexSecType: "2" }),
];
const { universe, audit } = filterValidStockUniverse(mixed);
assert("filter keeps 2 stocks", universe.length === 2);
assert("filter removes 2 non-stocks", audit.invalidRowsRemoved === 2);
assert("SBER in universe", universe.some((r) => r.ticker === "SBER"));
assert("TRNFP in universe", universe.some((r) => r.ticker === "TRNFP"));

console.log("\nverify:stock-universe — all checks passed");
