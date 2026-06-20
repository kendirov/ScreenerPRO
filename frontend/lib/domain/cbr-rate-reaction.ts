/**
 * Presentation helpers for CBR rate reaction lab UI.
 * Domain model — `cbr-rate-events.ts`.
 */

import { getCbrRateEvents } from "@/lib/domain/cbr-rate-events";

export type {
  CbrDataStatus,
  CbrDecisionType,
  CbrEventStatus,
  CbrExpectationSource,
  CbrInstrumentReaction,
  CbrInstrumentRole,
  CbrMarketType,
  CbrRateEvent,
  CbrTone,
} from "@/lib/domain/cbr-rate-events";

export {
  CBR_DECISION_LABELS,
  calculateSurpriseBps,
  cbrDataStatusLabel,
  collectTraderReads,
  enrichCbrRateEvent,
  filterCbrRateEvents,
  getCbrRateEventById,
  getCbrRateEvents,
  resolveDecisionType,
  resolveToneLabel,
} from "@/lib/domain/cbr-rate-events";

export {
  buildCbrReactionChartGridModel,
  buildCbrReactionChartGridSkeleton,
  resolveCbrInstrumentSpecs,
  CBR_CHART_TIMEFRAMES,
  CBR_CHART_TIMEFRAME_LABELS,
} from "@/lib/domain/cbr-rate-chart-model";

export { fetchCbrRateCandlesFromApi } from "@/lib/domain/cbr-rate-candles-client";

export {
  buildReactionMatrixFromChartSlots,
  calculateDayRange,
  calculateVolumeInWindow,
  calculateVolumeInWindowMsk,
  calculateVolumeRatio,
  calculateWindowReturn,
  calculateWindowReturnMsk,
  classifyReactionPattern,
  computeInstrumentReactionMetrics,
  CBR_COMPACT_PATTERN_INCOMPLETE,
  CBR_REACTION_PATTERN_LABELS,
  CBR_COMPACT_PATTERN_NO_DATA,
  CBR_REACTION_WINDOWS,
  CBR_REACTION_WINDOW_BY_ID,
  slotIdToRole,
  type CbrInstrumentReactionMetrics,
  type CbrReactionPatternId,
  type CbrReactionPeerSnapshot,
  type CbrReactionWindowId,
  type CbrRateCandle,
} from "@/lib/domain/cbr-rate-reaction-metrics";

export {
  buildExpectationDayRiskRead,
  buildExpectationVsFactView,
  CBR_EXPECTATION_DECISION_LABELS,
  CBR_EXPECTATION_SOURCE_LABELS,
  CBR_SURPRISE_NEUTRAL_THRESHOLD_BPS,
  CBR_TONE_AFTER_STATEMENT_LABELS,
  resolveExpectationDecisionId,
  resolveExpectationDecisionLabel,
  resolveToneAfterStatementId,
  resolveToneAfterStatementLabel,
  type CbrExpectationDecisionId,
  type CbrExpectationVsFactView,
  type CbrToneAfterStatementId,
} from "@/lib/domain/cbr-rate-expectation";

export {
  buildStatementBriefView,
  CBR_STATEMENT_SOURCE_LABELS,
  CBR_WATCHLIST_IMPACT_LABELS,
  CBR_WATCHLIST_IMPACT_SLOTS,
  CBR_WATCHLIST_IMPACT_TICKERS,
  collectWatchlistImpactsForPhrase,
  type CbrStatementBrief,
  type CbrStatementBriefView,
  type CbrStatementPhraseBrief,
  type CbrStatementSource,
  type CbrWatchlistImpactSlot,
} from "@/lib/domain/cbr-rate-statement-translation";

export { getEventWindow } from "@/lib/domain/cbr-rate-event-window";

export {
  buildCockpitInsights,
  buildInstrumentInspector,
  CBR_COCKPIT_BAR_MODE_LABELS,
  CBR_COCKPIT_PHASE_BY_ID,
  CBR_COCKPIT_PHASES,
  matrixColumnActive,
  phaseHighlightPercents,
  phaseWindowId,
  resolveDataProvenanceLabel,
  resolvePhaseHighlightUnix,
  type CbrCockpitBarMode,
  type CbrCockpitInsight,
  type CbrCockpitInsightKind,
  type CbrCockpitPhase,
  type CbrCockpitPhaseId,
  type CbrInstrumentInspectorView,
} from "@/lib/domain/cbr-rate-cockpit";

export {
  buildEventPlayersSnapshotFromIngest,
  CBR_EVENT_PLAYER_SIGNAL_LABELS,
  CBR_EVENT_PLAYER_TAGS,
  CBR_EVENT_PLAYERS_SECTION_LABELS,
  CBR_EVENT_PLAYERS_SOURCE_LABELS,
  countEventPlayers,
  formatCbrEventPlayerRangePct,
  getCbrEventPlayersSnapshot,
  type CbrEventPlayerRow,
  type CbrEventPlayerSignalKind,
  type CbrEventPlayerTag,
  type CbrEventPlayersIngestRow,
  type CbrEventPlayersSection,
  type CbrEventPlayersSectionId,
  type CbrEventPlayersSnapshot,
  type CbrEventPlayersSource,
} from "@/lib/domain/cbr-rate-event-players";

export {
  buildCbrRateReactionSummary,
  buildConfirmationSentence,
  buildFactSentence,
  buildReactionSentence,
  buildReplaySummary,
  type CbrRateReactionSummary,
} from "@/lib/domain/cbr-rate-reaction-summary";

export {
  CBR_COMPACT_MATRIX_ROWS,
  CBR_REPLAY_MATRIX_SLOTS,
  CBR_REPLAY_YEARS,
  formatMeetingCardDate,
  formatRateChangeBps,
  formatToneCard,
  groupCbrRateEventsByYear,
  pickCompactMatrixRows,
  pickReplayMatrixRows,
  resolveCompactMatrixPattern,
  resolveReplayDataBadge,
  surpriseFromEvent,
  TONE_CARD_LABELS,
  type CbrReplayDataBadge,
  type CbrReplaySummary,
  type CbrReplayYear,
} from "@/lib/domain/cbr-rate-replay";

export {
  buildDataIntegrityView,
  getDataIntegrityCaption,
  getDataIntegrityStatus,
  instrumentsDataFromChartSlots,
  type CbrDataIntegrityStatus,
  type CbrDataIntegrityView,
  type CbrInstrumentChartIntegrity,
} from "@/lib/cbr/cbr-data-integrity";

export type CbrTimelinePhaseKind = "open" | "decision" | "press" | "final" | "close";

export type CbrTimelinePhase = {
  timeMsk: string;
  label: string;
  hint: string;
  kind: CbrTimelinePhaseKind;
  offsetMin: number;
};

export const CBR_SESSION_TIMELINE: CbrTimelinePhase[] = [
  { timeMsk: "10:00", label: "Старт торгов", hint: "Позиционирование до решения", kind: "open", offsetMin: 0 },
  { timeMsk: "13:30", label: "Решение ЦБ", hint: "Факт ключевой ставки", kind: "decision", offsetMin: 210 },
  { timeMsk: "15:00", label: "Пресс-конференция", hint: "Тон и формулировки", kind: "press", offsetMin: 300 },
  { timeMsk: "18:45", label: "Финальная фаза", hint: "Перекладка перед закрытием", kind: "final", offsetMin: 525 },
  { timeMsk: "19:00", label: "Закрытие сессии", hint: "Итог дня по реакции", kind: "close", offsetMin: 540 },
];

export function buildEventTimeline(event: {
  decisionTime: string;
  pressConferenceTime: string;
}): CbrTimelinePhase[] {
  return CBR_SESSION_TIMELINE.map((phase) => {
    if (phase.kind === "decision") {
      return { ...phase, timeMsk: event.decisionTime };
    }
    if (phase.kind === "press") {
      return { ...phase, timeMsk: event.pressConferenceTime };
    }
    return phase;
  });
}

export function formatCbrEventDate(dateIso: string): string {
  return new Date(`${dateIso}T12:00:00`).toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** @deprecated — use formatCbrEventDate */
export const formatCbrMeetingDate = formatCbrEventDate;

export function formatRatePct(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(1).replace(".", ",")}%`;
}

export function formatSurpriseBps(value: number | null): string {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value} bps`;
}

export function formatReactionPct(value: number | null): string {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatVolumeRatio(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}×`;
}

export function formatVolatilityRatio(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}×`;
}

export type CbrRateReactionBundle = {
  events: ReturnType<typeof getCbrRateEvents>;
  fetchedAt: string | null;
};

export function getCbrRateReactionBundle(): CbrRateReactionBundle {
  return {
    events: getCbrRateEvents(),
    fetchedAt: null,
  };
}
