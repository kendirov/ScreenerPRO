"use client";

import * as React from "react";
import { DomFocusTeachingBar } from "@/components/lab/orderflow-simulator/dom-focus-teaching-bar";
import { DomLadder } from "@/components/lab/orderflow-simulator/dom-ladder";
import { DomLadderSettings } from "@/components/lab/orderflow-simulator/dom-ladder-settings";
import { DomLevelInspectorPanel } from "@/components/lab/orderflow-simulator/dom-level-inspector-panel";
import { SimulatorScenarioBar } from "@/components/lab/orderflow-simulator/simulator-scenario-bar";
import { SimulatorTradeStrip } from "@/components/lab/orderflow-simulator/simulator-trade-strip";
import { SimulatedCandleChart } from "@/components/lab/orderflow-simulator/simulated-candle-chart";
import { TapeBubbleLane } from "@/components/lab/orderflow-simulator/tape-bubble-lane";
import type { OrderflowEngineState, OrderflowSimulatorAction } from "@/lib/domain/orderflow-simulator-engine";
import { buildDomScrollLayout } from "@/lib/domain/dom-tape-layout";
import type { DomFocusDemoKind, DomFocusLevelSelection, DomFocusTeachingHighlight } from "@/lib/domain/dom-focus-teaching";
import { resolveDomFocusDemo } from "@/lib/domain/dom-focus-teaching";
import type { DomLevelTooltipData } from "@/lib/domain/order-book-ladder-model";
import {
  buildDomLevelTooltip,
  computeDepthStats,
  DEFAULT_DOM_LADDER_SETTINGS,
  resolveDepthScale,
  type LadderLevelCount,
  type LadderSettings,
} from "@/lib/domain/order-book-ladder-model";
import { pricesEqual } from "@/lib/domain/order-book-ladder-model";
import type { PriceViewport } from "@/lib/domain/orderflow-price-viewport";
import { TAPE_MERGE_OPTIONS, type TapeMergeMs } from "@/lib/domain/tape-bubbles-model";
import { cn } from "@/lib/utils/cn";

const LARGE_DEFAULT_SETTINGS: LadderSettings = {
  ...DEFAULT_DOM_LADDER_SETTINGS,
  rowHeight: 18,
  levelCount: 80,
};

export type LargeDomWorkspaceProps = {
  state: OrderflowEngineState;
  dispatch: React.Dispatch<OrderflowSimulatorAction>;
  priceViewport: PriceViewport;
  tickMergeMs: TapeMergeMs;
  onTickMergeMsChange: (ms: TapeMergeMs) => void;
  viewportAutoCenter: boolean;
  onViewportAutoCenterChange: (value: boolean) => void;
  onViewportLevelCountChange: (count: LadderLevelCount) => void;
  onRecenterViewport: () => void;
  tradeSize: number;
  onTradeSizeChange: (size: number) => void;
  limitSize: number;
  onLimitSizeChange: (size: number) => void;
  className?: string;
};

export function LargeDomWorkspace({
  state,
  dispatch,
  priceViewport,
  tickMergeMs,
  onTickMergeMsChange,
  viewportAutoCenter,
  onViewportAutoCenterChange,
  onViewportLevelCountChange,
  onRecenterViewport,
  tradeSize,
  onTradeSizeChange,
  limitSize,
  onLimitSizeChange,
  className,
}: LargeDomWorkspaceProps) {
  const [settings, setSettings] = React.useState<LadderSettings>({
    ...LARGE_DEFAULT_SETTINGS,
    levelCount: priceViewport.levelsCount as LadderLevelCount,
    autoCenter: viewportAutoCenter,
  });
  const [scrollTop, setScrollTop] = React.useState(0);
  const [tapeHighlights, setTapeHighlights] = React.useState<import("@/lib/domain/tape-bubbles-model").TapeLevelHighlight[]>([]);
  const [selectedLevel, setSelectedLevel] = React.useState<DomFocusLevelSelection | null>(null);
  const [inspectorData, setInspectorData] = React.useState<DomLevelTooltipData | null>(null);
  const [teachingHighlights, setTeachingHighlights] = React.useState<DomFocusTeachingHighlight[]>([]);
  const [teachingCaption, setTeachingCaption] = React.useState<string | null>(null);
  const [activeDemo, setActiveDemo] = React.useState<DomFocusDemoKind | null>(null);

  React.useEffect(() => {
    setSettings((prev) => ({
      ...prev,
      levelCount: priceViewport.levelsCount as LadderLevelCount,
      autoCenter: viewportAutoCenter,
    }));
  }, [priceViewport.levelsCount, viewportAutoCenter]);

  const scrollLayout = React.useMemo(
    () => buildDomScrollLayout(priceViewport, state.currentPrice, settings.rowHeight),
    [priceViewport, state.currentPrice, settings.rowHeight],
  );

  const handleSettings = (next: LadderSettings) => {
    if (next.levelCount !== settings.levelCount) onViewportLevelCountChange(next.levelCount);
    if (next.autoCenter !== settings.autoCenter) onViewportAutoCenterChange(next.autoCenter);
    setSettings(next);
  };

  const handleLevelSelect = React.useCallback((sel: DomFocusLevelSelection, tooltip: DomLevelTooltipData) => {
    setSelectedLevel(sel);
    setInspectorData(tooltip);
  }, []);

  const handleDemo = React.useCallback(
    (kind: DomFocusDemoKind) => {
      const result = resolveDomFocusDemo(kind, state.levels, state.currentPrice, state.clusters, state.candles);
      setActiveDemo(kind);
      setTeachingHighlights(result.highlights);
      setTeachingCaption(result.caption);
      if (result.selection) {
        setSelectedLevel(result.selection);
        const level =
          state.levels.find((l) => pricesEqual(l.price, result.selection!.price)) ?? {
            price: result.selection.price,
            bidSize: 0,
            askSize: 0,
          };
        const stats = computeDepthStats(state.levels);
        const scale = resolveDepthScale(settings.depthScale, stats);
        setInspectorData(
          buildDomLevelTooltip(level, result.selection.side, stats, settings, state.trades, state.clusters, undefined, scale),
        );
      }
      if (result.marketAction === "buy") {
        dispatch({ type: "MARKET_BUY", size: tradeSize });
      } else if (result.marketAction === "sell") {
        dispatch({ type: "MARKET_SELL", size: tradeSize });
      }
    },
    [state.levels, state.currentPrice, state.clusters, state.candles, state.trades, settings, dispatch, tradeSize],
  );

  React.useEffect(() => {
    if (!teachingCaption) return undefined;
    const id = window.setTimeout(() => setTeachingCaption(null), 12_000);
    return () => window.clearTimeout(id);
  }, [teachingCaption]);

  const mergeBtn = (on: boolean) =>
    cn(
      "rounded px-1.5 py-px font-mono text-[9px] transition",
      on ? "bg-white/[0.1] text-slate-100" : "text-slate-600 hover:text-slate-400",
    );

  return (
    <div className={cn("large-dom-workspace orderflow-canvas flex min-h-[min(78vh,800px)] flex-col bg-[#010204]", className)}>
      <p className="shrink-0 border-b border-amber-500/15 bg-amber-950/20 px-2 py-0.5 text-center font-mono text-[9px] text-amber-200/85">
        Стакан крупно · симуляция GAZP · не котировки MOEX
      </p>

      <SimulatorScenarioBar state={state} dispatch={dispatch} />

      <details className="group shrink-0 border-b border-white/[0.04] bg-[#030508]/80">
        <summary className="cursor-pointer px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-slate-600 hover:text-slate-400">
          Торговля
        </summary>
        <SimulatorTradeStrip
          state={state}
          dispatch={dispatch}
          tradeSize={tradeSize}
          onTradeSizeChange={onTradeSizeChange}
          limitSize={limitSize}
          onLimitSizeChange={onLimitSizeChange}
        />
      </details>

      <DomFocusTeachingBar activeKind={activeDemo} onDemo={handleDemo} />

      <div className="shrink-0 border-b border-white/[0.04] bg-[#010204]">
        <DomLadderSettings settings={settings} onChange={handleSettings} onRecenter={onRecenterViewport} className="py-1" />
        <div className="flex flex-wrap items-center gap-1 border-t border-white/[0.03] px-2 py-1">
          <span className="font-mono text-[8px] uppercase tracking-wider text-slate-600">Складывать тики</span>
          {TAPE_MERGE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              className={mergeBtn(tickMergeMs === opt.value)}
              onClick={() => onTickMergeMsChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="large-dom-grid min-h-0 flex-1">
        <section className="large-dom-tape flex min-h-0 flex-col border-r border-white/[0.06] bg-[#010204]">
          <header className="shrink-0 border-b border-white/[0.04] px-2 py-1 font-mono text-[9px] text-slate-500">
            Лента · симуляция
          </header>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <TapeBubbleLane
              trades={state.trades}
              priceViewport={priceViewport}
              currentPrice={state.currentPrice}
              aggregationWindowMs={tickMergeMs}
              rowHeightPx={settings.rowHeight}
              scrollTopPx={scrollTop}
              scrollLayout={scrollLayout}
              contentHeightPx={scrollLayout.contentHeightPx}
              embedded
              onLevelHighlight={setTapeHighlights}
              className="h-full w-full"
            />
          </div>
        </section>

        <section className="large-dom-book flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#010204]">
          <header className="shrink-0 border-b border-white/[0.04] px-2 py-1 font-mono text-[9px] text-slate-500">
            Стакан · GAZP · симуляция
          </header>
          <DomLadder
            levels={state.levels}
            currentPrice={state.currentPrice}
            trades={state.trades}
            clusters={state.clusters}
            icebergs={state.icebergs}
            recentExecutedLevels={state.recentExecutedLevels}
            tapeHighlights={tapeHighlights}
            priceViewport={priceViewport}
            viewportAutoCenter={viewportAutoCenter}
            onViewportAutoCenterChange={onViewportAutoCenterChange}
            onViewportLevelCountChange={onViewportLevelCountChange}
            onRecenterViewport={onRecenterViewport}
            stacked
            ladderSettings={settings}
            onLadderSettingsChange={handleSettings}
            scrollLayout={scrollLayout}
            onScrollTopChange={setScrollTop}
            selectedLevel={selectedLevel}
            onLevelSelect={handleLevelSelect}
            teachingHighlights={teachingHighlights}
            className="dom-ladder--large min-h-0 flex-1"
          />
        </section>

        <DomLevelInspectorPanel data={inspectorData} teachingCaption={teachingCaption} className="large-dom-inspector" />
      </div>

      <details className="large-dom-mini-chart shrink-0 border-t border-white/[0.06] bg-[#020408]">
        <summary className="cursor-pointer px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-slate-600 hover:text-slate-400">
          Мини-график (симуляция)
        </summary>
        <div className="h-[88px] p-1">
          <SimulatedCandleChart
            candles={state.candles.slice(-24)}
            currentPrice={state.currentPrice}
            timeframe={state.candleTimeframe}
            symbol={state.symbol}
            priceViewport={priceViewport}
            className="h-full w-full"
          />
        </div>
      </details>
    </div>
  );
}
