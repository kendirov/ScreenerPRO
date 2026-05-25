"use client";

import { BarChart3 } from "lucide-react";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { PreparationInstrumentRow } from "@/components/lab/preparation/preparation-instrument-row";
import type { PreparationCandlesResponse, ResolvedPreparationInstrument } from "@/lib/domain/preparation-watchlist";
import { findCandleSeries, resolveReasonTag } from "@/lib/domain/preparation-watchlist";
import { selectFocusInstruments } from "@/lib/domain/preparation-focus-instruments";
import { cn } from "@/lib/utils/cn";

export function PreparationInstrumentsCompact({
  watchlist,
  candlesResponse,
  hasLiveData,
  selectedInstrumentIds,
  onToggleInstrument,
  limit = 6,
  className,
}: {
  watchlist: ResolvedPreparationInstrument[];
  candlesResponse?: PreparationCandlesResponse;
  hasLiveData: boolean;
  selectedInstrumentIds: ReadonlySet<string>;
  onToggleInstrument: (id: string) => void;
  limit?: number;
  className?: string;
}) {
  const instruments = selectFocusInstruments(watchlist, candlesResponse, limit);

  return (
    <LabGlassPanel depth={20} className={cn("flex h-full flex-col p-2.5", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5 text-lab-cyan/85" />
          <h3 className="text-xs font-semibold text-lab-text">Инструменты</h3>
          <span className="font-mono text-[9px] text-lab-dim">до {limit}</span>
        </div>
        {hasLiveData ? (
          <span className="lab-chip lab-chip-moex px-1.5 py-px text-[8px]">MOEX ISS</span>
        ) : (
          <span className="lab-chip px-1.5 py-px text-[8px] text-lab-muted">нет live</span>
        )}
      </div>

      {instruments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-lab-border/60 px-2 py-4 text-center text-[11px] text-lab-muted">
          Данных сегодня нет — выберите инструменты вручную или дождитесь MOEX ISS
        </p>
      ) : (
        <ul className="space-y-1">
          {instruments.map((instrument) => (
            <PreparationInstrumentRow
              key={instrument.id}
              instrument={instrument}
              candleSeries={findCandleSeries(candlesResponse?.series ?? [], instrument)}
              reasonTag={resolveReasonTag(instrument, instrument.screenerRow)}
              hasLiveMetrics={hasLiveData}
              selected={selectedInstrumentIds.has(instrument.id)}
              onToggleBriefing={() => onToggleInstrument(instrument.id)}
              showDataStatus
            />
          ))}
        </ul>
      )}
    </LabGlassPanel>
  );
}
