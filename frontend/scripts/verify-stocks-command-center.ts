import { buildStocksCommandCenterModel } from "../lib/screener/stocks-command-center";
import type { ScreenerRow } from "@screenerpro/shared";

function row(ticker: string, change: number, turnover: number, trades: number, range = 2): ScreenerRow {
  return { ticker, shortName: ticker, assetClass: "stock", lastPrice: 100, previousClose: 100, absoluteChange: change, percentChange: change, volume: 1, turnover, open: 100, high: 101, low: 99, tradesCount: trades, stockActivityClass: "active", tradingStatus: "open", lotSize: 1, updatedAt: "2026-07-21T10:00:00Z", sourceUpdatedAt: null, metrics: { turnoverRatio: null, volumeRatio: null, turnoverVsAverage: null, rangeVsAverage: null, tradesVsAverage: null, turnoverPercentile: null, tradesPercentile: null, rangePercentile: null, dayRangePct: range, gapPct: null, relativeVolatility20d: null, inPlayScore: null, isInPlay: false, inPlayTags: [], reasonLabel: null, currentTurnoverRub: turnover, previousDayTurnoverRub: null, activityRatio: null, requiredActivityRatio: null, sessionProgress: null, intradayBaselineKind: "none" } };
}
const model = buildStocksCommandCenterModel([row("LIQUID", 2.5, 10_000_000_000, 200_000, 5), row("THIN", 4.2, 10_000_000, 200, 6), row("WEAK", -2.1, 1_000_000_000, 90_000, 4)], [{ code:"IMOEX", name:"IMOEX", market:"stock", lastValue:3000, percentChange:0.3, dayRangePct:1, aggregateTurnover:null, aggregateTrades:null, updatedAt:"", sourceUpdatedAt:null }]);
if (model.rows.length !== 3) throw new Error("Rows were lost");
if (model.rows.some((item) => !Number.isFinite(item.score))) throw new Error("NaN score");
if (model.rows.find((item) => item.ticker === "THIN")?.category !== "thin-spike") throw new Error("Thin spike penalty is missing");
if (model.market.rising !== 2 || model.market.falling !== 1) throw new Error("Breadth mismatch");
console.log("Stocks Command Center checks passed: breadth, thin spike, stable finite scores.");
