"use client";

import type { PreparationCandlesResponse } from "@/lib/domain/preparation-watchlist";
import type { MarketDriver, PreparationEvent } from "@/lib/domain/preparation-events";
import type { BriefingOutlineItem } from "@/lib/domain/preparation-briefing-outline";
import type { ResolvedPreparationInstrument } from "@/lib/domain/preparation-watchlist";
import type { PreparationEventSourceFilter } from "@/lib/domain/smartlab-calendar";
import { PreparationAirOrderCompact } from "@/components/lab/preparation/preparation-air-order-compact";
import { PreparationDriversCompact } from "@/components/lab/preparation/preparation-drivers-compact";
import { PreparationEventSourceSwitch } from "@/components/lab/preparation/preparation-event-source-switch";
import { PreparationEventsTimeline } from "@/components/lab/preparation/preparation-events-timeline";
import { PreparationInplayStrip } from "@/components/lab/preparation/preparation-inplay-strip";
import type { WeeklyInflationBrief } from "@/lib/domain/weekly-inflation-storage";
import { cn } from "@/lib/utils/cn";

export function PreparationConsole({
  events,
  drivers,
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
  inflationBrief,
  className,
}: {
  events: PreparationEvent[];
  drivers: MarketDriver[];
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
  inflationBrief: WeeklyInflationBrief;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
        <h2 className="text-sm font-semibold tracking-tight text-lab-text">Что важно</h2>
        <PreparationEventSourceSwitch
          value={eventSourceFilter}
          onChange={onEventSourceChange}
          smartLabStatus={smartLabStatus}
        />
      </div>

      <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-12">
        <div className="lg:col-span-1 xl:col-span-4">
          <PreparationEventsTimeline
            events={events}
            selectedEventIds={selectedEventIds}
            onToggleEvent={onToggleEvent}
            smartLabStatus={smartLabStatus}
          />
        </div>

        <div className="lg:col-span-1 xl:col-span-3">
          <PreparationDriversCompact drivers={drivers} />
        </div>

        <div className="lg:col-span-1 xl:col-span-3">
          <PreparationInplayStrip
            watchlist={watchlist}
            candlesResponse={candlesResponse}
            hasLiveData={hasLiveData}
            selectedInstrumentIds={selectedInstrumentIds}
            onToggleInstrument={onToggleInstrument}
          />
        </div>

        <div className="lg:col-span-2 xl:col-span-2">
          <PreparationAirOrderCompact outline={outline} inflationAirOrderLine={inflationBrief.airOrderLine} />
        </div>
      </div>
    </section>
  );
}
