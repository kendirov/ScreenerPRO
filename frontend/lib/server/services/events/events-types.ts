import type {
  PreparationCalendarEvent,
  PreparationEventImportance,
  PreparationEventImpactTag,
} from "@/lib/preparation/preparation-types";

export type RawCalendarEvent = {
  id: string;
  date: string;
  time?: string;
  timeMsk?: string;
  country?: string;
  region?: string;
  title: string;
  importance: PreparationEventImportance;
  category?: string;
  impactAssets: PreparationEventImpactTag[];
  previous?: string;
  forecast?: string;
  actual?: string;
  status: "upcoming" | "released" | "unknown";
  source: string;
  sourceUrl?: string;
};

export type EventsProviderResult = {
  id: string;
  enabled: boolean;
  status: "ok" | "empty" | "disabled" | "error";
  count: number;
  error?: string;
  events: RawCalendarEvent[];
};

export function toCalendarEvent(raw: RawCalendarEvent): PreparationCalendarEvent {
  return {
    id: raw.id,
    date: raw.date,
    time: raw.time,
    timeMsk: raw.timeMsk,
    country: raw.country,
    region: raw.region,
    title: raw.title,
    importance: raw.importance,
    category: raw.category,
    assetImpact: raw.impactAssets,
    previous: raw.previous,
    forecast: raw.forecast,
    actual: raw.actual,
    status: raw.status,
    source: raw.source,
    sourceUrl: raw.sourceUrl,
  };
}

function moscowDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow" }).format(now);
}

function addDaysIso(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dateRangeMoscow(daysAhead = 7): { from: string; to: string; today: string } {
  const today = moscowDateKey();
  return { from: today, to: addDaysIso(today, daysAhead), today };
}

export function utcToMskTime(isoOrDate: string): string | undefined {
  const d = new Date(isoOrDate.includes("T") ? isoOrDate : `${isoOrDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleTimeString("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dedupeEvents(events: RawCalendarEvent[]): RawCalendarEvent[] {
  const seen = new Set<string>();
  const out: RawCalendarEvent[] = [];
  for (const event of events) {
    const key = `${event.date}|${event.timeMsk ?? event.time ?? ""}|${event.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(event);
  }
  return out;
}
