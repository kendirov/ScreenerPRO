import type { RawCalendarEvent, EventsProviderResult } from "@/lib/server/services/events/events-types";
import {
  classifyEventImportance,
  inferImpactAssets,
} from "@/lib/preparation/event-importance-rules";
import { dateRangeMoscow, utcToMskTime } from "@/lib/server/services/events/events-types";

const FETCH_TIMEOUT_MS = 12_000;

type TeCalendarRow = {
  CalendarId?: string | number;
  Date?: string;
  Country?: string;
  Category?: string;
  Event?: string;
  Reference?: string;
  Actual?: string | number | null;
  Previous?: string | number | null;
  Forecast?: string | number | null;
  Importance?: number;
  Currency?: string;
  Unit?: string;
  Ticker?: string;
  Symbol?: string;
};

function getTradingEconomicsKey(): string | null {
  const key = process.env.TRADING_ECONOMICS_API_KEY?.trim();
  return key || null;
}

function formatTeValue(value: string | number | null | undefined): string | undefined {
  if (value == null || value === "") return undefined;
  return String(value);
}

function mapTeImportance(value?: number): RawCalendarEvent["importance"] {
  if (value == null) return "medium";
  if (value >= 3) return "high";
  if (value === 2) return "medium";
  return "low";
}

function mapTeRow(row: TeCalendarRow): RawCalendarEvent | null {
  const title = row.Event?.trim();
  const dateRaw = row.Date?.trim();
  if (!title || !dateRaw) return null;

  const date = dateRaw.slice(0, 10);
  const timeMsk = utcToMskTime(dateRaw);
  const importance = mapTeImportance(row.Importance);
  const classified = classifyEventImportance(title, row.Country);
  const finalImportance =
    importance === "high" || classified === "high"
      ? "high"
      : importance === "low" && classified === "medium"
        ? "medium"
        : importance;

  return {
    id: `te-${row.CalendarId ?? `${date}-${title}`.slice(0, 80)}`,
    date,
    time: dateRaw.includes("T") ? dateRaw : undefined,
    timeMsk,
    country: row.Country,
    region: row.Country,
    title,
    importance: finalImportance,
    category: row.Category,
    impactAssets: inferImpactAssets(title, row.Country, row.Category),
    previous: formatTeValue(row.Previous),
    forecast: formatTeValue(row.Forecast),
    actual: formatTeValue(row.Actual),
    status: row.Actual != null && row.Actual !== "" ? "released" : "upcoming",
    source: "Trading Economics",
  };
}

export async function fetchTradingEconomicsEvents(): Promise<EventsProviderResult> {
  const apiKey = getTradingEconomicsKey();
  if (!apiKey) {
    return {
      id: "trading-economics",
      enabled: false,
      status: "disabled",
      count: 0,
      error: "ключ не задан",
      events: [],
    };
  }

  const { from, to } = dateRangeMoscow(7);
  const url = `https://api.tradingeconomics.com/calendar/country/all/${from}/${to}?c=${encodeURIComponent(apiKey)}&f=json`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) {
      return {
        id: "trading-economics",
        enabled: true,
        status: "error",
        count: 0,
        error: `HTTP ${response.status}`,
        events: [],
      };
    }

    const rows = (await response.json()) as TeCalendarRow[];
    const events = rows.map(mapTeRow).filter((e): e is RawCalendarEvent => e != null);

    return {
      id: "trading-economics",
      enabled: true,
      status: events.length ? "ok" : "empty",
      count: events.length,
      events,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      id: "trading-economics",
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

export function hasTradingEconomicsKey(): boolean {
  return Boolean(getTradingEconomicsKey());
}
