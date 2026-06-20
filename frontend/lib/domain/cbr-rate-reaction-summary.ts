/**
 * Трейдерское чтение реакции — 3 короткие строки под графиками.
 */

import { getCbrRateEventById } from "@/lib/cbr/cbr-rate-events";
import { CBR_SURPRISE_NEUTRAL_BPS } from "@/lib/cbr/cbr-rate-events";
import { CBR_DECISION_LABELS, calculateSurpriseBps } from "@/lib/domain/cbr-rate-events";
import type { CbrRateEvent } from "@/lib/domain/cbr-rate-events";
import { buildExpectationVsFactView } from "@/lib/domain/cbr-rate-expectation";
import type { CbrInstrumentReactionMetrics } from "@/lib/domain/cbr-rate-reaction-metrics";
import {
  CBR_DEMO_MIXED_WARNING,
  buildReplayAvailabilityMessage,
  CBR_REPLAY_INSUFFICIENT_MESSAGE,
  filterAnalyzableReactionMetrics,
  type CbrReplayAvailabilityMode,
  type CbrReplayMarketIntegrity,
} from "@/lib/cbr/cbr-replay-market-integrity";
import type { CbrReplayDataQualityResult } from "@/lib/cbr/cbr-replay-data-quality";
import {
  buildReplayQualityMessage,
  replayQualityToAvailabilityMode,
} from "@/lib/cbr/cbr-replay-data-quality";
import type { CbrReplayConsistencyResult } from "@/lib/cbr/cbr-replay-consistency";
import { CBR_REPLAY_CONSISTENCY_STATUS_LINES } from "@/lib/cbr/cbr-replay-consistency";
import {
  buildConstrainedConfirmation,
  buildConstrainedMarketReaction,
} from "@/lib/cbr/cbr-replay-market-output";
import type { CbrReplayMarketMode } from "@/lib/cbr/cbr-replay-market-mode";

export type CbrRateReactionSummary = {
  fact: string;
  reaction: string;
  confirmation: string;
  nextWatch: string;
  marketWarning: string | null;
  availabilityMode: CbrReplayAvailabilityMode | null;
  availabilityMessage: string | null;
  marketIntegrityStatus: CbrReplayMarketIntegrity["status"] | null;
  consistencyStatus: CbrReplayConsistencyResult["status"] | null;
  consistencyStatusLine: string | null;
};

function formatRatePct(rate: number): string {
  return `${rate.toFixed(1)}%`;
}

export function buildFactSentence(event: CbrRateEvent): string {
  if (event.status === "upcoming" || event.actualRate == null) {
    return "Заседание ещё не состоялось — факт ставки не объявлен.";
  }

  const actual = event.actualRate;
  const changeBps = Math.round((actual - event.previousRate) * 100);
  const decision = event.decisionType;

  let base: string;
  if (decision === "cut") {
    base = `ЦБ снизил ставку на ${Math.abs(changeBps)} б.п. до ${formatRatePct(actual)}.`;
  } else if (decision === "hike") {
    base = `ЦБ повысил ставку на ${changeBps} б.п. до ${formatRatePct(actual)}.`;
  } else if (decision === "hold") {
    base = `ЦБ сохранил ставку на уровне ${formatRatePct(actual)}.`;
  } else {
    base = `ЦБ объявил ставку ${formatRatePct(actual)} (${CBR_DECISION_LABELS.hold}).`;
  }

  if (event.expectedRate == null) {
    return `${base} Ожидание не задано.`;
  }

  const surprise =
    event.surpriseBps ?? calculateSurpriseBps(event.expectedRate, event.actualRate);
  if (surprise == null) {
    return `${base} Ожидание не задано.`;
  }

  if (Math.abs(surprise) < CBR_SURPRISE_NEUTRAL_BPS) {
    return `${base} В рамках ожиданий.`;
  }

  if (surprise < 0) {
    return `${base} Это было мягче ожиданий на ${Math.abs(surprise)} б.п.`;
  }

  return `${base} Это было жёстче ожиданий на ${surprise} б.п.`;
}

/** @deprecated use buildConstrainedMarketReaction */
export function buildReactionSentence(
  event: CbrRateEvent,
  reactionMetrics: CbrInstrumentReactionMetrics[],
  replayMode?: CbrReplayMarketMode,
  consistency?: Pick<
    CbrReplayConsistencyResult,
    "constraints" | "equityDivergenceRead" | "canBuildMarketSummary" | "status"
  > | null,
): string {
  return buildConstrainedMarketReaction(
    event,
    reactionMetrics,
    reactionMetrics.filter((m) => m.dataStatus === "live" || m.dataStatus === "partial"),
    replayMode ?? "equities",
    consistency,
  );
}

/** @deprecated use buildConstrainedConfirmation */
export function buildConfirmationSentence(
  event: CbrRateEvent,
  reactionMetrics: CbrInstrumentReactionMetrics[],
  replayMode: CbrReplayMarketMode = "equities",
  consistency?: Pick<CbrReplayConsistencyResult, "status"> | null,
): string {
  const live = reactionMetrics.filter((m) => m.dataStatus === "live" || m.dataStatus === "partial");
  return buildConstrainedConfirmation(event, reactionMetrics, live, replayMode, consistency);
}

export function buildNextWatchSentence(
  event: CbrRateEvent,
  replayMode: CbrReplayMarketMode = "equities",
): string {
  const expectation = buildExpectationVsFactView(event);
  const canonical = getCbrRateEventById(event.id);
  const tickers =
    replayMode === "derivatives"
      ? "MX · Si · CNY"
      : replayMode === "currency"
        ? "USD/RUB · CNY/RUB"
        : "IMOEX · SBER · GAZP · VTBR";
  const windows = canonical?.pressConferenceTime ? "13:30 и 15:00" : "13:30";

  if (event.status === "upcoming") {
    return `${expectation.dayRiskRead} Смотреть ${tickers} в ${windows}.`;
  }

  return `${expectation.dayRiskRead} На следующем заседании — ${tickers}, окна ${windows}.`;
}

export function buildCbrRateReactionSummary(
  event: CbrRateEvent,
  reactionMetrics: CbrInstrumentReactionMetrics[],
  marketIntegrity?: CbrReplayMarketIntegrity | null,
  consistency?: CbrReplayConsistencyResult | null,
  dataQuality?: CbrReplayDataQualityResult | null,
): CbrRateReactionSummary {
  const replayMode = marketIntegrity?.replayMode ?? dataQuality?.replayMode ?? "equities";
  const analyzable = consistency?.analyzableMetrics ?? filterAnalyzableReactionMetrics(reactionMetrics);
  const integrityStatus = marketIntegrity?.status ?? null;
  const consistencyStatus = consistency?.status ?? null;
  const consistencyStatusLine =
    consistency?.statusLine ??
    (consistencyStatus ? CBR_REPLAY_CONSISTENCY_STATUS_LINES[consistencyStatus] : null);

  const availability = marketIntegrity
    ? buildReplayAvailabilityMessage(marketIntegrity, dataQuality)
    : dataQuality
      ? {
          mode: replayQualityToAvailabilityMode(dataQuality.quality),
          message: buildReplayQualityMessage(dataQuality),
        }
      : { mode: null as CbrReplayAvailabilityMode | null, message: null as string | null };

  let reaction: string;
  let confirmation: string;
  let marketWarning = marketIntegrity?.warning ?? null;

  const conclusionsBlocked =
    availability.mode === "insufficient" ||
    availability.mode === "no_data" ||
    dataQuality?.canBuildConclusions === false;

  if (conclusionsBlocked) {
    reaction = availability.message ?? CBR_REPLAY_INSUFFICIENT_MESSAGE;
    confirmation = "Подтверждение по рынку не строим — недостаточно MOEX-данных.";
    marketWarning = availability.message;
  } else if (availability.mode === "partial") {
    reaction = buildConstrainedMarketReaction(
      event,
      reactionMetrics,
      analyzable,
      replayMode,
      consistency,
    );
    confirmation = buildConstrainedConfirmation(
      event,
      reactionMetrics,
      analyzable,
      replayMode,
      consistency,
    );
    marketWarning = availability.message ?? marketWarning;
  } else {
    reaction = buildConstrainedMarketReaction(
      event,
      reactionMetrics,
      analyzable,
      replayMode,
      consistency,
    );
    confirmation = buildConstrainedConfirmation(
      event,
      reactionMetrics,
      analyzable,
      replayMode,
      consistency,
    );
  }

  return {
    fact: buildFactSentence(event),
    reaction,
    confirmation,
    nextWatch: buildNextWatchSentence(event, replayMode),
    marketWarning:
      integrityStatus === "demo_mixed" || consistencyStatus === "demo_mixed"
        ? marketWarning ?? CBR_DEMO_MIXED_WARNING
        : marketWarning,
    availabilityMode: availability.mode,
    availabilityMessage: availability.message,
    marketIntegrityStatus: integrityStatus,
    consistencyStatus,
    consistencyStatusLine,
  };
}

/** @deprecated use buildCbrRateReactionSummary */
export function buildReplaySummary(
  event: CbrRateEvent,
  reactionMetrics: CbrInstrumentReactionMetrics[],
): { whatHappened: string; mainReaction: string; postPressConfirmation: string } {
  const s = buildCbrRateReactionSummary(event, reactionMetrics);
  return {
    whatHappened: s.fact,
    mainReaction: s.reaction,
    postPressConfirmation: s.confirmation,
  };
}
