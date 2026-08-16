import type { ScreenerBenchmark, ScreenerRow } from "@screenerpro/shared";
import { resolveHonestTradesRatio, resolveHonestVolumeRatio } from "@/lib/domain/baseline-info";

export type TradingMarketSummary = {
  rising: number;
  falling: number;
  flat: number;
  unknown: number;
  totalTurnover: number | null;
  totalTrades: number | null;
  risingTurnover: number;
  fallingTurnover: number;
  turnoverBalancePct: number | null;
};

export type TradingWhyReason = {
  code: string;
  label: string;
  tone: "positive" | "negative" | "attention" | "neutral";
};

export type TradingMarketState = {
  label: string;
  evidence: string;
  tone: "positive" | "negative" | "neutral";
};

export function isFiniteMetric(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function summarizeTradingMarket(rows: ScreenerRow[]): TradingMarketSummary {
  let rising = 0;
  let falling = 0;
  let flat = 0;
  let unknown = 0;
  let totalTurnover = 0;
  let totalTrades = 0;
  let turnoverObservations = 0;
  let tradesObservations = 0;
  let risingTurnover = 0;
  let fallingTurnover = 0;

  for (const row of rows) {
    const change = row.percentChange;
    const turnover = row.turnover;
    const trades = row.tradesCount;

    if (isFiniteMetric(turnover)) {
      totalTurnover += turnover;
      turnoverObservations += 1;
    }
    if (isFiniteMetric(trades)) {
      totalTrades += trades;
      tradesObservations += 1;
    }

    if (!isFiniteMetric(change)) {
      unknown += 1;
    } else if (change > 0) {
      rising += 1;
      if (isFiniteMetric(turnover)) risingTurnover += turnover;
    } else if (change < 0) {
      falling += 1;
      if (isFiniteMetric(turnover)) fallingTurnover += turnover;
    } else {
      flat += 1;
    }
  }

  const directionalTurnover = risingTurnover + fallingTurnover;
  return {
    rising,
    falling,
    flat,
    unknown,
    totalTurnover: turnoverObservations ? totalTurnover : null,
    totalTrades: tradesObservations ? totalTrades : null,
    risingTurnover,
    fallingTurnover,
    turnoverBalancePct: directionalTurnover > 0
      ? ((risingTurnover - fallingTurnover) / directionalTurnover) * 100
      : null,
  };
}

export function deriveTradingMarketState(
  benchmark: ScreenerBenchmark | null,
  summary: TradingMarketSummary,
): TradingMarketState {
  const observed = summary.rising + summary.falling;
  const fallingShare = observed > 0 ? summary.falling / observed : 0.5;
  const risingShare = observed > 0 ? summary.rising / observed : 0.5;
  const indexChange = benchmark?.percentChange;
  const balance = summary.turnoverBalancePct;
  const evidence = [
    isFiniteMetric(indexChange) ? `${benchmark?.code ?? "Индекс"} ${indexChange > 0 ? "+" : ""}${indexChange.toFixed(1)}%` : null,
    observed ? `${summary.rising}↑ / ${summary.falling}↓` : null,
    isFiniteMetric(balance) ? `баланс ${balance > 0 ? "+" : ""}${balance.toFixed(0)}%` : null,
  ].filter(Boolean).join(" · ");

  if ((isFiniteMetric(indexChange) && indexChange <= -1) || (fallingShare >= 0.7 && (balance ?? 0) <= -30)) {
    return { label: "Широкое давление продавцов", evidence, tone: "negative" };
  }
  if ((isFiniteMetric(indexChange) && indexChange >= 1) || (risingShare >= 0.7 && (balance ?? 0) >= 30)) {
    return { label: "Широкий спрос", evidence, tone: "positive" };
  }
  if (Math.abs(fallingShare - risingShare) <= 0.15 || (isFiniteMetric(balance) && Math.abs(balance) < 20)) {
    return { label: "Смешанный рынок", evidence, tone: "neutral" };
  }
  return fallingShare > risingShare
    ? { label: "Перевес продавцов", evidence, tone: "negative" }
    : { label: "Перевес покупателей", evidence, tone: "positive" };
}

export function tradingDayPosition(row: Pick<ScreenerRow, "lastPrice" | "low" | "high">): number | null {
  if (!isFiniteMetric(row.lastPrice) || !isFiniteMetric(row.low) || !isFiniteMetric(row.high) || row.high <= row.low) {
    return null;
  }
  return Math.min(100, Math.max(0, ((row.lastPrice - row.low) / (row.high - row.low)) * 100));
}

export function tradingBenchmarkPosition(benchmark: ScreenerBenchmark | null): number | null {
  if (
    !benchmark ||
    !isFiniteMetric(benchmark.lastValue) ||
    !isFiniteMetric(benchmark.low) ||
    !isFiniteMetric(benchmark.high) ||
    benchmark.high <= benchmark.low
  ) {
    return null;
  }
  return Math.min(100, Math.max(0, ((benchmark.lastValue - benchmark.low) / (benchmark.high - benchmark.low)) * 100));
}

export function tradingMarketDelta(row: ScreenerRow, benchmark: ScreenerBenchmark | null): number | null {
  if (!isFiniteMetric(row.percentChange) || !benchmark || !isFiniteMetric(benchmark.percentChange)) return null;
  return row.percentChange - benchmark.percentChange;
}

function topPercent(value: number | null | undefined, universe: Array<number | null | undefined>): number | null {
  if (!isFiniteMetric(value)) return null;
  const comparable = universe.filter(isFiniteMetric).sort((left, right) => right - left);
  if (!comparable.length) return null;
  const rank = comparable.findIndex((candidate) => candidate <= value) + 1;
  return Math.max(1, Math.ceil((rank / comparable.length) * 100));
}

function signed(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

export function buildTradingWhyReasons(
  row: ScreenerRow,
  benchmark: ScreenerBenchmark | null,
  universe: ScreenerRow[],
  maxReasons = 3,
): TradingWhyReason[] {
  const reasons: TradingWhyReason[] = [];
  const volumeRatio = resolveHonestVolumeRatio(row);
  const tradesRatio = resolveHonestTradesRatio(row);
  const relative = tradingMarketDelta(row, benchmark);
  const position = tradingDayPosition(row);
  const range = row.metrics.dayRangePct;

  if (isFiniteMetric(volumeRatio) && volumeRatio >= 1.2) {
    reasons.push({ code: "turnover-ratio", label: `оборот ${volumeRatio.toFixed(1)}× нормы`, tone: "attention" });
  }
  if (isFiniteMetric(tradesRatio) && tradesRatio >= 1.2) {
    reasons.push({ code: "trades-ratio", label: `сделки ${tradesRatio.toFixed(1)}×`, tone: "attention" });
  }
  if (isFiniteMetric(relative) && Math.abs(relative) >= 0.5) {
    reasons.push({
      code: "market-delta",
      label: `${signed(relative)} п.п. к ${benchmark?.code ?? "IMOEX"}`,
      tone: relative > 0 ? "positive" : "negative",
    });
  }
  if (isFiniteMetric(range) && Math.abs(range) >= 1) {
    reasons.push({ code: "day-range", label: `диапазон ${Math.abs(range).toFixed(1)}%`, tone: "attention" });
  }
  if (isFiniteMetric(position) && (position >= 75 || position <= 25)) {
    reasons.push({
      code: "range-position",
      label: `позиция ${position.toFixed(0)}% диапазона`,
      tone: position >= 75 ? "positive" : "negative",
    });
  }

  const turnoverTop = topPercent(row.turnover, universe.map((item) => item.turnover));
  if (turnoverTop != null && turnoverTop <= 20) {
    reasons.push({ code: "turnover-rank", label: `оборот — топ ${turnoverTop}% рынка`, tone: "neutral" });
  }
  const tradesTop = topPercent(row.tradesCount, universe.map((item) => item.tradesCount));
  if (tradesTop != null && tradesTop <= 20) {
    reasons.push({ code: "trades-rank", label: `сделки — топ ${tradesTop}% рынка`, tone: "neutral" });
  }

  const unique = new Map<string, TradingWhyReason>();
  for (const reason of reasons) {
    if (!unique.has(reason.code)) unique.set(reason.code, reason);
  }
  return [...unique.values()].slice(0, Math.max(1, maxReasons));
}
