"use client";

import * as React from "react";
import { BriefingOrder } from "@/components/preparation/briefing-order";
import { ExternalMoversGrid } from "@/components/preparation/external-movers-grid";
import { ImportantEvents } from "@/components/preparation/important-events";
import { PreparationDataQuality } from "@/components/preparation/preparation-data-quality";
import { PreparationSummaryStrip } from "@/components/preparation/preparation-summary-strip";
import { RussiaContextStrip } from "@/components/preparation/russia-context-strip";
import { ManualEventImport } from "@/components/lab/preparation/manual-event-import";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import type { PreparationEvent } from "@/lib/domain/preparation-events";
import type {
  PreparationCalendarEvent,
  PreparationDataQualityStatus,
} from "@/lib/preparation/preparation-types";
import {
  filterVisibleEvents,
} from "@/lib/preparation/event-importance-rules";
import { bucketCalendarEvents } from "@/lib/preparation/event-buckets";
import { usePreparationEvents, usePreparationExternal } from "@/lib/hooks/use-preparation-external";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";

function manualToCalendar(event: PreparationEvent): PreparationCalendarEvent {
  return {
    id: event.id,
    date: event.date,
    timeMsk: event.timeMsk,
    title: event.title,
    country: event.affectedMarkets[0],
    importance: event.impact === "critical" || event.impact === "high" ? "high" : event.impact === "medium" ? "medium" : "low",
    assetImpact: [],
    status: "upcoming",
    source: event.sourceName,
    sourceUrl: event.sourceUrl,
  };
}

function resolveDataQuality(
  externalStatus?: string,
  eventsLoaded?: boolean,
  eventsStatus?: string,
  isLoading?: boolean,
): PreparationDataQualityStatus {
  if (isLoading) return "loading";
  if (externalStatus === "error" && !eventsLoaded) return "error";
  if (externalStatus === "live" && eventsLoaded && (eventsStatus === "live" || eventsStatus === "partial")) {
    return "live";
  }
  if (externalStatus === "partial" || externalStatus === "live") return "partial";
  if (externalStatus === "degraded" || !eventsLoaded) return "degraded";
  return "partial";
}

function resolveEventsLabel(loaded: boolean, count: number): string {
  if (!loaded) return "события не загружены";
  if (count === 0) return "важных событий нет";
  return `событий ${count}`;
}

export function PreparationCockpitPage() {
  const [showManualImport, setShowManualImport] = React.useState(false);
  const [manualEvents, setManualEvents] = React.useState<PreparationEvent[]>([]);

  const externalQuery = usePreparationExternal();
  const eventsQuery = usePreparationEvents();
  const screenerQuery = useScreenerQuery("all");

  const external = externalQuery.data;
  const events = eventsQuery.data;
  const isLoading = externalQuery.isLoading || eventsQuery.isLoading;

  const manualCalendar = React.useMemo(
    () => filterVisibleEvents(manualEvents.map(manualToCalendar)),
    [manualEvents],
  );

  const mergedEvents = React.useMemo(() => {
    if (!events?.loaded) {
      if (!manualCalendar.length) return null;
      return bucketCalendarEvents(manualCalendar);
    }
    const merged = filterVisibleEvents([
      ...events.today,
      ...events.tomorrow,
      ...events.week,
      ...manualCalendar,
    ]);
    return bucketCalendarEvents(merged);
  }, [events, manualCalendar]);

  const eventsLoaded = events?.loaded === true || manualCalendar.length > 0;
  const eventsCount =
    (mergedEvents?.today.length ?? 0) +
    (mergedEvents?.tomorrow.length ?? 0) +
    (mergedEvents?.week.length ?? 0);

  const dataQuality = resolveDataQuality(
    external?.status,
    eventsLoaded,
    events?.status,
    isLoading,
  );
  const updatedAt = external?.updatedAt ?? events?.updatedAt;
  const sourceCount =
    (external?.status === "live" || external?.status === "partial" ? 1 : 0) +
    (eventsLoaded ? 1 : 0);

  const summary = external?.summary ?? { tone: "calm" as const, line: "Загрузка…", moversCount: 0 };
  const groups = external?.groups ?? [];
  const noMovers = (external?.moversCount ?? 0) === 0;

  return (
    <div className="space-y-0.5 pb-4">
      <div className="flex h-12 items-center justify-between gap-2 border-b border-white/[0.05] pb-1">
        <div className="min-w-0">
          <h1 className="text-[13px] font-semibold leading-none text-lab-text-main">Подготовка</h1>
          <p className="mt-0.5 text-[9px] text-lab-text-dim">
            Премаркет · внешний фон · события · инструменты
          </p>
        </div>
        <PreparationDataQuality status={dataQuality} updatedAt={updatedAt} sourceCount={sourceCount || undefined} />
      </div>

      {!isLoading && external ? (
        <PreparationSummaryStrip
          summary={summary}
          eventsLabel={resolveEventsLabel(eventsLoaded, eventsCount)}
          externalStatus={external.status}
          updatedAt={external.updatedAt}
        />
      ) : null}

      <LabGlassPanel depth={20} className="mt-2 px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-mono text-[9px] uppercase tracking-wider text-lab-text-dim">Внешний фон</h2>
          {external?.status === "partial" ? (
            <span className="font-mono text-[8px] text-amber-200/80">данные частично</span>
          ) : null}
        </div>
        {externalQuery.isLoading ? (
          <p className="font-mono text-[10px] text-lab-text-dim">загрузка котировок…</p>
        ) : externalQuery.isError ? (
          <p className="font-mono text-[10px] text-rose-300/90">ошибка загрузки внешнего фона</p>
        ) : (
          <ExternalMoversGrid groups={groups} noMovers={noMovers} />
        )}
      </LabGlassPanel>

      <LabGlassPanel depth={20} className="mt-2 px-3 py-2.5">
        <h2 className="mb-2 font-mono text-[9px] uppercase tracking-wider text-lab-text-dim">События</h2>
        {eventsQuery.isLoading ? (
          <p className="font-mono text-[10px] text-lab-text-dim">загрузка календаря…</p>
        ) : (
          <ImportantEvents
            today={mergedEvents?.today ?? []}
            tomorrow={mergedEvents?.tomorrow ?? []}
            week={mergedEvents?.week ?? []}
            loaded={eventsLoaded}
            providers={events?.providers ?? []}
            onManualImport={() => setShowManualImport(true)}
          />
        )}
      </LabGlassPanel>

      <LabGlassPanel depth={20} className="mt-2 px-3 py-2.5">
        <h2 className="mb-2 font-mono text-[9px] uppercase tracking-wider text-lab-text-dim">Россия</h2>
        <RussiaContextStrip rows={screenerQuery.data?.rows ?? []} />
      </LabGlassPanel>

      <LabGlassPanel depth={10} className="mt-2 px-3 py-2">
        <h2 className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-lab-text-dim">Порядок эфира</h2>
        <BriefingOrder />
      </LabGlassPanel>

      {showManualImport ? (
        <LabGlassPanel depth={10} className="mt-2 px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-mono text-[9px] uppercase tracking-wider text-lab-text-dim">Ручной импорт</h2>
            <button
              type="button"
              onClick={() => setShowManualImport(false)}
              className="font-mono text-[9px] text-lab-text-dim hover:text-lab-text-main"
            >
              закрыть
            </button>
          </div>
          <ManualEventImport
            onAddEvent={(event) => setManualEvents((prev) => [...prev, event])}
            unparsedNotes={[]}
            onAddUnparsedNote={() => {}}
            onRemoveUnparsedNote={() => {}}
          />
        </LabGlassPanel>
      ) : null}
    </div>
  );
}
