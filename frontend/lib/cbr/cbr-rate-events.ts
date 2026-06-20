/**
 * CBR rate meetings — source of truth for replay page.
 * Manual catalog: frontend/data/cbr-rate-events.ts
 */

import { loadCbrRateEventsRaw } from "@/lib/cbr/cbr-rate-events-db";
import type { CbrRateEventExpectationStatus } from "@/data/cbr-rate-events";

export type CbrDecisionType = "cut" | "hold" | "hike" | "upcoming";

export type CbrExpectationType =
  | "softer_than_expected"
  | "as_expected"
  | "tighter_than_expected"
  | "unknown";

export type CbrTone = "dovish" | "neutral" | "hawkish" | "unknown";

export type CbrEventDataStatus = "real" | "partial" | "manual" | "mock";

export type CbrSourceStatus = "official" | "manual" | "needs_verification";

export type CbrExpectationStatus = CbrRateEventExpectationStatus;

export type CbrInstrumentRole =
  | "equity_index"
  | "bank"
  | "heavy_stock"
  | "bonds"
  | "usd_fut"
  | "cny_fut"
  | "index_fut";

export type CbrInstrumentDataStatus = "moex" | "demo" | "no_data";

export type CbrRateInstrumentConfig = {
  key: string;
  ticker: string;
  title: string;
  role: CbrInstrumentRole;
  engine: "stock" | "futures";
  market: string;
  board?: string;
  dataStatus: CbrInstrumentDataStatus;
};

export type CbrRateEvent = {
  id: string;
  date: string;
  year: number;
  title: string;

  decisionTime: "13:30";
  pressConferenceTime?: "15:00";

  previousRate: number | null;
  expectedRate: number | null;
  actualRate: number | null;
  changeBps: number | null;
  surpriseBps: number | null;

  decisionType: CbrDecisionType;
  expectationType: CbrExpectationType;
  tone: CbrTone;

  officialUrl?: string;
  statementUrl?: string;
  summary: string;
  traderTakeaway: string;

  dataStatus: CbrEventDataStatus;
  sourceStatus: CbrSourceStatus;
  expectationStatus: CbrExpectationStatus;
  instruments: CbrRateInstrumentConfig[];
};

export const CBR_DECISION_LABELS: Record<Exclude<CbrDecisionType, "upcoming">, string> = {
  cut: "снижение",
  hold: "сохранение",
  hike: "повышение",
};

export const CBR_EXPECTATION_TYPE_LABELS: Record<CbrExpectationType, string> = {
  softer_than_expected: "мягче ожиданий",
  as_expected: "в рамках ожиданий",
  tighter_than_expected: "жёстче ожиданий",
  unknown: "ожидание не задано",
};

export const CBR_TONE_LABELS: Record<CbrTone, string> = {
  dovish: "мягко",
  neutral: "нейтрально",
  hawkish: "жёстко",
  unknown: "—",
};

/** Порог surprise ±12 bps (0,12 п.п.). */
export const CBR_SURPRISE_NEUTRAL_BPS = 12;

// —— Pure calculations ——

export function calculateChangeBps(
  previousRate: number | null,
  actualRate: number | null,
): number | null {
  if (previousRate == null || actualRate == null) return null;
  return Math.round((actualRate - previousRate) * 100);
}

export function calculateSurpriseBps(
  expectedRate: number | null,
  actualRate: number | null,
): number | null {
  if (expectedRate == null || actualRate == null) return null;
  return Math.round((actualRate - expectedRate) * 100);
}

export function resolveDecisionType(
  previousRate: number | null,
  actualRate: number | null,
): CbrDecisionType {
  if (previousRate == null || actualRate == null) return "upcoming";
  if (actualRate < previousRate) return "cut";
  if (actualRate > previousRate) return "hike";
  return "hold";
}

export function resolveExpectationType(
  expectedRate: number | null,
  surpriseBps: number | null,
): CbrExpectationType {
  if (expectedRate == null || surpriseBps == null) return "unknown";
  if (surpriseBps <= -CBR_SURPRISE_NEUTRAL_BPS) return "softer_than_expected";
  if (surpriseBps >= CBR_SURPRISE_NEUTRAL_BPS) return "tighter_than_expected";
  return "as_expected";
}

export function formatRateLabel(rate: number | null): string {
  if (rate == null) return "—";
  return `${rate.toFixed(1).replace(".", ",")}%`;
}

export function formatBpsLabel(bps: number | null): string {
  if (bps == null) return "—";
  const sign = bps > 0 ? "+" : "";
  return `${sign}${bps} bps`;
}

export function enrichCbrRateEvent(event: CbrRateEvent): CbrRateEvent {
  const changeBps = calculateChangeBps(event.previousRate, event.actualRate);
  const surpriseBps = calculateSurpriseBps(event.expectedRate, event.actualRate);
  const decisionType =
    event.actualRate == null ? "upcoming" : resolveDecisionType(event.previousRate, event.actualRate);
  const expectationType = resolveExpectationType(event.expectedRate, surpriseBps);

  return {
    ...event,
    year: Number(event.date.slice(0, 4)),
    changeBps,
    surpriseBps,
    decisionType,
    expectationType,
  };
}

export function needsSourceVerification(event: Pick<CbrRateEvent, "sourceStatus">): boolean {
  return event.sourceStatus === "needs_verification";
}

const EVENTS: CbrRateEvent[] = loadCbrRateEventsRaw().map(enrichCbrRateEvent);

export function getCbrRateEvents(): CbrRateEvent[] {
  return [...EVENTS].sort((a, b) => b.date.localeCompare(a.date));
}

export function getCbrRateEventsByYear(year: number): CbrRateEvent[] {
  return getCbrRateEvents().filter((e) => e.year === year);
}

export function getCbrRateEventById(id: string): CbrRateEvent | undefined {
  return EVENTS.find((e) => e.id === id);
}

export function getUpcomingCbrRateEvent(): CbrRateEvent | undefined {
  return EVENTS.find((e) => e.decisionType === "upcoming");
}

export function getCbrRateYears(): number[] {
  const years = new Set(EVENTS.map((e) => e.year));
  return [...years].sort((a, b) => b - a);
}

export function isUpcomingEvent(event: CbrRateEvent): boolean {
  return event.decisionType === "upcoming";
}

export function decisionLabel(event: CbrRateEvent): string {
  if (event.decisionType === "upcoming") return "ожидание";
  return CBR_DECISION_LABELS[event.decisionType];
}
