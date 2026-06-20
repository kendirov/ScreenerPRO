/**
 * Legacy domain types — UI/chart modules until full migration to @/lib/cbr.
 */

import type { CbrStatementBrief } from "@/lib/domain/cbr-rate-statement-translation";

export type CbrDataStatus = "mock" | "live" | "partial" | "fallback";

export type CbrEventStatus = "upcoming" | "past";

export type CbrDecisionType = "cut" | "hold" | "hike";

export type CbrTone = "dovish" | "neutral" | "hawkish";

export type CbrExpectationSource = "manual" | "broker-consensus" | "futures-implied" | "mock";

export type CbrMarketType = "futures" | "stock" | "index" | "bond";

export type CbrInstrumentRole = "currency" | "index" | "bank" | "heavy" | "bonds" | "active";

export type CbrInstrumentReaction = {
  ticker: string;
  title: string;
  marketType: CbrMarketType;
  role: CbrInstrumentRole;
  dataStatus: CbrDataStatus;
  reaction5mPct: number | null;
  reaction30mPct: number | null;
  reactionPostPressPct: number | null;
  reactionDayPct: number | null;
  volumeRatio: number | null;
  volatilityRatio: number | null;
  interpretationTag: string | null;
  traderRead: string | null;
};

export type CbrRateEvent = {
  id: string;
  date: string;
  title: string;
  status: CbrEventStatus;
  dataStatus: CbrDataStatus;
  decisionTime: string;
  pressConferenceTime: string;
  previousRate: number;
  expectedRate: number | null;
  expectationSource: CbrExpectationSource;
  actualRate: number | null;
  surpriseBps: number | null;
  decisionType: CbrDecisionType | null;
  tone: CbrTone | null;
  toneLabelRu: string | null;
  officialUrl: string | null;
  statementUrl: string | null;
  summary: string;
  keyPhrases: string[];
  marketContext: string[];
  statementBrief: CbrStatementBrief | null;
  instruments: CbrInstrumentReaction[];
};

export const CBR_DECISION_LABELS: Record<CbrDecisionType, string> = {
  cut: "снижение",
  hold: "сохранение",
  hike: "повышение",
};

const TONE_LABELS_RU: Record<CbrTone, string> = {
  dovish: "мягче",
  neutral: "нейтрально",
  hawkish: "жёстче",
};

export function resolveToneLabel(tone: CbrTone | null): string | null {
  if (!tone) return null;
  return TONE_LABELS_RU[tone];
}

export function cbrDataStatusLabel(status: CbrDataStatus): string {
  if (status === "live") return "MOEX ISS";
  if (status === "partial") return "частично · MOEX";
  if (status === "fallback") return "fallback · demo";
  return "mock";
}

export function collectTraderReads(event: CbrRateEvent): string[] {
  const fromInstruments = event.instruments
    .map((i) => i.traderRead)
    .filter((s): s is string => Boolean(s));
  return [...event.marketContext, ...fromInstruments].slice(0, 5);
}

export function filterCbrRateEvents(
  events: CbrRateEvent[],
  mode: "upcoming" | "history",
): CbrRateEvent[] {
  return events.filter((e) => (mode === "upcoming" ? e.status === "upcoming" : e.status === "past"));
}
