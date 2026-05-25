"use client";

import type { PreparationCandlesResponse, ResolvedPreparationInstrument } from "@/lib/domain/preparation-watchlist";
import type { PreparationEvent } from "@/lib/domain/preparation-events";
import type { BriefingOutlineItem } from "@/lib/domain/preparation-briefing-outline";
import type { PreparationEventSourceFilter } from "@/lib/domain/smartlab-calendar";
import { PreparationAirOrderCompact } from "@/components/lab/preparation/preparation-air-order-compact";
import { PreparationEventSourceSwitch } from "@/components/lab/preparation/preparation-event-source-switch";
import { PreparationEventsTimeline } from "@/components/lab/preparation/preparation-events-timeline";
import { PreparationInstrumentsCompact } from "@/components/lab/preparation/preparation-instruments-compact";
import { cn } from "@/lib/utils/cn";

export function PreparationPremarketGrid({
  events,
  watchlist,
  outline,
  candlesResponse,
  hasLiveData,
  selectedEventIds,
  selectedInstrumentIds,
  onToggleEvent,
  onToggleInstrument,
  eventSourceFilter,
  onEventSourceChange,
  smartLabStatus,
  inflationAirOrderLine,
  className,
}: {
  events: PreparationEvent[];
  watchlist: ResolvedPreparationInstrument[];
  outline: BriefingOutlineItem[];
  candlesResponse?: PreparationCandlesResponse;
  hasLiveData: boolean;
  selectedEventIds: ReadonlySet<string>;
  selectedInstrumentIds: ReadonlySet<string>;
  onToggleEvent: (id: string) => void;
  onToggleInstrument: (id: string) => void;
  eventSourceFilter: PreparationEventSourceFilter;
  onEventSourceChange: (value: PreparationEventSourceFilter) => void;
  smartLabStatus?: "ok" | "empty" | "error" | "loading";
  inflationAirOrderLine: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-end gap-2 px-0.5">
        <PreparationEventSourceSwitch
          value={eventSourceFilter}
          onChange={onEventSourceChange}
          smartLabStatus={smartLabStatus}
        />
      </div>

      <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <PreparationEventsTimeline
            events={events}
            selectedEventIds={selectedEventIds}
            onToggleEvent={onToggleEvent}
            smartLabStatus={smartLabStatus}
            limit={6}
          />
        </div>

        <div className="xl:col-span-4">
          <PreparationInstrumentsCompact
            watchlist={watchlist}
            candlesResponse={candlesResponse}
            hasLiveData={hasLiveData}
            selectedInstrumentIds={selectedInstrumentIds}
            onToggleInstrument={onToggleInstrument}
          />
        </div>

        <div className="xl:col-span-3">
          <PreparationAirOrderCompact outline={outline} inflationAirOrderLine={inflationAirOrderLine} />
        </div>
      </div>
    </div>
  );
}
