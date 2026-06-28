import type { EventImpact } from "@/lib/domain/preparation-events";
import type { RawCalendarEvent, EventsProviderResult } from "@/lib/server/services/events/events-types";
import {
  classifyEventImportance,
  inferImpactAssets,
} from "@/lib/preparation/event-importance-rules";
import { fetchSmartLabCalendarResponse } from "@/lib/server/services/smartlab-calendar";

function mapSmartLabImpact(impact: EventImpact): RawCalendarEvent["importance"] {
  if (impact === "critical" || impact === "high") return "high";
  if (impact === "medium") return "medium";
  return "low";
}

export async function fetchSmartLabEvents(): Promise<EventsProviderResult> {
  try {
    const response = await fetchSmartLabCalendarResponse("week", "all");
    const rawEvents = response.events ?? [];

    const events: RawCalendarEvent[] = rawEvents.map((event) => {
      const importanceFromImpact = mapSmartLabImpact(event.impact);
      const classified = classifyEventImportance(event.title, event.affectedMarkets[0]);
      const importance =
        importanceFromImpact === "high" || classified === "high"
          ? "high"
          : importanceFromImpact === "low" && classified === "medium"
            ? "medium"
            : importanceFromImpact;

      return {
        id: event.id,
        date: event.date,
        timeMsk: event.timeMsk,
        country: event.affectedMarkets[0],
        title: event.title,
        importance,
        category: event.category,
        impactAssets: inferImpactAssets(event.title, event.affectedMarkets[0], event.category),
        status: "upcoming",
        source: "Smart-Lab",
        sourceUrl: event.sourceUrl,
      };
    });

    let status: EventsProviderResult["status"] = "ok";
    if (response.status === "error") status = "error";
    else if (!events.length) status = "empty";

    return {
      id: "smart-lab",
      enabled: true,
      status,
      count: events.length,
      error:
        response.status === "error"
          ? response.diagnostics.warning ?? "parser failed"
          : !events.length
            ? "календарь пуст"
            : undefined,
      events,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      id: "smart-lab",
      enabled: true,
      status: "error",
      count: 0,
      error: message,
      events: [],
    };
  }
}
