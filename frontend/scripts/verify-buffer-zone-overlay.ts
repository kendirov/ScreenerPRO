/**
 * QA Buffer Zone Overlay helpers — pnpm -C frontend verify:buffer-zones
 */
import type { RoundLevelApproachSegment } from "../lib/strategies/round-level-approach-engine";
import type { RoundLevel } from "../lib/strategies/round-levels-engine";
import {
  buildApproachBufferRects,
  buildBufferZoneOverlay,
  buildNearMissRects,
  clampRectToPane,
  filterApproachesForBufferDisplay,
  SELECTED_LABEL_RIGHT_OFFSET,
} from "../lib/strategies/strategy-buffer-zone-overlay";

function assert(label: string, condition: boolean): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`OK: ${label}`);
}

function makeLevel(price: number, importance: RoundLevel["importance"] = "major"): RoundLevel {
  const buffer = 0.14;
  return {
    price,
    label: String(price),
    importance,
    step: 1,
    upperBuffer: { from: price, to: price + buffer },
    lowerBuffer: { from: price - buffer, to: price },
  };
}

function makeApproach(
  level: number,
  direction: "up" | "down",
  startTime: number,
  endTime: number,
): RoundLevelApproachSegment {
  return {
    id: `${level}-${direction}-${startTime}`,
    level,
    direction,
    fromIndex: 0,
    toIndex: 1,
    startTime,
    endTime,
    startPrice: direction === "up" ? level - 0.5 : level + 0.5,
    endPrice: level,
    reactionZone:
      direction === "up" ? { from: level - 0.14, to: level } : { from: level, to: level + 0.14 },
    breakZone:
      direction === "up" ? { from: level, to: level + 0.14 } : { from: level - 0.14, to: level },
    outcome: "pending",
  };
}

const approaches = [
  makeApproach(93, "up", 10, 30),
  makeApproach(94, "up", 40, 60),
  makeApproach(95, "down", 70, 90),
];

const selected = filterApproachesForBufferDisplay(
  approaches,
  [makeLevel(93), makeLevel(94), makeLevel(95)],
  "selected",
  94,
);
assert("selected keeps one level", selected.length === 1);
assert("selected keeps highlighted approach", selected[0]?.level === 94);

const important = filterApproachesForBufferDisplay(
  approaches,
  [makeLevel(93, "normal"), makeLevel(94, "normal"), makeLevel(95, "major")],
  "important",
  null,
);
assert("important keeps major only", important.length === 1);

const all = filterApproachesForBufferDisplay(
  approaches,
  [makeLevel(93, "normal"), makeLevel(94, "normal"), makeLevel(95, "major")],
  "all",
  null,
);
assert("all mode keeps non-minor approaches", all.length === 3);

const clamped = clampRectToPane(10, 40, 500);
assert("clamp finite", clamped != null && Number.isFinite(clamped.top) && Number.isFinite(clamped.height));
assert("clamp top >= 0", clamped != null && clamped.top >= 0);
assert("clamp within pane", clamped != null && clamped.top + clamped.height <= 500);
assert("null coords safe", clampRectToPane(NaN, 10, 500) === null);
assert("oversized band rejected", clampRectToPane(0, 400, 500) === null);

const priceToY = (price: number) => 500 - price * 4;
const timeToX = (time: number) => time * 2;

const rects = buildApproachBufferRects(makeApproach(94, "up", 40, 60), priceToY, timeToX, 500, 500, {
  isSelected: true,
  displayMode: "selected",
});
assert("rect builder returns two rects", rects.rects.length === 2);
assert(
  "rect builder finite coords",
  rects.rects.every((rect) => Number.isFinite(rect.left) && Number.isFinite(rect.width)),
);

const overlay = buildBufferZoneOverlay(
  approaches,
  [makeLevel(94, "normal"), makeLevel(95, "major"), makeLevel(93, "normal")],
  94,
  timeToX,
  priceToY,
  500,
  500,
  { displayMode: "selected" },
);
assert("overlay zone count", overlay.diagnostics.bufferZoneCount === 1);
assert("overlay skipped null", overlay.diagnostics.skippedNullCoords === 0);
assert(
  "overlay rects finite",
  overlay.rects.every(
    (rect) =>
      Number.isFinite(rect.left) &&
      Number.isFinite(rect.width) &&
      Number.isFinite(rect.top) &&
      Number.isFinite(rect.height),
  ),
);
assert(
  "overlay selected coords finite",
  overlay.diagnostics.selectedPriceY != null &&
    overlay.diagnostics.selectedUpperY != null &&
    overlay.diagnostics.selectedLowerY != null,
);
assert("overlay has selected labels", overlay.labels.length === 2);
assert("selected labels near right edge", overlay.labels.every((label) => label.x >= 500 - SELECTED_LABEL_RIGHT_OFFSET - 1));
assert("overlay diagnostics mode", overlay.diagnostics.bufferDisplayMode === "selected");

const nearMissApproach = {
  ...makeApproach(94, "up", 40, 60),
  id: "level_94_near_2240",
  eventKind: "near_miss" as const,
  approachZone: { from: 93.72, to: 94.28 },
  enteredHardBuffer: false,
  enteredApproachZone: true,
  distanceToLevel: 0.26,
  firstApproachZoneIndex: 0,
};

const nearMissRects = buildNearMissRects(
  nearMissApproach,
  priceToY,
  timeToX,
  500,
  500,
  [{ time: 40, open: 93.5, high: 93.8, low: 93.74, close: 93.76, volume: 1000 }],
  true,
);
assert("near miss renders at least one rect", nearMissRects.rects.length >= 1);
assert("near miss rect kind", nearMissRects.rects[0]?.kind === "near_miss");

const nearMissFiltered = filterApproachesForBufferDisplay(
  [nearMissApproach, makeApproach(95, "down", 70, 90)],
  [makeLevel(94), makeLevel(95)],
  "active",
  94,
  { showNearMiss: true },
);
assert("active mode keeps near miss for selected level", nearMissFiltered.some((item) => item.eventKind === "near_miss"));

const allOverlay = buildBufferZoneOverlay(
  approaches,
  [makeLevel(94, "normal"), makeLevel(95, "major"), makeLevel(93, "normal")],
  94,
  timeToX,
  priceToY,
  500,
  500,
  { displayMode: "all" },
);
assert("all mode renders multiple zones", allOverlay.diagnostics.zonesRendered >= 2);

const nullOverlay = buildBufferZoneOverlay(
  [makeApproach(95, "down", 70, 90)],
  [makeLevel(95, "major")],
  null,
  () => null,
  () => null,
  500,
  500,
  { displayMode: "important" },
);
assert("null coordinate skipped", nullOverlay.diagnostics.skippedNullCoords > 0);
assert("null coordinate no rects", nullOverlay.rects.length === 0);

console.log("\nverify:buffer-zones — all checks passed");
