import {
  countEventBuckets,
  filterVisibleEvents,
} from "@/lib/preparation/event-importance-rules";
import type { EventsProviderDiagnostic, PreparationEventsResponse } from "@/lib/preparation/preparation-types";
import {
  dedupeEvents,
  toCalendarEvent,
  type EventsProviderResult,
} from "@/lib/server/services/events/events-types";
import { bucketCalendarEvents } from "@/lib/preparation/event-buckets";
import { fetchFinnhubEvents } from "@/lib/server/services/events/finnhub-events-provider";
import { fetchManualEvents } from "@/lib/server/services/events/manual-events-provider";
import { fetchSmartLabEvents } from "@/lib/server/services/events/smartlab-events-provider";
import { fetchTradingEconomicsEvents } from "@/lib/server/services/events/trading-economics-events-provider";

const CACHE_TTL_MS = 10 * 60_000;

let cache: { expiresAt: number; payload: PreparationEventsResponse } | null = null;

function providerSummary(results: EventsProviderResult[]): EventsProviderDiagnostic[] {
  return results.map(({ id, enabled, status, count, error }) => ({
    id,
    enabled,
    status,
    count,
    error,
  }));
}

function isProviderLoaded(provider: EventsProviderResult): boolean {
  if (!provider.enabled) return false;
  if (provider.status === "ok") return true;
  if (provider.status === "empty" && (provider.id === "trading-economics" || provider.id === "finnhub")) {
    return true;
  }
  return false;
}

function resolveEventsStatus(
  loaded: boolean,
  visibleCount: number,
  primary: EventsProviderResult | null,
): PreparationEventsResponse["status"] {
  if (!loaded) return "error";
  if (visibleCount > 0 && primary?.status === "ok") return "live";
  if (loaded) return "partial";
  return "degraded";
}

export async function buildPreparationEventsResponse(): Promise<PreparationEventsResponse> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.payload;
  }

  const manual = fetchManualEvents();
  const te = await fetchTradingEconomicsEvents();
  const finnhub = await fetchFinnhubEvents();
  const smartLab = await fetchSmartLabEvents();

  const providerResults: EventsProviderResult[] = [te, finnhub, smartLab, manual];
  let primary: EventsProviderResult | null = null;
  let rawEvents = dedupeEvents([]);

  for (const provider of [te, finnhub, smartLab]) {
    if (provider.status === "ok" && provider.events.length > 0) {
      primary = provider;
      rawEvents = dedupeEvents(provider.events);
      break;
    }
  }

  if (!primary) {
    for (const provider of [te, finnhub]) {
      if (isProviderLoaded(provider)) {
        primary = provider;
        break;
      }
    }
  }

  if (!primary && smartLab.status === "ok") {
    primary = smartLab;
    rawEvents = dedupeEvents(smartLab.events);
  }

  const loaded = providerResults.some(isProviderLoaded);

  const allMapped = rawEvents.map(toCalendarEvent);
  const visible = filterVisibleEvents(allMapped);
  const buckets = bucketCalendarEvents(visible);
  const counts = countEventBuckets(allMapped, visible);

  const status = resolveEventsStatus(loaded, visible.length, primary);

  const payload: PreparationEventsResponse = {
    status,
    loaded,
    updatedAt: new Date().toISOString(),
    providers: providerSummary(providerResults),
    ...buckets,
    counts,
    source: primary?.id ?? "none",
    diagnostics: providerResults
      .map((p) => `${p.id}=${p.status}${p.error ? `(${p.error})` : ""}`)
      .filter(Boolean),
  };

  cache = { expiresAt: Date.now() + CACHE_TTL_MS, payload };
  return payload;
}

export function clearPreparationEventsCache(): void {
  cache = null;
}
