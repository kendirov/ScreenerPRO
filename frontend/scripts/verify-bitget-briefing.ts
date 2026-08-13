import { buildBitgetBriefing } from "@/lib/bitget/briefing-engine";
import type { BitgetScreenerRow } from "@/lib/bitget/types";

const row = (id: string, change24hPct: number, spreadBps: number | null, turnover24h: number, range24hPct = 20): BitgetScreenerRow => ({
  id, category: "USDT-FUTURES", marketGroup: "CRYPTO_FUTURES", symbol: `${id}USDT`, baseCoin: id, quoteCoin: "USDT", symbolType: "crypto", status: "online", isReality: false, contractType: "perpetual", lastPrice: 100, change24hPct, high24h: 110, low24h: 90, range24hPct, rangePositionPct: 50, turnover24h, platformTurnover24h: null, volume24h: turnover24h, bid: 99.99, ask: 100.01, spreadBps, fundingRatePct: null, openInterest: 1, markPrice: 100, indexPrice: 100, maxLeverage: 20, minOrderAmount: 1, launchTime: null, updatedAt: Date.now(), attentionScore: 0, attentionReasons: [], inPlay: false,
});

const result = buildBitgetBriefing([row("BTC", 0.2, 2, 100, 2), row("PUMP", 10, 3, 400, 12), row("THIN", 12, 180, 300, 12)], { source: "bitget-v3", asOf: new Date().toISOString(), latencyMs: 0, warnings: [], categoriesLoaded: ["USDT-FUTURES"] });
const pump = result.rows.find((item) => item.row.baseCoin === "PUMP");
const thin = result.rows.find((item) => item.row.baseCoin === "THIN");
if (!pump || pump.situation !== "PUMP" || pump.disposition !== "IN_PLAY") throw new Error("PUMP must be In Play");
if (!thin || thin.disposition !== "WATCH_ONLY" || !thin.reasons.some((reason) => reason.includes("слабое"))) throw new Error("Poor execution must remain watch-only");
if (result.status.baseline !== "MISSING" || result.topInPlay.length > 10) throw new Error("Baseline and cap contract broken");
console.log("Bitget briefing engine: OK", { inPlay: result.topInPlay.length, watchOnly: result.watchOnly.length });
