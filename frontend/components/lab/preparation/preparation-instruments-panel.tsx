"use client";



import * as React from "react";

import { TrendingUp } from "lucide-react";

import { LabLoadingState } from "@/components/lab/lab-ui";

import { PreparationInstrumentCard } from "@/components/lab/preparation/preparation-instrument-card";

import { PreparationInstrumentRow } from "@/components/lab/preparation/preparation-instrument-row";

import type { ScreenerRow } from "@screenerpro/shared";

import { summarizePreparationCandlesDiagnostics } from "@/lib/domain/market-data-status";

import { selectFocusInstruments } from "@/lib/domain/preparation-focus-instruments";

import {

  PREPARATION_WATCHLIST_TAB_LABELS,

  buildPreparationWatchlist,

  filterWatchlistByTab,

  findCandleSeries,

  resolveReasonTag,

  type PreparationCandlesResponse,

  type PreparationWatchlistTab,

} from "@/lib/domain/preparation-watchlist";

import { cn } from "@/lib/utils/cn";



export type PreparationInstrumentsPanelMode = "focus" | "all" | "groups";



const PANEL_MODE_LABELS: Record<PreparationInstrumentsPanelMode, string> = {

  focus: "Фокус",

  all: "Все",

  groups: "Группы",

};



const GROUP_TAB_KEYS: PreparationWatchlistTab[] = [

  "external",

  "commodities",

  "currency",

  "index",

  "bluechips",

  "inplay",

];



export function PreparationInstrumentsPanel({

  rows,

  hasLiveData,

  isLoading,

  selectedInstrumentIds,

  onToggleInstrument,

  candlesResponse,

  candlesLoading,

  defaultPanelMode = "focus",

  forcedPanelMode,

  compactHeader = false,

  hideDiagnostics = false,

  className,

}: {

  rows: ScreenerRow[];

  hasLiveData: boolean;

  isLoading?: boolean;

  selectedInstrumentIds: ReadonlySet<string>;

  onToggleInstrument: (instrumentId: string) => void;

  candlesResponse?: PreparationCandlesResponse;

  candlesLoading?: boolean;

  defaultPanelMode?: PreparationInstrumentsPanelMode;

  forcedPanelMode?: PreparationInstrumentsPanelMode;

  compactHeader?: boolean;

  hideDiagnostics?: boolean;

  className?: string;

}) {

  const [panelMode, setPanelMode] = React.useState<PreparationInstrumentsPanelMode>(defaultPanelMode);

  const [groupTab, setGroupTab] = React.useState<PreparationWatchlistTab>("currency");



  const activeMode = forcedPanelMode ?? panelMode;



  const watchlist = React.useMemo(() => buildPreparationWatchlist(rows), [rows]);

  const focusItems = React.useMemo(

    () => selectFocusInstruments(watchlist, candlesResponse, 6),

    [watchlist, candlesResponse],

  );

  const groupItems = React.useMemo(

    () => filterWatchlistByTab(watchlist, groupTab),

    [watchlist, groupTab],

  );



  const visible =

    activeMode === "focus" ? focusItems : activeMode === "groups" ? groupItems : watchlist;



  const candlesDiagnostics = React.useMemo(

    () => summarizePreparationCandlesDiagnostics(candlesResponse, watchlist, candlesLoading),

    [candlesResponse, watchlist, candlesLoading],

  );



  return (

    <section className={cn(compactHeader ? "" : "lab-glass-panel relative overflow-hidden p-3", className)}>

      <div className={cn("relative", compactHeader ? "mb-2" : "mb-3")}>

        <div className="flex flex-wrap items-center justify-between gap-2">

          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-lab-green/90">
            <TrendingUp className="h-3.5 w-3.5" />
            Что открыть
          </h3>

          {!forcedPanelMode ? (

            <div className="flex flex-wrap gap-1">

              {(Object.keys(PANEL_MODE_LABELS) as PreparationInstrumentsPanelMode[]).map((mode) => (

                <button

                  key={mode}

                  type="button"

                  onClick={() => setPanelMode(mode)}

                  className={cn(

                    "lab-status-chip px-2 py-0.5 text-[10px] transition",

                    activeMode === mode

                      ? "border-lab-green/35 bg-lab-green/10 text-lab-green"

                      : "text-lab-muted hover:text-lab-text",

                  )}

                >

                  {PANEL_MODE_LABELS[mode]}

                </button>

              ))}

            </div>

          ) : null}

        </div>



        {!hideDiagnostics && !compactHeader && candlesLoading ? (

          <p className="mt-1 font-mono text-[9px] text-lab-dim">свечи · загрузка…</p>

        ) : !hideDiagnostics && !compactHeader ? (

          <p className="mt-1 font-mono text-[9px] text-lab-cyan/80">{candlesDiagnostics.summaryLine}</p>

        ) : null}

      </div>



      {activeMode === "groups" ? (

        <div className="mb-2 flex flex-wrap gap-1">

          {GROUP_TAB_KEYS.map((key) => (

            <button

              key={key}

              type="button"

              onClick={() => setGroupTab(key)}

              className={cn(

                "lab-status-chip px-2 py-0.5 text-[10px] transition",

                groupTab === key

                  ? "border-lab-cyan/35 bg-lab-cyan/10 text-lab-cyan"

                  : "text-lab-muted hover:text-lab-text",

              )}

            >

              {PREPARATION_WATCHLIST_TAB_LABELS[key]}

            </button>

          ))}

        </div>

      ) : null}



      {isLoading ? (

        <LabLoadingState message="Загрузка скринера…" />

      ) : visible.length === 0 ? (

        <div className="rounded-lg border border-dashed border-lab-border px-3 py-6 text-center">

          <p className="text-sm text-lab-muted">Нет инструментов в выбранном режиме.</p>

        </div>

      ) : activeMode === "focus" ? (

        <ul className="space-y-1">

          {visible.map((instrument) => (

            <PreparationInstrumentRow

              key={instrument.id}

              instrument={instrument}

              candleSeries={findCandleSeries(candlesResponse?.series ?? [], instrument)}

              reasonTag={resolveReasonTag(instrument, instrument.screenerRow)}

              hasLiveMetrics={hasLiveData}

              selected={selectedInstrumentIds.has(instrument.id)}

              onToggleBriefing={() => onToggleInstrument(instrument.id)}

            />

          ))}

        </ul>

      ) : (

        <div className="grid gap-2 sm:grid-cols-2">

          {visible.map((instrument) => (

            <PreparationInstrumentCard

              key={instrument.id}

              instrument={instrument}

              candleSeries={findCandleSeries(candlesResponse?.series ?? [], instrument)}

              reasonTag={resolveReasonTag(instrument, instrument.screenerRow)}

              viewMode="grid"

              hasLiveMetrics={hasLiveData}

              selected={selectedInstrumentIds.has(instrument.id)}

              onToggleBriefing={() => onToggleInstrument(instrument.id)}

            />

          ))}

        </div>

      )}

    </section>

  );

}


