"use client";

import * as React from "react";
import { DomLadder } from "@/components/lab/orderflow-simulator/dom-ladder";
import { TapeBubbleLane } from "@/components/lab/orderflow-simulator/tape-bubble-lane";
import type { ExecutedLevelFlash, ScenarioAnnotation } from "@/lib/domain/orderflow-simulator-engine";
import type { SimClusterCell, SimIcebergLevel, SimOrderBookLevel, SimTradePrint } from "@/lib/domain/orderflow-simulator";
import { buildDomScrollLayout } from "@/lib/domain/dom-tape-layout";
import type { ClusterPulse, TapeLevelHighlight } from "@/lib/domain/tape-bubbles-model";
import { TAPE_MERGE_OPTIONS, type TapeMergeMs } from "@/lib/domain/tape-bubbles-model";
import type { PriceViewport } from "@/lib/domain/orderflow-price-viewport";
import type { LadderLevelCount } from "@/lib/domain/order-book-ladder-model";
import {
  DEFAULT_DOM_LADDER_SETTINGS,
  type DepthScalePreset,
  type LadderSettings,
} from "@/lib/domain/order-book-ladder-model";
import { cn } from "@/lib/utils/cn";

export type DomTapeStackProps = {
  levels: SimOrderBookLevel[];
  currentPrice: number;
  trades: SimTradePrint[];
  clusters?: SimClusterCell[];
  recentExecutedLevels?: ExecutedLevelFlash[];
  icebergs?: SimIcebergLevel[];
  annotations?: ScenarioAnnotation[];
  priceViewport: PriceViewport;
  tickMergeMs: TapeMergeMs;
  onTickMergeMsChange?: (ms: TapeMergeMs) => void;
  viewportAutoCenter?: boolean;
  onViewportAutoCenterChange?: (value: boolean) => void;
  onViewportLevelCountChange?: (count: LadderLevelCount) => void;
  onRecenterViewport?: () => void;
  onLevelHighlight?: (highlights: TapeLevelHighlight[]) => void;
  onClusterPulse?: (pulses: ClusterPulse[]) => void;
  showTeachingHints?: boolean;
  className?: string;
};

export function DomTapeStack({
  levels,
  currentPrice,
  trades,
  clusters = [],
  recentExecutedLevels = [],
  icebergs = [],
  annotations = [],
  priceViewport,
  tickMergeMs,
  onTickMergeMsChange,
  viewportAutoCenter = true,
  onViewportAutoCenterChange,
  onViewportLevelCountChange,
  onRecenterViewport,
  onLevelHighlight,
  onClusterPulse,
  showTeachingHints = false,
  className,
}: DomTapeStackProps) {
  const [settings, setSettings] = React.useState<LadderSettings>({
    ...DEFAULT_DOM_LADDER_SETTINGS,
    levelCount: priceViewport.levelsCount as LadderLevelCount,
    autoCenter: viewportAutoCenter,
  });
  const [scrollTop, setScrollTop] = React.useState(0);
  const [tapeHighlights, setTapeHighlights] = React.useState<TapeLevelHighlight[]>([]);

  React.useEffect(() => {
    setSettings((prev) => ({
      ...prev,
      levelCount: priceViewport.levelsCount as LadderLevelCount,
      autoCenter: viewportAutoCenter,
    }));
  }, [priceViewport.levelsCount, viewportAutoCenter]);

  const scrollLayout = React.useMemo(
    () => buildDomScrollLayout(priceViewport, currentPrice, settings.rowHeight),
    [priceViewport, currentPrice, settings.rowHeight],
  );

  const handleDomSettings = (next: LadderSettings) => {
    if (next.levelCount !== settings.levelCount) {
      onViewportLevelCountChange?.(next.levelCount);
    }
    if (next.autoCenter !== settings.autoCenter) {
      onViewportAutoCenterChange?.(next.autoCenter);
    }
    setSettings(next);
  };

  const handleHighlights = React.useCallback(
    (highlights: TapeLevelHighlight[]) => {
      setTapeHighlights(highlights);
      onLevelHighlight?.(highlights);
    },
    [onLevelHighlight],
  );

  const btn = (on: boolean) =>
    cn(
      "rounded px-1 py-px font-mono text-[8px] leading-tight transition",
      on ? "bg-white/[0.08] text-slate-200" : "text-slate-600 hover:text-slate-400",
    );

  return (
    <div
      className={cn(
        "dom-tape-stack flex min-h-0 w-full min-w-[176px] flex-col overflow-hidden rounded-none border-0 bg-[#010204]",
        className,
      )}
    >
      <div className="shrink-0 border-b border-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-slate-500">
        Стакан · лента · <span className="text-slate-600">симуляция</span>
      </div>

      <div className="dom-tape-stack-toolbar flex flex-wrap items-center gap-x-1 gap-y-0 border-b border-white/[0.04] bg-[#010204] px-1 py-px">
        <span className="text-[7px] uppercase tracking-widest text-slate-600">Складывать тики</span>
        {TAPE_MERGE_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            type="button"
            className={btn(tickMergeMs === opt.value)}
            onClick={() => onTickMergeMsChange?.(opt.value)}
          >
            {opt.label}
          </button>
        ))}
        <span className="mx-0.5 h-2.5 w-px bg-white/[0.06]" />
        <span className="text-[7px] text-slate-600">строки</span>
        {([40, 60, 80, 100] as const).map((n) => (
          <button
            key={n}
            type="button"
            className={btn(settings.levelCount === n)}
            onClick={() => handleDomSettings({ ...settings, levelCount: n })}
          >
            {n}
          </button>
        ))}
        <span className="mx-0.5 h-2.5 w-px bg-white/[0.06]" />
        <span className="text-[7px] text-slate-600">шкала</span>
        {([10000, 20000, 50000] as const).map((scale) => (
          <button
            key={scale}
            type="button"
            className={btn(settings.depthScale === scale)}
            onClick={() => handleDomSettings({ ...settings, depthScale: scale as DepthScalePreset })}
          >
            {scale / 1000}K
          </button>
        ))}
        <span className="mx-0.5 h-2.5 w-px bg-white/[0.06]" />
        {([16, 18, 22] as const).map((h) => (
          <button
            key={h}
            type="button"
            className={btn(settings.rowHeight === h)}
            onClick={() => handleDomSettings({ ...settings, rowHeight: h })}
          >
            {h}px
          </button>
        ))}
        <button
          type="button"
          className={btn(settings.showRoundPrints)}
          onClick={() => handleDomSettings({ ...settings, showRoundPrints: !settings.showRoundPrints })}
        >
          круги
        </button>
        <button
          type="button"
          className={btn(settings.autoCenter)}
          onClick={() => handleDomSettings({ ...settings, autoCenter: !settings.autoCenter })}
        >
          центр
        </button>
        {onRecenterViewport ? (
          <button type="button" className={btn(false)} onClick={onRecenterViewport}>
            ↻
          </button>
        ) : null}
      </div>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div
          className="pointer-events-none absolute left-0 top-0 z-[6] w-[64px]"
          style={{ height: scrollLayout.contentHeightPx }}
        >
          <TapeBubbleLane
            trades={trades}
            priceViewport={priceViewport}
            currentPrice={currentPrice}
            aggregationWindowMs={tickMergeMs}
            rowHeightPx={settings.rowHeight}
            scrollTopPx={scrollTop}
            scrollLayout={scrollLayout}
            contentHeightPx={scrollLayout.contentHeightPx}
            embedded
            onLevelHighlight={handleHighlights}
            onClusterPulse={onClusterPulse}
            className="pointer-events-auto h-full w-[64px]"
          />
        </div>

        <DomLadder
          levels={levels}
          currentPrice={currentPrice}
          trades={trades}
          clusters={clusters}
          icebergs={icebergs}
          recentExecutedLevels={recentExecutedLevels}
          tapeHighlights={tapeHighlights}
          priceViewport={priceViewport}
          viewportAutoCenter={viewportAutoCenter}
          onViewportAutoCenterChange={onViewportAutoCenterChange}
          onViewportLevelCountChange={onViewportLevelCountChange}
          onRecenterViewport={onRecenterViewport}
          showTeachingHints={showTeachingHints}
          stacked
          ladderSettings={settings}
          onLadderSettingsChange={handleDomSettings}
          scrollLayout={scrollLayout}
          onScrollTopChange={setScrollTop}
          className="dom-ladder--stacked min-w-0 flex-1 pl-[64px]"
        />
      </div>
    </div>
  );
}
