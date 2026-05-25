"use client";

import { TrendingUp } from "lucide-react";
import { PreparationInstrumentRow } from "@/components/lab/preparation/preparation-instrument-row";
import type { PreparationCandlesResponse, ResolvedPreparationInstrument } from "@/lib/domain/preparation-watchlist";
import { findCandleSeries, resolveReasonTag } from "@/lib/domain/preparation-watchlist";
import { selectFocusInstruments } from "@/lib/domain/preparation-focus-instruments";
import { cn } from "@/lib/utils/cn";

export function PreparationInplayStrip({
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
    <div className={cn("lab-glass-panel flex h-full flex-col p-2.5", className)}>
      <div className="mb-2 flex items-center gap-1.5">
        <TrendingUp className="h-3.5 w-3.5 text-lab-green/80" />
        <h3 className="text-xs font-semibold text-lab-text">Что открыть</h3>
      </div>

      {instruments.length === 0 ? (
        <p className="text-[11px] text-lab-muted">Данных сегодня нет — выберите вручную</p>
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
            />
          ))}
        </ul>
      )}
    </div>
  );
}
