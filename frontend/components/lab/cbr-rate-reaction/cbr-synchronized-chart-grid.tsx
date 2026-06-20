"use client";

import * as React from "react";
import type { Time } from "lightweight-charts";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { CbrReactionIntradayChart } from "@/components/lab/cbr-rate-reaction/cbr-reaction-intraday-chart";
import {
  CBR_REPLAY_MODE_HINTS,
  CBR_REPLAY_MODE_LABELS,
  type CbrReplayMarketMode,
} from "@/lib/cbr/cbr-replay-market-mode";
import { CBR_REPLAY_NO_DATA_MESSAGE } from "@/lib/cbr/cbr-replay-data-quality";
import type { CbrReplayDataQualityResult } from "@/lib/cbr/cbr-replay-data-quality";
import { getReplayDataQualityFromSlots } from "@/lib/cbr/cbr-replay-data-quality";
import {
  buildCbrReactionChartGridModel,
  buildCbrReactionChartGridSkeleton,
  CBR_CHART_TIMEFRAME_LABELS,
  CBR_CHART_TIMEFRAMES,
  slotHasMoexCandles,
  type CbrChartRenderMode,
  type CbrChartTimeframe,
  type CbrReactionChartGridModel,
} from "@/lib/domain/cbr-rate-chart-model";
import { CBR_SESSION_END_MSK, CBR_SESSION_START_MSK } from "@/lib/domain/cbr-rate-event-window";
import type { CbrRateEvent } from "@/lib/domain/cbr-rate-events";
import { cn } from "@/lib/utils/cn";

export function CbrSynchronizedChartGrid({
  event,
  replayMode,
  dataQuality: dataQualityProp,
  onReplayModeChange,
  onModelChange,
  onLoadingChange,
}: {
  event: CbrRateEvent;
  replayMode: CbrReplayMarketMode;
  dataQuality?: CbrReplayDataQualityResult | null;
  onReplayModeChange: (mode: CbrReplayMarketMode) => void;
  onModelChange?: (model: CbrReactionChartGridModel) => void;
  onLoadingChange?: (loading: boolean) => void;
}) {
  const [timeframe, setTimeframe] = React.useState<CbrChartTimeframe>(5);
  const renderMode: CbrChartRenderMode = "candles";
  const [syncTime, setSyncTime] = React.useState<Time | null>(null);
  const [syncSource, setSyncSource] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [model, setModel] = React.useState<CbrReactionChartGridModel>(() =>
    buildCbrReactionChartGridSkeleton(event, 5, renderMode, replayMode),
  );

  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    onLoadingChange?.(true);
    setSyncTime(null);
    setSyncSource(null);
    setModel(buildCbrReactionChartGridSkeleton(event, timeframe, renderMode, replayMode));

    buildCbrReactionChartGridModel(event, timeframe, renderMode, {
      signal: controller.signal,
      replayMode,
    })
      .then((next) => {
        if (!controller.signal.aborted) {
          setModel(next);
          onModelChange?.(next);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setModel({
          ...buildCbrReactionChartGridSkeleton(event, timeframe, renderMode, replayMode),
          loadError: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          onLoadingChange?.(false);
        }
      });

    return () => controller.abort();
  }, [event, timeframe, renderMode, replayMode, onModelChange, onLoadingChange]);

  const handleSyncTime = React.useCallback((time: Time | null, sourceId: string) => {
    setSyncTime(time);
    setSyncSource(sourceId);
  }, []);

  const liveSlotCount = model.slots.filter(slotHasMoexCandles).length;
  const totalSlots = model.slots.length;
  const dataQuality =
    dataQualityProp ??
    (!loading ? getReplayDataQualityFromSlots(event, model.slots, replayMode) : null);
  const showEmptyState = !loading && dataQuality?.showEmptyState;

  return (
    <LabGlassPanel depth={10} className="relative p-2 sm:p-2.5">
      <div className="relative mb-2 flex flex-wrap items-center justify-end gap-2 border-b border-lab-border/25 pb-1.5">
        <div className="mr-auto flex min-w-0 flex-col gap-0.5">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-lab-dim">
            Графики · MOEX
          </span>
          <span className="font-mono text-[9px] tabular-nums text-lab-dim/90">
            {CBR_SESSION_START_MSK}–{CBR_SESSION_END_MSK} МСК
            {!loading && liveSlotCount > 0 ? ` · ${liveSlotCount}/${totalSlots}` : ""}
          </span>
          <span className="text-[8px] text-lab-dim/90">
            {CBR_REPLAY_MODE_LABELS[replayMode]} · {CBR_REPLAY_MODE_HINTS[replayMode]}
          </span>
        </div>
        <ToggleGroup
          label="режим"
          value={replayMode}
          options={[
            { id: "equities", label: "Акции" },
            { id: "currency", label: "Валюта" },
            { id: "derivatives", label: "Срочный" },
          ]}
          onChange={(v) => onReplayModeChange(v as CbrReplayMarketMode)}
        />
        <ToggleGroup
          label="ТФ"
          value={String(timeframe)}
          options={CBR_CHART_TIMEFRAMES.map((tf) => ({
            id: String(tf),
            label: CBR_CHART_TIMEFRAME_LABELS[tf],
          }))}
          onChange={(v) => setTimeframe(Number(v) as CbrChartTimeframe)}
        />
      </div>

      {model.loadError ? (
        <p className="mb-2 rounded border border-rose-400/30 bg-rose-500/8 px-2 py-1 text-[9px] text-rose-100/90">
          {model.loadError}
        </p>
      ) : null}

      {showEmptyState ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-lab-border/40 bg-lab-bg-deep/30 px-4 py-8 text-center">
          <span className="rounded border border-lab-border/45 bg-lab-bg-deep/70 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-lab-dim">
            NO DATA
          </span>
          <p className="max-w-md text-[11px] leading-snug text-lab-muted">
            {CBR_REPLAY_NO_DATA_MESSAGE}
          </p>
        </div>
      ) : (
      <div className={cn("grid grid-cols-1 gap-2 lg:grid-cols-2", loading && "opacity-95")}>
        {model.slots.map((slot) => (
          <CbrReactionIntradayChart
            key={`${event.id}-${replayMode}-${slot.id}-${slot.resolvedSecid ?? slot.secid}`}
            slotId={slot.id}
            slot={slot}
            markers={model.markers}
            window={model.window}
            renderMode={renderMode}
            syncTime={syncSource !== slot.id ? syncTime : null}
            onSyncTime={handleSyncTime}
            loading={loading && !slot.placeholder && slot.candles.length === 0}
            compact
            showDataBadge
            marketSegment={replayMode}
          />
        ))}
      </div>
      )}
    </LabGlassPanel>
  );
}

function ToggleGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] uppercase tracking-wide text-lab-dim">{label}</span>
      <div className="flex rounded-md border border-lab-border/55 bg-lab-bg-deep/50 p-0.5">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors",
              value === opt.id ? "bg-lab-violet/25 text-lab-text" : "text-lab-muted hover:text-lab-text",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** @deprecated use CbrSynchronizedChartGrid */
export const CbrReactionChartGrid = CbrSynchronizedChartGrid;

/** @deprecated */
export const CbrRateReactionChartGrid = CbrSynchronizedChartGrid;
