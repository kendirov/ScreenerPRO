import type { StrategyCandle } from "@/lib/screener/strategies/strategy-candles";
import { formatDirectionalPriceRange } from "@/lib/strategies/round-buffer-direction-engine";
import type { DirectionalBufferZone } from "@/lib/strategies/round-buffer-direction-engine";
import type { RoundLevelApproachSegment } from "@/lib/strategies/round-level-approach-engine";
import type { RoundLevel, RoundLevelImportance } from "@/lib/strategies/round-levels-engine";

export type BufferDisplayMode = "active" | "selected" | "important" | "all";

export type BufferZoneVisibilityTier = "selected" | "active" | "background";

/** Opacity tiers — candles must stay visually dominant over zones. */
export const BUFFER_ZONE_VISIBILITY: Record<
  BufferZoneVisibilityTier,
  { reaction: number; break: number; border: number }
> = {
  selected: { reaction: 0.14, break: 0.12, border: 0.42 },
  active: { reaction: 0.11, break: 0.09, border: 0.3 },
  background: { reaction: 0.05, break: 0.04, border: 0.15 },
};

export const NEAR_MISS_FILL_OPACITY = 0.06;
export const SELECTED_LABEL_RIGHT_OFFSET = 6;
export const APPROACH_WINDOW_FALLBACK_BEFORE = 10;
export const APPROACH_WINDOW_FALLBACK_AFTER = 8;

export const DEFAULT_EVENT_BAR_PADDING = 8;

export type BufferZoneRect = {
  id: string;
  left: number;
  width: number;
  top: number;
  height: number;
  fill: string;
  kind: "reaction" | "break" | "neutral" | "near_miss";
  levelPrice: number;
  isSelected: boolean;
  tier: BufferZoneVisibilityTier;
  eventKind?: "near_miss";
  label?: string;
};

export type BufferZoneBoundaryLine = {
  id: string;
  x1: number;
  x2: number;
  y: number;
  kind: "reaction" | "break" | "level" | "neutral";
  isSelected: boolean;
  tier: BufferZoneVisibilityTier;
};

export type BufferZoneLabel = {
  id: string;
  x: number;
  y: number;
  text: string;
};

export type BufferZoneOverlayDiagnostics = {
  bufferZoneCount: number;
  skippedNullCoords: number;
  rectCount: number;
  selectedPriceY: number | null;
  selectedUpperY: number | null;
  selectedLowerY: number | null;
  bufferDisplayMode: BufferDisplayMode;
  zonesRendered: number;
  zonesSkipped: number;
  approachDirection: "up_to_level" | "down_to_level" | "unknown" | null;
  reactionZoneValues: string | null;
  breakZoneValues: string | null;
};

const EPS = 1e-6;
const MIN_RECT_HEIGHT = 0.5;
const MAX_BAND_HEIGHT_RATIO = 0.35;

const EMPTY_DIAGNOSTICS: BufferZoneOverlayDiagnostics = {
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

export function bufferZoneFillOpacity(
  tier: BufferZoneVisibilityTier,
  kind: "reaction" | "break",
): number {
  return BUFFER_ZONE_VISIBILITY[tier][kind];
}

export function buildNearMissRects(
  approach: RoundLevelApproachSegment,
  priceToY: (price: number) => number | null,
  timeToX: (time: number) => number | null,
  paneWidth: number,
  paneHeight: number,
  candles: StrategyCandle[],
  isSelected: boolean,
): { rects: BufferZoneRect[]; labels: BufferZoneLabel[]; skipped: number } {
  if (approach.eventKind !== "near_miss") {
    return { rects: [], labels: [], skipped: 0 };
  }

  const timeRange = resolveApproachTimeRange(approach, candles);
  if (!timeRange) return { rects: [], labels: [], skipped: 2 };

  const xA = timeToX(timeRange.startTime);
  const xB = timeToX(timeRange.endTime);
  if (xA == null || xB == null) return { rects: [], labels: [], skipped: 2 };

  const left = Math.min(xA, xB);
  const width = Math.abs(xB - xA);

  const zoneFrom = approach.approachZone?.from ?? approach.reactionZone.from;
  const zoneTo = approach.approachZone?.to ?? approach.reactionZone.to;
  const built = priceBandRect(
    `near-miss-${approach.id}`,
    approach.level,
    zoneFrom,
    zoneTo,
    "near_miss",
    approach.direction,
    isSelected ? "selected" : "active",
    isSelected,
    left,
    width,
    priceToY,
    paneWidth,
    paneHeight,
  );

  const labels: BufferZoneLabel[] = [];
  if (built.rect) {
    built.rect.eventKind = "near_miss";
    built.rect.label = "недоход";
    const labelY = priceToY(approach.level);
    if (labelY != null && Number.isFinite(labelY)) {
      labels.push({
        id: `near-miss-label-${approach.id}`,
        x: Math.min(paneWidth - SELECTED_LABEL_RIGHT_OFFSET, left + width - 4),
        y: labelY,
        text: "near",
      });
    }
  }

  return { rects: built.rect ? [built.rect] : [], labels, skipped: built.skipped };
}

function zoneFillColor(
  kind: "reaction" | "break" | "neutral" | "near_miss",
  direction: RoundLevelApproachSegment["direction"] | null,
  tier: BufferZoneVisibilityTier,
): string {
  if (kind === "near_miss") {
    return `rgba(148,163,184,${NEAR_MISS_FILL_OPACITY})`;
  }

  const opacity =
    kind === "neutral"
      ? BUFFER_ZONE_VISIBILITY[tier].reaction
      : BUFFER_ZONE_VISIBILITY[tier][kind];

  if (kind === "reaction") {
    return direction === "down"
      ? `rgba(74,222,128,${opacity})`
      : `rgba(45,212,191,${opacity})`;
  }
  if (kind === "break") {
    return direction === "up"
      ? `rgba(248,113,113,${opacity})`
      : `rgba(251,191,36,${opacity})`;
  }
  return `rgba(148,163,184,${opacity})`;
}

function approachDirectionLabel(
  direction: RoundLevelApproachSegment["direction"],
): "up_to_level" | "down_to_level" {
  return direction === "up" ? "up_to_level" : "down_to_level";
}

export function filterApproachesForBufferDisplay(
  approaches: RoundLevelApproachSegment[],
  levels: RoundLevel[],
  displayMode: BufferDisplayMode,
  selectedPrice: number | null,
  options?: { showNearMiss?: boolean },
): RoundLevelApproachSegment[] {
  const showNearMiss = options?.showNearMiss ?? true;
  const levelMap = new Map(levels.map((level) => [level.price, level]));
  const selectedOnly = (segments: RoundLevelApproachSegment[]) =>
    selectedPrice == null ? [] : segments.filter((segment) => Math.abs(segment.level - selectedPrice) < EPS);

  const filterNearMiss = (segments: RoundLevelApproachSegment[]) => {
    if (showNearMiss) return segments;
    return segments.filter((segment) => segment.eventKind !== "near_miss");
  };

  if (displayMode === "active") {
    return filterNearMiss(
      approaches.filter(
        (segment) =>
          segment.eventKind !== "near_miss" ||
          (selectedPrice != null && Math.abs(segment.level - selectedPrice) < EPS),
      ),
    );
  }
  if (displayMode === "selected") {
    return filterNearMiss(selectedOnly(approaches));
  }
  if (displayMode === "important") {
    return filterNearMiss(
      approaches.filter((segment) => {
        const level = levelMap.get(segment.level);
        return level?.importance === "major" || level?.importance === "psychological";
      }),
    );
  }
  return filterNearMiss(
    approaches.filter((segment) => {
      const level = levelMap.get(segment.level);
      return level?.importance !== "minor";
    }),
  );
}

export function clampRectToPane(
  top: number,
  height: number,
  paneHeight: number,
): { top: number; height: number } | null {
  if (!Number.isFinite(top) || !Number.isFinite(height) || !Number.isFinite(paneHeight)) {
    return null;
  }
  if (paneHeight <= 0 || height <= MIN_RECT_HEIGHT) return null;

  let y = top;
  let h = height;
  if (h > paneHeight * MAX_BAND_HEIGHT_RATIO && h > paneHeight * 0.5) return null;
  if (y < 0) {
    h += y;
    y = 0;
  }
  if (y >= paneHeight) return null;
  if (y + h > paneHeight) {
    h = paneHeight - y;
  }
  if (!Number.isFinite(y) || !Number.isFinite(h) || h <= MIN_RECT_HEIGHT) return null;
  return { top: y, height: h };
}

export function clampRectToWidth(
  left: number,
  width: number,
  paneWidth: number,
): { left: number; width: number } | null {
  if (!Number.isFinite(left) || !Number.isFinite(width) || !Number.isFinite(paneWidth)) return null;
  if (paneWidth <= 0 || width <= MIN_RECT_HEIGHT) return null;

  let x = left;
  let w = width;
  if (x < 0) {
    w += x;
    x = 0;
  }
  if (x >= paneWidth) return null;
  if (x + w > paneWidth) {
    w = paneWidth - x;
  }
  if (!Number.isFinite(x) || !Number.isFinite(w) || w <= MIN_RECT_HEIGHT) return null;
  return { left: x, width: w };
}

export function resolveApproachTimeRange(
  approach: RoundLevelApproachSegment,
  candles: StrategyCandle[],
  barPadding = DEFAULT_EVENT_BAR_PADDING,
): { startTime: number; endTime: number } | null {
  const firstApproachIndex =
    approach.firstApproachZoneIndex != null && Number.isFinite(approach.firstApproachZoneIndex)
      ? Math.trunc(approach.firstApproachZoneIndex)
      : null;

  let startTime = approach.startTime;
  let endTime = approach.endTime;

  if (firstApproachIndex != null && candles.length > 0) {
    const fromCandle = candles[Math.max(0, Math.min(candles.length - 1, firstApproachIndex))];
    if (fromCandle && typeof fromCandle.time === "number") {
      startTime = fromCandle.time;
    }
  }

  if (
    (!Number.isFinite(startTime) || !Number.isFinite(endTime)) &&
    candles.length > 0 &&
    Number.isFinite(approach.toIndex)
  ) {
    const center = Math.max(0, Math.min(candles.length - 1, Math.trunc(approach.toIndex)));
    const fromIndex = Math.max(0, center - APPROACH_WINDOW_FALLBACK_BEFORE);
    const toIndex = Math.min(candles.length - 1, center + APPROACH_WINDOW_FALLBACK_AFTER);
    const fromCandle = candles[fromIndex];
    const toCandle = candles[toIndex];
    if (fromCandle && toCandle) {
      startTime = typeof fromCandle.time === "number" ? fromCandle.time : startTime;
      endTime = typeof toCandle.time === "number" ? toCandle.time : endTime;
    }
  } else if (
    Number.isFinite(approach.toIndex) &&
    candles.length > 0 &&
    (!Number.isFinite(endTime) || endTime < startTime)
  ) {
    const center = Math.max(0, Math.min(candles.length - 1, Math.trunc(approach.toIndex)));
    const fromIndex = Math.max(0, center - barPadding);
    const toIndex = Math.min(candles.length - 1, center + barPadding);
    const fromCandle = candles[fromIndex];
    const toCandle = candles[toIndex];
    if (fromCandle && toCandle) {
      startTime = typeof fromCandle.time === "number" ? fromCandle.time : startTime;
      endTime = typeof toCandle.time === "number" ? toCandle.time : endTime;
    }
  }

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return null;
  return { startTime, endTime };
}

function priceBandRect(
  id: string,
  levelPrice: number,
  zoneFrom: number,
  zoneTo: number,
  kind: "reaction" | "break" | "neutral" | "near_miss",
  direction: RoundLevelApproachSegment["direction"] | null,
  tier: BufferZoneVisibilityTier,
  isSelected: boolean,
  left: number,
  width: number,
  priceToY: (price: number) => number | null,
  paneWidth: number,
  paneHeight: number,
): { rect: BufferZoneRect | null; skipped: number } {
  const yA = priceToY(zoneFrom);
  const yB = priceToY(zoneTo);
  const missing = (yA == null ? 1 : 0) + (yB == null ? 1 : 0);
  if (missing > 0) return { rect: null, skipped: missing };

  const top = Math.min(yA!, yB!);
  const height = Math.abs(yB! - yA!);
  const clampedY = clampRectToPane(top, height, paneHeight);
  const clampedX = clampRectToWidth(left, width, paneWidth);
  if (!clampedY || !clampedX) return { rect: null, skipped: 0 };

  return {
    rect: {
      id,
      left: clampedX.left,
      width: clampedX.width,
      top: clampedY.top,
      height: clampedY.height,
      fill: zoneFillColor(kind, direction, tier),
      kind,
      levelPrice,
      isSelected,
      tier,
    },
    skipped: 0,
  };
}

function directionalBandRect(
  approach: RoundLevelApproachSegment,
  kind: "reaction" | "break",
  tier: BufferZoneVisibilityTier,
  isSelected: boolean,
  priceToY: (price: number) => number | null,
  timeToX: (time: number) => number | null,
  paneWidth: number,
  paneHeight: number,
  timeRange: { startTime: number; endTime: number },
  fullWidth: boolean,
): { rect: BufferZoneRect | null; skipped: number } {
  const zone = kind === "reaction" ? approach.reactionZone : approach.breakZone;
  const xA = fullWidth ? 0 : timeToX(timeRange.startTime);
  const xB = fullWidth ? paneWidth : timeToX(timeRange.endTime);
  const missing = (xA == null ? 1 : 0) + (xB == null ? 1 : 0);
  if (missing > 0) return { rect: null, skipped: missing };

  const left = fullWidth ? 0 : Math.min(xA!, xB!);
  const width = fullWidth ? paneWidth : Math.abs(xB! - xA!);

  return priceBandRect(
    `${approach.id}-${kind}${fullWidth ? "-full" : ""}`,
    approach.level,
    zone.from,
    zone.to,
    kind,
    approach.direction,
    tier,
    isSelected,
    left,
    width,
    priceToY,
    paneWidth,
    paneHeight,
  );
}

export function buildApproachBufferRects(
  approach: RoundLevelApproachSegment,
  priceToY: (price: number) => number | null,
  timeToX: (time: number) => number | null,
  paneWidth: number,
  paneHeight: number,
  options?: {
    isSelected?: boolean;
    displayMode?: BufferDisplayMode;
    tier?: BufferZoneVisibilityTier;
    candles?: StrategyCandle[];
    eventBarPadding?: number;
    fullWidth?: boolean;
  },
): {
  rects: BufferZoneRect[];
  skippedNullCoords: number;
  selectedPriceY: number | null;
  selectedUpperY: number | null;
  selectedLowerY: number | null;
} {
  const isSelected = options?.isSelected ?? false;
  const tier: BufferZoneVisibilityTier =
    options?.tier ?? (isSelected ? "selected" : "active");
  const fullWidth = options?.fullWidth ?? false;
  const candles = options?.candles ?? [];
  const eventBarPadding = options?.eventBarPadding ?? DEFAULT_EVENT_BAR_PADDING;

  let skippedNullCoords = 0;
  const rects: BufferZoneRect[] = [];

  const timeRange = resolveApproachTimeRange(approach, candles, eventBarPadding);
  if (!timeRange && !fullWidth) {
    return {
      rects,
      skippedNullCoords: 4,
      selectedPriceY: isSelected ? priceToY(approach.level) : null,
      selectedUpperY: isSelected ? priceToY(approach.breakZone.to) : null,
      selectedLowerY: isSelected ? priceToY(approach.reactionZone.from) : null,
    };
  }

  const range = timeRange ?? { startTime: 0, endTime: 0 };

  const reaction = directionalBandRect(
    approach,
    "reaction",
    tier,
    isSelected,
    priceToY,
    timeToX,
    paneWidth,
    paneHeight,
    range,
    fullWidth,
  );
  skippedNullCoords += reaction.skipped;
  if (reaction.rect) rects.push(reaction.rect);

  const breakRect = directionalBandRect(
    approach,
    "break",
    tier,
    isSelected,
    priceToY,
    timeToX,
    paneWidth,
    paneHeight,
    range,
    fullWidth,
  );
  skippedNullCoords += breakRect.skipped;
  if (breakRect.rect) rects.push(breakRect.rect);

  return {
    rects,
    skippedNullCoords,
    selectedPriceY: isSelected ? priceToY(approach.level) : null,
    selectedUpperY: isSelected ? priceToY(approach.breakZone.to) : null,
    selectedLowerY: isSelected ? priceToY(approach.reactionZone.from) : null,
  };
}

export function buildSelectedLevelBufferRects(
  zone: DirectionalBufferZone,
  priceToY: (price: number) => number | null,
  paneWidth: number,
  paneHeight: number,
): {
  rects: BufferZoneRect[];
  labels: BufferZoneLabel[];
  boundaryLines: BufferZoneBoundaryLine[];
  skippedNullCoords: number;
} {
  const rects: BufferZoneRect[] = [];
  const labels: BufferZoneLabel[] = [];
  const boundaryLines: BufferZoneBoundaryLine[] = [];
  let skippedNullCoords = 0;
  const tier: BufferZoneVisibilityTier = "selected";
  const direction =
    zone.direction === "up_to_level"
      ? ("up" as const)
      : zone.direction === "down_to_level"
        ? ("down" as const)
        : null;

  if (zone.direction === "unknown") {
    const neutralFrom = zone.reactionZone.from;
    const neutralTo = zone.breakZone.to;
    const built = priceBandRect(
      `selected-neutral-${zone.level}`,
      zone.level,
      neutralFrom,
      neutralTo,
      "neutral",
      null,
      tier,
      true,
      0,
      paneWidth,
      priceToY,
      paneWidth,
      paneHeight,
    );
    skippedNullCoords += built.skipped;
    if (built.rect) rects.push(built.rect);

    const midY = priceToY((neutralFrom + neutralTo) / 2);
    if (midY != null && Number.isFinite(midY)) {
      labels.push({
        id: `selected-neutral-label-${zone.level}`,
        x: paneWidth - SELECTED_LABEL_RIGHT_OFFSET,
        y: midY,
        text: "буфер",
      });
    }
  } else {
    for (const kind of ["reaction", "break"] as const) {
      const band = kind === "reaction" ? zone.reactionZone : zone.breakZone;
      const built = priceBandRect(
        `selected-${kind}-${zone.level}`,
        zone.level,
        band.from,
        band.to,
        kind,
        direction,
        tier,
        true,
        0,
        paneWidth,
        priceToY,
        paneWidth,
        paneHeight,
      );
      skippedNullCoords += built.skipped;
      if (built.rect) rects.push(built.rect);

      const midY = priceToY((band.from + band.to) / 2);
      if (midY != null && Number.isFinite(midY)) {
        labels.push({
          id: `selected-${kind}-label-${zone.level}`,
          x: paneWidth - SELECTED_LABEL_RIGHT_OFFSET,
          y: midY,
          text: kind === "reaction" ? "реакция" : "слом",
        });
      }

      for (const price of [band.from, band.to]) {
        const y = priceToY(price);
        if (y == null || !Number.isFinite(y)) continue;
        boundaryLines.push({
          id: `selected-${kind}-boundary-${zone.level}-${price}`,
          x1: 0,
          x2: paneWidth,
          y,
          kind,
          isSelected: true,
          tier,
        });
      }
    }

    const levelY = priceToY(zone.level);
    if (levelY != null && Number.isFinite(levelY)) {
      boundaryLines.push({
        id: `selected-level-${zone.level}`,
        x1: 0,
        x2: paneWidth,
        y: levelY,
        kind: "level",
        isSelected: true,
        tier,
      });
    }
  }

  return { rects, labels, boundaryLines, skippedNullCoords };
}

export function buildBufferZoneBoundaryLines(
  approach: RoundLevelApproachSegment,
  priceToY: (price: number) => number | null,
  timeToX: (time: number) => number | null,
  isSelected: boolean,
  tier: BufferZoneVisibilityTier,
  candles: StrategyCandle[],
  eventBarPadding: number,
  fullWidth: boolean,
  paneWidth: number,
): BufferZoneBoundaryLine[] {
  const timeRange = resolveApproachTimeRange(approach, candles, eventBarPadding);
  if (!timeRange && !fullWidth) return [];

  const x1 = fullWidth ? 0 : timeToX(timeRange!.startTime);
  const x2 = fullWidth ? paneWidth : timeToX(timeRange!.endTime);
  if (x1 == null || x2 == null) return [];

  const boundaries = [
    { price: approach.reactionZone.from, kind: "reaction" as const },
    { price: approach.reactionZone.to, kind: "reaction" as const },
    { price: approach.breakZone.from, kind: "break" as const },
    { price: approach.breakZone.to, kind: "break" as const },
    { price: approach.level, kind: "level" as const },
  ].filter(
    (boundary, index, all) =>
      all.findIndex((item) => Math.abs(item.price - boundary.price) < EPS && item.kind === boundary.kind) === index,
  );

  const lines: BufferZoneBoundaryLine[] = [];
  for (const boundary of boundaries) {
    const y = priceToY(boundary.price);
    if (y == null || !Number.isFinite(y)) continue;
    lines.push({
      id: `${approach.id}-${boundary.kind}-${boundary.price}`,
      x1: Math.min(x1, x2),
      x2: Math.max(x1, x2),
      y,
      kind: boundary.kind,
      isSelected,
      tier,
    });
  }
  return lines;
}

export function buildSelectedBufferZoneLabels(
  approach: RoundLevelApproachSegment,
  priceToY: (price: number) => number | null,
  timeToX: (time: number) => number | null,
  paneWidth: number,
  candles: StrategyCandle[],
  eventBarPadding: number,
  fullWidth: boolean,
): BufferZoneLabel[] {
  const reactionY = priceToY((approach.reactionZone.from + approach.reactionZone.to) / 2);
  const breakY = priceToY((approach.breakZone.from + approach.breakZone.to) / 2);
  const timeRange = resolveApproachTimeRange(approach, candles, eventBarPadding);
  const x = fullWidth
    ? paneWidth - SELECTED_LABEL_RIGHT_OFFSET
    : timeRange != null
      ? timeToX(timeRange.endTime)
      : null;
  const labels: BufferZoneLabel[] = [];
  if (x == null || !Number.isFinite(x)) return labels;

  if (reactionY != null && Number.isFinite(reactionY)) {
    labels.push({
      id: `${approach.id}-reaction-label`,
      x: x + 6,
      y: reactionY,
      text: "реакция",
    });
  }
  if (breakY != null && Number.isFinite(breakY)) {
    labels.push({
      id: `${approach.id}-break-label`,
      x: x + 6,
      y: breakY,
      text: "слом",
    });
  }

  return labels;
}

function isImportantLevel(importance: RoundLevelImportance): boolean {
  return importance === "major" || importance === "psychological";
}

export function buildBufferZoneOverlay(
  approaches: RoundLevelApproachSegment[],
  levels: RoundLevel[],
  highlightedPrice: number | null,
  timeToX: (time: number) => number | null,
  priceToY: (price: number) => number | null,
  paneWidth: number,
  paneHeight: number,
  options?: {
    displayMode?: BufferDisplayMode;
    focusedApproachId?: string | null;
    directionalZone?: DirectionalBufferZone | null;
    candles?: StrategyCandle[];
    eventBarPadding?: number;
    showBackgroundBuffers?: boolean;
    showNearMiss?: boolean;
    focusedEventId?: string | null;
  },
): {
  rects: BufferZoneRect[];
  boundaryLines: BufferZoneBoundaryLine[];
  labels: BufferZoneLabel[];
  diagnostics: BufferZoneOverlayDiagnostics;
} {
  const displayMode = options?.displayMode ?? "active";
  const focusedApproachId = options?.focusedApproachId ?? null;
  const directionalZone = options?.directionalZone ?? null;
  const candles = options?.candles ?? [];
  const eventBarPadding = options?.eventBarPadding ?? DEFAULT_EVENT_BAR_PADDING;
  const showBackgroundBuffers = options?.showBackgroundBuffers ?? displayMode === "important";
  const showNearMiss = options?.showNearMiss ?? true;
  const focusedEventId = options?.focusedEventId ?? null;

  if (levels.length === 0 || paneHeight <= 0 || paneWidth <= 0) {
    return {
      rects: [],
      boundaryLines: [],
      labels: [],
      diagnostics: { ...EMPTY_DIAGNOSTICS, bufferDisplayMode: displayMode },
    };
  }

  const filtered = filterApproachesForBufferDisplay(
    approaches,
    levels,
    displayMode,
    highlightedPrice,
    { showNearMiss },
  ).slice(0, 120);

  const rects: BufferZoneRect[] = [];
  const boundaryLines: BufferZoneBoundaryLine[] = [];
  const labels: BufferZoneLabel[] = [];
  let skippedNullCoords = 0;
  let zonesRendered = 0;
  let zonesSkipped = 0;
  let selectedPriceY: number | null = null;
  let selectedUpperY: number | null = null;
  let selectedLowerY: number | null = null;
  let approachDirection: "up_to_level" | "down_to_level" | "unknown" | null = null;
  let reactionZoneValues: string | null = null;
  let breakZoneValues: string | null = null;

  const selectedLevelMatch =
    highlightedPrice != null &&
    directionalZone != null &&
    Math.abs(directionalZone.level - highlightedPrice) < EPS;

  if (selectedLevelMatch && directionalZone) {
    const selectedBands = buildSelectedLevelBufferRects(directionalZone, priceToY, paneWidth, paneHeight);
    skippedNullCoords += selectedBands.skippedNullCoords;
    rects.push(...selectedBands.rects);
    boundaryLines.push(...selectedBands.boundaryLines);
    labels.push(...selectedBands.labels);
    zonesRendered += selectedBands.rects.length > 0 ? 1 : 0;
    selectedPriceY = priceToY(directionalZone.level);
    selectedUpperY = priceToY(directionalZone.breakZone.to);
    selectedLowerY = priceToY(directionalZone.reactionZone.from);
    approachDirection = directionalZone.direction;
    reactionZoneValues = formatDirectionalPriceRange(
      directionalZone.reactionZone.from,
      directionalZone.reactionZone.to,
    );
    breakZoneValues = formatDirectionalPriceRange(
      directionalZone.breakZone.from,
      directionalZone.breakZone.to,
    );
  }

  for (const approach of filtered) {
    const isSelectedLevel =
      highlightedPrice != null && Math.abs(approach.level - highlightedPrice) < EPS;
    const isFocused =
      focusedApproachId != null
        ? approach.id === focusedApproachId
        : isSelectedLevel;

    if (isSelectedLevel && selectedLevelMatch) {
      continue;
    }

    if (approach.eventKind === "near_miss") {
      const showThisNearMiss =
        showNearMiss &&
        (isSelectedLevel ||
          (focusedEventId != null && approach.id === focusedEventId) ||
          displayMode === "important");
      if (!showThisNearMiss) continue;

      const nearMiss = buildNearMissRects(
        approach,
        priceToY,
        timeToX,
        paneWidth,
        paneHeight,
        candles,
        isFocused || isSelectedLevel,
      );
      skippedNullCoords += nearMiss.skipped;
      if (nearMiss.rects.length > 0) {
        zonesRendered += 1;
        rects.push(...nearMiss.rects);
        labels.push(...nearMiss.labels);
      } else {
        zonesSkipped += 1;
      }
      continue;
    }

    const tier: BufferZoneVisibilityTier = isFocused ? "selected" : "active";
    const built = buildApproachBufferRects(approach, priceToY, timeToX, paneWidth, paneHeight, {
      isSelected: isFocused,
      displayMode,
      tier,
      candles,
      eventBarPadding,
      fullWidth: isFocused && isSelectedLevel,
    });
    skippedNullCoords += built.skippedNullCoords;

    if (built.rects.length === 0) {
      zonesSkipped += 1;
      continue;
    }

    zonesRendered += 1;
    rects.push(...built.rects);

    if (isFocused) {
      selectedPriceY = built.selectedPriceY;
      selectedUpperY = built.selectedUpperY;
      selectedLowerY = built.selectedLowerY;
      approachDirection = approachDirectionLabel(approach.direction);
      reactionZoneValues = formatDirectionalPriceRange(approach.reactionZone.from, approach.reactionZone.to);
      breakZoneValues = formatDirectionalPriceRange(approach.breakZone.from, approach.breakZone.to);
      boundaryLines.push(
        ...buildBufferZoneBoundaryLines(
          approach,
          priceToY,
          timeToX,
          true,
          tier,
          candles,
          eventBarPadding,
          isSelectedLevel,
          paneWidth,
        ),
      );
      labels.push(
        ...buildSelectedBufferZoneLabels(
          approach,
          priceToY,
          timeToX,
          paneWidth,
          candles,
          eventBarPadding,
          isSelectedLevel,
        ),
      );
    } else if (displayMode === "active" || displayMode === "important" || displayMode === "all") {
      boundaryLines.push(
        ...buildBufferZoneBoundaryLines(
          approach,
          priceToY,
          timeToX,
          false,
          tier,
          candles,
          eventBarPadding,
          false,
          paneWidth,
        ),
      );
    }
  }

  if (showBackgroundBuffers && displayMode !== "selected") {
    const approachLevels = new Set(filtered.map((segment) => segment.level));
    for (const level of levels) {
      if (!isImportantLevel(level.importance)) continue;
      if (highlightedPrice != null && Math.abs(level.price - highlightedPrice) < EPS) continue;
      if (approachLevels.has(level.price)) continue;

      const buffer = resolveLevelBufferSize(level);
      if (buffer <= 0) continue;

      const neutralFrom = level.price - buffer;
      const neutralTo = level.price + buffer;
      const built = priceBandRect(
        `background-${level.price}`,
        level.price,
        neutralFrom,
        neutralTo,
        "neutral",
        null,
        "background",
        false,
        0,
        paneWidth,
        priceToY,
        paneWidth,
        paneHeight,
      );
      skippedNullCoords += built.skipped;
      if (built.rect) rects.push(built.rect);
    }
  }

  return {
    rects,
    boundaryLines,
    labels,
    diagnostics: {
      bufferZoneCount: zonesRendered,
      skippedNullCoords,
      rectCount: rects.length,
      selectedPriceY,
      selectedUpperY,
      selectedLowerY,
      bufferDisplayMode: displayMode,
      zonesRendered,
      zonesSkipped,
      approachDirection,
      reactionZoneValues,
      breakZoneValues,
    },
  };
}

export function resolveLevelBufferSize(level: RoundLevel): number {
  const upper = level.upperBuffer.to - level.price;
  const lower = level.price - level.lowerBuffer.from;
  if (Number.isFinite(upper) && upper > 0) return upper;
  if (Number.isFinite(lower) && lower > 0) return lower;
  return 0;
}
