import type { ScreenerRow } from "@screenerpro/shared";
import { classifyStockTradingState, stockTradingStateLabel } from "@/lib/domain/stock-trading-state";
import { computePositionInRange } from "@/lib/domain/stock-sparkline";
import { tradingFormat } from "@/lib/formatters/trading";

export type InstrumentInspectorCopy = {
  statusLabel: string;
  whyLines: string[];
  riskLines: string[];
  scenarioLine: string | null;
};

function spreadRiskLine(row: ScreenerRow): string | null {
  const turnover = row.turnover ?? 0;
  const trades = row.tradesCount ?? 0;
  if (trades <= 0) return "мало сделок — лента тонкая";
  if (turnover / trades > 6_000_000) return "широкий спред / крупная средняя сделка";
  return null;
}

export function buildInstrumentInspectorCopy(row: ScreenerRow, maxTurnover: number): InstrumentInspectorCopy {
  const state = classifyStockTradingState(row, maxTurnover);
  const position = computePositionInRange(row.lastPrice, row.low, row.high);
  const range = row.metrics.dayRangePct;
  const volX = row.metrics.volumeRatioNow ?? row.metrics.turnoverVsAverage;
  const tradesX = row.metrics.tradesRatioNow ?? row.metrics.tradesVsAverage;

  const why: string[] = [];
  if ((row.turnover ?? 0) > 0) {
    why.push(`оборот ${tradingFormat.formatTurnoverRub(row.turnover)}`);
  }
  if (range != null && Math.abs(range) >= 1) {
    why.push(`диапазон ${tradingFormat.formatDayRangeMagnitude(range)}`);
  }
  if ((row.tradesCount ?? 0) > 0) {
    why.push(`сделки ${tradingFormat.formatInteger(row.tradesCount ?? null)}`);
  }
  if (volX != null && volX >= 1.15) why.push(`Vol x ${volX.toFixed(1)}`);
  if (tradesX != null && tradesX >= 1.1) why.push(`Trades x ${tradesX.toFixed(1)}`);

  const risk: string[] = [];
  const spread = spreadRiskLine(row);
  if (spread) risk.push(spread);
  if (position != null && position >= 0.88) risk.push("движение уже у high дня");
  if (position != null && position <= 0.12) risk.push("у low дня — риск отскока/пробоя");
  if (state === "dangerous") risk.push("ликвидность не подтверждает движение");

  let scenario: string | null = null;
  if (state === "in_play" || state === "momentum") {
    scenario =
      position != null && position >= 0.8
        ? "смотреть реакцию на удержание high / возврат в диапазон"
        : "смотреть продолжение ленты и оборота";
  }

  return {
    statusLabel: stockTradingStateLabel(state),
    whyLines: why.slice(0, 3),
    riskLines: risk.slice(0, 2),
    scenarioLine: scenario,
  };
}

export function buildFutureInspectorCopy(row: ScreenerRow): InstrumentInspectorCopy {
  const turnover = row.turnover ?? 0;
  const trades = row.tradesCount ?? 0;
  const range = row.metrics.dayRangePct;

  const why: string[] = [];
  if (turnover > 0) why.push(`оборот ${tradingFormat.formatTurnoverRub(turnover)}`);
  if (trades > 0) why.push(`${tradingFormat.formatInteger(trades)} сделок`);
  if (range != null) why.push(`диапазон ${tradingFormat.formatDayRangeMagnitude(range)}`);

  const risk: string[] = [];
  if (turnover > 0 && trades < 80) risk.push("мало сделок для скальпа");
  if (Math.abs(row.percentChange ?? 0) >= 2 && turnover < 50_000_000) {
    risk.push("движение без подтверждения оборотом");
  }

  const active = turnover > 0 && trades > 50;
  return {
    statusLabel: active ? "Активный" : turnover > 0 ? "Осторожно" : "Мёртвый",
    whyLines: why.slice(0, 3),
    riskLines: risk.slice(0, 2),
    scenarioLine: active ? "основной контракт по ликвидности" : null,
  };
}
