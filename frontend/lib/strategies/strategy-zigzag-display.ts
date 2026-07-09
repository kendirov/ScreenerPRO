import type { StrategyCandle } from "@/lib/screener/strategies/strategy-candles";
import type { ZigZagPivot, ZigZagSegment } from "@/lib/strategies/zigzag-lite-engine";

export const MAX_ZIGZAG_CHART_MARKERS = 60;

const SEGMENT_UP_COLOR = "rgba(45,212,191,0.72)";
const SEGMENT_DOWN_COLOR = "rgba(248,113,113,0.68)";
const SEGMENT_UP_CURRENT = "rgba(45,212,191,0.92)";
const SEGMENT_DOWN_CURRENT = "rgba(248,113,113,0.88)";
const NEUTRAL_PIVOT_COLOR = "rgba(186,198,214,0.62)";
const PIVOT_LABEL_UP = "rgba(94,234,212,0.95)";
const PIVOT_LABEL_DOWN = "rgba(251,113,133,0.95)";

export type ZigZagChartMarker = {
  time: number | string;
  position: "aboveBar" | "belowBar";
  color: string;
  shape: "arrowDown" | "arrowUp";
  text: string;
};

function segmentEndingAt(
  pivot: ZigZagPivot,
  segments: ZigZagSegment[],
): ZigZagSegment | null {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index]!;
    if (segment.to.candleIndex === pivot.candleIndex && segment.to.type === pivot.type) {
      return segment;
    }
  }
  return null;
}

function pivotMarkerColor(pivot: ZigZagPivot, segments: ZigZagSegment[]): string {
  const segment = segmentEndingAt(pivot, segments);
  if (!segment) return NEUTRAL_PIVOT_COLOR;
  return segment.direction === "up" ? PIVOT_LABEL_UP : PIVOT_LABEL_DOWN;
}

function pivotMarkerText(pivot: ZigZagPivot): string {
  const prefix = pivot.type === "high" ? "H" : "L";
  return `${prefix} ${pivot.price.toFixed(2)}`;
}

function isImportantPivot(pivot: ZigZagPivot, segments: ZigZagSegment[], minChangePct = 0.35): boolean {
  const segment = segmentEndingAt(pivot, segments);
  if (!segment) return false;
  return segment.changePct >= minChangePct;
}

export function buildZigZagChartMarkers(
  pivots: ZigZagPivot[],
  segments: ZigZagSegment[],
  candles: StrategyCandle[],
  options?: {
    maxMarkers?: number;
    showLabels?: boolean;
    importantOnly?: boolean;
  },
): ZigZagChartMarker[] {
  const maxMarkers = options?.maxMarkers ?? MAX_ZIGZAG_CHART_MARKERS;
  const showLabels = options?.showLabels ?? true;
  const importantOnly = options?.importantOnly ?? false;

  const filtered = importantOnly
    ? pivots.filter((pivot) => isImportantPivot(pivot, segments))
    : pivots;
  const visible = filtered.slice(-maxMarkers);

  return visible.map((pivot) => {
    const candle = candles[pivot.candleIndex];
    const time = typeof candle?.time === "number" ? candle.time : pivot.time;

    return {
      time,
      position: pivot.type === "high" ? ("aboveBar" as const) : ("belowBar" as const),
      color: pivotMarkerColor(pivot, segments),
      shape: pivot.type === "high" ? ("arrowDown" as const) : ("arrowUp" as const),
      text: showLabels ? pivotMarkerText(pivot) : "",
    };
  });
}

export function zigzagSegmentStroke(
  segment: ZigZagSegment,
  options?: { isCurrentSwing?: boolean; isFocused?: boolean },
): { color: string; width: number; opacity: number } {
  const isCurrent = options?.isCurrentSwing ?? false;
  const isFocused = options?.isFocused ?? false;
  const baseColor = segment.direction === "up" ? SEGMENT_UP_COLOR : SEGMENT_DOWN_COLOR;
  const currentColor = segment.direction === "up" ? SEGMENT_UP_CURRENT : SEGMENT_DOWN_CURRENT;

  if (isFocused) {
    return { color: currentColor, width: 2, opacity: 1 };
  }
  if (isCurrent) {
    return { color: currentColor, width: 1.5, opacity: 0.88 };
  }
  return { color: baseColor, width: 1, opacity: 0.68 };
}
