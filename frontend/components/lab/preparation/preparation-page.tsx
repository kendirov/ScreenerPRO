"use client";

import * as React from "react";
import { LabPageShell } from "@/components/lab/lab-page-shell";
import { BriefingModeSwitch } from "@/components/lab/preparation/briefing-mode-switch";
import { BriefingOutlinePanel } from "@/components/lab/preparation/briefing-outline-panel";
import { BriefingScriptPanel } from "@/components/lab/preparation/briefing-script-panel";
import { DriverBoard } from "@/components/lab/preparation/driver-board";
import { EventRadar } from "@/components/lab/preparation/event-radar";
import { ManualEventImport } from "@/components/lab/preparation/manual-event-import";
import { PreparationBriefingFocus } from "@/components/lab/preparation/preparation-briefing-focus";
import { PreparationCollapsibleSection } from "@/components/lab/preparation/preparation-collapsible-section";
import { PreparationInflationLabCard } from "@/components/lab/preparation/preparation-inflation-lab-card";
import { PreparationInstrumentsPanel } from "@/components/lab/preparation/preparation-instruments-panel";
import { PreparationPremarketGrid } from "@/components/lab/preparation/preparation-premarket-grid";
import { PreparationReadHint } from "@/components/lab/preparation/preparation-read-hint";
import { PreparationSourcePanel } from "@/components/lab/preparation/preparation-source-panel";
import { PreparationSourceStatus } from "@/components/lab/preparation/preparation-source-status";
import type { BriefingMode } from "@/components/lab/preparation/preparation-types";
import { DEMO_MARKET_DRIVERS } from "@/lib/domain/preparation-demo-data";
import {
  buildBriefingOutline,
  countBriefingSelections,
  toggleBriefingSelection,
} from "@/lib/domain/preparation-briefing-outline";
import {
  defaultEventFilterForMode,
  filterEventsForMode,
  type PreparationEvent,
} from "@/lib/domain/preparation-events";
import type { UnparsedEventNote } from "@/lib/domain/preparation-manual-import";
import {
  applyFocusItemsToBriefing,
  buildPreparationFocusPack,
  type PreparationFocusItem,
} from "@/lib/domain/preparation-focus-score";
import { summarizePreparationCandlesDiagnostics } from "@/lib/domain/market-data-status";
import { buildPreparationWatchlist } from "@/lib/domain/preparation-watchlist";
import {
  mergePreparationEventsBySource,
  type PreparationEventSourceFilter,
} from "@/lib/domain/smartlab-calendar";
import { usePreparationCandles } from "@/lib/hooks/use-preparation-candles";
import { useSmartLabCalendar } from "@/lib/hooks/use-smartlab-calendar";
import { useWeeklyInflationBrief } from "@/lib/hooks/use-weekly-inflation-brief";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";

const PAGE_PILLS = [
  { label: "ЧЕРНОВИК", tone: "meta" as const },
  { label: "LAB", tone: "accent" as const },
  { label: "MOEX ISS", tone: "source" as const },
  { label: "Smart-Lab", tone: "meta" as const },
];

const PAGE_DESCRIPTION =
  "Премаркет-пульт: фокус, события, инструменты и порядок эфира — на одном экране.";

export function PreparationLegacyPage() {
  const [mode, setMode] = React.useState<BriefingMode>("day");
  const [eventSourceFilter, setEventSourceFilter] = React.useState<PreparationEventSourceFilter>("smartlab");
  const [selectedEventIds, setSelectedEventIds] = React.useState<Set<string>>(() => new Set());
  const [selectedInstrumentIds, setSelectedInstrumentIds] = React.useState<Set<string>>(() => new Set());
  const [manualEvents, setManualEvents] = React.useState<PreparationEvent[]>([]);
  const [unparsedNotes, setUnparsedNotes] = React.useState<UnparsedEventNote[]>([]);

  const query = useScreenerQuery("all");
  const inflationBrief = useWeeklyInflationBrief();
  const smartLabQuery = useSmartLabCalendar(mode);

  const rows = query.data?.rows ?? [];
  const hasLiveData = query.data?.status?.source === "moex";
  const smartLabEvents = smartLabQuery.data?.events ?? [];

  const mergedEvents = React.useMemo(
    () =>
      mergePreparationEventsBySource({
        manualEvents,
        smartLabEvents,
        sourceFilter: eventSourceFilter,
      }),
    [manualEvents, smartLabEvents, eventSourceFilter],
  );

  const watchlist = React.useMemo(() => buildPreparationWatchlist(rows), [rows]);
  const candlesQuery = usePreparationCandles(watchlist, 5);

  const eventFilter = defaultEventFilterForMode(mode);
  const visibleEvents = React.useMemo(
    () => filterEventsForMode(mergedEvents, mode, eventFilter),
    [mergedEvents, eventFilter, mode],
  );

  const selectionCount = countBriefingSelections(selectedEventIds, selectedInstrumentIds);

  const focusPack = React.useMemo(
    () =>
      buildPreparationFocusPack({
        events: visibleEvents,
        drivers: DEMO_MARKET_DRIVERS,
        watchlist,
        candlesResponse: candlesQuery.data,
        hasLiveData,
        selectedEventIds,
        selectedInstrumentIds,
      }),
    [visibleEvents, watchlist, candlesQuery.data, hasLiveData, selectedEventIds, selectedInstrumentIds],
  );

  const outline = React.useMemo(
    () =>
      buildBriefingOutline({
        mode,
        events: mergedEvents,
        instruments: watchlist,
        drivers: DEMO_MARKET_DRIVERS,
        selectedEventIds,
        selectedInstrumentIds,
      }),
    [mode, mergedEvents, watchlist, selectedEventIds, selectedInstrumentIds],
  );

  const candlesDiagnostics = React.useMemo(
    () => summarizePreparationCandlesDiagnostics(candlesQuery.data, watchlist, candlesQuery.isLoading),
    [watchlist, candlesQuery.data, candlesQuery.isLoading],
  );

  const smartLabUiStatus: "ok" | "empty" | "error" | "loading" = smartLabQuery.isLoading
    ? "loading"
    : smartLabQuery.data?.status === "ok"
      ? "ok"
      : smartLabQuery.data?.status === "empty"
        ? "empty"
        : "error";

  React.useEffect(() => {
    if (smartLabQuery.isLoading) return;
    if (smartLabQuery.data?.status === "ok" && smartLabEvents.length > 0) {
      setEventSourceFilter((prev) => (prev === "manual" ? prev : "smartlab"));
    } else if (smartLabQuery.data?.status === "error" || smartLabQuery.data?.status === "empty") {
      setEventSourceFilter((prev) => (prev === "smartlab" ? "manual" : prev));
    }
  }, [smartLabQuery.isLoading, smartLabQuery.data?.status, smartLabEvents.length]);

  const toggleEvent = (id: string) => setSelectedEventIds((prev) => toggleBriefingSelection(prev, id));
  const toggleInstrument = (id: string) =>
    setSelectedInstrumentIds((prev) => toggleBriefingSelection(prev, id));

  const applyFocusToBriefing = React.useCallback((items: PreparationFocusItem[]) => {
    const { eventIds, instrumentIds } = applyFocusItemsToBriefing(items);
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      for (const id of eventIds) next.add(id);
      return next;
    });
    setSelectedInstrumentIds((prev) => {
      const next = new Set(prev);
      for (const id of instrumentIds) next.add(id);
      return next;
    });
  }, []);

  return (
    <LabPageShell
      title="Подготовка"
      description={PAGE_DESCRIPTION}
      pills={PAGE_PILLS}
      modeControl={<BriefingModeSwitch mode={mode} onModeChange={setMode} />}
    >
      <div className="space-y-2">
        <PreparationBriefingFocus focus={focusPack} onApplyToBriefing={applyFocusToBriefing} />

        <PreparationInflationLabCard />

        <PreparationPremarketGrid
          events={visibleEvents}
          watchlist={watchlist}
          outline={outline}
          candlesResponse={candlesQuery.data}
          hasLiveData={hasLiveData}
          selectedEventIds={selectedEventIds}
          selectedInstrumentIds={selectedInstrumentIds}
          onToggleEvent={toggleEvent}
          onToggleInstrument={toggleInstrument}
          eventSourceFilter={eventSourceFilter}
          onEventSourceChange={setEventSourceFilter}
          smartLabStatus={smartLabUiStatus}
          inflationAirOrderLine={inflationBrief.airOrderLine}
        />

        {selectionCount > 0 ? (
          <p className="px-0.5 font-mono text-[10px] text-lab-violet/85">в эфире: {selectionCount}</p>
        ) : null}

        <PreparationCollapsibleSection
          title="Подробный календарь"
          subtitle="Фильтры · карточки · доска драйверов"
          accent="amber"
          defaultOpen={false}
        >
          <PreparationReadHint />
          <EventRadar
            mode={mode}
            events={mergedEvents}
            manualEventCount={manualEvents.length}
            smartLabEventCount={smartLabEvents.length}
            smartLabWarning={smartLabQuery.data?.diagnostics.warning}
            eventSourceFilter={eventSourceFilter}
            onEventSourceChange={setEventSourceFilter}
            smartLabStatus={smartLabUiStatus}
            selectedEventIds={selectedEventIds}
            onToggleEvent={toggleEvent}
          />
          <DriverBoard mode={mode} />
        </PreparationCollapsibleSection>

        <PreparationCollapsibleSection
          title="Все инструменты"
          subtitle="Полный watchlist · группы · карточки"
          accent="green"
          defaultOpen={false}
        >
          <PreparationInstrumentsPanel
            rows={query.isError ? [] : rows}
            hasLiveData={hasLiveData}
            isLoading={query.isLoading}
            selectedInstrumentIds={selectedInstrumentIds}
            onToggleInstrument={toggleInstrument}
            candlesResponse={candlesQuery.data}
            candlesLoading={candlesQuery.isLoading}
            forcedPanelMode="all"
            compactHeader
          />
        </PreparationCollapsibleSection>

        <PreparationCollapsibleSection
          title="Ручной импорт"
          subtitle="Событие · неразобранные заметки"
          accent="amber"
          defaultOpen={false}
        >
          <ManualEventImport
            onAddEvent={(event) => setManualEvents((prev) => [...prev, event])}
            unparsedNotes={unparsedNotes}
            onAddUnparsedNote={(note) => setUnparsedNotes((prev) => [...prev, note])}
            onRemoveUnparsedNote={(id) => setUnparsedNotes((prev) => prev.filter((n) => n.id !== id))}
          />
        </PreparationCollapsibleSection>

        <PreparationCollapsibleSection
          title="Источники и диагностика"
          subtitle="MOEX ISS · Smart-Lab · свечи · реестр"
          accent="cyan"
          defaultOpen={false}
        >
          <PreparationSourceStatus
            screenerData={query.data}
            isLoading={query.isLoading}
            isError={query.isError}
            smartLabStatus={smartLabUiStatus}
          />
          <p className="mt-2 font-mono text-[9px] text-lab-cyan/80">{candlesDiagnostics.summaryLine}</p>
          <div className="mt-3">
            <PreparationSourcePanel
              isLiveMoex={hasLiveData}
              candlesResponse={candlesQuery.data}
              candlesLoading={candlesQuery.isLoading}
              watchlist={watchlist}
            />
          </div>
        </PreparationCollapsibleSection>

        <PreparationCollapsibleSection
          title="Черновик текста"
          subtitle="Структура · Telegram"
          accent="violet"
          defaultOpen={false}
        >
          <div className="grid gap-3 xl:grid-cols-2">
            <BriefingOutlinePanel outline={outline} />
            <BriefingScriptPanel
              mode={mode}
              outline={outline}
              drivers={DEMO_MARKET_DRIVERS}
              inflationBrief={inflationBrief}
            />
          </div>
        </PreparationCollapsibleSection>
      </div>
    </LabPageShell>
  );
}
