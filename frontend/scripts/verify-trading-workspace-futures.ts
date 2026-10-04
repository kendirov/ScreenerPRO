import { screenerRowSchema, type ScreenerRow } from "@screenerpro/shared";
import { buildFuturesFamilies } from "@/lib/domain/futures-family";

function future(input: Partial<ScreenerRow> & Pick<ScreenerRow, "ticker" | "shortName">): ScreenerRow {
  return screenerRowSchema.parse({
    assetClass: "future",
    lastPrice: 100,
    previousClose: 99,
    absoluteChange: 1,
    percentChange: 1.01,
    volume: 1_000,
    turnover: 100_000_000,
    tradesCount: 1_000,
    openInterest: 10_000,
    expiryDate: "2026-09-17",
    assetCode: null,
    open: 99,
    high: 102,
    low: 98,
    stockActivityClass: "unknown",
    tradingStatus: "open",
    lotSize: 1,
    updatedAt: "2026-08-17T08:00:00.000Z",
    sourceUpdatedAt: null,
    metrics: {
      turnoverRatio: null,
      volumeRatio: null,
      turnoverVsAverage: null,
      rangeVsAverage: null,
      tradesVsAverage: null,
      turnoverPercentile: null,
      tradesPercentile: null,
      rangePercentile: null,
      dayRangePct: 4,
      gapPct: null,
      relativeVolatility20d: null,
      inPlayScore: null,
      isInPlay: true,
      inPlayTags: [],
      reasonLabel: null,
      currentTurnoverRub: 100_000_000,
      previousDayTurnoverRub: null,
      activityRatio: null,
      requiredActivityRatio: null,
      sessionProgress: null,
    },
    ...input,
  });
}

const rows = [
  future({ ticker: "CRU6", shortName: "CNY-9.26", assetCode: "CNY", turnover: 7_000_000_000, tradesCount: 15_000 }),
  future({ ticker: "CNYRUBF", shortName: "CNYRUBF", assetCode: "CNYRUBTOM", expiryDate: "2100-01-01", turnover: 5_000_000_000, tradesCount: 9_000 }),
  future({ ticker: "MXU6", shortName: "MIX-9.26", assetCode: "MIX", turnover: 40_000_000_000, tradesCount: 58_000 }),
  future({ ticker: "MMU6", shortName: "MXI-9.26", assetCode: "MXI", turnover: 6_000_000_000, tradesCount: 56_000 }),
  future({ ticker: "IMOEXF", shortName: "IMOEXF", assetCode: "IMOEX", expiryDate: "2100-01-01", turnover: 20_000_000_000, tradesCount: 46_000 }),
  future({ ticker: "SRU6", shortName: "SBRF-9.26", assetCode: "SBRF", turnover: 1_100_000_000, tradesCount: 11_000 }),
  future({ ticker: "SBERF", shortName: "SBERF", assetCode: "SBERF", expiryDate: "2100-01-01", turnover: 360_000_000, tradesCount: 1_900 }),
  future({ ticker: "CIU6", shortName: "CHINA-9.26", assetCode: "CHINA", turnover: 210_000_000, tradesCount: 2_100 }),
  future({ ticker: "CIZ6", shortName: "CHINA-12.26", assetCode: "CHINA", turnover: 90_000_000, tradesCount: 900 }),
];

const families = buildFuturesFamilies(rows, new Date("2026-08-17T08:00:00.000Z"));
const cny = families.find((family) => family.familyKey === "cny_rub");
if (!cny || cny.contracts.length !== 2 || cny.activeContractTicker !== "CRU6" || cny.segment !== "Валюта") {
  throw new Error("CNY quarterly and perpetual variants must form one family with the turnover leader active");
}

const imoex = families.find((family) => family.familyKey === "imoex");
if (!imoex || imoex.contracts.length !== 3 || imoex.activeContractTicker !== "MXU6") {
  throw new Error("IMOEX standard, mini and perpetual contracts must form one family");
}
if (!imoex.contracts.some((contract) => contract.contractKind === "mini") || !imoex.contracts.some((contract) => contract.contractKind === "perpetual")) {
  throw new Error("Contract roles must expose mini and perpetual variants");
}

const sber = families.find((family) => family.familyKey === "stock:sber");
if (!sber || sber.contracts.length !== 2 || sber.activeContractTicker !== "SRU6" || sber.segment !== "Акции") {
  throw new Error("SBER quarterly and perpetual contracts must form one stock family");
}

const china = families.find((family) => family.familyKey === "asset:china");
if (!china || china.contracts.length !== 2 || china.activeContractTicker !== "CIU6" || china.segment !== "Индексы") {
  throw new Error("Unknown MOEX families must still group by ASSETCODE instead of duplicating expiries");
}

if (families[0]?.familyKey !== "imoex" || imoex.totalTrades !== 160_000) {
  throw new Error("Family ranking and aggregate trades must use real family totals");
}

console.log("Trading Workspace futures contracts: OK");
