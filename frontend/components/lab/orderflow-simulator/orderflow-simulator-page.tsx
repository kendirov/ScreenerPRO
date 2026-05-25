"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { LabPageShell } from "@/components/lab/lab-page-shell";
import { MultiWindowWorkspace } from "@/components/lab/orderflow-simulator/multi-window-workspace";
import { AnnotationsPanel } from "@/components/lab/orderflow-simulator/annotations-panel";
import { buildFootprintChartMarkers, ClusterPanel } from "@/components/lab/orderflow-simulator/cluster-panel";
import { detectAbsorptionSignals } from "@/lib/domain/orderflow-absorption";
import { OrderBookLadder } from "@/components/lab/orderflow-simulator/order-book-ladder";
import { PresentationToolbar } from "@/components/lab/orderflow-simulator/presentation-toolbar";
import { ScenarioJournalPanel } from "@/components/lab/orderflow-simulator/scenario-journal-panel";
import { SimulatedCandleChart } from "@/components/lab/orderflow-simulator/simulated-candle-chart";
import { ScalpTerminalTopbar } from "@/components/lab/orderflow-simulator/scalp-terminal-topbar";
import { ScalpTerminalWorkspace } from "@/components/lab/orderflow-simulator/scalp-terminal-workspace";
import { SimulatorControlPanel } from "@/components/lab/orderflow-simulator/simulator-control-panel";
import { SimulatorScenarioBar } from "@/components/lab/orderflow-simulator/simulator-scenario-bar";
import { SimulatorTradeStrip } from "@/components/lab/orderflow-simulator/simulator-trade-strip";
import { SimulatorViewModeTabs } from "@/components/lab/orderflow-simulator/simulator-view-mode-tabs";
import { DomTapeStack } from "@/components/lab/orderflow-simulator/dom-tape-stack";
import { BookModelWorkspace } from "@/components/lab/orderflow-simulator/book-model-workspace";
import { LargeDomWorkspace } from "@/components/lab/orderflow-simulator/large-dom-workspace";
import { TapePrintFeed } from "@/components/lab/orderflow-simulator/tape-print-feed";
import type { TapeMergeMs } from "@/lib/domain/tape-bubbles-model";
import { TeachingOverlay } from "@/components/lab/orderflow-simulator/teaching-overlay";
import { roundPrice, TICK_SIZE } from "@/lib/domain/orderflow-simulator";
import { createPriceViewport, shouldSuggestRecenter } from "@/lib/domain/orderflow-price-viewport";
import type { LadderLevelCount } from "@/lib/domain/order-book-ladder-model";
import {
  createInitialEngineState,
  orderflowSimulatorReducer,
} from "@/lib/domain/orderflow-simulator-engine";
import {
  createInitialMultiMarket,
  multiMarketReducer,
} from "@/lib/domain/orderflow-multi-market";
import {
  UI_MODE_LABELS,
  VIEW_MODE_LABELS,
  VIEW_MODE_ORDER,
  type SimulatorUiMode,
  type SimulatorViewMode,
  type TeachingAnnotation,
} from "@/lib/domain/orderflow-teaching";
import type { ClusterPulse } from "@/lib/domain/tape-bubbles-model";
import { cn } from "@/lib/utils/cn";

export function OrderflowSimulatorPage() {
  const [state, dispatch] = React.useReducer(orderflowSimulatorReducer, undefined, createInitialEngineState);
  const [multiState, multiDispatch] = React.useReducer(
    multiMarketReducer,
    undefined,
    createInitialMultiMarket,
  );
  const [viewMode, setViewMode] = React.useState<SimulatorViewMode>("domfocus");
  const searchParams = useSearchParams();

  React.useEffect(() => {
    const raw = searchParams.get("view");
    if (raw && (VIEW_MODE_ORDER as string[]).includes(raw)) {
      setViewMode(raw as SimulatorViewMode);
    }
  }, [searchParams]);
  const [multiSelectedSymbol, setMultiSelectedSymbol] = React.useState<string | null>(null);
  const [uiMode, setUiMode] = React.useState<SimulatorUiMode>("workspace");
  const [manualAnnotations, setManualAnnotations] = React.useState<TeachingAnnotation[]>([]);
  const [tradeSize, setTradeSize] = React.useState(5000);
  const [limitSize, setLimitSize] = React.useState(3500);
  const [sidePanelOpen, setSidePanelOpen] = React.useState(false);
  const [clusterPulses, setClusterPulses] = React.useState<ClusterPulse[]>([]);
  const [viewportAutoCenter, setViewportAutoCenter] = React.useState(true);
  const [viewportCenterPrice, setViewportCenterPrice] = React.useState(123.34);
  const [viewportLevelCount, setViewportLevelCount] = React.useState<LadderLevelCount>(80);

  React.useEffect(() => {
    if (!viewportAutoCenter) return;
    setViewportCenterPrice((prev) => {
      const probe = createPriceViewport({
        centerPrice: prev,
        tickSize: TICK_SIZE,
        levelsCount: viewportLevelCount,
      });
      if (shouldSuggestRecenter(state.currentPrice, probe)) {
        return state.currentPrice;
      }
      return prev;
    });
  }, [state.currentPrice, viewportAutoCenter, viewportLevelCount]);

  const priceViewport = React.useMemo(
    () =>
      createPriceViewport({
        centerPrice: viewportCenterPrice,
        tickSize: TICK_SIZE,
        levelsCount: viewportLevelCount,
      }),
    [viewportCenterPrice, viewportLevelCount],
  );

  const recenterViewport = React.useCallback(() => {
    setViewportCenterPrice(state.currentPrice);
  }, [state.currentPrice]);

  const handleViewportAutoCenterChange = React.useCallback(
    (enabled: boolean) => {
      if (enabled) {
        setViewportCenterPrice(state.currentPrice);
      }
      setViewportAutoCenter(enabled);
    },
    [state.currentPrice],
  );

  const handleClusterPulse = React.useCallback((pulses: ClusterPulse[]) => {
    setClusterPulses(pulses);
  }, []);

  const footprintMarkers = React.useMemo(() => {
    const absorptions = detectAbsorptionSignals(
      state.clusters,
      state.levels,
      state.currentPrice,
      state.candles,
    );
    return buildFootprintChartMarkers(state.clusters, absorptions);
  }, [state.clusters, state.levels, state.currentPrice, state.candles]);

  const isPresentation = uiMode === "presentation";
  const isLesson = uiMode === "lesson" || isPresentation;
  const isTerminalView = viewMode === "terminal";
  const isDomFocusView = viewMode === "domfocus";
  const isMultiWindowView = viewMode === "multiwindow";
  const isEducationalView = viewMode === "educational";
  const isBookModelView = viewMode === "book-model";
  const showTeachingHints = isEducationalView || isDomFocusView || isBookModelView || uiMode !== "workspace";

  const scenarioAnnotations = state.scenarioPlayback.annotations;
  const visibleCandles = state.candles.slice(-36);
  const chartMinPrice = isTerminalView ? priceViewport.minPrice : visibleCandles.length > 0
      ? Math.min(...visibleCandles.map((c) => c.low), state.currentPrice) - 0.04
      : state.currentPrice - 0.2;
  const chartMaxPrice = isTerminalView ? priceViewport.maxPrice : visibleCandles.length > 0
      ? Math.max(...visibleCandles.map((c) => c.high), state.currentPrice) + 0.04
      : state.currentPrice + 0.2;

  const hasLesson = Boolean(state.scenarioPlayback.activeScenarioId);

  React.useEffect(() => {
    if (!state.isPlaying) return undefined;
    const intervalMs = Math.max(400, 1200 / state.speed);
    const id = window.setInterval(() => dispatch({ type: "SIM_TICK" }), intervalMs);
    return () => window.clearInterval(id);
  }, [state.isPlaying, state.speed]);

  React.useEffect(() => {
    if (!isMultiWindowView) return undefined;
    if (multiState.pressure.playing && multiState.pressure.tick < multiState.pressure.maxTick) {
      const id = window.setInterval(() => multiDispatch({ type: "PRESSURE_STEP" }), 1800);
      return () => window.clearInterval(id);
    }
    if (multiState.pressure.playing) return undefined;
    const id = window.setInterval(() => multiDispatch({ type: "TICK_ALL" }), 2800);
    return () => window.clearInterval(id);
  }, [
    isMultiWindowView,
    multiState.pressure.playing,
    multiState.pressure.tick,
    multiState.pressure.maxTick,
  ]);

  const handleOpenMultiInstrument = React.useCallback(
    (symbol: string) => {
      const engine = multiState.instruments[symbol];
      if (engine) {
        dispatch({ type: "LOAD_ENGINE_STATE", state: engine });
      } else {
        dispatch({ type: "LOAD_SYMBOL", symbol });
      }
      setMultiSelectedSymbol(symbol);
      setViewMode("terminal");
    },
    [multiState.instruments],
  );

  React.useEffect(() => {
    const isTyping = (target: EventTarget | null) =>
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;

      switch (event.key) {
        case " ":
          event.preventDefault();
          dispatch(state.isPlaying ? { type: "PAUSE" } : { type: "PLAY" });
          break;
        case "ArrowRight":
          dispatch({ type: hasLesson ? "SCENARIO_STEP" : "STEP" });
          break;
        case "r":
        case "R":
          dispatch({ type: "RESET_SCENARIO" });
          break;
        case "b":
        case "B":
          dispatch({ type: "MARKET_BUY", size: tradeSize });
          break;
        case "s":
        case "S":
          dispatch({ type: "MARKET_SELL", size: tradeSize });
          break;
        case "d":
        case "D":
          dispatch({ type: "ADD_LIMIT_BID", price: roundPrice(state.currentPrice), size: limitSize });
          break;
        case "a":
        case "A":
          dispatch({ type: "ADD_LIMIT_ASK", price: roundPrice(state.currentPrice), size: limitSize });
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.isPlaying, state.currentPrice, hasLesson, tradeSize, limitSize]);

  const addAnnotation = (annotation: TeachingAnnotation) => {
    setManualAnnotations((prev) => [...prev, annotation].slice(-8));
  };

  const chartBlock = (
    <div className={cn("relative flex min-h-0 flex-1 flex-col bg-[#020408]", isTerminalView ? "h-full p-0" : "p-1")}>
      <SimulatedCandleChart
        candles={state.candles}
        currentPrice={state.currentPrice}
        timeframe={state.candleTimeframe}
        symbol={state.symbol}
        annotations={scenarioAnnotations}
        footprintMarkers={footprintMarkers}
        presentation={isPresentation}
        terminal={isTerminalView}
        priceViewport={isTerminalView ? priceViewport : undefined}
        className="min-h-0 flex-1"
      />
      {showTeachingHints ? (
        <TeachingOverlay
          manualAnnotations={manualAnnotations}
          scenarioAnnotations={scenarioAnnotations}
          currentPrice={state.currentPrice}
          minPrice={chartMinPrice}
          maxPrice={chartMaxPrice}
          presentation={isPresentation}
        />
      ) : null}
    </div>
  );

  const bookPanel = (
    <OrderBookLadder
      levels={state.levels}
      currentPrice={state.currentPrice}
      trades={state.trades}
      clusters={state.clusters}
      recentExecutedLevels={state.recentExecutedLevels}
      annotations={scenarioAnnotations}
      showTeachingHints={showTeachingHints}
      presentation={isPresentation}
      terminal={isTerminalView}
      className={isTerminalView ? "h-full" : "min-h-[280px]"}
    />
  );

  const tapePanel = (
    <TapePrintFeed
      trades={state.trades}
      tickMergeMs={state.tickMergeMs}
      levels={state.levels}
      currentPrice={state.currentPrice}
      clusters={state.clusters}
      onClusterPulse={handleClusterPulse}
      showTeachingHints={showTeachingHints}
      presentation={isPresentation}
      terminal={isTerminalView}
      className={isTerminalView ? "h-full" : "min-h-[280px]"}
    />
  );

  const clusterPanel = (
    <ClusterPanel
      clusters={state.clusters}
      levels={state.levels}
      currentPrice={state.currentPrice}
      candles={state.candles}
      clusterPulses={clusterPulses}
      showTeachingHints={showTeachingHints}
      lesson={isLesson}
      presentation={isPresentation}
      terminal={isTerminalView}
      className={
        isTerminalView
          ? "h-full max-h-none"
          : isPresentation
            ? "min-h-[140px] max-h-[180px]"
            : isLesson
              ? "min-h-[280px] max-h-[420px]"
              : "min-h-[180px] max-h-[260px]"
      }
    />
  );

  const collapsibleSidePanel =
    isLesson && !isPresentation ? (
      <details
        open={sidePanelOpen}
        onToggle={(e) => setSidePanelOpen((e.target as HTMLDetailsElement).open)}
        className="flex h-full min-h-0 flex-col overflow-hidden rounded border border-white/[0.06] bg-[#030508]"
      >
        <summary className="cursor-pointer border-b border-white/[0.05] px-2 py-1 font-mono text-[10px] text-slate-400">
          Урок и журнал
        </summary>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
          <ScenarioJournalPanel
            entries={state.scenarioPlayback.journal}
            learningGoal={state.scenarioPlayback.learningGoal}
            isComplete={state.scenarioPlayback.isScenarioComplete}
          />
          {isEducationalView ? (
            <AnnotationsPanel
              levels={state.levels}
              currentPrice={state.currentPrice}
              minPrice={chartMinPrice}
              maxPrice={chartMaxPrice}
              annotations={manualAnnotations}
              onAdd={addAnnotation}
              onClear={() => setManualAnnotations([])}
              compact
            />
          ) : null}
        </div>
      </details>
    ) : null;

  const bookModelBody = <BookModelWorkspace />;

  const domFocusBody = (
    <LargeDomWorkspace
      state={state}
      dispatch={dispatch}
      priceViewport={priceViewport}
      tickMergeMs={state.tickMergeMs as TapeMergeMs}
      onTickMergeMsChange={(ms) => dispatch({ type: "SET_TICK_MERGE", mergeMs: ms })}
      viewportAutoCenter={viewportAutoCenter}
      onViewportAutoCenterChange={handleViewportAutoCenterChange}
      onViewportLevelCountChange={setViewportLevelCount}
      onRecenterViewport={recenterViewport}
      tradeSize={tradeSize}
      onTradeSizeChange={setTradeSize}
      limitSize={limitSize}
      onLimitSizeChange={setLimitSize}
    />
  );

  const terminalBody = (
    <ScalpTerminalWorkspace
      combinedBook
      isPresentation={isPresentation}
      topBar={
        <ScalpTerminalTopbar
          state={state}
          dispatch={dispatch}
          uiMode={uiMode}
          onUiModeChange={setUiMode}
          hasLesson={hasLesson}
        />
      }
      presentationToolbar={
        <PresentationToolbar
          state={state}
          dispatch={dispatch}
          onExitPresentation={() => setUiMode("workspace")}
        />
      }
      presentationHint={
        isPresentation ? (
          <p className="orderflow-presentation-hint">
            Цепочка урока: лимитка в стакане → рыночная сделка → лента → кластер → свеча. Все данные — симуляция.
          </p>
        ) : null
      }
      scenarioBar={<SimulatorScenarioBar state={state} dispatch={dispatch} />}
      tradeStrip={
        <SimulatorTradeStrip
          state={state}
          dispatch={dispatch}
          tradeSize={tradeSize}
          onTradeSizeChange={setTradeSize}
          limitSize={limitSize}
          onLimitSizeChange={setLimitSize}
        />
      }
      explanation={
        state.lastExplanation && (isLesson || isPresentation) ? (
          <p
            className={cn(
              "border-b border-sky-500/10 bg-sky-950/20 px-2 py-0.5 font-mono text-sky-100/90",
              isPresentation ? "text-sm leading-snug" : "text-[11px]",
            )}
          >
            {state.lastExplanation}
          </p>
        ) : null
      }
      chart={chartBlock}
      tape={null}
      orderBook={
        <DomTapeStack
          levels={state.levels}
          currentPrice={state.currentPrice}
          trades={state.trades}
          clusters={state.clusters}
          recentExecutedLevels={state.recentExecutedLevels}
          icebergs={state.icebergs}
          annotations={scenarioAnnotations}
          priceViewport={priceViewport}
          tickMergeMs={state.tickMergeMs as TapeMergeMs}
          onTickMergeMsChange={(ms) => dispatch({ type: "SET_TICK_MERGE", mergeMs: ms })}
          viewportAutoCenter={viewportAutoCenter}
          onViewportAutoCenterChange={handleViewportAutoCenterChange}
          onViewportLevelCountChange={setViewportLevelCount}
          onRecenterViewport={recenterViewport}
          onClusterPulse={handleClusterPulse}
          showTeachingHints={showTeachingHints}
          className="h-full max-w-none"
        />
      }
      clusters={
        <ClusterPanel
          clusters={state.clusters}
          levels={state.levels}
          currentPrice={state.currentPrice}
          candles={state.candles}
          clusterPulses={clusterPulses}
          showTeachingHints={showTeachingHints}
          lesson={isLesson}
          presentation={isPresentation}
          terminal
          className="h-full max-h-none"
        />
      }
      sidePanel={collapsibleSidePanel ?? undefined}
    />
  );

  const educationalBody = (
    <div className="space-y-3">
      <details className="rounded-lg border border-white/[0.06] bg-slate-950/40 px-3 py-2 text-sm text-slate-400">
        <summary className="cursor-pointer text-slate-300">Краткая справка</summary>
        <ul className="mt-2 list-inside list-disc space-y-1 text-[13px] leading-relaxed">
          <li>Условный инструмент GAZP — все цифры сгенерированы симулятором, не котировки MOEX.</li>
          <li>
            Режим <strong className="font-normal text-slate-200">Урок</strong> — сценарии и подсказки;{" "}
            <strong className="font-normal text-slate-200">Презентация</strong> — для записи видео.
          </li>
          <li>Объяснения не являются торговыми рекомендациями.</li>
        </ul>
      </details>

      <p className="orderflow-sim-banner rounded-md px-2 py-1 text-center font-mono text-[10px] text-amber-200/85">
        Симуляция. Не реальные котировки MOEX.
      </p>

      {isPresentation ? (
        <PresentationToolbar
          state={state}
          dispatch={dispatch}
          onExitPresentation={() => setUiMode("workspace")}
        />
      ) : (
        <SimulatorControlPanel
          state={state}
          dispatch={dispatch}
          uiMode={uiMode}
          onUiModeChange={setUiMode}
          tradeSize={tradeSize}
          onTradeSizeChange={setTradeSize}
          limitSize={limitSize}
          onLimitSizeChange={setLimitSize}
        />
      )}

      {isLesson && !isPresentation ? (
        <AnnotationsPanel
          levels={state.levels}
          currentPrice={state.currentPrice}
          minPrice={chartMinPrice}
          maxPrice={chartMaxPrice}
          annotations={manualAnnotations}
          onAdd={addAnnotation}
          onClear={() => setManualAnnotations([])}
        />
      ) : null}

      {isLesson && !isPresentation ? (
        <ScenarioJournalPanel
          entries={state.scenarioPlayback.journal}
          learningGoal={state.scenarioPlayback.learningGoal}
          isComplete={state.scenarioPlayback.isScenarioComplete}
        />
      ) : null}

      <div
        className={cn(
          "grid gap-3",
          isPresentation
            ? "lg:grid-cols-[minmax(0,1.75fr)_minmax(260px,0.65fr)]"
            : "lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]",
        )}
      >
        <section
          className={cn(
            "orderflow-terminal-panel relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#04070f]",
            isPresentation && "min-h-[min(72vh,640px)]",
          )}
        >
          <div className="relative min-h-[360px] p-2">{chartBlock}</div>
        </section>

        <section className={cn("flex flex-col gap-3", isPresentation ? "min-h-[min(72vh,640px)]" : "min-h-[520px]")}>
          <div
            className={cn(
              "grid min-h-0 flex-1 gap-3",
              isPresentation ? "grid-cols-1" : "grid-cols-[minmax(0,1.1fr)_minmax(140px,0.75fr)]",
            )}
          >
            {bookPanel}
            {!isPresentation ? tapePanel : null}
          </div>
          {isPresentation ? (
            <TapePrintFeed
              trades={state.trades}
              tickMergeMs={state.tickMergeMs}
              showTeachingHints={showTeachingHints}
              presentation
              className="min-h-[140px] max-h-[180px]"
            />
          ) : null}
          {clusterPanel}
        </section>
      </div>

      <p className="orderflow-sim-banner rounded-md px-2 py-1 text-center font-mono text-[10px] text-amber-200/85">
        Симуляция. Не реальные котировки MOEX.
      </p>
    </div>
  );

  return (
    <LabPageShell
      title="Привод-симулятор"
      compact={isTerminalView || isDomFocusView || isBookModelView}
      description={
        isMultiWindowView
          ? "Несколько demo-инструментов на одном рабочем столе: мини-стакан, лента и график. Клик — полный привод."
          : isTerminalView
            ? ""
            : isDomFocusView
              ? "Крупный стакан и лента сделок без основного графика — для разбора уровней и плотностей (симуляция)."
              : isBookModelView
                ? "Учебная схема для урока и записи видео: стакан, лента, кластера. Не реальные котировки."
                : "Интерактивная модель стакана, ленты, кластеров и графика для разбора рыночных ситуаций."
      }
      pills={
        isBookModelView
          ? [
              { label: "Учебная симуляция", tone: "accent" },
              { label: VIEW_MODE_LABELS[viewMode], tone: "time" },
            ]
          : [
              { label: "Симуляция", tone: "accent" },
              {
                label: isMultiWindowView
                  ? `${multiSelectedSymbol ?? state.symbol} · demo`
                  : `${state.symbol} · условный`,
                tone: "meta",
              },
              { label: VIEW_MODE_LABELS[viewMode], tone: "time" },
              { label: UI_MODE_LABELS[uiMode], tone: "meta" },
            ]
      }
      modeControl={
        <SimulatorViewModeTabs
          value={viewMode}
          onChange={setViewMode}
          compact={isTerminalView || isDomFocusView || isBookModelView}
        />
      }
      className={isTerminalView || isDomFocusView || isBookModelView ? "space-y-1" : undefined}
    >
      {isMultiWindowView ? (
        <MultiWindowWorkspace
          state={multiState}
          dispatch={multiDispatch}
          selectedSymbol={multiSelectedSymbol}
          onOpenInstrument={handleOpenMultiInstrument}
        />
      ) : isBookModelView ? (
        bookModelBody
      ) : isDomFocusView ? (
        domFocusBody
      ) : isTerminalView ? (
        terminalBody
      ) : (
        educationalBody
      )}
    </LabPageShell>
  );
}
