/**
 * Форматирование и состояния карточек CbrRateEventSelector.
 */

import {
  CBR_DECISION_LABELS,
  decisionLabel,
  isUpcomingEvent,
  needsSourceVerification,
  type CbrEventDataStatus,
  type CbrRateEvent,
} from "@/lib/cbr/cbr-rate-events";

export const CBR_SELECTOR_YEARS = [2026, 2025, 2024] as const;

export type CbrSelectorYear = (typeof CBR_SELECTOR_YEARS)[number];

export type CbrEventDataBadge = "real" | "manual" | "demo";

export type CbrEventCardVisualState = "selected" | "upcoming" | "no-data" | "historical";

export function groupCbrEventsBySelectorYear(events: CbrRateEvent[]): Record<number, CbrRateEvent[]> {
  const map: Record<number, CbrRateEvent[]> = {};
  for (const y of CBR_SELECTOR_YEARS) map[y] = [];
  for (const e of events) {
    const y = e.year;
    if (!map[y]) map[y] = [];
    map[y].push(e);
  }
  for (const y of Object.keys(map)) {
    map[Number(y)]!.sort((a, b) => b.date.localeCompare(a.date));
  }
  return map;
}

export function formatSelectorMeetingDate(dateIso: string): string {
  const raw = new Date(`${dateIso}T12:00:00`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return raw.replace(/\./g, "").replace(/\s+/g, " ").trim();
}

export function formatRateCompact(rate: number | null): string {
  if (rate == null) return "—";
  return rate.toFixed(1);
}

export function formatRateArrow(previous: number | null, actual: number | null): string {
  const from = formatRateCompact(previous);
  const to = actual == null ? "—" : formatRateCompact(actual);
  return `${from} → ${to}`;
}

export function formatChangeBpsRu(bps: number | null, upcoming = false): string {
  if (upcoming || bps == null) return "—";
  const sign = bps > 0 ? "+" : "";
  return `${sign}${bps} б.п.`;
}

export function formatExpectationLine(expected: number | null): string {
  if (expected == null) return "ожидание неизвестно";
  return `ожид. ${expected.toFixed(2)}`;
}

export function resolveVerificationBadgeLabel(event: CbrRateEvent): string | null {
  if (!needsSourceVerification(event)) return null;
  return "проверить";
}

export function resolveEventDataBadge(status: CbrEventDataStatus): CbrEventDataBadge {
  if (status === "real") return "real";
  if (status === "manual") return "manual";
  return "demo";
}

export function resolveEventCardVisualState(
  event: CbrRateEvent,
  selected: boolean,
): CbrEventCardVisualState {
  if (selected) return "selected";
  if (isUpcomingEvent(event)) return "upcoming";
  if (resolveEventDataBadge(event.dataStatus) === "demo") return "no-data";
  return "historical";
}

export function resolveDecisionBadgeLabel(event: CbrRateEvent): string {
  if (isUpcomingEvent(event)) return decisionLabel(event);
  if (event.decisionType === "upcoming") return "ожидание";
  return CBR_DECISION_LABELS[event.decisionType];
}

export function countSelectorYearEvents(events: CbrRateEvent[], year: number): number {
  return events.filter((e) => e.year === year).length;
}
