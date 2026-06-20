/**
 * Expectation vs Fact — surprise, decision framing, tone-after-statement reads.
 */

import {
  calculateSurpriseBps,
  type CbrEventStatus,
  type CbrExpectationSource,
  type CbrRateEvent,
  type CbrTone,
} from "@/lib/domain/cbr-rate-events";

export type { CbrExpectationSource };

export const CBR_EXPECTATION_SOURCE_LABELS: Record<CbrExpectationSource, string> = {
  manual: "вручную",
  "broker-consensus": "консенсус брокеров",
  "futures-implied": "из фьючерсов",
  mock: "mock · учебный",
};

export type CbrExpectationDecisionId = "softer-than-expected" | "as-expected" | "harder-than-expected";

export const CBR_EXPECTATION_DECISION_LABELS: Record<CbrExpectationDecisionId, string> = {
  "softer-than-expected": "мягче ожиданий",
  "as-expected": "в рамках ожиданий",
  "harder-than-expected": "жёстче ожиданий",
};

export type CbrToneAfterStatementId =
  | "soft-fact-hard-comment"
  | "soft-fact-and-tone"
  | "neutral-fact-tone-matters"
  | "expected-decision-press-only";

export const CBR_TONE_AFTER_STATEMENT_LABELS: Record<CbrToneAfterStatementId, string> = {
  "soft-fact-hard-comment": "факт мягкий, комментарий жёсткий",
  "soft-fact-and-tone": "факт и тон мягкие",
  "neutral-fact-tone-matters": "факт нейтральный, тон важнее",
  "expected-decision-press-only": "решение ожидаемое, реакция только на пресс-конференцию",
};

/** Порог «в рамках ожиданий» — ±12 bps (0,12 п.п.). */
export const CBR_SURPRISE_NEUTRAL_THRESHOLD_BPS = 12;

export type CbrExpectationVsFactView = {
  previousRate: number;
  expectedRate: number | null;
  actualRate: number | null;
  surpriseBps: number | null;
  expectationSource: CbrExpectationSource;
  expectationSourceLabel: string;
  decisionId: CbrExpectationDecisionId | null;
  decisionLabel: string | null;
  toneAfterId: CbrToneAfterStatementId | null;
  toneAfterLabel: string | null;
  dayRiskRead: string;
  status: CbrEventStatus;
};

export function resolveExpectationDecisionId(
  surpriseBps: number | null,
): CbrExpectationDecisionId | null {
  if (surpriseBps == null) return null;
  if (surpriseBps <= -CBR_SURPRISE_NEUTRAL_THRESHOLD_BPS) return "softer-than-expected";
  if (surpriseBps >= CBR_SURPRISE_NEUTRAL_THRESHOLD_BPS) return "harder-than-expected";
  return "as-expected";
}

export function resolveExpectationDecisionLabel(surpriseBps: number | null): string | null {
  const id = resolveExpectationDecisionId(surpriseBps);
  return id ? CBR_EXPECTATION_DECISION_LABELS[id] : null;
}

export function resolveToneAfterStatementId(
  surpriseBps: number | null,
  tone: CbrTone | null,
  status: CbrEventStatus,
): CbrToneAfterStatementId | null {
  if (status === "upcoming" || tone == null || surpriseBps == null) return null;

  const decisionId = resolveExpectationDecisionId(surpriseBps);

  if (decisionId === "as-expected") {
    if (tone === "neutral") return "expected-decision-press-only";
    return "neutral-fact-tone-matters";
  }

  if (decisionId === "softer-than-expected") {
    if (tone === "hawkish") return "soft-fact-hard-comment";
    return "soft-fact-and-tone";
  }

  // жёстче ожиданий
  if (tone === "dovish") return "neutral-fact-tone-matters";
  if (tone === "hawkish") return "neutral-fact-tone-matters";
  return "soft-fact-and-tone";
}

export function resolveToneAfterStatementLabel(
  surpriseBps: number | null,
  tone: CbrTone | null,
  status: CbrEventStatus,
): string | null {
  const id = resolveToneAfterStatementId(surpriseBps, tone, status);
  return id ? CBR_TONE_AFTER_STATEMENT_LABELS[id] : null;
}

const DAY_RISK_BY_TONE_AFTER: Record<CbrToneAfterStatementId, string> = {
  "soft-fact-hard-comment":
    "Главный риск дня: первая реакция в 13:30 может быть ловушкой до комментариев в 15:00.",
  "soft-fact-and-tone":
    "Импульс после 13:30 и тон брифинга сонаправлены — следи, не выдыхается ли ход к закрытию.",
  "neutral-fact-tone-matters":
    "Главный риск дня: уровень ставки уже в цене — развязка в формулировках на пресс-конференции.",
  "expected-decision-press-only":
    "Решение заложено — смотри, даст ли 15:00 новый вектор или рынок останется в диапазоне.",
};

const DAY_RISK_UPCOMING =
  "До 13:30 зафиксируй ожидание рынка — без него surprise в bps не прочитается.";
const DAY_RISK_NO_EXPECTATION =
  "Ожидание не задано — введи ставку консенсуса вручную, иначе сюрприз не посчитать.";

export function buildExpectationDayRiskRead(input: {
  status: CbrEventStatus;
  expectedRate: number | null;
  toneAfterId: CbrToneAfterStatementId | null;
}): string {
  if (input.status === "upcoming") {
    return input.expectedRate == null ? DAY_RISK_NO_EXPECTATION : DAY_RISK_UPCOMING;
  }
  if (input.toneAfterId) return DAY_RISK_BY_TONE_AFTER[input.toneAfterId];
  if (input.expectedRate == null) return DAY_RISK_NO_EXPECTATION;
  return DAY_RISK_BY_TONE_AFTER["neutral-fact-tone-matters"];
}

export function buildExpectationVsFactView(event: CbrRateEvent): CbrExpectationVsFactView {
  const surpriseBps = event.surpriseBps ?? calculateSurpriseBps(event.expectedRate, event.actualRate);
  const expectationSource = event.expectationSource ?? "mock";
  const decisionId = resolveExpectationDecisionId(surpriseBps);
  const toneAfterId = resolveToneAfterStatementId(surpriseBps, event.tone, event.status);

  return {
    previousRate: event.previousRate,
    expectedRate: event.expectedRate,
    actualRate: event.actualRate,
    surpriseBps,
    expectationSource,
    expectationSourceLabel: CBR_EXPECTATION_SOURCE_LABELS[expectationSource],
    decisionId,
    decisionLabel: decisionId ? CBR_EXPECTATION_DECISION_LABELS[decisionId] : null,
    toneAfterId,
    toneAfterLabel: toneAfterId ? CBR_TONE_AFTER_STATEMENT_LABELS[toneAfterId] : null,
    dayRiskRead: buildExpectationDayRiskRead({
      status: event.status,
      expectedRate: event.expectedRate,
      toneAfterId,
    }),
    status: event.status,
  };
}
