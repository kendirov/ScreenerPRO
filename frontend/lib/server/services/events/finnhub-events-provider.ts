import type { RawCalendarEvent, EventsProviderResult } from "@/lib/server/services/events/events-types";
import {
  classifyEventImportance,
  inferImpactAssets,
} from "@/lib/preparation/event-importance-rules";
import { dateRangeMoscow, utcToMskTime } from "@/lib/server/services/events/events-types";

const FETCH_TIMEOUT_MS = 12_000;

type FinnhubCalendarRow = {
  actual?: number | string | null;
  estimate?: number | string | null;
  prev?: number | string | null;
  country?: string;
  event?: string;
  impact?: string;
  time?: string;
  unit?: string;
};

function getFinnhubKey(): string | null {
  const key = process.env.FINNHUB_API_KEY?.trim();
  return key || null;
}

function formatValue(value: number | string | null | undefined): string | undefined {
  if (value == null || value === "") return undefined;
  return String(value);
}

function mapFinnhubImpact(impact?: string): RawCalendarEvent["importance"] {
  const normalized = impact?.toLowerCase();
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  return "low";
}

function mapFinnhubRow(row: FinnhubCalendarRow): RawCalendarEvent | null {
  const title = row.event?.trim();
  const time = row.time?.trim();
  if (!title || !time) return null;

  const date = time.slice(0, 10);
  const timeMsk = utcToMskTime(time);
  const importanceFromImpact = mapFinnhubImpact(row.impact);
  const classified = classifyEventImportance(title, row.country);
  const importance =
    importanceFromImpact === "high" || classified === "high"
      ? "high"
      : importanceFromImpact === "low" && classified === "medium"
        ? "medium"
        : importanceFromImpact;

  return {
    id: `finnhub-${date}-${title}`.replace(/\s+/g, "-").slice(0, 120),
    date,
    time,
    timeMsk,
    country: row.country,
    title,
    importance,
    impactAssets: inferImpactAssets(title, row.country),
    previous: formatValue(row.prev),
    forecast: formatValue(row.estimate),
    actual: formatValue(row.actual),
    status: row.actual != null && row.actual !== "" ? "released" : "upcoming",
    source: "Finnhub",
  };
}

export async function fetchFinnhubEvents(): Promise<EventsProviderResult> {
  const apiKey = getFinnhubKey();
  if (!apiKey) {
    return {
      id: "finnhub",
      enabled: false,
      status: "disabled",
      count: 0,
      error: "ключ не задан",
      events: [],
    };
  }

  const { from, to } = dateRangeMoscow(7);
  const url = `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${encodeURIComponent(apiKey)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) {
      return {
        id: "finnhub",
        enabled: true,
        status: "error",
        count: 0,
        error: `HTTP ${response.status}`,
        events: [],
      };
    }

    const json = (await response.json()) as { economicCalendar?: FinnhubCalendarRow[] };
    const rows = json.economicCalendar ?? [];
    const events = rows.map(mapFinnhubRow).filter((e): e is RawCalendarEvent => e != null);

    return {
      id: "finnhub",
      enabled: true,
      status: events.length ? "ok" : "empty",
      count: events.length,
      events,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      id: "finnhub",
      enabled: true,
      status: "error",
      count: 0,
      error: message,
      events: [],
    };
  } finally {
    clearTimeout(timer);
  }
}

export function hasFinnhubKey(): boolean {
  return Boolean(getFinnhubKey());
}
