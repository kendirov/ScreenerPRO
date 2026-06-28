import type { EventsProviderResult } from "@/lib/server/services/events/events-types";

/** Server-side manual provider — events added in browser session are merged on client. */
export function fetchManualEvents(): EventsProviderResult {
  return {
    id: "manual",
    enabled: true,
    status: "empty",
    count: 0,
    error: "нет ручных событий на сервере",
    events: [],
  };
}
