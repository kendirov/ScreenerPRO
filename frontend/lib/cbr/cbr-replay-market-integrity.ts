/**
 * Guard рыночной аналитики replay: запрет смешивания MOEX и DEMO в выводах.
 */

import {
  instrumentsDataFromChartSlots,
  type CbrInstrumentChartIntegrity,
} from "@/lib/cbr/cbr-data-integrity";
import {
  keyReplaySlotIdsForMode,
  type CbrReplayMarketMode,
} from "@/lib/cbr/cbr-replay-market-mode";
import {
  buildReplayQualityMessage,
  getReplayDataQualityFromSlots,
  replayQualityToAvailabilityMode,
  type CbrReplayDataQualityResult,
} from "@/lib/cbr/cbr-replay-data-quality";
import type { CbrChartSlot, CbrChartSlotId } from "@/lib/domain/cbr-rate-chart-model";
import type { CbrDataStatus } from "@/lib/domain/cbr-rate-events";
import type {
  CbrInstrumentReactionMetrics,
  CbrReactionPatternId,
} from "@/lib/domain/cbr-rate-reaction-metrics";

export const CBR_FORBIDDEN_NON_LIVE_PHRASES = [
  "основная реакция пришла в акции",
  "банк сильнее рынка",
  "реакция только в валюте",
] as const;

export function isForbiddenMarketPhrase(text: string): boolean {
  const lower = text.toLowerCase();
  return CBR_FORBIDDEN_NON_LIVE_PHRASES.some((p) => lower.includes(p));
}

export function patternAllowedForLiveData(
  pattern: CbrReactionPatternId,
  row: Pick<CbrInstrumentReactionMetrics, "role" | "dataStatus" | "ticker">,
  peers: Array<Pick<CbrInstrumentReactionMetrics, "role" | "dataStatus" | "ticker">>,
): boolean {
  if (!metricIsMoexAnalyzable(row)) return false;

  const indexPeer = peers.find((p) => p.role === "index");
  const liveCurrencyPeers = peers.filter((p) => p.role === "currency" && metricIsMoexAnalyzable(p));

  switch (pattern) {
    case "currency-only":
      return (
        liveCurrencyPeers.length > 0 &&
        (row.role === "bank" || row.role === "heavy" || row.role === "active")
      );
    case "banks-beat-index":
      return (
        row.role === "bank" &&
        Boolean(indexPeer && metricIsMoexAnalyzable(indexPeer))
      );
    default:
      return true;
  }
}

export type CbrReplayMarketIntegrityStatus =
  | "all_live"
  | "partial_live"
  | "demo_mixed"
  | "no_data";

export type CbrReplayMarketIntegrity = {
  status: CbrReplayMarketIntegrityStatus;
  canBuildMarketConclusions: boolean;
  warning: string | null;
  replayMode: CbrReplayMarketMode;
  keyInstruments: CbrInstrumentChartIntegrity[];
  liveCount: number;
  demoCount: number;
  noDataCount: number;
};

export function isMoexAnalyzableDataStatus(status: CbrDataStatus): boolean {
  return status === "live" || status === "partial";
}

export function isDemoDataStatus(status: CbrDataStatus): boolean {
  return status === "fallback";
}

export function slotIsMoexAnalyzable(slot: Pick<CbrChartSlot, "dataStatus">): boolean {
  return isMoexAnalyzableDataStatus(slot.dataStatus);
}

export function metricIsMoexAnalyzable(row: Pick<CbrInstrumentReactionMetrics, "dataStatus">): boolean {
  return isMoexAnalyzableDataStatus(row.dataStatus);
}

export function filterAnalyzableReactionMetrics(
  rows: CbrInstrumentReactionMetrics[],
): CbrInstrumentReactionMetrics[] {
  return rows.filter(metricIsMoexAnalyzable);
}

export const CBR_DEMO_MIXED_WARNING =
  "Недостаточно данных MOEX для рыночного вывода.";

export const CBR_DEMO_PARTIAL_WARNING =
  "Часть инструментов без данных MOEX — рыночный вывод не строится.";

export const CBR_REPLAY_INSUFFICIENT_MESSAGE =
  "Недостаточно MOEX-данных для вывода. Replay не строится.";

export type CbrReplayAvailabilityMode = "full" | "partial" | "insufficient" | "no_data";

function availabilityModeFromQuality(
  quality: CbrReplayDataQualityResult["quality"],
): CbrReplayAvailabilityMode {
  return replayQualityToAvailabilityMode(quality);
}

export function buildReplayAvailabilityMessage(
  integrity: CbrReplayMarketIntegrity,
  dataQuality?: CbrReplayDataQualityResult | null,
): {
  mode: CbrReplayAvailabilityMode;
  message: string | null;
} {
  if (dataQuality) {
    return {
      mode: availabilityModeFromQuality(dataQuality.quality),
      message: buildReplayQualityMessage(dataQuality),
    };
  }

  const available = integrity.keyInstruments
    .filter((i) => i.status === "moex" || i.status === "partial")
    .map((i) => i.ticker);
  const missing = integrity.keyInstruments
    .filter((i) => i.status === "no_data" || i.status === "demo")
    .map((i) => i.ticker);

  if (integrity.liveCount < 2 || integrity.status === "no_data") {
    return { mode: "insufficient", message: CBR_REPLAY_INSUFFICIENT_MESSAGE };
  }

  if (integrity.status === "all_live" && missing.length === 0) {
    return { mode: "full", message: null };
  }

  if (available.length > 0 && missing.length > 0) {
    return {
      mode: "partial",
      message: `Доступны данные: ${available.join(", ")}. Нет данных: ${missing.join(", ")}. Вывод ограничен.`,
    };
  }

  if (integrity.status === "partial_live") {
    return { mode: "partial", message: integrity.warning };
  }

  return { mode: "insufficient", message: CBR_REPLAY_INSUFFICIENT_MESSAGE };
}

export function buildReplayAvailabilityFromSlots(
  event: Pick<{ date: string }, "date">,
  slots: CbrChartSlot[] | undefined,
  mode: CbrReplayMarketMode,
): {
  mode: CbrReplayAvailabilityMode;
  message: string | null;
  dataQuality: CbrReplayDataQualityResult;
} {
  const dataQuality = getReplayDataQualityFromSlots(event, slots, mode);
  return {
    dataQuality,
    ...buildReplayAvailabilityMessage(resolveReplayMarketIntegrity(slots, mode), dataQuality),
  };
}

export function resolveReplayMarketIntegrity(
  slots: CbrChartSlot[] | undefined,
  mode: CbrReplayMarketMode = "equities",
): CbrReplayMarketIntegrity {
  const keySlotIds = keyReplaySlotIdsForMode(mode);
  const instruments = instrumentsDataFromChartSlots(slots);
  const keyInstruments = instruments.filter((i) =>
    (keySlotIds as readonly string[]).includes(i.slotId as CbrChartSlotId),
  );

  const live = keyInstruments.filter((i) => i.status === "moex" || i.status === "partial");
  const demo = keyInstruments.filter((i) => i.status === "demo");
  const noData = keyInstruments.filter((i) => i.status === "no_data");

  let status: CbrReplayMarketIntegrityStatus;
  let warning: string | null = null;
  let canBuildMarketConclusions = false;

  if (live.length > 0 && demo.length > 0) {
    status = "demo_mixed";
    warning = CBR_DEMO_MIXED_WARNING;
  } else if (demo.length > 0) {
    status = "no_data";
    warning = CBR_DEMO_PARTIAL_WARNING;
  } else if (live.length === 0) {
    status = "no_data";
  } else if (live.length >= 2 && live.length === keyInstruments.length) {
    status = "all_live";
    canBuildMarketConclusions = true;
  } else if (live.length >= 2) {
    status = "partial_live";
    canBuildMarketConclusions = true;
  } else if (live.length === 1) {
    status = "partial_live";
    warning = "Недостаточно инструментов MOEX для рыночного вывода (нужно ≥ 2).";
  } else {
    status = "no_data";
  }

  return {
    status,
    canBuildMarketConclusions,
    warning,
    replayMode: mode,
    keyInstruments,
    liveCount: live.length,
    demoCount: demo.length,
    noDataCount: noData.length,
  };
}

export const CBR_REPLAY_MARKET_INTEGRITY_LABELS: Record<CbrReplayMarketIntegrityStatus, string> = {
  all_live: "все ключевые — MOEX",
  partial_live: "частично MOEX",
  demo_mixed: "MOEX + DEMO",
  no_data: "нет MOEX",
};
