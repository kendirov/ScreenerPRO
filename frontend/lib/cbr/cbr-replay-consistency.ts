/**
 * Проверка согласованности market replay: одна дата, одно окно, честные выводы.
 */

import {
  formatMskTimeLabel,
  getEventWindow,
  type CbrEventWindow,
} from "@/lib/domain/cbr-rate-event-window";
import type { CbrChartSlot, CbrReactionChartGridModel } from "@/lib/domain/cbr-rate-chart-model";
import type { CbrRateEvent } from "@/lib/cbr/cbr-rate-events";
import type { CbrReplayMarketMode } from "@/lib/cbr/cbr-replay-market-mode";
import { keyReplaySlotIdsForMode } from "@/lib/cbr/cbr-replay-market-mode";
import {
  isDemoDataStatus,
  metricIsMoexAnalyzable,
  slotIsMoexAnalyzable,
} from "@/lib/cbr/cbr-replay-market-integrity";
import type { CbrInstrumentReactionMetrics } from "@/lib/domain/cbr-rate-reaction-metrics";
import { analyzeReplayLiveCoverage } from "@/lib/cbr/cbr-replay-market-output";

export type CbrReplayConsistencyStatus =
  | "consistent_moex"
  | "partial_moex"
  | "demo_mixed";

export type CbrReplayChartSeries = {
  eventId: string;
  eventDate: string;
  replayMode: CbrReplayMarketMode;
  window: CbrEventWindow;
  slots: CbrChartSlot[];
};

export type CbrReplayConsistencyChecks = {
  sameEventDate: boolean;
  windowsAligned: boolean;
  demoExcludedFromSummary: boolean;
};

export type CbrReplayConsistencyConstraints = {
  canCompareStocksToIndex: boolean;
  canBuildEquityMarketRead: boolean;
  usesIndexFutures: boolean;
  indexLabel: string;
};

export type CbrReplayConsistencyResult = {
  status: CbrReplayConsistencyStatus;
  statusLine: string;
  canBuildMarketSummary: boolean;
  issues: string[];
  checks: CbrReplayConsistencyChecks;
  constraints: CbrReplayConsistencyConstraints;
  equityDivergenceRead: string | null;
  analyzableMetrics: CbrInstrumentReactionMetrics[];
};

export const CBR_REPLAY_CONSISTENCY_STATUS_LINES: Record<CbrReplayConsistencyStatus, string> = {
  consistent_moex: "Данные согласованы: MOEX",
  partial_moex: "Частично MOEX: выводы ограничены",
  demo_mixed: "MOEX + DEMO: выводы отключены",
};

export const CBR_EQUITY_DIVERGENCE_READ_ALL_REAL =
  "точечный спрос в SBER/GAZP при слабом широком индексе";

export const CBR_EQUITY_DIVERGENCE_READ_DEMO =
  "расхождение не анализируется: часть данных demo";

const WINDOW_TOLERANCE_SEC = 5 * 60;
const DIVERGENCE_MOVE_THRESHOLD_PCT = 0.05;

/** Слоты с иным режимом торгов — допускаем фактическое окно внутри сессии. */
const SLOT_ACTUAL_WINDOW_OK: Partial<Record<string, boolean>> = {
  bonds: true,
};

export function chartModelToReplaySeries(
  model: CbrReactionChartGridModel,
  eventDate: string,
): CbrReplayChartSeries {
  return {
    eventId: model.eventId,
    eventDate,
    replayMode: model.replayMode,
    window: model.window,
    slots: model.slots,
  };
}

function candleSpan(slot: CbrChartSlot): { min: number; max: number } | null {
  if (slot.candles.length < 2) return null;
  let min = slot.candles[0]!.time;
  let max = slot.candles[0]!.time;
  for (const c of slot.candles) {
    if (c.time < min) min = c.time;
    if (c.time > max) max = c.time;
  }
  return { min, max };
}

function slotWithinExpectedWindow(
  slot: CbrChartSlot,
  window: CbrEventWindow,
): boolean {
  const span = candleSpan(slot);
  if (!span) return true;

  if (SLOT_ACTUAL_WINDOW_OK[slot.id]) {
    return span.min >= window.startUnix && span.max <= window.endUnix;
  }

  return (
    span.min >= window.startUnix - WINDOW_TOLERANCE_SEC &&
    span.max <= window.endUnix + WINDOW_TOLERANCE_SEC
  );
}

function windowsAligned(slots: CbrChartSlot[]): boolean {
  const live = slots.filter((s) => slotIsMoexAnalyzable(s) && s.candles.length >= 2);
  if (live.length < 2) return true;

  const spans = live.map((s) => candleSpan(s)).filter((s): s is { min: number; max: number } => s != null);
  if (spans.length < 2) return true;

  const ref = spans[0]!;
  return spans.every(
    (s) =>
      Math.abs(s.min - ref.min) <= WINDOW_TOLERANCE_SEC &&
      Math.abs(s.max - ref.max) <= WINDOW_TOLERANCE_SEC,
  );
}

function indexSlotId(mode: CbrReplayMarketMode): string | null {
  if (mode === "derivatives") return "mx-futures";
  if (mode === "equities") return "equity-index";
  return null;
}

function resolveIndexLabel(mode: CbrReplayMarketMode, slots: CbrChartSlot[]): string {
  if (mode === "derivatives") {
    return "фьючерс на индекс";
  }
  if (mode === "currency") {
    return "валюта";
  }
  const indexSlot = slots.find((s) => s.id === "equity-index");
  if (indexSlot?.id === "mx-futures") {
    return "фьючерс на индекс";
  }
  return "индекс МосБиржи";
}

function metricByTicker(
  metrics: CbrInstrumentReactionMetrics[],
  ticker: string,
): CbrInstrumentReactionMetrics | undefined {
  return metrics.find((m) => m.ticker.toUpperCase() === ticker.toUpperCase());
}

function stockMetrics(metrics: CbrInstrumentReactionMetrics[]): CbrInstrumentReactionMetrics[] {
  return metrics.filter((m) => m.role === "bank" || m.role === "heavy" || m.role === "active");
}

function detectEquityDivergence(
  metrics: CbrInstrumentReactionMetrics[],
  mode: CbrReplayMarketMode,
): { detected: boolean; allReal: boolean } {
  if (mode !== "equities") {
    return { detected: false, allReal: false };
  }

  const index = metrics.find((m) => m.role === "index");
  const sber = metricByTicker(metrics, "SBER") ?? metrics.find((m) => m.role === "bank");
  const gazp = metricByTicker(metrics, "GAZP");

  if (!index || !sber || !gazp) {
    return { detected: false, allReal: false };
  }

  const sberUp = (sber.reactionDayPct ?? 0) > DIVERGENCE_MOVE_THRESHOLD_PCT;
  const gazpUp = (gazp.reactionDayPct ?? 0) > DIVERGENCE_MOVE_THRESHOLD_PCT;
  const indexDown = (index.reactionDayPct ?? 0) < -DIVERGENCE_MOVE_THRESHOLD_PCT;

  const detected = sberUp && gazpUp && indexDown;
  const involved = [index, sber, gazp];
  const allReal = involved.every(metricIsMoexAnalyzable);

  return { detected, allReal };
}

export function validateReplayConsistency(
  event: Pick<CbrRateEvent, "id" | "date">,
  chartSeries: CbrReplayChartSeries | null | undefined,
  reactionMetrics: CbrInstrumentReactionMetrics[],
): CbrReplayConsistencyResult {
  const issues: string[] = [];
  const replayMode = chartSeries?.replayMode ?? "equities";
  const window = chartSeries?.window ?? getEventWindow(event.date);
  const slots = chartSeries?.slots ?? [];

  const sameEventDate =
    Boolean(chartSeries) &&
    chartSeries!.eventId === event.id &&
    chartSeries!.eventDate.slice(0, 10) === event.date.slice(0, 10) &&
    window.date.slice(0, 10) === event.date.slice(0, 10);

  if (!sameEventDate) {
    issues.push("графики не привязаны к выбранной дате заседания");
  }

  const keySlotIds = keyReplaySlotIdsForMode(replayMode);
  const keySlots = slots.filter((s) => (keySlotIds as readonly string[]).includes(s.id));

  const liveKeySlots = keySlots.filter((s) => slotIsMoexAnalyzable(s) && s.candles.length >= 2);
  const demoKeySlots = keySlots.filter(
    (s) => isDemoDataStatus(s.dataStatus) && !s.placeholder && s.candles.length >= 2,
  );

  const windowsOk =
    liveKeySlots.every((s) => slotWithinExpectedWindow(s, window)) && windowsAligned(liveKeySlots);

  if (!windowsOk && liveKeySlots.length > 0) {
    const misaligned = liveKeySlots.filter((s) => !slotWithinExpectedWindow(s, window));
    if (misaligned.length) {
      issues.push(
        `окно свечей вне 10:00–19:00 МСК: ${misaligned.map((s) => s.ticker).join(", ")}`,
      );
    } else {
      const spans = liveKeySlots.map((s) => candleSpan(s)).filter(Boolean) as Array<{
        min: number;
        max: number;
      }>;
      if (spans.length >= 2) {
        const ref = spans[0]!;
        const outlier = liveKeySlots.find((s, i) => {
          const span = spans[i];
          if (!span) return false;
          return (
            Math.abs(span.min - ref.min) > WINDOW_TOLERANCE_SEC ||
            Math.abs(span.max - ref.max) > WINDOW_TOLERANCE_SEC
          );
        });
        if (outlier) {
          issues.push(
            `разные окна графиков: ${outlier.ticker} (${formatMskTimeLabel(spans[liveKeySlots.indexOf(outlier)]!.min)}–${formatMskTimeLabel(spans[liveKeySlots.indexOf(outlier)]!.max)})`,
          );
        }
      }
    }
  }

  const analyzableMetrics = reactionMetrics.filter(metricIsMoexAnalyzable);
  const demoExcludedFromSummary = reactionMetrics.every(
    (m) => metricIsMoexAnalyzable(m) || isDemoDataStatus(m.dataStatus),
  );

  const indexMetric = reactionMetrics.find((m) => m.role === "index");
  const stocks = stockMetrics(reactionMetrics);
  const stocksWithData = stocks.filter(
    (m) =>
      m.reactionDayPct != null ||
      m.reaction30mPct != null ||
      m.reaction5mPct != null,
  );
  const stocksLive = stocksWithData.some(metricIsMoexAnalyzable);
  const stocksDemo = stocksWithData.some((m) => isDemoDataStatus(m.dataStatus));
  const indexLive = Boolean(indexMetric && metricIsMoexAnalyzable(indexMetric));
  const indexDemoOrMissing = !indexMetric || !metricIsMoexAnalyzable(indexMetric);

  const usesIndexFutures = replayMode === "derivatives";
  const indexLabel = resolveIndexLabel(replayMode, slots);

  let canCompareStocksToIndex = replayMode === "equities";
  if (replayMode === "equities" && indexLive && stocksDemo) {
    canCompareStocksToIndex = false;
    issues.push("индекс MOEX, акции demo — сравнение с индексом отключено");
  }

  let canBuildEquityMarketRead = replayMode === "equities";
  if (replayMode === "equities" && stocksLive && indexDemoOrMissing) {
    canBuildEquityMarketRead = false;
    issues.push("акции MOEX без индекса — вывод по рынку акций не строится");
  }

  const divergence = detectEquityDivergence(reactionMetrics, replayMode);
  let equityDivergenceRead: string | null = null;
  if (divergence.detected) {
    equityDivergenceRead = divergence.allReal
      ? CBR_EQUITY_DIVERGENCE_READ_ALL_REAL
      : CBR_EQUITY_DIVERGENCE_READ_DEMO;
  }

  const hasDemoMixed = liveKeySlots.length > 0 && demoKeySlots.length > 0;
  const allDemo =
    keySlots.length > 0 &&
    liveKeySlots.length === 0 &&
    keySlots.every(
      (s) =>
        isDemoDataStatus(s.dataStatus) &&
        !s.placeholder &&
        s.candles.length >= 2,
    );

  const liveCoverage = analyzeReplayLiveCoverage(reactionMetrics, replayMode);

  const allowsPartialRead =
    replayMode === "currency" ||
    liveCoverage.scope === "currency_only" ||
    liveCoverage.scope === "currency_market" ||
    liveCoverage.scope === "equities_market" ||
    liveCoverage.scope === "derivatives_market" ||
    (liveCoverage.replayMode === "equities" &&
      Boolean(liveCoverage.liveIndexTicker) &&
      liveCoverage.demoSegments.includes("акции")) ||
    (liveCoverage.replayMode === "equities" &&
      liveCoverage.liveStockTickers.length > 0 &&
      liveCoverage.demoSegments.includes("индекс"));

  let status: CbrReplayConsistencyStatus;
  if (allDemo) {
    status = "demo_mixed";
  } else if (hasDemoMixed && !allowsPartialRead) {
    status = "demo_mixed";
  } else if (
    liveKeySlots.length > 0 &&
    sameEventDate &&
    windowsOk &&
    canBuildEquityMarketRead &&
    canCompareStocksToIndex &&
    issues.length === 0 &&
    !hasDemoMixed
  ) {
    status = "consistent_moex";
  } else {
    status = "partial_moex";
  }

  const canBuildMarketSummary =
    status !== "demo_mixed" &&
    analyzableMetrics.length > 0 &&
    (replayMode === "currency" ||
      allowsPartialRead ||
      (replayMode === "equities" && canBuildEquityMarketRead));

  return {
    status,
    statusLine: CBR_REPLAY_CONSISTENCY_STATUS_LINES[status],
    canBuildMarketSummary,
    issues,
    checks: {
      sameEventDate,
      windowsAligned: windowsOk,
      demoExcludedFromSummary,
    },
    constraints: {
      canCompareStocksToIndex,
      canBuildEquityMarketRead,
      usesIndexFutures,
      indexLabel,
    },
    equityDivergenceRead,
    analyzableMetrics,
  };
}
