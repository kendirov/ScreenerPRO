import type { ScreenerBenchmark, ScreenerRow } from "@screenerpro/shared";
import { computePositionInRange } from "@/lib/domain/stock-sparkline";
import { resolveHonestVolumeRatio } from "@/lib/domain/baseline-info";

export type StocksLabCategory = "focus" | "in-play" | "active" | "impulse" | "thin-spike" | "risk";

export type StocksLabRow = {
  raw: ScreenerRow;
  ticker: string;
  name: string;
  turnover: number;
  trades: number;
  changePct: number;
  rangePct: number;
  position: number | null;
  turnoverShare: number;
  activity: number;
  participation: number;
  range: number;
  momentum: number;
  strength: number;
  quality: number;
  risk: number;
  score: number;
  category: StocksLabCategory;
  reason: string;
  riskReason: string | null;
};

export type StocksLabMarket = {
  totalTurnover: number;
  totalTrades: number;
  rising: number;
  falling: number;
  flat: number;
  greenTurnoverShare: number;
  greenTradesShare: number;
  concentrationTop5: number;
  concentrationTop10: number;
  index: ScreenerBenchmark | null;
  regime: "рост" | "снижение" | "баланс";
  activity: "тихо" | "норма" | "активно";
};

export type StocksLabModel = { rows: StocksLabRow[]; market: StocksLabMarket };

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const finite = (value: number | null | undefined) => (Number.isFinite(value) ? Number(value) : 0);
const percentile = (value: number, values: number[]) => {
  if (values.length < 2) return 50;
  return (values.filter((candidate) => candidate <= value).length / values.length) * 100;
};

/**
 * Experimental, snapshot-only ranking. It deliberately does not claim order-flow,
 * tape, 5m returns or candle quality: those require a durable intraday source.
 */
export function buildStocksCommandCenterModel(rows: ScreenerRow[], benchmarks: ScreenerBenchmark[]): StocksLabModel {
  const stocks = rows.filter((row) => row.assetClass === "stock" && row.tradingStatus !== "halted");
  const turnovers = stocks.map((row) => finite(row.turnover));
  const trades = stocks.map((row) => finite(row.tradesCount));
  const ranges = stocks.map((row) => Math.abs(finite(row.metrics.dayRangePct)));
  const totalTurnover = turnovers.reduce((sum, value) => sum + value, 0);
  const totalTrades = trades.reduce((sum, value) => sum + value, 0);
  const index = benchmarks.find((item) => item.code === "IMOEX2") ?? benchmarks.find((item) => item.code === "IMOEX") ?? null;
  const indexMove = finite(index?.percentChange);

  const result = stocks.map((raw) => {
    const turnover = finite(raw.turnover);
    const tradeCount = finite(raw.tradesCount);
    const changePct = finite(raw.percentChange);
    const rangePct = Math.abs(finite(raw.metrics.dayRangePct));
    const position = computePositionInRange(raw.lastPrice, raw.low, raw.high);
    const turnoverPct = percentile(turnover, turnovers);
    const tradesPct = percentile(tradeCount, trades);
    const rangePctile = percentile(rangePct, ranges);
    const baseline = resolveHonestVolumeRatio(raw);
    const activity = clamp(turnoverPct * 0.65 + (baseline == null ? 0 : clamp(baseline / 3, 0, 1) * 35));
    const participation = clamp(tradesPct * 0.8 + (tradeCount > 0 && turnover > 0 ? 20 : 0));
    const range = clamp(rangePctile);
    const strength = clamp(50 + (changePct - indexMove) * 15);
    const nearExtreme = position == null ? 0 : Math.abs(position - 50) / 50;
    const momentum = clamp(Math.abs(changePct) * 15 + nearExtreme * 35);
    const quality = clamp(participation * 0.55 + range * 0.2 + nearExtreme * 25);
    const thin = changePct !== 0 && Math.abs(changePct) >= 2 && (turnoverPct < 40 || tradesPct < 40);
    const risk = clamp((thin ? 65 : 0) + (raw.metrics.intradayBaselineKind === "none" ? 15 : 0) + (tradeCount === 0 ? 25 : 0));
    const score = clamp(activity * 0.28 + participation * 0.2 + range * 0.14 + momentum * 0.14 + strength * 0.12 + quality * 0.12 - risk * 0.22);
    let category: StocksLabCategory = "active";
    if (thin) category = "thin-spike";
    else if (risk >= 55) category = "risk";
    else if (score >= 73 && quality >= 58) category = "focus";
    else if (score >= 58 && quality >= 48) category = "in-play";
    else if (momentum >= 62 && participation >= 45) category = "impulse";
    const reason = baseline != null ? `оборот ${baseline.toFixed(1)}× · ${Math.round(tradesPct)}-й перцентиль сделок` : `оборот ${Math.round(turnoverPct)}-й перцентиль · диапазон ${Math.round(rangePctile)}-й`;
    return { raw, ticker: raw.ticker, name: raw.shortName, turnover, trades: tradeCount, changePct, rangePct, position, turnoverShare: totalTurnover ? turnover / totalTurnover : 0, activity, participation, range, momentum, strength, quality, risk, score, category, reason, riskReason: thin ? "движение без достаточного участия" : risk >= 55 ? "неполные или слабые данные" : null };
  }).sort((a, b) => b.score - a.score || b.turnover - a.turnover || a.ticker.localeCompare(b.ticker));

  const rising = result.filter((row) => row.changePct > 0.05);
  const falling = result.filter((row) => row.changePct < -0.05);
  const sortedTurnover = [...result].sort((a, b) => b.turnover - a.turnover);
  const share = (subset: StocksLabRow[], field: "turnover" | "trades", total: number) => total ? subset.reduce((sum, row) => sum + row[field], 0) / total : 0;
  const medianTurnover = sortedTurnover[Math.floor(sortedTurnover.length / 2)]?.turnover ?? 0;
  return {
    rows: result,
    market: {
      totalTurnover, totalTrades, rising: rising.length, falling: falling.length, flat: result.length - rising.length - falling.length,
      greenTurnoverShare: share(rising, "turnover", totalTurnover), greenTradesShare: share(rising, "trades", totalTrades),
      concentrationTop5: share(sortedTurnover.slice(0, 5), "turnover", totalTurnover), concentrationTop10: share(sortedTurnover.slice(0, 10), "turnover", totalTurnover),
      index, regime: indexMove > 0.15 ? "рост" : indexMove < -0.15 ? "снижение" : "баланс",
      activity: medianTurnover > 500_000_000 ? "активно" : medianTurnover > 80_000_000 ? "норма" : "тихо",
    },
  };
}

export const STOCKS_LAB_CATEGORY_LABEL: Record<StocksLabCategory, string> = {
  focus: "Фокус", "in-play": "В игре", active: "Активна", impulse: "Импульс", "thin-spike": "Тонкий прострел", risk: "Риск",
};
