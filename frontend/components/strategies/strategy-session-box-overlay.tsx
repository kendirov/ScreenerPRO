"use client";

import * as React from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import type { SessionBox } from "@/lib/strategies/session-box-engine";

type SessionBoxOverlayDiagnostics = {
  sessionBoxCount: number;
  sessionBoxSkipped: number;
};

type SessionBoxRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  labelX: number;
  labelY: number;
  highY: number;
  lowY: number;
};

const EMPTY_DIAGNOSTICS: SessionBoxOverlayDiagnostics = {
  sessionBoxCount: 0,
  sessionBoxSkipped: 0,
};
const MAX_SESSION_BOXES = 30;

function clampRect(
  x: number,
  y: number,
  width: number,
  height: number,
  paneWidth: number,
  paneHeight: number,
): { x: number; y: number; width: number; height: number } | null {
  if (![x, y, width, height, paneWidth, paneHeight].every(Number.isFinite)) return null;
  if (paneWidth <= 0 || paneHeight <= 0 || width <= 1 || height <= 1) return null;

  let nextX = x;
  let nextY = y;
  let nextWidth = width;
  let nextHeight = height;

  if (nextX < 0) {
    nextWidth += nextX;
    nextX = 0;
  }
  if (nextY < 0) {
    nextHeight += nextY;
    nextY = 0;
  }
  if (nextX >= paneWidth || nextY >= paneHeight) return null;
  if (nextX + nextWidth > paneWidth) nextWidth = paneWidth - nextX;
  if (nextY + nextHeight > paneHeight) nextHeight = paneHeight - nextY;
  if (nextWidth <= 1 || nextHeight <= 1) return null;

  return { x: nextX, y: nextY, width: nextWidth, height: nextHeight };
}

function formatSessionLabel(box: SessionBox): string {
  const [year, month, day] = box.date.split("-");
  return `${day}.${month} · ${box.rangePct.toFixed(1)}%`;
}

function buildSessionRects(options: {
  boxes: SessionBox[];
  chart: IChartApi;
  candleSeries: ISeriesApi<"Candlestick">;
  width: number;
  height: number;
}): { rects: SessionBoxRect[]; diagnostics: SessionBoxOverlayDiagnostics } {
  const { boxes, chart, candleSeries, width, height } = options;
  const rects: SessionBoxRect[] = [];
  let skipped = 0;

  for (const box of boxes.slice(-MAX_SESSION_BOXES)) {
    const startX = chart.timeScale().timeToCoordinate(box.startTime as Time);
    const endX = chart.timeScale().timeToCoordinate(box.endTime as Time);
    const highY = candleSeries.priceToCoordinate(box.high);
    const lowY = candleSeries.priceToCoordinate(box.low);
    if (startX == null || endX == null || highY == null || lowY == null) {
      skipped += 1;
      continue;
    }

    const left = Math.min(startX, endX);
    const top = Math.min(highY, lowY);
    const rectWidth = Math.abs(endX - startX);
    const rectHeight = Math.abs(lowY - highY);
    const clamped = clampRect(left, top, rectWidth, rectHeight, width, height);
    if (!clamped) {
      skipped += 1;
      continue;
    }

    rects.push({
      id: box.id,
      x: clamped.x,
      y: clamped.y,
      width: clamped.width,
      height: clamped.height,
      label: formatSessionLabel(box),
      labelX: clamped.x + 6,
      labelY: Math.max(10, clamped.y + 12),
      highY: Math.max(0, Math.min(height, highY)),
      lowY: Math.max(0, Math.min(height, lowY)),
    });
  }

  return {
    rects,
    diagnostics: {
      sessionBoxCount: rects.length,
      sessionBoxSkipped: skipped,
    },
  };
}

export function StrategySessionBoxOverlay({
  chart,
  candleSeries,
  boxes,
  showSessionBoxes,
  containerWidth,
  containerHeight,
}: {
  chart: IChartApi | null;
  candleSeries: ISeriesApi<"Candlestick"> | null;
  boxes: SessionBox[];
  showSessionBoxes: boolean;
  containerWidth: number;
  containerHeight: number;
}) {
  const [visibleRangeRevision, setVisibleRangeRevision] = React.useState(0);

  React.useEffect(() => {
    if (!chart || !showSessionBoxes) return;
    const handleVisibleRangeChange = () => {
      setVisibleRangeRevision((value) => value + 1);
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
    };
  }, [chart, showSessionBoxes]);

  const snapshot = React.useMemo(() => {
    if (
      !chart ||
      !candleSeries ||
      !showSessionBoxes ||
      boxes.length === 0 ||
      containerWidth <= 0 ||
      containerHeight <= 0
    ) {
      return { rects: [] as SessionBoxRect[], diagnostics: EMPTY_DIAGNOSTICS };
    }
    return buildSessionRects({
      boxes,
      chart,
      candleSeries,
      width: containerWidth,
      height: containerHeight,
    });
  }, [
    boxes,
    candleSeries,
    chart,
    containerHeight,
    containerWidth,
    showSessionBoxes,
    visibleRangeRevision,
  ]);

  if (!showSessionBoxes || snapshot.rects.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[2] bg-transparent"
      width={containerWidth}
      height={containerHeight}
      data-session-box-count={snapshot.diagnostics.sessionBoxCount}
      aria-hidden
    >
      {snapshot.rects.map((rect) => (
        <g key={rect.id}>
          <rect
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            fill="rgba(56,189,248,0.05)"
            stroke="rgba(125,145,170,0.20)"
            strokeWidth={1}
          />
          <line
            x1={rect.x}
            x2={rect.x + rect.width}
            y1={rect.highY}
            y2={rect.highY}
            stroke="rgba(125,211,252,0.18)"
            strokeWidth={0.75}
            strokeDasharray="3 4"
          />
          <line
            x1={rect.x}
            x2={rect.x + rect.width}
            y1={rect.lowY}
            y2={rect.lowY}
            stroke="rgba(125,211,252,0.16)"
            strokeWidth={0.75}
            strokeDasharray="3 4"
          />
          <text
            x={rect.labelX}
            y={rect.labelY}
            fill="rgba(186,230,253,0.54)"
            fontSize={9}
            fontFamily="ui-monospace, monospace"
          >
            {rect.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
