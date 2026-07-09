/**
 * QA ZigZag-lite Engine — pnpm -C frontend verify:zigzag-lite
 */
import { createSyntheticCandles } from "../lib/strategies/strategy-chart-test-data";
import type { StrategyCandle } from "../lib/screener/strategies/strategy-candles";
import {
  buildZigZagSegments,
  computeZigZagLite,
  filterZigZagPivots,
  inferZigZagMovementDirection,
  nearestRoundLevelDistance,
  type ZigZagPivot,
} from "../lib/strategies/zigzag-lite-engine";
import { buildZigZagChartMarkers } from "../lib/strategies/strategy-zigzag-display";

function assert(label: string, condition: boolean): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`OK: ${label}`);
}

function assertNoNaNPivots(label: string, pivots: ZigZagPivot[]): void {
  for (const pivot of pivots) {
    assert(`${label} price finite`, Number.isFinite(pivot.price));
    assert(
      `${label} time valid`,
      (typeof pivot.time === "number" && Number.isFinite(pivot.time)) ||
        (typeof pivot.time === "string" && pivot.time.length > 0),
    );
    assert(`${label} candleIndex finite`, Number.isFinite(pivot.candleIndex));
    assert(`${label} confirmedAtIndex finite`, Number.isFinite(pivot.confirmedAtIndex));
  }
}

function createClearSwingSeries(): StrategyCandle[] {
  const closes = [100, 98, 96, 94, 96, 99, 102, 100, 97, 95, 98, 101, 103, 100, 97];
  const candles: StrategyCandle[] = [];
  let time = 1_700_000_000;

  for (let index = 0; index < closes.length; index += 1) {
    const close = closes[index]!;
    const open = index === 0 ? close : closes[index - 1]!;
    const high = Math.max(open, close) + 0.4;
    const low = Math.min(open, close) - 0.4;
    candles.push({
      time: time + index * 300,
      open,
      high,
      low,
      close,
      volume: 10_000,
    });
  }

  return candles;
}

function createNoisyFlatSeries(): StrategyCandle[] {
  const candles: StrategyCandle[] = [];
  let time = 1_700_100_000;

  for (let index = 0; index < 30; index += 1) {
    const base = 93 + Math.sin(index / 2) * 0.02;
    candles.push({
      time: time + index * 300,
      open: base,
      high: base + 0.03,
      low: base - 0.03,
      close: base + (index % 2 === 0 ? 0.01 : -0.01),
      volume: 5_000,
    });
  }

  return candles;
}

function assertSegmentsSorted(label: string, result: ReturnType<typeof computeZigZagLite>): void {
  for (let index = 1; index < result.segments.length; index += 1) {
    const prev = result.segments[index - 1]!;
    const next = result.segments[index]!;
    assert(`${label} segments sorted`, next.from.candleIndex >= prev.from.candleIndex);
  }
}

// --- clean up/down alternating pivots ---
const swingCandles = createClearSwingSeries();
const swingResult = computeZigZagLite(swingCandles, {
  left: 3,
  right: 3,
  minMovePct: 0.15,
  minMoveAbs: 0.5,
});

assert("swing series has pivots", swingResult.pivots.length >= 3);
assertNoNaNPivots("swing", swingResult.pivots);

for (let index = 1; index < swingResult.pivots.length; index += 1) {
  const prev = swingResult.pivots[index - 1]!;
  const next = swingResult.pivots[index]!;
  assert("pivots sorted by index", next.candleIndex >= prev.candleIndex);
  assert("pivots alternate type", prev.type !== next.type);
}

assert("swing has segments", swingResult.segments.length === swingResult.pivots.length - 1);
assertSegmentsSorted("swing", swingResult);
for (const segment of swingResult.segments) {
  assert("segment changePct finite", Number.isFinite(segment.changePct));
  assert("segment bars >= 0", segment.bars >= 0);
}

// --- noise filtered in important mode ---
const noisy = createNoisyFlatSeries();
const noisyResult = computeZigZagLite(noisy, {
  left: 5,
  right: 5,
  minMovePct: 0.35,
  minMoveAbs: 0.2,
  minBarsBetweenPivots: 4,
});
assert("noisy flat filtered", noisyResult.pivots.length <= 4);

// --- all mode returns more pivots than important ---
const modeCandles = createClearSwingSeries();
const importantMode = computeZigZagLite(modeCandles, {
  left: 5,
  right: 5,
  minMovePct: 0.35,
  minMoveAbs: 1,
  minBarsBetweenPivots: 4,
});
const allMode = computeZigZagLite(modeCandles, {
  left: 3,
  right: 3,
  minMovePct: 0.15,
  minMoveAbs: 0.5,
});
assert("all mode has >= pivots than important", allMode.pivots.length >= importantMode.pivots.length);
assert("all mode has >= segments than important", allMode.segments.length >= importantMode.segments.length);
assertSegmentsSorted("important", importantMode);
assertSegmentsSorted("all", allMode);

// --- direction ---
const upPivot = swingResult.pivots.find((pivot) => pivot.type === "low");
if (upPivot) {
  assert("low + price above → up", inferZigZagMovementDirection(upPivot, upPivot.price + 1) === "up");
}
const downPivot = swingResult.pivots.find((pivot) => pivot.type === "high");
if (downPivot) {
  assert("high + price below → down", inferZigZagMovementDirection(downPivot, downPivot.price - 1) === "down");
}

assert("unknown without pivot", inferZigZagMovementDirection(null, 100) === "unknown");

// --- nearest level ---
const nearest = nearestRoundLevelDistance(93.2, [90, 91, 92, 93, 94, 95]);
assert("nearest level found", nearest != null && nearest.level === 93);
assert("nearest distance finite", nearest != null && Number.isFinite(nearest.distance));

// --- markers ---
const markers = buildZigZagChartMarkers(swingResult.pivots, swingResult.segments, swingCandles);
assert("markers built", markers.length > 0);
assert("markers capped", markers.length <= 60);
for (const marker of markers) {
  assert(
    "marker time valid",
    (typeof marker.time === "number" && Number.isFinite(marker.time)) ||
      (typeof marker.time === "string" && marker.time.length > 0),
  );
  assert("marker text non-empty", marker.text.length > 0);
}

// --- GAZP-like synthetic ---
const gazpCandles = createSyntheticCandles(80);
const gazpResult = computeZigZagLite(gazpCandles, { left: 5, right: 5, minMovePct: 0.35, minMoveAbs: 0.28, minBarsBetweenPivots: 4 });
assertNoNaNPivots("GAZP-like", gazpResult.pivots);
console.log(`INFO: GAZP-like pivots=${gazpResult.pivots.length} segments=${gazpResult.segments.length} direction=${gazpResult.movementDirection}`);
if (gazpResult.lastSegment) {
  console.log(`INFO: GAZP-like last segment direction=${gazpResult.lastSegment.direction} changePct=${gazpResult.lastSegment.changePct.toFixed(2)}%`);
}
const gazpMarkers = buildZigZagChartMarkers(gazpResult.pivots, gazpResult.segments, gazpCandles);
console.log(`INFO: GAZP-like zigzag markers=${gazpMarkers.length}`);

// --- filter helper ---
const candidates = swingResult.pivots.map((pivot) => ({
  type: pivot.type,
  candleIndex: pivot.candleIndex,
  time: pivot.time,
  price: pivot.price,
  confirmedAtIndex: pivot.confirmedAtIndex,
}));
const refiltered = filterZigZagPivots(candidates, 0.3, 0.5);
assert("filter preserves pivots", refiltered.length === swingResult.pivots.length);

const emptySegments = buildZigZagSegments([]);
assert("empty segments", emptySegments.length === 0);

console.log("\nAll zigzag-lite checks passed.");
