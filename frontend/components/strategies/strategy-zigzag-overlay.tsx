"use client";

import * as React from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";

import type { ZigZagPivot, ZigZagSegment } from "@/lib/strategies/zigzag-lite-engine";
import { zigzagSegmentStroke } from "@/lib/strategies/strategy-zigzag-display";

function stableSignature(pivots: ZigZagPivot[], segments: ZigZagSegment[]): string {
  return JSON.stringify({
    pivots: pivots.map((pivot) => [pivot.candleIndex, pivot.type, pivot.time, pivot.price]),
    segments: segments.map((segment) => [
      segment.from.candleIndex,
      segment.to.candleIndex,
      segment.direction,
      segment.from.price,
      segment.to.price,
    ]),
  });
}

type ZigZagLine = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
  opacity: number;
};

export function StrategyZigZagOverlay({
  chart,
  candleSeries,
  pivots,
  segments,
  currentSwingSegment = null,
  focusedSegmentId = null,
  containerWidth,
  containerHeight,
  show,
}: {
  chart: IChartApi | null;
  candleSeries: ISeriesApi<"Candlestick"> | null;
  pivots: ZigZagPivot[];
  segments: ZigZagSegment[];
  currentSwingSegment?: ZigZagSegment | null;
  focusedSegmentId?: string | null;
  containerWidth: number;
  containerHeight: number;
  show: boolean;
}) {
  const [revision, setRevision] = React.useState(0);
  const signature = React.useMemo(() => stableSignature(pivots, segments), [pivots, segments]);

  const lines = React.useMemo(() => {
    if (!show || !chart || !candleSeries || containerWidth <= 0 || containerHeight <= 0 || segments.length === 0) {
      return [] as ZigZagLine[];
    }

    const built: ZigZagLine[] = [];
    for (const segment of segments) {
      const x1 = chart.timeScale().timeToCoordinate(segment.from.time as Time);
      const x2 = chart.timeScale().timeToCoordinate(segment.to.time as Time);
      const y1 = candleSeries.priceToCoordinate(segment.from.price);
      const y2 = candleSeries.priceToCoordinate(segment.to.price);
      if ([x1, x2, y1, y2].some((value) => value == null || !Number.isFinite(value))) continue;

      const segmentId = `${segment.from.candleIndex}-${segment.to.candleIndex}-${segment.direction}`;
      const style = zigzagSegmentStroke(segment, {
        isCurrentSwing:
          currentSwingSegment != null &&
          currentSwingSegment.from.candleIndex === segment.from.candleIndex &&
          currentSwingSegment.to.candleIndex === segment.to.candleIndex,
        isFocused: focusedSegmentId != null && focusedSegmentId === segmentId,
      });

      built.push({
        id: segmentId,
        x1: x1!,
        y1: y1!,
        x2: x2!,
        y2: y2!,
        stroke: style.color,
        strokeWidth: style.width,
        opacity: style.opacity,
      });
    }
    return built;
  }, [
    show,
    chart,
    candleSeries,
    containerWidth,
    containerHeight,
    segments,
    revision,
    signature,
    currentSwingSegment,
    focusedSegmentId,
  ]);

  React.useEffect(() => {
    if (!show || !chart) return;
    const handleVisibleRangeChange = () => setRevision((value) => value + 1);
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
    };
  }, [chart, show]);

  if (!show || lines.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[2] bg-transparent"
      width={containerWidth > 0 ? containerWidth : "100%"}
      height={containerHeight > 0 ? containerHeight : "100%"}
      aria-hidden
    >
      {lines.map((line) => (
        <line
          key={line.id}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke={line.stroke}
          strokeWidth={line.strokeWidth}
          opacity={line.opacity}
        />
      ))}
    </svg>
  );
}
