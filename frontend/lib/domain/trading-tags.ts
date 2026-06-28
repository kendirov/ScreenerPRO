import type { ScreenerRow } from "@screenerpro/shared";
import { computePositionInRange } from "@/lib/domain/stock-sparkline";
import { classifyStockTradingState } from "@/lib/domain/stock-trading-state";

export type TradingTagTone = "risk" | "in_play" | "liquidity" | "movement" | "neutral" | "dead";

export type TradingTag = {
  key: string;
  label: string;
  tone: TradingTagTone;
  explanation: string;
  priority: number;
};

function spreadPctProxy(row: ScreenerRow): number | null {
  const turnover = row.turnover ?? 0;
  const trades = row.tradesCount ?? 0;
  if (trades <= 0 || turnover <= 0) return null;
  return (turnover / trades / (row.lastPrice ?? 1)) * 0.0001;
}

export function buildTradingTags(row: ScreenerRow, maxTurnover: number): TradingTag[] {
  const tags: TradingTag[] = [];
  const turnoverPct = row.metrics.turnoverPercentile ?? 0;
  const tradesPct = row.metrics.tradesPercentile ?? 0;
  const range = Math.abs(row.metrics.dayRangePct ?? 0);
  const volX = row.metrics.volumeRatioNow ?? row.metrics.turnoverVsAverage;
  const tradesX = row.metrics.tradesRatioNow ?? row.metrics.tradesVsAverage;
  const position = computePositionInRange(row.lastPrice, row.low, row.high);
  const spread = spreadPctProxy(row);
  const state = classifyStockTradingState(row, maxTurnover);

  if (state === "dangerous") {
    tags.push({
      key: "spread-risk",
      label: "spread risk",
      tone: "risk",
      explanation: "Движение есть, но условия для скальпа сомнительные",
      priority: 100,
    });
  }

  if (state === "in_play") {
    tags.push({
      key: "in-play",
      label: "в игре",
      tone: "in_play",
      explanation: "Высокая активность: деньги + лента + ход",
      priority: 90,
    });
  }

  if (turnoverPct >= 70 || (row.turnover ?? 0) >= maxTurnover * 0.08) {
    tags.push({
      key: "money",
      label: "деньги",
      tone: "liquidity",
      explanation: "Высокий оборот относительно рынка",
      priority: 70,
    });
  }

  if (tradesPct >= 65 || (row.tradesCount ?? 0) >= 8_000) {
    tags.push({
      key: "tape",
      label: "лента",
      tone: "liquidity",
      explanation: "Много сделок — лента живая",
      priority: 68,
    });
  }

  if (volX != null && volX >= 1.25) {
    tags.push({
      key: "vol-x",
      label: "vol x",
      tone: "movement",
      explanation: "Оборот выше intraday-нормы",
      priority: 62,
    });
  }

  if (tradesX != null && tradesX >= 1.2) {
    tags.push({
      key: "trades-x",
      label: "сделки x",
      tone: "movement",
      explanation: "Сделки выше нормы сессии",
      priority: 60,
    });
  }

  if (range >= 2.2) {
    tags.push({
      key: "range",
      label: "range",
      tone: "movement",
      explanation: "Широкий диапазон дня",
      priority: 58,
    });
  }

  if (position != null && position >= 0.85) {
    tags.push({
      key: "high",
      label: "high",
      tone: "movement",
      explanation: "Цена у максимума дня",
      priority: 55,
    });
  } else if (position != null && position <= 0.15) {
    tags.push({
      key: "low",
      label: "low",
      tone: "movement",
      explanation: "Цена у минимума дня",
      priority: 55,
    });
  }

  if (spread != null && spread <= 0.08) {
    tags.push({
      key: "spread-ok",
      label: "spread ok",
      tone: "liquidity",
      explanation: "Спред в норме для ликвидной бумаги",
      priority: 45,
    });
  } else if (spread != null && spread > 0.15) {
    tags.push({
      key: "spread-risk",
      label: "spread risk",
      tone: "risk",
      explanation: "Широкий спред / тонкая лента",
      priority: 95,
    });
  }

  if ((row.tradesCount ?? 0) < 800 && (row.turnover ?? 0) < maxTurnover * 0.01) {
    tags.push({
      key: "thin",
      label: "thin",
      tone: "risk",
      explanation: "Мало сделок — тонкая ликвидность",
      priority: 88,
    });
  }

  if (state === "active") {
    tags.push({
      key: "watch",
      label: "watch",
      tone: "neutral",
      explanation: "Активность есть, но ещё не HARD in-play",
      priority: 40,
    });
  }

  if (state === "dead") {
    tags.push({
      key: "dead",
      label: "dead",
      tone: "dead",
      explanation: "Нет заметной активности",
      priority: 10,
    });
  }

  const merged = new Map<string, TradingTag>();
  for (const tag of tags.sort((a, b) => b.priority - a.priority)) {
    if (!merged.has(tag.key)) merged.set(tag.key, tag);
  }
  return [...merged.values()].sort((a, b) => b.priority - a.priority);
}

export function mergeTradingTags(row: ScreenerRow, maxTurnover: number, limit = 5): TradingTag[] {
  const fromMetrics = buildTradingTags(row, maxTurnover);
  const legacy = (row.metrics.inPlayTags ?? [])
    .filter((t) => t !== "IN_PLAY")
    .map(
      (tag): TradingTag => ({
        key: `legacy-${tag}`,
        label: tag.toLowerCase(),
        tone: "in_play",
        explanation: "Сигнал in-play",
        priority: 50,
      }),
    );
  const all = [...fromMetrics, ...legacy];
  const seen = new Set<string>();
  return all
    .sort((a, b) => b.priority - a.priority)
    .filter((t) => {
      if (seen.has(t.label)) return false;
      seen.add(t.label);
      return true;
    })
    .slice(0, limit);
}
