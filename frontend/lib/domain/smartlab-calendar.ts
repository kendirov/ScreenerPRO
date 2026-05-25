import type { PreparationEvent } from "@/lib/domain/preparation-events";

export type SmartLabCalendarMode = "day" | "week";

export type SmartLabCalendarType = "all" | "stocks" | "dividends" | "macro";

export type SmartLabCalendarStatus = "ok" | "empty" | "error";

export type SmartLabCalendarResponse = {
  source: "Smart-Lab";
  updatedAt: string;
  status: SmartLabCalendarStatus;
  events: PreparationEvent[];
  diagnostics: {
    fetchedUrl: string;
    parsedEvents: number;
    warning?: string;
    fromCache?: boolean;
    staleFallback?: boolean;
  };
};

export type PreparationEventSourceFilter = "manual" | "smartlab" | "all";

export const PREPARATION_EVENT_SOURCE_LABELS: Record<PreparationEventSourceFilter, string> = {
  manual: "Ручные",
  smartlab: "Smart-Lab",
  all: "Все",
};

export function isSmartLabEvent(event: PreparationEvent): boolean {
  return event.id.startsWith("smartlab-") || event.sourceName === "Smart-Lab";
}

export function isManualOrDemoEvent(event: PreparationEvent): boolean {
  return (
    event.id.startsWith("manual-") ||
    event.id.startsWith("demo-") ||
    (event.isManual && !isSmartLabEvent(event))
  );
}

export function mergePreparationEventsBySource(input: {
  manualEvents: PreparationEvent[];
  smartLabEvents: PreparationEvent[];
  sourceFilter: PreparationEventSourceFilter;
}): PreparationEvent[] {
  const { manualEvents, smartLabEvents, sourceFilter } = input;

  switch (sourceFilter) {
    case "manual":
      return manualEvents;
    case "smartlab":
      return smartLabEvents;
    case "all":
    default: {
      const seen = new Set<string>();
      const merged: PreparationEvent[] = [];
      for (const event of [...manualEvents, ...smartLabEvents]) {
        if (seen.has(event.id)) continue;
        seen.add(event.id);
        merged.push(event);
      }
      return merged;
    }
  }
}
