"use client";

import * as React from "react";
import { LineStyle, type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";
import {
  buildBufferZoneOverlay,
  type BufferDisplayMode,
  type BufferZoneOverlayDiagnostics,
  type BufferZoneRect,
} from "@/lib/strategies/strategy-buffer-zone-overlay";
import type { ApproachDirection, DirectionalBufferZone } from "@/lib/strategies/round-buffer-direction-engine";
import type { RoundLevelApproachSegment } from "@/lib/strategies/round-level-approach-engine";
import type { StrategyCandle } from "@/lib/screener/strategies/strategy-candles";
import type { RoundLevel, RoundLevelImportance } from "@/lib/strategies/round-levels-engine";

export type { BufferDisplayMode, BufferZoneOverlayDiagnostics };

const LEVEL_LINE_STYLE: Record<
  RoundLevelImportance,
  { color: string; lineWidth: 1 | 2 | 3 | 4; lineStyle: LineStyle; axisLabelVisible: boolean }
> = {
  psychological: {
    color: "rgba(96,165,250,0.72)",
    lineWidth: 2,
    lineStyle: LineStyle.Solid,
    axisLabelVisible: true,
  },
  major: {
    color: "rgba(34,211,238,0.42)",
    lineWidth: 1,
    lineStyle: LineStyle.Solid,
    axisLabelVisible: true,
  },
  normal: {
    color: "rgba(125,145,170,0.40)",
    lineWidth: 1,
    lineStyle: LineStyle.Solid,
    axisLabelVisible: false,
  },
  minor: {
    color: "rgba(125,145,170,0.20)",
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
    axisLabelVisible: false,
  },
};

import { BUFFER_ZONE_VISIBILITY } from "@/lib/strategies/strategy-buffer-zone-overlay";

const BUFFER_LINE_COLOR = `rgba(148,163,184,${BUFFER_ZONE_VISIBILITY.active.border})`;
const BUFFER_LINE_COLOR_SELECTED = `rgba(186,230,253,${BUFFER_ZONE_VISIBILITY.selected.border})`;

const EMPTY_BUFFER_DIAGNOSTICS: BufferZoneOverlayDiagnostics = {
  bufferZoneCount: 0,
  skippedNullCoords: 0,
  rectCount: 0,
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

function stableBufferRectsSignature(
  rects: BufferZoneRect[],
  boundaryCount: number,
  labelCount: number,
): string {
  return JSON.stringify({
    rects: rects.map((rect) => [
      rect.id,
      Math.round(rect.left),
      Math.round(rect.width),
      Math.round(rect.top),
      Math.round(rect.height),
      rect.fill,
    ]),
    boundaryCount,
    labelCount,
  });
}

function stableBufferDiagnosticsSignature(diagnostics: BufferZoneOverlayDiagnostics): string {
  return JSON.stringify([
    diagnostics.bufferZoneCount,
    diagnostics.skippedNullCoords,
    diagnostics.rectCount,
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

function buildLevelsSignature(levels: RoundLevel[]): string {
  return JSON.stringify(
    levels.map((level) => [
      level.price,
      level.importance,
      level.upperBuffer.from,
      level.upperBuffer.to,
      level.lowerBuffer.from,
      level.lowerBuffer.to,
    ]),
  );
}

function approachesSignature(approaches: RoundLevelApproachSegment[]): string {
  return JSON.stringify(
    approaches.map((approach) => [
      approach.id,
      approach.level,
      approach.direction,
      approach.startTime,
      approach.endTime,
      approach.reactionZone.from,
      approach.reactionZone.to,
      approach.breakZone.from,
      approach.breakZone.to,
      approach.outcome ?? null,
    ]),
  );
}

export function StrategyRoundLevelOverlay({
  chart,
  candleSeries,
  levels,
  activeApproaches = [],
  highlightedLevelPrice,
  focusedApproachId = null,
  directionalZone = null,
  bufferDisplayMode = "active",
  currentPrice = null,
  bufferSize = null,
  resolveDirection,
  candles = [],
  showBufferDebug = false,
  showNearMiss = true,
  focusedEventId = null,
  showBufferZones,
  containerWidth,
  containerHeight,
  layoutRevision = 0,
  onBufferDiagnostics,
}: {
  chart: IChartApi | null;
  candleSeries: ISeriesApi<"Candlestick"> | null;
  levels: RoundLevel[];
  activeApproaches?: RoundLevelApproachSegment[];
  highlightedLevelPrice: number | null;
  focusedApproachId?: string | null;
  directionalZone?: DirectionalBufferZone | null;
  bufferDisplayMode?: BufferDisplayMode;
  currentPrice?: number | null;
  bufferSize?: number | null;
  resolveDirection?: (levelPrice: number) => ApproachDirection;
  candles?: StrategyCandle[];
  showBufferDebug?: boolean;
  showNearMiss?: boolean;
  focusedEventId?: string | null;
  showBufferZones: boolean;
  containerWidth: number;
  containerHeight: number;
  layoutRevision?: number;
  onBufferDiagnostics?: (diagnostics: BufferZoneOverlayDiagnostics) => void;
}) {
  const onBufferDiagnosticsRef = React.useRef(onBufferDiagnostics);
  const lastPublishedDiagnosticsSignatureRef = React.useRef(
    stableBufferDiagnosticsSignature(EMPTY_BUFFER_DIAGNOSTICS),
  );
  const lastRectsSignatureRef = React.useRef("");
  const diagnosticsPublishRafRef = React.useRef<number | null>(null);
  const [visibleRangeRevision, setVisibleRangeRevision] = React.useState(0);

  const levelsSignature = React.useMemo(() => buildLevelsSignature(levels), [levels]);
  const highlightedSignature =
    highlightedLevelPrice != null && Number.isFinite(highlightedLevelPrice)
      ? String(highlightedLevelPrice)
      : "none";
  const activeApproachesSignature = React.useMemo(
    () => approachesSignature(activeApproaches),
    [activeApproaches],
  );

  React.useEffect(() => {
    onBufferDiagnosticsRef.current = onBufferDiagnostics;
  }, [onBufferDiagnostics]);

  const publishDiagnosticsSafe = React.useCallback((diagnostics: BufferZoneOverlayDiagnostics) => {
    const signature = stableBufferDiagnosticsSignature(diagnostics);
    if (signature === lastPublishedDiagnosticsSignatureRef.current) return;

    lastPublishedDiagnosticsSignatureRef.current = signature;
    if (diagnosticsPublishRafRef.current != null) {
      cancelAnimationFrame(diagnosticsPublishRafRef.current);
    }
    diagnosticsPublishRafRef.current = requestAnimationFrame(() => {
      diagnosticsPublishRafRef.current = null;
      onBufferDiagnosticsRef.current?.(diagnostics);
    });
  }, []);

  const overlaySnapshot = React.useMemo(() => {
    const hasSelectedZone =
      directionalZone != null &&
      highlightedLevelPrice != null &&
      Math.abs(directionalZone.level - highlightedLevelPrice) < 1e-6;

    if (
      !chart ||
      !candleSeries ||
      !showBufferZones ||
      levels.length === 0 ||
      (activeApproaches.length === 0 && !hasSelectedZone) ||
      containerHeight <= 0 ||
      containerWidth <= 0
    ) {
      return {
        bands: [] as BufferZoneRect[],
        boundaryLines: [] as ReturnType<typeof buildBufferZoneOverlay>["boundaryLines"],
        labels: [] as ReturnType<typeof buildBufferZoneOverlay>["labels"],
        diagnostics: { ...EMPTY_BUFFER_DIAGNOSTICS, bufferDisplayMode },
      };
    }

    const built = buildBufferZoneOverlay(
      activeApproaches,
      levels,
      highlightedLevelPrice,
      (time) => chart.timeScale().timeToCoordinate(time as Time),
      (price) => candleSeries.priceToCoordinate(price),
      containerWidth,
      containerHeight,
      {
        displayMode: bufferDisplayMode,
        focusedApproachId,
        directionalZone,
        candles,
        showBackgroundBuffers: bufferDisplayMode === "important",
        showNearMiss,
        focusedEventId,
      },
    );
    return {
      bands: built.rects,
      boundaryLines: built.boundaryLines,
      labels: built.labels,
      diagnostics: built.diagnostics,
    };
  }, [
    activeApproaches,
    activeApproachesSignature,
    bufferDisplayMode,
    candleSeries,
    candles,
    chart,
    containerHeight,
    directionalZone,
    focusedApproachId,
    highlightedLevelPrice,
    highlightedSignature,
    levels,
    levelsSignature,
    showBufferZones,
    visibleRangeRevision,
    layoutRevision,
    containerWidth,
  ]);

  const diagnosticsSignature = stableBufferDiagnosticsSignature(overlaySnapshot.diagnostics);

  React.useEffect(() => {
    publishDiagnosticsSafe(overlaySnapshot.diagnostics);
  }, [diagnosticsSignature, overlaySnapshot.diagnostics, publishDiagnosticsSafe]);

  React.useEffect(() => {
    if (!showBufferZones) {
      publishDiagnosticsSafe({ ...EMPTY_BUFFER_DIAGNOSTICS, bufferDisplayMode });
    }
  }, [bufferDisplayMode, publishDiagnosticsSafe, showBufferZones]);

  React.useEffect(() => {
    lastRectsSignatureRef.current = stableBufferRectsSignature(
      overlaySnapshot.bands,
      overlaySnapshot.boundaryLines.length,
      overlaySnapshot.labels.length,
    );
  }, [overlaySnapshot.bands, overlaySnapshot.boundaryLines.length, overlaySnapshot.labels.length]);

  React.useEffect(() => {
    const hasSelectedZone =
      directionalZone != null &&
      highlightedLevelPrice != null &&
      Math.abs(directionalZone.level - highlightedLevelPrice) < 1e-6;

    if (
      !chart ||
      !candleSeries ||
      !showBufferZones ||
      levels.length === 0 ||
      (activeApproaches.length === 0 && !hasSelectedZone) ||
      containerHeight <= 0 ||
      containerWidth <= 0
    ) {
      return;
    }

    const handleVisibleRangeChange = () => {
      const { rects, boundaryLines, labels, diagnostics } = buildBufferZoneOverlay(
        activeApproaches,
        levels,
        highlightedLevelPrice,
        (time) => chart.timeScale().timeToCoordinate(time as Time),
        (price) => candleSeries.priceToCoordinate(price),
        containerWidth,
        containerHeight,
        {
          displayMode: bufferDisplayMode,
          focusedApproachId,
          directionalZone,
          candles,
          showBackgroundBuffers: bufferDisplayMode === "important",
          showNearMiss,
          focusedEventId,
        },
      );
      const rectsSignature = stableBufferRectsSignature(rects, boundaryLines.length, labels.length);
      if (rectsSignature !== lastRectsSignatureRef.current) {
        lastRectsSignatureRef.current = rectsSignature;
        setVisibleRangeRevision((value) => value + 1);
      }
      publishDiagnosticsSafe(diagnostics);
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      if (diagnosticsPublishRafRef.current != null) {
        cancelAnimationFrame(diagnosticsPublishRafRef.current);
      }
    };
  }, [
    activeApproaches,
    activeApproachesSignature,
    bufferDisplayMode,
    candles,
    candleSeries,
    chart,
    containerHeight,
    directionalZone,
    focusedApproachId,
    highlightedLevelPrice,
    highlightedSignature,
    levels,
    levelsSignature,
    layoutRevision,
    publishDiagnosticsSafe,
    showBufferZones,
    containerWidth,
  ]);

  const { bands, boundaryLines, labels, diagnostics: bufferDiagnostics } = overlaySnapshot;

  if (!showBufferZones || bands.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[2] bg-transparent"
      width={containerWidth > 0 ? containerWidth : "100%"}
      height={containerHeight > 0 ? containerHeight : "100%"}
      data-buffer-zone-count={bufferDiagnostics.bufferZoneCount}
      data-buffer-rect-count={bufferDiagnostics.rectCount}
      aria-hidden
    >
      {bands.map((band) => (
        <rect
          key={band.id}
          x={band.left}
          y={band.top}
          width={band.width}
          height={band.height}
          fill={band.fill}
          stroke={
            band.kind === "near_miss"
              ? `rgba(186,230,253,${BUFFER_ZONE_VISIBILITY[band.tier].border})`
              : band.isSelected
                ? BUFFER_LINE_COLOR_SELECTED
                : `rgba(148,163,184,${BUFFER_ZONE_VISIBILITY[band.tier].border})`
          }
          strokeWidth={band.kind === "near_miss" ? 0.75 : band.isSelected ? 1 : 0.5}
          strokeDasharray={band.kind === "near_miss" ? "3 3" : undefined}
        />
      ))}
      {boundaryLines.map((line) => (
        <line
          key={line.id}
          x1={line.x1}
          x2={line.x2}
          y1={line.y}
          y2={line.y}
          stroke={line.isSelected ? BUFFER_LINE_COLOR_SELECTED : BUFFER_LINE_COLOR}
          strokeWidth={line.isSelected ? 1 : 0.75}
          strokeDasharray={line.kind === "level" ? "5 3" : "4 4"}
          opacity={line.isSelected ? 0.9 : BUFFER_ZONE_VISIBILITY[line.tier].border}
        />
      ))}
      {showBufferDebug
        ? bands.map((band) => (
            <rect
              key={`${band.id}-debug`}
              x={band.left}
              y={band.top}
              width={band.width}
              height={band.height}
              fill="none"
              stroke="rgba(250,204,21,0.55)"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          ))
        : null}
      {labels.map((label) => (
        <text
          key={label.id}
          x={label.x}
          y={label.y + 3}
          fill="rgba(186,230,253,0.82)"
          fontSize={9}
          fontFamily="ui-monospace, monospace"
        >
          {label.text}
        </text>
      ))}
    </svg>
  );
}

function axisLabelVisibleForLevel(
  level: RoundLevel,
  importance: RoundLevelImportance,
  isHighlighted: boolean,
  highlightedLevelPrice: number | null,
): boolean {
  if (isHighlighted) return true;
  if (
    highlightedLevelPrice != null &&
    Number.isFinite(highlightedLevelPrice) &&
    Math.abs(level.price - highlightedLevelPrice) <= Math.max(level.step * 3, 1.5)
  ) {
    return true;
  }
  return importance === "psychological" || importance === "major";
}

export function syncRoundLevelPriceLines(
  candleSeries: ISeriesApi<"Candlestick"> | null,
  levels: RoundLevel[],
  highlightedLevelPrice: number | null,
  showBufferZones: boolean,
  priceLinesRef: React.MutableRefObject<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]>[]>,
  directionalZone?: DirectionalBufferZone | null,
): number {
  for (const line of priceLinesRef.current) {
    candleSeries?.removePriceLine(line);
  }
  priceLinesRef.current = [];

  if (!candleSeries || levels.length === 0) return 0;

  let levelLineCount = 0;

  for (const level of levels) {
    const isHighlighted =
      highlightedLevelPrice != null && Math.abs(level.price - highlightedLevelPrice) < 1e-6;
    const style = LEVEL_LINE_STYLE[level.importance];
    const showAxisLabel = axisLabelVisibleForLevel(
      level,
      level.importance,
      isHighlighted,
      highlightedLevelPrice,
    );

    const mainLine = candleSeries.createPriceLine({
      price: level.price,
      color: isHighlighted ? "rgba(125,211,252,0.96)" : style.color,
      lineWidth: isHighlighted ? 2 : style.lineWidth,
      lineStyle: style.lineStyle,
      axisLabelVisible: showAxisLabel,
      title: showAxisLabel ? level.label : "",
    });
    priceLinesRef.current.push(mainLine);
    levelLineCount += 1;

    if (!showBufferZones) continue;

    const useDirectional =
      isHighlighted &&
      directionalZone != null &&
      Math.abs(directionalZone.level - level.price) < 1e-6;

    if (!useDirectional) continue;

    const boundaries = [
      directionalZone.reactionZone.from,
      directionalZone.reactionZone.to,
      directionalZone.breakZone.from,
      directionalZone.breakZone.to,
    ].filter(
      (boundary, index, all) =>
        Math.abs(boundary - level.price) >= 1e-6 && all.indexOf(boundary) === index,
    );

    for (const boundary of boundaries) {
      const bufferLine = candleSeries.createPriceLine({
        price: boundary,
        color: BUFFER_LINE_COLOR_SELECTED,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: false,
        title: "",
      });
      priceLinesRef.current.push(bufferLine);
    }
  }

  return levelLineCount;
}
