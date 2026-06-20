/**
 * Data integrity guard для CBR replay — только реальные MOEX-свечи.
 * Demo/mock не участвуют в оценке качества, матрице и выводах.
 */

import { hasDecisionTimeCoverage, type CbrReactionCandle } from "@/lib/cbr/calculate-cbr-reaction";
import {
  benchmarkSlotIdForReplayMode,
  minLiveInstrumentsForFullReplay,
  type CbrReplayMarketMode,
} from "@/lib/cbr/cbr-replay-market-mode";
import type { CbrChartSlot, CbrChartSlotId } from "@/lib/domain/cbr-rate-chart-model";
import type { CbrDataStatus } from "@/lib/domain/cbr-rate-events";

export type CbrReplayDataQuality = "full_moex" | "partial_moex" | "insufficient" | "no_data";

export type CbrReplayQualityInstrument = {
  slotId: CbrChartSlotId;
  ticker: string;
  dataStatus: CbrDataStatus;
  candles: CbrReactionCandle[];
  placeholder?: boolean;
};

export type CbrReplayDataQualityResult = {
  quality: CbrReplayDataQuality;
  replayMode: CbrReplayMarketMode;
  benchmarkSlotId: CbrChartSlotId;
  liveCount: number;
  liveTickers: string[];
  missingTickers: string[];
  hasBenchmark: boolean;
  hasDecisionCoverage: boolean;
  canBuildFullReplay: boolean;
  canBuildLimitedReplay: boolean;
  canBuildConclusions: boolean;
  showCharts: boolean;
  showEmptyState: boolean;
};

export const CBR_REPLAY_NO_DATA_MESSAGE = "Нет MOEX-свечей за выбранный день.";

function isDemoOrMockDataStatus(status: CbrDataStatus): boolean {
  return status === "fallback" || status === "mock";
}

export function isRealMoexReplayInstrument(
  instrument: Pick<CbrReplayQualityInstrument, "dataStatus" | "candles" | "placeholder">,
): boolean {
  if (instrument.placeholder) return false;
  if (isDemoOrMockDataStatus(instrument.dataStatus)) return false;
  return (
    instrument.candles.length >= 2 &&
    (instrument.dataStatus === "live" || instrument.dataStatus === "partial")
  );
}

export function replayQualityInstrumentsFromSlots(
  slots: CbrChartSlot[] | undefined,
): CbrReplayQualityInstrument[] {
  if (!slots?.length) return [];
  return slots.map((slot) => ({
    slotId: slot.id,
    ticker: slot.ticker,
    dataStatus: slot.dataStatus,
    candles: slot.candles,
    placeholder: slot.placeholder,
  }));
}

export function getReplayDataQuality(
  event: Pick<{ date: string; decisionTime?: string }, "date">,
  instruments: CbrReplayQualityInstrument[],
  replayMode: CbrReplayMarketMode,
): CbrReplayDataQualityResult {
  const benchmarkSlotId = benchmarkSlotIdForReplayMode(replayMode);
  const modeInstruments = instruments.filter((i) => !i.placeholder);
  const live = modeInstruments.filter(isRealMoexReplayInstrument);
  const liveTickers = live.map((i) => i.ticker);
  const missingTickers = modeInstruments
    .filter((i) => !isRealMoexReplayInstrument(i))
    .map((i) => i.ticker);

  const benchmark = live.find((i) => i.slotId === benchmarkSlotId) ?? null;
  const hasBenchmark = benchmark != null;
  const hasDecisionCoverage =
    hasBenchmark && hasDecisionTimeCoverage(benchmark.candles, event.date.slice(0, 10));

  const liveCount = live.length;
  const minForFull = minLiveInstrumentsForFullReplay(replayMode);

  let quality: CbrReplayDataQuality;

  if (liveCount === 0) {
    quality = "no_data";
  } else if (!hasBenchmark || !hasDecisionCoverage || liveCount < 2) {
    quality = "insufficient";
  } else if (liveCount >= minForFull) {
    quality = "full_moex";
  } else {
    quality = "partial_moex";
  }

  return {
    quality,
    replayMode,
    benchmarkSlotId,
    liveCount,
    liveTickers,
    missingTickers,
    hasBenchmark,
    hasDecisionCoverage,
    canBuildFullReplay: quality === "full_moex",
    canBuildLimitedReplay: quality === "partial_moex",
    canBuildConclusions: quality === "full_moex" || quality === "partial_moex",
    showCharts: quality !== "no_data",
    showEmptyState: quality === "no_data",
  };
}

export function getReplayDataQualityFromSlots(
  event: Pick<{ date: string }, "date">,
  slots: CbrChartSlot[] | undefined,
  replayMode: CbrReplayMarketMode,
): CbrReplayDataQualityResult {
  return getReplayDataQuality(event, replayQualityInstrumentsFromSlots(slots), replayMode);
}

export function buildReplayQualityMessage(result: CbrReplayDataQualityResult): string | null {
  if (result.quality === "no_data") return CBR_REPLAY_NO_DATA_MESSAGE;
  if (result.quality === "insufficient") {
    return "Недостаточно MOEX-данных для вывода. Replay не строится.";
  }
  if (result.quality === "partial_moex" && result.liveTickers.length > 0) {
    const missing =
      result.missingTickers.length > 0 ? result.missingTickers.join(", ") : "часть инструментов";
    return `Доступны данные: ${result.liveTickers.join(", ")}. Нет данных: ${missing}. Вывод ограничен.`;
  }
  return null;
}

export function replayQualityToAvailabilityMode(
  quality: CbrReplayDataQuality,
): "full" | "partial" | "insufficient" | "no_data" {
  if (quality === "full_moex") return "full";
  if (quality === "partial_moex") return "partial";
  if (quality === "no_data") return "no_data";
  return "insufficient";
}

export function replayQualityToChartsDisplay(
  quality: CbrReplayDataQuality,
): "MOEX" | "partial" | "no data" {
  if (quality === "full_moex") return "MOEX";
  if (quality === "partial_moex") return "partial";
  return "no data";
}
