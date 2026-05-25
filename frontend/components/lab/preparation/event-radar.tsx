"use client";



import * as React from "react";

import { CalendarDays, ExternalLink } from "lucide-react";

import { LabSectionHeading } from "@/components/lab/lab-ui";

import { BriefingSelectionButton } from "@/components/lab/preparation/briefing-selection-button";

import { PreparationEventSourceSwitch } from "@/components/lab/preparation/preparation-event-source-switch";

import type { BriefingMode } from "@/components/lab/preparation/preparation-types";

import {

  EVENT_CATEGORY_LABELS,

  EVENT_IMPACT_LABELS,

  EVENT_RADAR_FILTER_LABELS,

  DRIVER_STATE_LABELS,

  type EventRadarFilter,

  type PreparationEvent,

  defaultEventFilterForMode,

  filterEventsForMode,

  formatEventDateLabel,

  impactToneClass,

  driverStateToneClass,

  sortEventsByDateTime,

} from "@/lib/domain/preparation-events";

import {

  isSmartLabEvent,

  type PreparationEventSourceFilter,

} from "@/lib/domain/smartlab-calendar";

import { cn } from "@/lib/utils/cn";



const FILTER_KEYS = Object.keys(EVENT_RADAR_FILTER_LABELS) as EventRadarFilter[];



export function EventRadar({

  mode,

  events,

  manualEventCount = 0,

  smartLabEventCount = 0,

  smartLabWarning,

  eventSourceFilter,

  onEventSourceChange,

  smartLabStatus,

  selectedEventIds,

  onToggleEvent,

  className,

}: {

  mode: BriefingMode;

  events: PreparationEvent[];

  manualEventCount?: number;

  smartLabEventCount?: number;

  smartLabWarning?: string;

  eventSourceFilter: PreparationEventSourceFilter;

  onEventSourceChange: (value: PreparationEventSourceFilter) => void;

  smartLabStatus?: "ok" | "empty" | "error" | "loading";

  selectedEventIds: ReadonlySet<string>;

  onToggleEvent: (eventId: string) => void;

  className?: string;

}) {

  const hasManualEvents = manualEventCount > 0;

  const hasSmartLabEvents = smartLabEventCount > 0;

  const [filter, setFilter] = React.useState<EventRadarFilter>(() => defaultEventFilterForMode(mode));



  React.useEffect(() => {

    setFilter(defaultEventFilterForMode(mode));

  }, [mode]);



  const visibleEvents = React.useMemo(

    () => sortEventsByDateTime(filterEventsForMode(events, mode, filter)),

    [events, filter, mode],

  );



  const calendarSubtitle =
    smartLabStatus === "ok" || hasSmartLabEvents
      ? `Smart-Lab · ${smartLabEventCount} событ. · проверяйте даты перед эфиром`
      : hasManualEvents
        ? "Ручные события · без автокалендаря"
        : "Добавьте события вручную или включите Smart-Lab";

  const calendarBanner =
    smartLabStatus === "ok" || hasSmartLabEvents
      ? "Smart-Lab · эксперимент. Проверяйте дату и время перед эфиром."
      : smartLabStatus === "error" || smartLabStatus === "empty"
        ? (smartLabWarning ?? "Smart-Lab недоступен. Используйте ручной импорт.")
        : "Календарь не подключён. Добавьте события вручную.";



  return (

    <section className={cn("lab-glass-panel relative overflow-hidden p-3", className)}>

      <div className="lab-accent-line absolute inset-x-0 top-0 opacity-35" aria-hidden />

      <div className="relative">

        <LabSectionHeading className="mb-1 flex items-center gap-1.5 text-lab-amber/90">

          <CalendarDays className="h-3.5 w-3.5" />

          {mode === "day" ? "События дня" : "События недели"}

        </LabSectionHeading>

        <p className="text-[11px] text-lab-muted">{calendarSubtitle}</p>

      </div>



      <div className="mt-2">

        <PreparationEventSourceSwitch

          value={eventSourceFilter}

          onChange={onEventSourceChange}

          smartLabStatus={smartLabStatus}

        />

      </div>



      <div className="mt-3 rounded-lg border border-dashed border-lab-amber/25 bg-lab-amber/5 px-3 py-2">

        <p className="text-[11px] leading-relaxed text-lab-muted">{calendarBanner}</p>

      </div>



      <div className="mt-3 flex flex-wrap gap-1">

        {FILTER_KEYS.map((key) => (

          <button

            key={key}

            type="button"

            onClick={() => setFilter(key)}

            className={cn(

              "lab-status-chip px-2 py-0.5 text-[10px] transition",

              filter === key

                ? "border-lab-amber/40 bg-lab-amber/12 text-lab-amber shadow-[var(--lab-glow-amber)]"

                : "text-lab-muted hover:border-lab-amber/25 hover:text-lab-amber/90",

            )}

          >

            {EVENT_RADAR_FILTER_LABELS[key]}

          </button>

        ))}

      </div>



      <div className="mt-3 space-y-2">

        {visibleEvents.length === 0 ? (

          <div className="rounded-lg border border-dashed border-lab-border px-3 py-6 text-center">

            <p className="text-sm text-lab-muted">

              {events.length === 0

                ? "Добавьте события вручную или выберите Smart-Lab"

                : "Нет событий для выбранного фильтра"}

            </p>

          </div>

        ) : (

          visibleEvents.map((event) => (

            <PreparationEventCard

              key={event.id}

              event={event}

              selected={selectedEventIds.has(event.id)}

              onToggle={() => onToggleEvent(event.id)}

            />

          ))

        )}

      </div>

    </section>

  );

}



function PreparationEventCard({

  event,

  selected,

  onToggle,

}: {

  event: PreparationEvent;

  selected: boolean;

  onToggle: () => void;

}) {

  const timeLabel = event.timeMsk && event.timeMsk !== "—" ? event.timeMsk : "весь день";

  const affects = [...event.affectedMarkets, ...event.affectedInstruments].slice(0, 8);

  const isImportant = event.impact === "critical" || event.impact === "high";

  const fromSmartLab = isSmartLabEvent(event);



  return (

    <article

      className={cn(

        "lab-glass-card border bg-gradient-to-br from-lab-amber/6 to-transparent px-3 py-2.5 transition",

        isImportant

          ? "border-lab-amber/45 shadow-[var(--lab-glow-amber)] ring-1 ring-lab-amber/15"

          : "border-lab-amber/20",

        selected && "border-lab-violet/35 ring-1 ring-lab-violet/15",

      )}

    >

      <div className="flex items-start gap-3">

        <div className="shrink-0 text-center">

          <span className="block rounded-md border border-lab-amber/30 bg-lab-amber/10 px-2 py-1 font-mono text-[11px] text-lab-amber">

            {timeLabel}

          </span>

          <span className="mt-1 block text-[9px] text-lab-dim">{formatEventDateLabel(event.date)}</span>

        </div>



        <div className="min-w-0 flex-1 space-y-2">

          <div>

            <p className="text-sm font-medium text-lab-text">{event.title}</p>

            <div className="mt-0.5 flex flex-wrap items-center gap-2">

              <p className="text-[10px] text-lab-dim">{event.sourceName}</p>

              {event.sourceUrl ? (

                <a

                  href={event.sourceUrl}

                  target="_blank"

                  rel="noopener noreferrer"

                  className="inline-flex items-center gap-0.5 text-[10px] text-lab-cyan hover:underline"

                >

                  источник

                  <ExternalLink className="h-2.5 w-2.5" />

                </a>

              ) : null}

            </div>

          </div>



          <div className="flex flex-wrap gap-1">

            <span className="lab-status-chip border-lab-amber/25 bg-lab-amber/8 px-1.5 py-px text-[9px] text-lab-amber">

              {EVENT_CATEGORY_LABELS[event.category]}

            </span>

            <span className={cn("lab-status-chip px-1.5 py-px text-[9px]", impactToneClass(event.impact))}>

              {EVENT_IMPACT_LABELS[event.impact]}

            </span>

            <span className={cn("lab-status-chip px-1.5 py-px text-[9px]", driverStateToneClass(event.driverState))}>

              драйвер · {DRIVER_STATE_LABELS[event.driverState]}

            </span>

            {fromSmartLab ? (

              <span className="lab-status-chip border-lab-cyan/30 bg-lab-cyan/8 px-1.5 py-px text-[9px] text-lab-cyan">

                Smart-Lab

              </span>

            ) : event.isManual ? (

              <span className="lab-status-chip lab-chip-dev px-1.5 py-px text-[9px]">

                {event.id.startsWith("manual-") ? "ручной" : "пример"}

              </span>

            ) : null}

          </div>



          {affects.length > 0 ? (

            <div>

              <p className="text-[10px] uppercase tracking-wide text-lab-dim">Затрагивает</p>

              <p className="mt-0.5 text-[11px] text-lab-muted">{affects.join(" · ")}</p>

            </div>

          ) : null}



          {event.note ? <p className="text-[10px] italic text-lab-dim">{event.note}</p> : null}



          <div className="flex justify-end pt-1">

            <BriefingSelectionButton selected={selected} onToggle={onToggle} />

          </div>

        </div>

      </div>

    </article>

  );

}


