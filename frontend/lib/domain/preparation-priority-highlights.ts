import type { MarketDriver, PreparationEvent } from "@/lib/domain/preparation-events";
import {
  findNextImportantEvent,
  sortEventsByDateTime,
} from "@/lib/domain/preparation-events";
import { selectFocusInstruments } from "@/lib/domain/preparation-focus-instruments";
import { getSessionPulseInfo } from "@/lib/domain/session-phase";
import type {
  PreparationCandlesResponse,
  ResolvedPreparationInstrument,
} from "@/lib/domain/preparation-watchlist";

export type PreparationPriorityKind = "event" | "driver" | "instrument" | "risk" | "time";

export type PreparationPriorityCard = {
  id: string;
  kind: PreparationPriorityKind;
  title: string;
  value: string;
  hint?: string;
  accent: "amber" | "violet" | "cyan" | "green" | "red";
};

const KIND_LABELS: Record<PreparationPriorityKind, string> = {
  event: "Событие",
  driver: "Драйвер",
  instrument: "Инструмент",
  risk: "Риск",
  time: "Время",
};

export function priorityKindLabel(kind: PreparationPriorityKind): string {
  return KIND_LABELS[kind];
}

export function buildPreparationPriorityCards(input: {
  events: PreparationEvent[];
  drivers: MarketDriver[];
  watchlist: ResolvedPreparationInstrument[];
  candlesResponse?: PreparationCandlesResponse;
  now?: Date;
}): PreparationPriorityCard[] {
  const { events, drivers, watchlist, candlesResponse, now = new Date() } = input;
  const cards: PreparationPriorityCard[] = [];

  const nextEvent = findNextImportantEvent(events, now);
  if (nextEvent) {
    cards.push({
      id: "priority-event",
      kind: "event",
      title: KIND_LABELS.event,
      value: nextEvent.title,
      hint: nextEvent.timeMsk && nextEvent.timeMsk !== "—" ? nextEvent.timeMsk : "весь день",
      accent: nextEvent.impact === "critical" ? "red" : "amber",
    });
  }

  const hotDriver = drivers.find((d) => d.state === "active") ?? drivers.find((d) => d.state === "fading");
  if (hotDriver) {
    cards.push({
      id: "priority-driver",
      kind: "driver",
      title: KIND_LABELS.driver,
      value: hotDriver.title,
      hint: hotDriver.affectedInstruments.slice(0, 3).join(" · ") || undefined,
      accent: hotDriver.state === "active" ? "red" : "violet",
    });
  }

  const focus = selectFocusInstruments(watchlist, candlesResponse, 1)[0];
  if (focus) {
    cards.push({
      id: "priority-instrument",
      kind: "instrument",
      title: KIND_LABELS.instrument,
      value: focus.resolvedSecid ?? focus.symbol,
      hint: focus.title,
      accent: "green",
    });
  }

  const riskEvent =
    sortEventsByDateTime(events).find((e) => e.impact === "critical") ??
    events.find((e) => e.driverState === "active" && e.impact === "high");
  const fadingDriver = drivers.find((d) => d.state === "fading");
  if (riskEvent || fadingDriver) {
    cards.push({
      id: "priority-risk",
      kind: "risk",
      title: KIND_LABELS.risk,
      value: riskEvent?.title ?? fadingDriver?.title ?? "—",
      hint: riskEvent ? "критическое событие" : "остывающий драйвер",
      accent: "red",
    });
  }

  const session = getSessionPulseInfo(now);
  cards.push({
    id: "priority-time",
    kind: "time",
    title: KIND_LABELS.time,
    value: nextEvent?.timeMsk && nextEvent.timeMsk !== "—" ? nextEvent.timeMsk : session.moscowTime,
    hint: nextEvent ? "ближайшее важное" : session.phase,
    accent: "cyan",
  });

  return cards.slice(0, 5);
}
