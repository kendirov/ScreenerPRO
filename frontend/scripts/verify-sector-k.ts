import { screenerRowSchema } from "@screenerpro/shared";
import {
  getSectorKContentItem,
  getSectorKCurrentRevision,
  sectorKContentItemSchema,
  sectorKContentItems,
  sectorKPublishReadiness,
} from "@/lib/sector-k/content-model";
import { buildStockScreenerUniverse } from "@/lib/screener/stock-universe-filter";
import {
  buildSectorKStockActivity,
  getSectorKLiquidTickers,
  selectSectorKImpulses,
  selectSectorKInPlay,
  sortSectorKStocks,
} from "@/lib/sector-k/market";

const fixture = screenerRowSchema.parse({
  ticker: "TEST",
  shortName: "Test instrument",
  assetClass: "stock",
  lastPrice: 100,
  previousClose: 97,
  absoluteChange: 3,
  percentChange: 3.09,
  volume: 1_000_000,
  turnover: 100_000_000,
  open: 98,
  high: 102,
  low: 97,
  tradesCount: 12_000,
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
    dayRangePct: 5.15,
    gapPct: null,
    relativeVolatility20d: null,
    inPlayScore: 88,
    isInPlay: false,
    inPlayTags: [],
    reasonLabel: null,
    currentTurnoverRub: 100_000_000,
    previousDayTurnoverRub: null,
    activityRatio: null,
    requiredActivityRatio: null,
    sessionProgress: 0.5,
    baselineIsReliable: false,
  },
});

const lowerPrice = screenerRowSchema.parse({ ...fixture, ticker: "LOW", lastPrice: 10, turnover: 10_000_000, tradesCount: 500 });
const illiquid = screenerRowSchema.parse({ ...fixture, ticker: "TAIL", lastPrice: 40, turnover: 100_000, tradesCount: 4, percentChange: 0.1, metrics: { ...fixture.metrics, dayRangePct: 0.2 } });
const relativeLeader = screenerRowSchema.parse({
  ...fixture,
  ticker: "REL",
  turnover: 80_000_000,
  tradesCount: 8_000,
  percentChange: 4.2,
  metrics: {
    ...fixture.metrics,
    volumeRatioNow: 2.4,
    intradayBaselineKind: "intraday-ok",
    baselineMode: "same-time",
    baselineIsReliable: true,
  },
});
const etf = screenerRowSchema.parse({ ...fixture, ticker: "ETF1", shortName: "ETF test", moexSecType: "J" });
const stockUniverse = buildStockScreenerUniverse([fixture, lowerPrice, illiquid, relativeLeader, etf]);
if (stockUniverse.stockRows.length !== 4 || stockUniverse.excludedCount !== 1) {
  throw new Error("Sector K must use the verified stock-only universe");
}
if (sortSectorKStocks(stockUniverse.stockRows, "price", "asc")[0]?.ticker !== "LOW") {
  throw new Error("Ascending price sort failed");
}
if (sortSectorKStocks(stockUniverse.stockRows, "turnover", "desc")[0]?.ticker !== "TEST") {
  throw new Error("Descending turnover sort failed");
}
const activity = buildSectorKStockActivity(stockUniverse.stockRows);
if (getSectorKLiquidTickers(activity).has("TAIL")) {
  throw new Error("Bottom liquidity tail must be hidden by default");
}
if (!selectSectorKInPlay(activity).some((item) => item.row.ticker === "REL")) {
  throw new Error("Reliable same-time relative activity must enter the in-play strip");
}
if (selectSectorKInPlay(activity).some((item) => item.row.ticker === "TEST")) {
  throw new Error("Cross-section strength alone must not be called relative in-play");
}
if (!selectSectorKImpulses(activity).some((item) => item.row.ticker === "REL")) {
  throw new Error("Liquid signed impulse selection failed");
}

const material = getSectorKContentItem("intraday-selection");
if (!material || !getSectorKCurrentRevision(material)) {
  throw new Error("Reference material or active revision is missing");
}
sectorKContentItemSchema.array().parse(sectorKContentItems);
const readiness = sectorKPublishReadiness(material);
if (readiness.ready || !readiness.blockers.some((blocker) => blocker.includes("одобрен"))) {
  throw new Error("Review content must not be treated as publish-ready");
}

console.log("Sector K contracts: OK", {
  contentItems: sectorKContentItems.length,
  scenes: getSectorKCurrentRevision(material)?.scenes.length ?? 0,
  stockRows: stockUniverse.stockRows.length,
});
