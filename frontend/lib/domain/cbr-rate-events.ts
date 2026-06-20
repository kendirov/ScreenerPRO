/**
 * @deprecated Импортируйте из @/lib/cbr — этот модуль адаптирует canonical events.
 */

import { toDomainCbrRateEvent } from "@/lib/cbr/cbr-domain-adapter";
import {
  calculateSurpriseBps as calcSurprise,
  formatRateLabel,
  getCbrRateEventById as getCanonicalById,
  getCbrRateEvents as getCanonicalEvents,
  getUpcomingCbrRateEvent,
  type CbrRateEvent as CanonicalCbrRateEvent,
} from "@/lib/cbr/cbr-rate-events";
import {
  resolveToneLabel,
  type CbrRateEvent as LegacyCbrRateEvent,
} from "@/lib/domain/cbr-rate-events-legacy-types";

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
} from "@/lib/domain/cbr-rate-events-legacy-types";

export {
  CBR_DECISION_LABELS,
  cbrDataStatusLabel,
  collectTraderReads,
  filterCbrRateEvents,
  resolveToneLabel,
} from "@/lib/domain/cbr-rate-events-legacy-types";

export function calculateSurpriseBps(
  expected: number | null,
  actual: number | null,
): number | null {
  return calcSurprise(expected, actual);
}

export function resolveDecisionType(
  previous: number,
  actual: number | null,
): import("@/lib/domain/cbr-rate-events-legacy-types").CbrDecisionType | null {
  if (actual == null) return null;
  if (actual < previous) return "cut";
  if (actual > previous) return "hike";
  return "hold";
}

export function enrichCbrRateEvent(event: LegacyCbrRateEvent): LegacyCbrRateEvent {
  const surpriseBps = event.surpriseBps ?? calculateSurpriseBps(event.expectedRate, event.actualRate);
  const decisionType = event.decisionType ?? resolveDecisionType(event.previousRate, event.actualRate);
  const toneLabelRu = event.toneLabelRu ?? resolveToneLabel(event.tone);
  return { ...event, surpriseBps, decisionType, toneLabelRu };
}

export function getCbrRateEvents(): LegacyCbrRateEvent[] {
  return getCanonicalEvents().map(toDomainCbrRateEvent);
}

export function getCbrRateEventById(id: string): LegacyCbrRateEvent | undefined {
  const e = getCanonicalById(id);
  return e ? toDomainCbrRateEvent(e) : undefined;
}

/** Canonical event (preferred for new code). */
export function getCanonicalCbrRateEvent(id: string): CanonicalCbrRateEvent | undefined {
  return getCanonicalById(id);
}

export { getUpcomingCbrRateEvent, formatRateLabel };

/** @deprecated use formatRateLabel from @/lib/cbr */
export const formatRatePct = formatRateLabel;

export function formatSurpriseBps(value: number | null): string {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value} bps`;
}
