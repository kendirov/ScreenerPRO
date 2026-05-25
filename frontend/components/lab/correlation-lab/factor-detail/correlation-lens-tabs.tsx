"use client";

import type { CorrelationFactorDetailResponse, CorrelationSignal } from "@/lib/domain/correlation-api";
import type { CorrelationFactorTheme } from "@/lib/domain/correlation-api-display";
import {
  type CorrelationLensTab,
  type CorrelationSortMode,
  type CorrelationWindowMode,
  sortSignals,
} from "@/lib/domain/correlation-factor-detail-display";
import { CorrelationCorrHeatmap } from "@/components/lab/correlation-lab/factor-detail/correlation-corr-heatmap";
import { CorrelationScatterLens } from "@/components/lab/correlation-lab/factor-detail/correlation-scatter-lens";
import { CorrelationSignalsList } from "@/components/lab/correlation-lab/factor-detail/correlation-signals-list";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { cn } from "@/lib/utils/cn";

const TABS: { id: CorrelationLensTab; label: string }[] = [
  { id: "lens", label: "Линза" },
  { id: "heatmap", label: "Теплокарта" },
  { id: "list", label: "Список" },
];

export function CorrelationLensTabs({
  detail,
  lensTab,
  onLensTabChange,
  sortMode,
  windowMode,
  theme,
  turnoverByTicker,
  selectedTicker,
  onSelectTicker,
}: {
  detail: CorrelationFactorDetailResponse;
  lensTab: CorrelationLensTab;
  onLensTabChange: (tab: CorrelationLensTab) => void;
  sortMode: CorrelationSortMode;
  windowMode: CorrelationWindowMode;
  theme: CorrelationFactorTheme;
  turnoverByTicker: Map<string, number>;
  selectedTicker: string | null;
  onSelectTicker: (ticker: string | null) => void;
}) {
  const sorted = sortSignals(detail.signals, sortMode);

  return (
    <LabGlassPanel depth={20} className={cn("overflow-hidden p-0", theme.border)}>
      <div className={cn("h-px bg-gradient-to-r opacity-80", theme.line)} aria-hidden />
      <div className="flex flex-wrap items-center gap-1 border-b border-lab-border-soft/30 px-3 py-2">
        <p className="mr-2 text-[10px] uppercase tracking-[0.12em] text-lab-dim">Correlation Lens</p>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onLensTabChange(tab.id)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] transition",
              lensTab === tab.id
                ? cn(theme.chip, "font-medium")
                : "text-lab-muted hover:text-lab-text",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-3">
        {lensTab === "lens" ? (
          <CorrelationScatterLens
            signals={sorted.length ? sorted : detail.signals}
            windowMode={windowMode}
            theme={theme}
            turnoverByTicker={turnoverByTicker}
            selectedTicker={selectedTicker}
            onSelectTicker={onSelectTicker}
          />
        ) : null}

        {lensTab === "heatmap" ? (
          <CorrelationCorrHeatmap
            signals={sorted.length ? sorted : detail.signals}
            windowMode={windowMode}
            theme={theme}
            selectedTicker={selectedTicker}
            onSelectTicker={onSelectTicker}
          />
        ) : null}

        {lensTab === "list" ? (
          <CorrelationSignalsList
            signals={sorted.length ? sorted : detail.signals}
            windowMode={windowMode}
            theme={theme}
            dataStatus={detail.meta.dataStatus}
            selectedTicker={selectedTicker}
            onSelectTicker={onSelectTicker}
          />
        ) : null}
      </div>
    </LabGlassPanel>
  );
}

export type { CorrelationSignal };
