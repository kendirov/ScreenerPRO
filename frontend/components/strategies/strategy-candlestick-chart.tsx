"use client";

import * as React from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import {
  StrategyRoundLevelOverlay,
  syncRoundLevelPriceLines,
  type BufferDisplayMode,
} from "@/components/strategies/strategy-round-level-overlay";
import { StrategySessionBoxOverlay } from "@/components/strategies/strategy-session-box-overlay";
import { StrategyZigZagOverlay } from "@/components/strategies/strategy-zigzag-overlay";
import type { StrategyCandle } from "@/lib/screener/strategies/strategy-candles";
import type { RoundLevel } from "@/lib/strategies/round-levels-engine";
import type { ApproachDirection, DirectionalBufferZone } from "@/lib/strategies/round-buffer-direction-engine";
import type { RoundLevelTouchEvent } from "@/lib/strategies/round-level-reaction-engine";
import type { SessionBox } from "@/lib/strategies/session-box-engine";
import { buildReactionChartMarkers } from "@/lib/strategies/strategy-reaction-display";
import { buildZigZagChartMarkers } from "@/lib/strategies/strategy-zigzag-display";
import type { ZigZagPivot, ZigZagSegment } from "@/lib/strategies/zigzag-lite-engine";
import type { RoundLevelApproachSegment } from "@/lib/strategies/round-level-approach-engine";
import {
  bumpStrategyChartMountCount,
  registerStrategyChartComponentVersion,
} from "@/lib/strategies/strategy-chart-browser-parity";
import {
  countInvalidStrategyChartCandles,
  collectStrategyChartRuntimeDiagnostics,
  createEmptyStrategyChartRuntimeDiagnostics,
  EMPTY_STRATEGY_CHART_DEBUG_STATE,
  isStrategyBaseCandlesVisible,
  type StrategyChartDebugState,
  type StrategyChartRuntimeDiagnostics,
} from "@/lib/strategies/strategy-chart-runtime-diagnostics";
import { getStrategyChartCandlestickSeriesOptions } from "@/lib/strategies/strategy-chart-candle-colors";
import { STRATEGY_LAB_FIELD_LABELS } from "@/lib/strategies/strategy-lab-labels";
import { cn } from "@/lib/utils/cn";
import {
  applyVisibleRangePreset,
  type ChartVisibleRangePreset,
} from "@/lib/strategies/chart-visible-range";

export type { StrategyChartRuntimeDiagnostics };

export type StrategyChartDiagnostics = {
  chartWidth: number;
  chartHeight: number;
};

export type StrategyOverlayDiagnostics = {
  priceLineCount: number;
  bufferZoneCount: number;
  skippedNullCoords: number;
  rectCount: number;
  markerCount: number;
  selectedPriceY: number | null;
  selectedUpperY: number | null;
  selectedLowerY: number | null;
  bufferDisplayMode: BufferDisplayMode;
  zonesRendered: number;
  zonesSkipped: number;
  approachDirection: ApproachDirection | null;
  reactionZoneValues: string | null;
  breakZoneValues: string | null;
};

const EMPTY_OVERLAY_DIAGNOSTICS: StrategyOverlayDiagnostics = {
  priceLineCount: 0,
  bufferZoneCount: 0,
  skippedNullCoords: 0,
  rectCount: 0,
  markerCount: 0,
  selectedPriceY: null,
  selectedUpperY: null,
  selectedLowerY: null,
  bufferDisplayMode: "active",
  zonesRendered: 0,
  zonesSkipped: 0,
  approachDirection: null,
  reactionZoneValues: null,
  breakZoneValues: null,
};

function stableOverlayDiagnosticsSignature(diagnostics: StrategyOverlayDiagnostics): string {
  return JSON.stringify([
    diagnostics.priceLineCount,
    diagnostics.bufferZoneCount,
    diagnostics.skippedNullCoords,
    diagnostics.rectCount,
    diagnostics.markerCount,
    diagnostics.selectedPriceY != null ? Math.round(diagnostics.selectedPriceY) : null,
    diagnostics.selectedUpperY != null ? Math.round(diagnostics.selectedUpperY) : null,
    diagnostics.selectedLowerY != null ? Math.round(diagnostics.selectedLowerY) : null,
    diagnostics.bufferDisplayMode,
    diagnostics.zonesRendered,
    diagnostics.zonesSkipped,
    diagnostics.approachDirection,
    diagnostics.reactionZoneValues,
    diagnostics.breakZoneValues,
  ]);
}

function stableRuntimeDiagnosticsSignature(diagnostics: StrategyChartRuntimeDiagnostics): string {
  return JSON.stringify({
    source: diagnostics.source,
    overlayIsolation: diagnostics.overlayIsolation,
    containerWidth: diagnostics.containerWidth,
    containerHeight: diagnostics.containerHeight,
    containerReady: diagnostics.containerReady,
    chartCreated: diagnostics.chartCreated,
    chartReady: diagnostics.chartReady,
    canvasCount: diagnostics.canvasCount,
    canvasBitmapWidth: diagnostics.canvasBitmapWidth,
    canvasBitmapHeight: diagnostics.canvasBitmapHeight,
    canvasCssWidth: diagnostics.canvasCssWidth,
    canvasCssHeight: diagnostics.canvasCssHeight,
    candlestickSeriesCreated: diagnostics.candlestickSeriesCreated,
    seriesReady: diagnostics.seriesReady,
    dataReady: diagnostics.dataReady,
    dataApplied: diagnostics.dataApplied,
    setDataCalled: diagnostics.setDataCalled,
    setDataCandlesLength: diagnostics.setDataCandlesLength,
    setDataCallCount: diagnostics.setDataCallCount,
    lastSetDataReason: diagnostics.lastSetDataReason,
    skippedSetDataReason: diagnostics.skippedSetDataReason,
    selfHealAttempts: diagnostics.selfHealAttempts,
    recreateAttempts: diagnostics.recreateAttempts,
    seriesDataLength: diagnostics.seriesDataLength,
    lastValueDataNoData: diagnostics.lastValueDataNoData,
    lastValuePrice: diagnostics.lastValuePrice,
    baseCandlesVisible: diagnostics.baseCandlesVisible,
    priceLinesCount: diagnostics.priceLinesCount,
    bufferZonesCount: diagnostics.bufferZonesCount,
    markersCount: diagnostics.markersCount,
    overlaysGateBlocked: diagnostics.overlaysGateBlocked,
    userZoomed: diagnostics.userZoomed,
    barSpacing: diagnostics.barSpacing,
    lastFitReason: diagnostics.lastFitReason,
    visiblePreset: diagnostics.visiblePreset,
    visibleBarsCount: diagnostics.visibleBarsCount,
    lastApplyVisibleRangeReason: diagnostics.lastApplyVisibleRangeReason,
    visibleRangeFrom: diagnostics.visibleRangeFrom,
    visibleRangeTo: diagnostics.visibleRangeTo,
    createSeriesError: diagnostics.createSeriesError,
    setDataError: diagnostics.setDataError,
    invalidTimeOhlcCount: diagnostics.invalidTimeOhlcCount,
    errors: diagnostics.errors,
  });
}

const MIN_CHART_WIDTH = 100;
const MIN_CHART_HEIGHT = 200;
const BASE_RIGHT_OFFSET = 8;
const BASE_BAR_SPACING = 8;
const MIN_BAR_SPACING = 3;
const MAX_BAR_SPACING = 48;
const ZOOM_FACTOR = 1.15;

const STRATEGY_CHART_HANDLE_SCROLL = {
  mouseWheel: true,
  pressedMouseMove: true,
  horzTouchDrag: true,
  vertTouchDrag: false,
} as const;

const STRATEGY_CHART_HANDLE_SCALE = {
  mouseWheel: true,
  pinch: true,
  axisPressedMouseMove: {
    time: true,
    price: true,
  },
} as const;

const STRATEGY_CHART_TIME_SCALE_OPTIONS = {
  rightOffset: BASE_RIGHT_OFFSET,
  barSpacing: BASE_BAR_SPACING,
  minBarSpacing: MIN_BAR_SPACING,
  fixLeftEdge: false,
  fixRightEdge: false,
  lockVisibleTimeRangeOnResize: false,
  rightBarStaysOnScroll: true,
  borderVisible: false,
  timeVisible: true,
  secondsVisible: false,
} as const;

function candlesSignature(candles: StrategyCandle[]): string {
  if (candles.length === 0) return "empty";
  const first = candles[0]!;
  const last = candles[candles.length - 1]!;
  return `${candles.length}:${first.time}:${last.time}:${last.close}`;
}

function toCandlestickData(candles: StrategyCandle[]): CandlestickData<Time>[] {
  return candles.map((candle) => ({
    time: candle.time as Time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));
}

function buildChartMarkers(
  touches: RoundLevelTouchEvent[],
  candles: StrategyCandle[],
  focusedTouchEventId?: string | null,
): SeriesMarker<Time>[] {
  return buildReactionChartMarkers(touches, candles, focusedTouchEventId).map((marker) => ({
    time: marker.time as Time,
    position: marker.position,
    color: marker.color,
    shape: marker.shape,
    text: marker.text,
  }));
}

function buildZigzagMarkers(
  pivots: ZigZagPivot[],
  segments: ZigZagSegment[],
  candles: StrategyCandle[],
  showLabels: boolean,
): SeriesMarker<Time>[] {
  return buildZigZagChartMarkers(pivots, segments, candles, {
    showLabels,
    maxMarkers: 80,
    importantOnly: showLabels,
  }).map((marker) => ({
    time: marker.time as Time,
    position: marker.position,
    color: marker.color,
    shape: marker.shape,
    text: marker.text,
  }));
}

function ChartToolbarButton({
  label,
  onClick,
  title,
}: {
  label: string;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded border border-white/[0.10] bg-black/55 px-2 py-0.5 font-mono text-[10px] text-lab-muted backdrop-blur-[1px] transition hover:border-cyan-800/45 hover:text-cyan-200"
    >
      {label}
    </button>
  );
}

type StrategyCandlestickChartProps = {
  candles: StrategyCandle[];
  debugSource?: "moex" | "synthetic";
  fitContentKey?: string;
  initialVisibleRangeMode?: ChartVisibleRangePreset;
  levels?: RoundLevel[];
  touchMarkers?: RoundLevelTouchEvent[];
  focusedTouchEventId?: string | null;
  focusedTouchEventIndex?: number | null;
  zigzagPivots?: ZigZagPivot[];
  zigzagSegments?: ZigZagSegment[];
  showZigzagLabels?: boolean;
  activeApproaches?: RoundLevelApproachSegment[];
  focusedApproachId?: string | null;
  focusedEventId?: string | null;
  showNearMiss?: boolean;
  highlightedLevelPrice?: number | null;
  directionalBufferZone?: DirectionalBufferZone | null;
  bufferDisplayMode?: BufferDisplayMode;
  chartCurrentPrice?: number | null;
  chartBufferSize?: number | null;
  resolveBufferDirection?: (levelPrice: number) => ApproachDirection;
  sessionBoxes?: SessionBox[];
  showSessionBoxes?: boolean;
  showLevelLines?: boolean;
  showBufferZones?: boolean;
  showReactionMarkers?: boolean;
  showZigzagMarkers?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string | null;
  className?: string;
  chartDebug?: boolean;
  onChartDiagnostics?: (diagnostics: StrategyChartDiagnostics) => void;
  onOverlayDiagnostics?: (diagnostics: StrategyOverlayDiagnostics) => void;
  onRuntimeDiagnostics?: (diagnostics: StrategyChartRuntimeDiagnostics) => void;
  onChartDebugState?: (state: StrategyChartDebugState & { chartReadyRevision: number }) => void;
  showBufferDebug?: boolean;
};

function ChartMessage({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-[inherit] flex-col items-center justify-center gap-1.5 px-4 text-center",
        className,
      )}
    >
      <p className="font-mono text-xs text-lab-text">{title}</p>
      {subtitle ? <p className="max-w-sm text-[10px] leading-relaxed text-lab-muted">{subtitle}</p> : null}
    </div>
  );
}

export function StrategyCandlestickChart({
  candles,
  debugSource = "moex",
  fitContentKey,
  initialVisibleRangeMode = "two_sessions",
  levels = [],
  touchMarkers = [],
  focusedTouchEventId = null,
  focusedTouchEventIndex = null,
  zigzagPivots = [],
  zigzagSegments = [],
  showZigzagLabels = false,
  activeApproaches = [],
  focusedApproachId = null,
  focusedEventId = null,
  showNearMiss = true,
  highlightedLevelPrice = null,
  directionalBufferZone = null,
  bufferDisplayMode = "active",
  chartCurrentPrice = null,
  chartBufferSize = null,
  resolveBufferDirection,
  sessionBoxes = [],
  showSessionBoxes = false,
  showLevelLines = false,
  showBufferZones = false,
  showReactionMarkers = false,
  showZigzagMarkers = false,
  isLoading = false,
  isError = false,
  errorMessage,
  className,
  chartDebug = false,
  onChartDiagnostics,
  onOverlayDiagnostics,
  onRuntimeDiagnostics,
  onChartDebugState,
  showBufferDebug = false,
}: StrategyCandlestickChartProps) {
  const shellRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<IChartApi | null>(null);
  const candleSeriesRef = React.useRef<ISeriesApi<"Candlestick"> | null>(null);
  const latestCandlesRef = React.useRef<StrategyCandle[]>(candles);
  const latestOptionsRef = React.useRef({
    debugSource,
    isolatedChart: chartDebug,
    overlaysRequested: showLevelLines || showBufferZones || showReactionMarkers || showZigzagMarkers,
  });
  const chartReadyRevisionRef = React.useRef(0);
  const setDataCallCountRef = React.useRef(0);
  const dataRevisionRef = React.useRef(0);
  const selfHealAttemptsRef = React.useRef(0);
  const recreateAttemptsRef = React.useRef(0);
  const hadZeroSizeRef = React.useRef(false);
  const mountedRef = React.useRef(false);
  const userZoomedRef = React.useRef(false);
  const programmaticViewportChangeRef = React.useRef(false);
  const lastFitContentKeyRef = React.useRef<string | undefined>(undefined);
  const lastAppliedVisibleRangeKeyRef = React.useRef<string | null>(null);
  const lastAppliedVisibleRangeChartRevisionRef = React.useRef<number | null>(null);
  const lastAppliedVisibleRangePresetRef = React.useRef<ChartVisibleRangePreset | null>(null);
  const lastCandlesSignatureRef = React.useRef("");
  const visibleRangeHandlerRef = React.useRef<(() => void) | null>(null);
  const priceLinesRef = React.useRef<IPriceLine[]>([]);
  const markersPluginRef = React.useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const overlayDiagnosticsRef = React.useRef<StrategyOverlayDiagnostics>(EMPTY_OVERLAY_DIAGNOSTICS);
  const lastPublishedOverlaySignatureRef = React.useRef(
    stableOverlayDiagnosticsSignature(EMPTY_OVERLAY_DIAGNOSTICS),
  );
  const lastPublishedRuntimeSignatureRef = React.useRef("");
  const overlayPublishRafRef = React.useRef<number | null>(null);
  const debugStateRef = React.useRef({ ...EMPTY_STRATEGY_CHART_DEBUG_STATE });
  const runtimeDiagnosticsRafRef = React.useRef<number | null>(null);
  const applyDiagnosticsRafRef = React.useRef<number | null>(null);
  const selfHealTimeoutsRef = React.useRef<number[]>([]);
  const onChartDiagnosticsRef = React.useRef(onChartDiagnostics);
  const onOverlayDiagnosticsRef = React.useRef(onOverlayDiagnostics);
  const onRuntimeDiagnosticsRef = React.useRef(onRuntimeDiagnostics);
  const onChartDebugStateRef = React.useRef(onChartDebugState);

  const [chartApi, setChartApi] = React.useState<IChartApi | null>(null);
  const [candleSeriesApi, setCandleSeriesApi] = React.useState<ISeriesApi<"Candlestick"> | null>(null);
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
  const [layoutRevision, setLayoutRevision] = React.useState(0);
  const [chartReadyRevision, setChartReadyRevision] = React.useState(0);
  const [baseCandlesVisible, setBaseCandlesVisible] = React.useState(false);
  const [debugWarning, setDebugWarning] = React.useState<string | null>(null);

  const publishChartDebugState = React.useCallback(
    (readyRevision: number) => {
      onChartDebugStateRef.current?.({
        ...debugStateRef.current,
        chartReadyRevision: readyRevision,
      });
    },
    [],
  );

  const hasCandles = candles.length > 0;
  const isolatedChart = chartDebug;
  const overlaysRequested = showLevelLines || showBufferZones || showReactionMarkers || showZigzagMarkers;
  const overlaysAllowed = !isolatedChart && baseCandlesVisible;
  const effectiveShowLevelLines = showLevelLines && overlaysAllowed;
  const effectiveShowBufferZones = showBufferZones && overlaysAllowed;
  const effectiveShowReactionMarkers = showReactionMarkers && overlaysAllowed;
  const effectiveShowZigzagMarkers = showZigzagMarkers && overlaysAllowed;

  React.useEffect(() => {
    onChartDiagnosticsRef.current = onChartDiagnostics;
    onOverlayDiagnosticsRef.current = onOverlayDiagnostics;
    onRuntimeDiagnosticsRef.current = onRuntimeDiagnostics;
    onChartDebugStateRef.current = onChartDebugState;
  }, [onChartDebugState, onChartDiagnostics, onOverlayDiagnostics, onRuntimeDiagnostics]);

  React.useEffect(() => {
    latestCandlesRef.current = candles;
    latestOptionsRef.current = {
      debugSource,
      isolatedChart,
      overlaysRequested,
    };
  }, [candles, debugSource, isolatedChart, overlaysRequested]);

  const setBaseCandlesVisibleSafe = React.useCallback((nextValue: boolean) => {
    setBaseCandlesVisible((prev) => (prev === nextValue ? prev : nextValue));
  }, []);

  const setDebugWarningSafe = React.useCallback((nextValue: string | null) => {
    setDebugWarning((prev) => (prev === nextValue ? prev : nextValue));
  }, []);

  const publishOverlayDiagnostics = React.useCallback((patch: Partial<StrategyOverlayDiagnostics>) => {
    const merged = { ...overlayDiagnosticsRef.current, ...patch };
    const signature = stableOverlayDiagnosticsSignature(merged);
    if (signature === lastPublishedOverlaySignatureRef.current) return;

    overlayDiagnosticsRef.current = merged;
    lastPublishedOverlaySignatureRef.current = signature;

    if (overlayPublishRafRef.current != null) {
      cancelAnimationFrame(overlayPublishRafRef.current);
    }
    overlayPublishRafRef.current = requestAnimationFrame(() => {
      overlayPublishRafRef.current = null;
      onOverlayDiagnosticsRef.current?.(overlayDiagnosticsRef.current);
    });
  }, []);

  const publishRuntimeDiagnostics = React.useCallback(() => {
    if (!chartDebug || !onRuntimeDiagnosticsRef.current) return;
    const options = latestOptionsRef.current;
    const diagnostics = collectStrategyChartRuntimeDiagnostics({
      container: containerRef.current,
      chart: chartRef.current,
      candleSeries: candleSeriesRef.current,
      candles: latestCandlesRef.current,
      debugState: debugStateRef.current,
      source: options.debugSource,
      overlayIsolation: options.isolatedChart,
    });
    const baseVisible = isStrategyBaseCandlesVisible(diagnostics);
    diagnostics.baseCandlesVisible = baseVisible;
    diagnostics.priceLinesCount = overlayDiagnosticsRef.current.priceLineCount;
    diagnostics.bufferZonesCount = overlayDiagnosticsRef.current.bufferZoneCount;
    diagnostics.markersCount = overlayDiagnosticsRef.current.markerCount;
    diagnostics.overlaysGateBlocked = !options.isolatedChart && options.overlaysRequested && !baseVisible;

    const signature = stableRuntimeDiagnosticsSignature(diagnostics);
    if (signature === lastPublishedRuntimeSignatureRef.current) return;
    lastPublishedRuntimeSignatureRef.current = signature;
    onRuntimeDiagnosticsRef.current(diagnostics);
  }, [chartDebug]);

  const scheduleRuntimeDiagnostics = React.useCallback(() => {
    if (!chartDebug || !onRuntimeDiagnosticsRef.current) return;
    if (runtimeDiagnosticsRafRef.current != null) {
      cancelAnimationFrame(runtimeDiagnosticsRafRef.current);
    }
    runtimeDiagnosticsRafRef.current = requestAnimationFrame(() => {
      runtimeDiagnosticsRafRef.current = null;
      publishRuntimeDiagnostics();
    });
  }, [chartDebug, publishRuntimeDiagnostics]);

  const handleBufferDiagnostics = React.useCallback(
    (diagnostics: {
      bufferZoneCount: number;
      skippedNullCoords: number;
      rectCount: number;
      selectedPriceY: number | null;
      selectedUpperY: number | null;
      selectedLowerY: number | null;
      bufferDisplayMode: BufferDisplayMode;
      zonesRendered: number;
      zonesSkipped: number;
      approachDirection: ApproachDirection | null;
      reactionZoneValues: string | null;
      breakZoneValues: string | null;
    }) => {
      publishOverlayDiagnostics({
        bufferZoneCount: diagnostics.bufferZoneCount,
        skippedNullCoords: diagnostics.skippedNullCoords,
        rectCount: diagnostics.rectCount,
        selectedPriceY: diagnostics.selectedPriceY,
        selectedUpperY: diagnostics.selectedUpperY,
        selectedLowerY: diagnostics.selectedLowerY,
        bufferDisplayMode: diagnostics.bufferDisplayMode,
        zonesRendered: diagnostics.zonesRendered,
        zonesSkipped: diagnostics.zonesSkipped,
        approachDirection: diagnostics.approachDirection,
        reactionZoneValues: diagnostics.reactionZoneValues,
        breakZoneValues: diagnostics.breakZoneValues,
      });
      scheduleRuntimeDiagnostics();
    },
    [publishOverlayDiagnostics, scheduleRuntimeDiagnostics],
  );

  React.useEffect(() => {
    if (!chartDebug || !onRuntimeDiagnosticsRef.current) return;
    lastPublishedRuntimeSignatureRef.current = "";
    onRuntimeDiagnosticsRef.current(createEmptyStrategyChartRuntimeDiagnostics(debugSource, isolatedChart));
    return () => {
      if (runtimeDiagnosticsRafRef.current != null) {
        cancelAnimationFrame(runtimeDiagnosticsRafRef.current);
      }
    };
  }, [chartDebug, debugSource, isolatedChart]);

  const clearPriceLines = React.useCallback(() => {
    const candleSeries = candleSeriesRef.current;
    for (const line of priceLinesRef.current) {
      candleSeries?.removePriceLine(line);
    }
    priceLinesRef.current = [];
    publishOverlayDiagnostics({ priceLineCount: 0 });
  }, [publishOverlayDiagnostics]);

  const clearMarkers = React.useCallback(() => {
    markersPluginRef.current?.setMarkers([]);
    markersPluginRef.current?.detach();
    markersPluginRef.current = null;
    publishOverlayDiagnostics({ markerCount: 0 });
  }, [publishOverlayDiagnostics]);

  const publishDebugStateNow = React.useCallback(() => {
    publishChartDebugState(chartReadyRevisionRef.current);
  }, [publishChartDebugState]);

  const clearSelfHealTimeouts = React.useCallback(() => {
    for (const timer of selfHealTimeoutsRef.current) {
      window.clearTimeout(timer);
    }
    selfHealTimeoutsRef.current = [];
  }, []);

  const finishProgrammaticViewportChange = React.useCallback(() => {
    requestAnimationFrame(() => {
      programmaticViewportChangeRef.current = false;
      const chart = chartRef.current;
      if (chart) {
        debugStateRef.current.barSpacing = chart.timeScale().options().barSpacing;
      }
      publishDebugStateNow();
      scheduleRuntimeDiagnostics();
    });
  }, [publishDebugStateNow, scheduleRuntimeDiagnostics]);

  const applyVisibleRangeAndDebug = React.useCallback(
    (preset: ChartVisibleRangePreset, reason: string) => {
      const chart = chartRef.current;
      const sourceCandles = latestCandlesRef.current;
      if (!chart || sourceCandles.length === 0) return;

      programmaticViewportChangeRef.current = true;
      userZoomedRef.current = false;
      debugStateRef.current.userZoomed = false;

      let appliedPreset: ChartVisibleRangePreset = preset;

      if (preset === "focus") {
        const focusIndex = focusedTouchEventIndex;
        if (
          focusIndex == null ||
          !Number.isFinite(focusIndex) ||
          focusIndex < 0 ||
          focusIndex >= sourceCandles.length
        ) {
          // Fallback to two_sessions when we don't have a focal candle index yet.
          const res = applyVisibleRangePreset(chart, sourceCandles, "two_sessions");
          appliedPreset = res.appliedPreset;
          if (res.usedFitContent) {
            debugStateRef.current.fitContentCalled = true;
            debugStateRef.current.lastFitReason = reason;
          }
        } else {
          const fromIndex = Math.max(0, Math.trunc(focusIndex) - 12);
          const toIndex = Math.min(sourceCandles.length - 1, Math.trunc(focusIndex) + 12);
          const fromCandle = sourceCandles[fromIndex];
          const toCandle = sourceCandles[toIndex];
          if (fromCandle && toCandle) {
            const is5m = sourceCandles.length >= 2
              && Math.abs(
                sourceCandles[sourceCandles.length - 1]!.time -
                  sourceCandles[sourceCandles.length - 2]!.time -
                  300,
              ) <= 1;
            if (is5m) {
              chart.timeScale().applyOptions({ rightOffset: 10 });
            }
            chart.timeScale().setVisibleRange({
              from: fromCandle.time as Time,
              to: toCandle.time as Time,
            });
          }
        }
      } else {
        const res = applyVisibleRangePreset(chart, sourceCandles, preset);
        appliedPreset = res.appliedPreset;
        if (res.usedFitContent) {
          debugStateRef.current.fitContentCalled = true;
          debugStateRef.current.lastFitReason = reason;
        }
      }

      debugStateRef.current.visiblePreset = appliedPreset;
      debugStateRef.current.lastApplyVisibleRangeReason = reason;
      lastAppliedVisibleRangePresetRef.current = appliedPreset;

      finishProgrammaticViewportChange();
    },
    [finishProgrammaticViewportChange, focusedTouchEventIndex],
  );

  const maybeApplyVisibleRangeForCurrentChart = React.useCallback(
    (reason: string) => {
      if (!fitContentKey) return;
      if (candles.length === 0) return;
      if (!chartRef.current) return;

      const needByKey = lastAppliedVisibleRangeKeyRef.current !== fitContentKey;
      const needByChartRevision = lastAppliedVisibleRangeChartRevisionRef.current !== chartReadyRevisionRef.current;
      if (!needByKey && !needByChartRevision) return;

      const preset: ChartVisibleRangePreset =
        needByKey
          ? initialVisibleRangeMode ?? "two_sessions"
          : lastAppliedVisibleRangePresetRef.current ?? initialVisibleRangeMode ?? "two_sessions";

      lastAppliedVisibleRangeKeyRef.current = fitContentKey;
      lastAppliedVisibleRangeChartRevisionRef.current = chartReadyRevisionRef.current;

      applyVisibleRangeAndDebug(preset, reason);
    },
    [applyVisibleRangeAndDebug, candles.length, fitContentKey, initialVisibleRangeMode],
  );

  const runFitContent = React.useCallback(
    (reason: string) => {
      const chart = chartRef.current;
      if (!chart) return;

      programmaticViewportChangeRef.current = true;
      chart.timeScale().fitContent();
      chart.timeScale().applyOptions({ ...STRATEGY_CHART_TIME_SCALE_OPTIONS });
      userZoomedRef.current = false;
      debugStateRef.current.userZoomed = false;
      debugStateRef.current.fitContentCalled = true;
      debugStateRef.current.lastFitReason = reason;
      debugStateRef.current.visiblePreset = "all";
      debugStateRef.current.lastApplyVisibleRangeReason = reason;
      lastAppliedVisibleRangePresetRef.current = "all";
      debugStateRef.current.barSpacing = BASE_BAR_SPACING;
      finishProgrammaticViewportChange();
    },
    [finishProgrammaticViewportChange],
  );

  const handleToolbarFit = React.useCallback(() => {
    runFitContent("toolbar-fit");
  }, [runFitContent]);

  const handleToolbarReset = React.useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;

    programmaticViewportChangeRef.current = true;
    chart.timeScale().resetTimeScale();
    chart.timeScale().applyOptions({ ...STRATEGY_CHART_TIME_SCALE_OPTIONS });
    userZoomedRef.current = false;
    debugStateRef.current.userZoomed = false;
    debugStateRef.current.fitContentCalled = false;
    debugStateRef.current.lastFitReason = "toolbar-reset";
    debugStateRef.current.barSpacing = BASE_BAR_SPACING;
    finishProgrammaticViewportChange();
  }, [finishProgrammaticViewportChange]);

  const handleToolbarZoom = React.useCallback(
    (direction: "in" | "out") => {
      const chart = chartRef.current;
      if (!chart) return;

      const timeScale = chart.timeScale();
      const current = timeScale.options().barSpacing;
      const next =
        direction === "in"
          ? Math.max(MIN_BAR_SPACING, current / ZOOM_FACTOR)
          : Math.min(MAX_BAR_SPACING, current * ZOOM_FACTOR);
      if (Math.abs(next - current) < 0.01) return;

      programmaticViewportChangeRef.current = true;
      timeScale.applyOptions({ barSpacing: next });
      userZoomedRef.current = true;
      debugStateRef.current.userZoomed = true;
      debugStateRef.current.barSpacing = next;
      finishProgrammaticViewportChange();
    },
    [finishProgrammaticViewportChange],
  );

  const scheduleApplyDiagnostics = React.useCallback(
    () => {
      if (applyDiagnosticsRafRef.current != null) {
        cancelAnimationFrame(applyDiagnosticsRafRef.current);
      }
      applyDiagnosticsRafRef.current = requestAnimationFrame(() => {
        applyDiagnosticsRafRef.current = requestAnimationFrame(() => {
          applyDiagnosticsRafRef.current = null;
          const chart = chartRef.current;
          const candleSeries = candleSeriesRef.current;
          const sourceCandles = latestCandlesRef.current;
          const options = latestOptionsRef.current;
          const diagnostics = collectStrategyChartRuntimeDiagnostics({
            container: containerRef.current,
            chart,
            candleSeries,
            candles: sourceCandles,
            debugState: debugStateRef.current,
            source: options.debugSource,
            overlayIsolation: options.isolatedChart,
          });
          const baseVisible = isStrategyBaseCandlesVisible(diagnostics);
          const prevBaseVisible = debugStateRef.current.baseVisible;
          debugStateRef.current.baseVisible = baseVisible;
          setBaseCandlesVisibleSafe(baseVisible);
          if (prevBaseVisible !== baseVisible) {
            setLayoutRevision((value) => value + 1);
          }

          if (chartDebug) {
            if (
              sourceCandles.length > 0 &&
              diagnostics.setDataCalled &&
              !baseVisible &&
              diagnostics.lastValueDataNoData === true
            ) {
              setDebugWarningSafe("Candlestick series has no visible data after setData.");
            } else if (options.overlaysRequested && !options.isolatedChart && !baseVisible) {
              setDebugWarningSafe("Overlays blocked: base candles are not visible.");
            } else if (debugStateRef.current.skippedSetDataReason) {
              setDebugWarningSafe(`setData skipped: ${debugStateRef.current.skippedSetDataReason}`);
            } else {
              setDebugWarningSafe(null);
            }
          } else {
            setDebugWarningSafe(null);
          }

          publishDebugStateNow();
          scheduleRuntimeDiagnostics();
        });
      });
    },
    [chartDebug, publishDebugStateNow, scheduleRuntimeDiagnostics, setBaseCandlesVisibleSafe, setDebugWarningSafe],
  );

  const applyCandleData = React.useCallback(
    (reason: string, options?: { fitContent?: boolean; updateData?: boolean }) => {
      const chart = chartRef.current;
      const candleSeries = candleSeriesRef.current;
      const sourceCandles = latestCandlesRef.current;
      const shouldFitContent = options?.fitContent ?? false;
      const shouldUpdateData = options?.updateData ?? true;

      debugStateRef.current.dataReady = sourceCandles.length > 0;
      debugStateRef.current.containerReady =
        (containerRef.current?.clientWidth ?? 0) > MIN_CHART_WIDTH &&
        (containerRef.current?.clientHeight ?? 0) > MIN_CHART_HEIGHT;
      debugStateRef.current.chartReady = chart != null;
      debugStateRef.current.seriesReady = candleSeries != null;
      debugStateRef.current.skippedSetDataReason = null;

      if (!chart) {
        debugStateRef.current.dataApplied = false;
        debugStateRef.current.skippedSetDataReason = `${reason}: chart not ready`;
        publishDebugStateNow();
        scheduleRuntimeDiagnostics();
        return false;
      }

      if (!candleSeries) {
        debugStateRef.current.dataApplied = false;
        debugStateRef.current.skippedSetDataReason = `${reason}: series not ready`;
        publishDebugStateNow();
        scheduleRuntimeDiagnostics();
        return false;
      }

      if (sourceCandles.length === 0) {
        candleSeries.setData([]);
        lastCandlesSignatureRef.current = "empty";
        debugStateRef.current.setDataCalled = false;
        debugStateRef.current.dataApplied = false;
        debugStateRef.current.setDataCandlesLength = 0;
        debugStateRef.current.fitContentCalled = false;
        debugStateRef.current.visiblePreset = null;
        debugStateRef.current.lastApplyVisibleRangeReason = null;
        debugStateRef.current.lastSetDataAt = new Date().toISOString();
        debugStateRef.current.lastSetDataReason = `${reason}: empty-candles`;
        debugStateRef.current.baseVisible = false;
        setBaseCandlesVisibleSafe(false);
        publishDebugStateNow();
        scheduleApplyDiagnostics();
        return true;
      }

      const invalidCount = countInvalidStrategyChartCandles(sourceCandles);
      if (invalidCount > 0) {
        debugStateRef.current.setDataError = `invalid time/OHLC count: ${invalidCount}`;
        debugStateRef.current.dataApplied = false;
        debugStateRef.current.lastSetDataAt = new Date().toISOString();
        debugStateRef.current.lastSetDataReason = `${reason}: invalid-candles`;
        debugStateRef.current.skippedSetDataReason = `${reason}: invalid-candles`;
        publishDebugStateNow();
        scheduleRuntimeDiagnostics();
        return false;
      }

      const nextSignature = candlesSignature(sourceCandles);
      const dataChanged = nextSignature !== lastCandlesSignatureRef.current;

      try {
        if (shouldUpdateData && dataChanged) {
          candleSeries.setData(toCandlestickData(sourceCandles));
          lastCandlesSignatureRef.current = nextSignature;
          setDataCallCountRef.current += 1;
          debugStateRef.current.setDataCallCount = setDataCallCountRef.current;
          debugStateRef.current.setDataCalled = true;
          debugStateRef.current.dataApplied = true;
          debugStateRef.current.setDataCandlesLength = sourceCandles.length;
          debugStateRef.current.lastSetDataAt = new Date().toISOString();
          debugStateRef.current.lastSetDataReason = reason;
          debugStateRef.current.setDataError = null;
        } else if (!debugStateRef.current.setDataCalled) {
          candleSeries.setData(toCandlestickData(sourceCandles));
          lastCandlesSignatureRef.current = nextSignature;
          setDataCallCountRef.current += 1;
          debugStateRef.current.setDataCallCount = setDataCallCountRef.current;
          debugStateRef.current.setDataCalled = true;
          debugStateRef.current.dataApplied = true;
          debugStateRef.current.setDataCandlesLength = sourceCandles.length;
          debugStateRef.current.lastSetDataAt = new Date().toISOString();
          debugStateRef.current.lastSetDataReason = reason;
          debugStateRef.current.setDataError = null;
        }

        if (shouldFitContent) {
          runFitContent(reason);
        } else if (chart) {
          debugStateRef.current.barSpacing = chart.timeScale().options().barSpacing;
        }
      } catch (error) {
        debugStateRef.current.setDataError = error instanceof Error ? error.message : "setData failed";
        debugStateRef.current.dataApplied = false;
        debugStateRef.current.skippedSetDataReason = `${reason}: setData-error`;
        debugStateRef.current.lastSetDataAt = new Date().toISOString();
        debugStateRef.current.lastSetDataReason = `${reason}: setData-error`;
        publishDebugStateNow();
        scheduleRuntimeDiagnostics();
        return false;
      }

      publishDebugStateNow();
      scheduleApplyDiagnostics();
      scheduleRuntimeDiagnostics();
      return true;
    },
    [publishDebugStateNow, runFitContent, scheduleApplyDiagnostics, scheduleRuntimeDiagnostics, setBaseCandlesVisibleSafe],
  );

  const destroyChart = React.useCallback(() => {
    clearPriceLines();
    clearMarkers();
    if (chartRef.current && visibleRangeHandlerRef.current) {
      chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(visibleRangeHandlerRef.current);
      visibleRangeHandlerRef.current = null;
    }
    chartRef.current?.remove();
    chartRef.current = null;
    candleSeriesRef.current = null;
    setChartApi(null);
    setCandleSeriesApi(null);
    setBaseCandlesVisibleSafe(false);
    debugStateRef.current.chartCreated = false;
    debugStateRef.current.chartReady = false;
    debugStateRef.current.candlestickSeriesCreated = false;
    debugStateRef.current.seriesReady = false;
    debugStateRef.current.dataApplied = false;
    debugStateRef.current.baseVisible = false;
    userZoomedRef.current = false;
    lastCandlesSignatureRef.current = "";
  }, [clearMarkers, clearPriceLines, setBaseCandlesVisibleSafe]);

  const createChartIfPossible = React.useCallback(() => {
    const el = containerRef.current;
    if (!el || chartRef.current) return false;

    const width = el.clientWidth;
    const height = el.clientHeight;
    setContainerSize({ width, height });
    onChartDiagnosticsRef.current?.({ chartWidth: width, chartHeight: height });
    const containerReady = width > MIN_CHART_WIDTH && height > MIN_CHART_HEIGHT;
    debugStateRef.current.containerReady = containerReady;

    if (!containerReady) {
      hadZeroSizeRef.current = true;
      publishDebugStateNow();
      scheduleRuntimeDiagnostics();
      return false;
    }

    try {
      const chart = createChart(el, {
        layout: {
          background: { type: ColorType.Solid, color: "#050b14" },
          textColor: "#93a8c2",
          fontFamily: "ui-monospace, monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "rgba(148,163,184,0.025)" },
          horzLines: { color: "rgba(148,163,184,0.03)" },
        },
        rightPriceScale: {
          autoScale: true,
          borderVisible: false,
          scaleMargins: { top: 0.08, bottom: 0.12 },
        },
        timeScale: {
          ...STRATEGY_CHART_TIME_SCALE_OPTIONS,
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "rgba(34,211,238,0.20)", labelBackgroundColor: "#0f172a" },
          horzLine: { color: "rgba(34,211,238,0.16)", labelBackgroundColor: "#0f172a" },
        },
        handleScroll: STRATEGY_CHART_HANDLE_SCROLL,
        handleScale: STRATEGY_CHART_HANDLE_SCALE,
        localization: { locale: "ru-RU" },
        width,
        height,
      });

      const candleSeries = chart.addSeries(CandlestickSeries, getStrategyChartCandlestickSeriesOptions());

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;

      const onVisibleLogicalRangeChange = () => {
        if (!programmaticViewportChangeRef.current) {
          userZoomedRef.current = true;
          debugStateRef.current.userZoomed = true;
        }
        debugStateRef.current.barSpacing = chart.timeScale().options().barSpacing;
        scheduleRuntimeDiagnostics();
      };
      visibleRangeHandlerRef.current = onVisibleLogicalRangeChange;
      chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChange);

      setChartApi(chart);
      setCandleSeriesApi(candleSeries);
      overlayDiagnosticsRef.current = EMPTY_OVERLAY_DIAGNOSTICS;
      lastPublishedOverlaySignatureRef.current = "";
      publishOverlayDiagnostics({
        priceLineCount: 0,
        bufferZoneCount: 0,
        skippedNullCoords: 0,
        rectCount: 0,
        markerCount: 0,
        selectedPriceY: null,
        selectedUpperY: null,
        selectedLowerY: null,
        bufferDisplayMode: "active",
        zonesRendered: 0,
        zonesSkipped: 0,
        approachDirection: null,
        reactionZoneValues: null,
        breakZoneValues: null,
      });
      debugStateRef.current.chartCreated = true;
      debugStateRef.current.chartReady = true;
      debugStateRef.current.candlestickSeriesCreated = true;
      debugStateRef.current.seriesReady = true;
      debugStateRef.current.createSeriesError = null;
      chartReadyRevisionRef.current += 1;
      setChartReadyRevision(chartReadyRevisionRef.current);
      publishDebugStateNow();
      scheduleRuntimeDiagnostics();
      applyCandleData("chart-created", { fitContent: false });
      maybeApplyVisibleRangeForCurrentChart("chart-created");
      return true;
    } catch (error) {
      debugStateRef.current.createSeriesError =
        error instanceof Error ? error.message : "createChart/addSeries failed";
      publishDebugStateNow();
      scheduleRuntimeDiagnostics();
      return false;
    }
  }, [
    applyCandleData,
    maybeApplyVisibleRangeForCurrentChart,
    publishDebugStateNow,
    publishOverlayDiagnostics,
    scheduleRuntimeDiagnostics,
  ]);

  const recreateChart = React.useCallback(
    (reason: string) => {
      recreateAttemptsRef.current += 1;
      debugStateRef.current.recreateAttempts = recreateAttemptsRef.current;
      debugStateRef.current.lastSetDataReason = reason;
      destroyChart();
      publishDebugStateNow();
      if (createChartIfPossible()) {
        applyCandleData(reason, { fitContent: false });
      }
    },
    [applyCandleData, createChartIfPossible, destroyChart, publishDebugStateNow],
  );

  React.useEffect(() => {
    bumpStrategyChartMountCount();
    registerStrategyChartComponentVersion();
    mountedRef.current = true;
    createChartIfPossible();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        applyCandleData("visibility-visible", { fitContent: false });
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mountedRef.current = false;
      if (applyDiagnosticsRafRef.current != null) {
        cancelAnimationFrame(applyDiagnosticsRafRef.current);
      }
      if (runtimeDiagnosticsRafRef.current != null) {
        cancelAnimationFrame(runtimeDiagnosticsRafRef.current);
      }
      if (overlayPublishRafRef.current != null) {
        cancelAnimationFrame(overlayPublishRafRef.current);
      }
      clearSelfHealTimeouts();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      destroyChart();
      debugStateRef.current = { ...EMPTY_STRATEGY_CHART_DEBUG_STATE };
      overlayDiagnosticsRef.current = EMPTY_OVERLAY_DIAGNOSTICS;
    };
  }, [applyCandleData, clearSelfHealTimeouts, createChartIfPossible, destroyChart]);

  React.useEffect(() => {
    publishChartDebugState(chartReadyRevisionRef.current);
  }, [publishChartDebugState]);

  React.useEffect(() => {
    dataRevisionRef.current += 1;
    debugStateRef.current.dataReady = candles.length > 0;
    applyCandleData("candles-changed", { fitContent: false });
    maybeApplyVisibleRangeForCurrentChart("candles-changed");
  }, [applyCandleData, candles, maybeApplyVisibleRangeForCurrentChart]);

  React.useEffect(() => {
    if (!fitContentKey) return;
    const previousKey = lastFitContentKeyRef.current;
    if (previousKey === undefined) {
      lastFitContentKeyRef.current = fitContentKey;
      return;
    }
    if (previousKey === fitContentKey) return;

    lastFitContentKeyRef.current = fitContentKey;
    userZoomedRef.current = false;
    debugStateRef.current.userZoomed = false;
    lastCandlesSignatureRef.current = "";
  }, [fitContentKey]);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver(() => {
      const container = containerRef.current;
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      setContainerSize({ width, height });
      onChartDiagnosticsRef.current?.({ chartWidth: width, chartHeight: height });
      const containerReady = width > MIN_CHART_WIDTH && height > MIN_CHART_HEIGHT;
      debugStateRef.current.containerReady = containerReady;

      if (!containerReady) {
        hadZeroSizeRef.current = true;
      } else if (hadZeroSizeRef.current) {
        hadZeroSizeRef.current = false;
        createChartIfPossible();
        applyCandleData("resize-after-zero-size", { fitContent: false });
      }

      if (chartRef.current && containerReady) {
        chartRef.current.applyOptions({ width, height });
        debugStateRef.current.barSpacing = chartRef.current.timeScale().options().barSpacing;
        setLayoutRevision((value) => value + 1);
        publishDebugStateNow();
        scheduleRuntimeDiagnostics();
      }
    });

    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [applyCandleData, createChartIfPossible, publishDebugStateNow, scheduleRuntimeDiagnostics]);

  React.useEffect(() => {
    clearSelfHealTimeouts();
    if (
      !mountedRef.current ||
      !hasCandles ||
      !debugStateRef.current.chartReady ||
      !debugStateRef.current.seriesReady ||
      baseCandlesVisible
    ) {
      return;
    }

    const runSelfHeal = (reason: string) => {
      if (baseCandlesVisible || !latestCandlesRef.current.length) return;
      if (selfHealAttemptsRef.current < 3) {
        selfHealAttemptsRef.current += 1;
        debugStateRef.current.selfHealAttempts = selfHealAttemptsRef.current;
        publishDebugStateNow();
        applyCandleData(reason, { fitContent: false });
        return;
      }
      if (recreateAttemptsRef.current < 1) {
        recreateChart("recreate after invisible series");
      }
    };

    selfHealTimeoutsRef.current.push(window.setTimeout(() => runSelfHeal("self-heal retry 250ms"), 250));
    selfHealTimeoutsRef.current.push(window.setTimeout(() => runSelfHeal("self-heal retry 1000ms"), 1000));

    return clearSelfHealTimeouts;
  }, [
    applyCandleData,
    baseCandlesVisible,
    clearSelfHealTimeouts,
    hasCandles,
    publishDebugStateNow,
    recreateChart,
  ]);

  React.useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) return;

    if (!effectiveShowLevelLines || levels.length === 0) {
      clearPriceLines();
      scheduleRuntimeDiagnostics();
      return;
    }

    const count = syncRoundLevelPriceLines(
      candleSeries,
      levels,
      highlightedLevelPrice,
      effectiveShowBufferZones,
      priceLinesRef,
      directionalBufferZone,
    );
    publishOverlayDiagnostics({ priceLineCount: count });
    scheduleRuntimeDiagnostics();

    return () => {
      const series = candleSeriesRef.current;
      for (const line of priceLinesRef.current) {
        series?.removePriceLine(line);
      }
      priceLinesRef.current = [];
    };
  }, [
    chartReadyRevision,
    clearPriceLines,
    directionalBufferZone,
    effectiveShowBufferZones,
    effectiveShowLevelLines,
    highlightedLevelPrice,
    levels,
    publishOverlayDiagnostics,
    scheduleRuntimeDiagnostics,
  ]);

  React.useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries || candles.length === 0) {
      clearMarkers();
      scheduleRuntimeDiagnostics();
      return;
    }

    const reactionMarkers =
      effectiveShowReactionMarkers && touchMarkers.length > 0
        ? buildChartMarkers(touchMarkers, candles, focusedTouchEventId)
        : [];
    const zigzagMarkers =
      effectiveShowZigzagMarkers && zigzagPivots.length > 0
        ? buildZigzagMarkers(zigzagPivots, zigzagSegments, candles, showZigzagLabels)
        : [];
    const markers = [...reactionMarkers, ...zigzagMarkers];

    if (markers.length === 0) {
      clearMarkers();
      scheduleRuntimeDiagnostics();
      return;
    }

    if (!markersPluginRef.current) {
      markersPluginRef.current = createSeriesMarkers(candleSeries, markers);
    } else {
      markersPluginRef.current.setMarkers(markers);
    }
    publishOverlayDiagnostics({ markerCount: markers.length });
    scheduleRuntimeDiagnostics();

    return () => {
      markersPluginRef.current?.setMarkers([]);
      markersPluginRef.current?.detach();
      markersPluginRef.current = null;
    };
  }, [
    candles,
    clearMarkers,
    effectiveShowReactionMarkers,
    effectiveShowZigzagMarkers,
    publishOverlayDiagnostics,
    scheduleRuntimeDiagnostics,
    touchMarkers,
    focusedTouchEventId,
    showZigzagLabels,
    zigzagPivots,
    zigzagSegments,
  ]);

  React.useEffect(() => {
    if (effectiveShowBufferZones) return;
    publishOverlayDiagnostics({
      bufferZoneCount: 0,
      skippedNullCoords: 0,
      rectCount: 0,
      selectedPriceY: null,
      selectedUpperY: null,
      selectedLowerY: null,
      bufferDisplayMode,
      zonesRendered: 0,
      zonesSkipped: 0,
      approachDirection: null,
      reactionZoneValues: null,
      breakZoneValues: null,
    });
    scheduleRuntimeDiagnostics();
  }, [bufferDisplayMode, effectiveShowBufferZones, publishOverlayDiagnostics, scheduleRuntimeDiagnostics]);

  const messageOverlay = isError ? (
    <ChartMessage
      title={STRATEGY_LAB_FIELD_LABELS.loadError}
      subtitle={errorMessage ?? STRATEGY_LAB_FIELD_LABELS.candlesFetchFailed}
      className="bg-black/70 backdrop-blur-[1px]"
    />
  ) : !hasCandles ? (
    <ChartMessage
      title={isLoading ? STRATEGY_LAB_FIELD_LABELS.loadingCandles : STRATEGY_LAB_FIELD_LABELS.noCandles}
      subtitle={isLoading ? "MOEX ISS" : errorMessage ?? STRATEGY_LAB_FIELD_LABELS.moexNoHistory}
      className="bg-black/55 backdrop-blur-[1px]"
    />
  ) : null;

  return (
    <div
      ref={shellRef}
      className={cn(
        "relative w-full overflow-hidden rounded border border-white/[0.08] bg-[#050b14]",
        "h-[420px] md:h-[540px] lg:h-[clamp(650px,74vh,820px)]",
        className,
      )}
    >
      <div ref={containerRef} className="absolute inset-0 z-[1]" />
      {showSessionBoxes ? (
        <StrategySessionBoxOverlay
          chart={chartApi}
          candleSeries={candleSeriesApi}
          boxes={sessionBoxes}
          showSessionBoxes={showSessionBoxes}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
        />
      ) : null}
      {effectiveShowBufferZones ? (
        <StrategyRoundLevelOverlay
          chart={chartApi}
          candleSeries={candleSeriesApi}
          levels={levels}
          candles={candles}
          activeApproaches={activeApproaches}
          highlightedLevelPrice={highlightedLevelPrice}
          focusedApproachId={focusedApproachId}
          directionalZone={directionalBufferZone}
          bufferDisplayMode={bufferDisplayMode}
          currentPrice={chartCurrentPrice}
          bufferSize={chartBufferSize}
          resolveDirection={resolveBufferDirection}
          showBufferDebug={showBufferDebug}
          showNearMiss={showNearMiss}
          focusedEventId={focusedEventId}
          showBufferZones
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
          layoutRevision={layoutRevision}
          onBufferDiagnostics={handleBufferDiagnostics}
        />
      ) : null}
      {effectiveShowZigzagMarkers ? (
        <StrategyZigZagOverlay
          chart={chartApi}
          candleSeries={candleSeriesApi}
          pivots={zigzagPivots}
          segments={zigzagSegments}
          currentSwingSegment={zigzagSegments.length > 0 ? zigzagSegments[zigzagSegments.length - 1]! : null}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
          show
        />
      ) : null}
      {hasCandles ? (
        <div className="pointer-events-auto absolute right-2 top-2 z-10 flex items-center gap-1">
          <ChartToolbarButton label="Вписать" title="Вписать все свечи" onClick={handleToolbarFit} />
          <ChartToolbarButton label="Сброс" title="Сбросить масштаб" onClick={handleToolbarReset} />
          <ChartToolbarButton
            label="Сессия"
            title="Вид: текущая сессия"
            onClick={() => applyVisibleRangeAndDebug("session", "toolbar-preset-session")}
          />
          <ChartToolbarButton
            label="2 сессии"
            title="Вид: последние 2 сессии"
            onClick={() => applyVisibleRangeAndDebug("two_sessions", "toolbar-preset-two_sessions")}
          />
          <ChartToolbarButton
            label="Всё"
            title="Вид: весь диапазон"
            onClick={() => applyVisibleRangeAndDebug("all", "toolbar-preset-all")}
          />
          <ChartToolbarButton
            label="Фокус"
            title="Вид: вокруг выбранного касания"
            onClick={() => applyVisibleRangeAndDebug("focus", "toolbar-preset-focus")}
          />
          <ChartToolbarButton label="+" title="Приблизить" onClick={() => handleToolbarZoom("in")} />
          <ChartToolbarButton label="−" title="Отдалить" onClick={() => handleToolbarZoom("out")} />
        </div>
      ) : null}
      {isLoading && hasCandles ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 border-b border-white/[0.06] bg-black/40 px-2 py-1 font-mono text-[10px] text-lab-muted">
          {STRATEGY_LAB_FIELD_LABELS.updating}
        </div>
      ) : null}
      {chartDebug && debugWarning ? (
        <div className="pointer-events-none absolute inset-x-0 top-8 z-10 border border-rose-500/35 bg-rose-950/75 px-2 py-1.5 font-mono text-[10px] text-rose-200">
          {debugWarning}
        </div>
      ) : null}
      {messageOverlay ? <div className="absolute inset-0 z-[3]">{messageOverlay}</div> : null}
    </div>
  );
}
