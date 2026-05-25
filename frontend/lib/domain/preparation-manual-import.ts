import type {
  DriverState,
  EventImpact,
  PreparationEvent,
  PreparationEventCategory,
} from "@/lib/domain/preparation-events";
import { findSourceById } from "@/lib/domain/preparation-sources";

export type ManualEventFormValues = {
  date: string;
  timeMsk: string;
  title: string;
  category: PreparationEventCategory;
  impact: EventImpact;
  sourceId: string;
  affectedInstruments: string;
  expectation: string;
  scenarioAbove: string;
  scenarioBelow: string;
  note: string;
};

export type UnparsedEventNote = {
  id: string;
  sourceId: string;
  sourceLabel: string;
  rawText: string;
  pastedAt: string;
};

export const EMPTY_MANUAL_EVENT_FORM: ManualEventFormValues = {
  date: "",
  timeMsk: "",
  title: "",
  category: "macro",
  impact: "medium",
  sourceId: "manual-form",
  affectedInstruments: "",
  expectation: "",
  scenarioAbove: "",
  scenarioBelow: "",
  note: "",
};

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function createDefaultManualEventForm(): ManualEventFormValues {
  return { ...EMPTY_MANUAL_EVENT_FORM, date: todayIso() };
}

function parseInstrumentList(raw: string): string[] {
  return raw
    .split(/[,;·\n]/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

function inferDriverState(impact: EventImpact): DriverState {
  if (impact === "critical" || impact === "high") return "active";
  if (impact === "medium") return "potential";
  return "unknown";
}

export function manualFormToPreparationEvent(
  form: ManualEventFormValues,
  id?: string,
): PreparationEvent {
  const source = findSourceById(form.sourceId);
  const instruments = parseInstrumentList(form.affectedInstruments);

  return {
    id: id ?? `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: form.date,
    timeMsk: form.timeMsk.trim() || undefined,
    title: form.title.trim(),
    sourceName: source?.title ?? "Ручной ввод",
    category: form.category,
    impact: form.impact,
    driverState: inferDriverState(form.impact),
    affectedMarkets: [],
    affectedInstruments: instruments,
    expectation: form.expectation.trim() || undefined,
    scenarioAbove: form.scenarioAbove.trim() || undefined,
    scenarioBelow: form.scenarioBelow.trim() || undefined,
    note: form.note.trim() || undefined,
    isManual: true,
  };
}

export function createUnparsedEventNote(rawText: string, sourceId: string): UnparsedEventNote {
  const source = findSourceById(sourceId);
  return {
    id: `paste-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sourceId,
    sourceLabel: source?.title ?? sourceId,
    rawText: rawText.trim(),
    pastedAt: new Date().toISOString(),
  };
}

export function validateManualEventForm(form: ManualEventFormValues): string | null {
  if (!form.date.trim()) return "Укажите дату.";
  if (!form.title.trim()) return "Укажите название события.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date.trim())) return "Дата в формате ГГГГ-ММ-ДД.";
  if (form.timeMsk.trim() && !/^\d{1,2}:\d{2}$/.test(form.timeMsk.trim())) {
    return "Время МСК в формате ЧЧ:ММ.";
  }
  return null;
}
