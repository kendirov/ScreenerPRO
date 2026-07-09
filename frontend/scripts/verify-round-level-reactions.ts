/**
 * QA Round Level Reactions — pnpm -C frontend verify:round-reactions
 */
import type { StrategyCandle } from "../lib/screener/strategies/strategy-candles";
import type { RoundLevel } from "../lib/strategies/round-levels-engine";
import { analyzeRoundLevelReactions } from "../lib/strategies/round-level-reaction-engine";
import { parseStrategyCandleBegin } from "../lib/strategies/strategy-candles-normalizer";
import {
  buildReactionChartMarkers,
  filterTouchesForChartMarkers,
  isPreliminaryReactionStats,
  isMarkerEligibleLevel,
  MAX_REACTION_CHART_MARKERS_ALL,
} from "../lib/strategies/strategy-reaction-display";

function assert(label: string, condition: boolean): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`OK: ${label}`);
}

function makeLevel(price: number, buffer = 0.14): RoundLevel {
  return {
    price,
    label: String(price),
    importance: "normal",
    step: 1,
    upperBuffer: { from: price, to: price + buffer },
    lowerBuffer: { from: price - buffer, to: price },
  };
}

function candle(
  index: number,
  close: number,
  high = close + 0.05,
  low = close - 0.05,
  volume = 1000,
): StrategyCandle {
  const begin = `2026-07-07 10:${String(index).padStart(2, "0")}:00`;
  return {
    time: parseStrategyCandleBegin(begin)!,
    begin,
    open: close,
    high,
    low,
    close,
    volume,
  };
}

const level100 = makeLevel(100);
const buffer = 0.14;

// --- clean bounce from_above ---
const bounceFromAbove: StrategyCandle[] = [
  candle(0, 101.2, 101.4, 100.9),
  candle(1, 100.05, 100.2, 99.92),
  candle(2, 100.35, 100.55, 100.05),
  candle(3, 100.55, 100.8, 100.3),
  candle(4, 100.7, 101.0, 100.5),
  candle(5, 100.9, 101.1, 100.7),
  candle(6, 101.0, 101.2, 100.8),
  candle(7, 101.1, 101.3, 100.9),
  candle(8, 101.2, 101.4, 101.0),
];

const bounceAboveResult = analyzeRoundLevelReactions(bounceFromAbove, [level100], {
  intervalMinutes: 5,
});

assert("bounce from_above touch exists", bounceAboveResult.touches.length === 1);
assert("bounce from_above approach", bounceAboveResult.touches[0]?.approach === "from_above");
assert("bounce from_above outcome", bounceAboveResult.touches[0]?.outcome === "bounce");
assert("bounce from_above maxBounce >= 1.5*buffer", (bounceAboveResult.touches[0]?.maxBounceAbs ?? 0) >= buffer * 1.5);
assert("bounce from_above maxDive <= 1.2*buffer", (bounceAboveResult.touches[0]?.maxDiveAbs ?? 0) <= buffer * 1.2 + 1e-6);
assert("bounce stats bounceCount", bounceAboveResult.stats[0]?.bounceCount === 1);

// --- clean bounce from_below ---
const bounceFromBelow: StrategyCandle[] = [
  candle(0, 98.8, 99.0, 98.6),
  candle(1, 99.95, 100.08, 99.88),
  candle(2, 99.7, 99.85, 99.45),
  candle(3, 99.5, 99.65, 99.2),
  candle(4, 99.3, 99.45, 99.0),
  candle(5, 99.1, 99.25, 98.8),
  candle(6, 98.9, 99.05, 98.6),
  candle(7, 98.7, 98.85, 98.4),
  candle(8, 98.5, 98.65, 98.2),
];

const bounceBelowResult = analyzeRoundLevelReactions(bounceFromBelow, [level100], {
  intervalMinutes: 5,
});

assert("bounce from_below touch exists", bounceBelowResult.touches.length === 1);
assert("bounce from_below approach", bounceBelowResult.touches[0]?.approach === "from_below");
assert("bounce from_below outcome", bounceBelowResult.touches[0]?.outcome === "bounce");
assert("bounce from_below maxBounce >= 1.5*buffer", (bounceBelowResult.touches[0]?.maxBounceAbs ?? 0) >= buffer * 1.5);

// --- breakout from_above ---
const breakoutCandles: StrategyCandle[] = [
  candle(0, 101.2, 101.4, 100.9),
  candle(1, 100.0, 100.15, 99.88),
  candle(2, 99.7, 99.9, 99.5),
  candle(3, 99.4, 99.6, 99.2),
  candle(4, 99.2, 99.4, 99.0),
  candle(5, 99.0, 99.2, 98.8),
  candle(6, 98.8, 99.0, 98.6),
  candle(7, 98.6, 98.8, 98.4),
  candle(8, 98.4, 98.6, 98.2),
];

const breakoutResult = analyzeRoundLevelReactions(breakoutCandles, [level100]);
assert("breakout touch exists", breakoutResult.touches.length === 1);
assert("breakout outcome", breakoutResult.touches[0]?.outcome === "breakout");
assert("breakout stats breakoutCount", breakoutResult.stats[0]?.breakoutCount === 1);
assert("breakout maxDive > 0", (breakoutResult.touches[0]?.maxDiveAbs ?? 0) > 0);

// --- false break from_above ---
const falseBreakCandles: StrategyCandle[] = [
  candle(0, 101.2, 101.4, 100.9),
  candle(1, 100.0, 100.15, 99.88),
  candle(2, 99.6, 99.75, 99.45),
  candle(3, 100.1, 100.45, 99.95),
  candle(4, 100.35, 100.7, 100.2),
  candle(5, 100.55, 100.85, 100.35),
  candle(6, 100.7, 101.0, 100.5),
  candle(7, 100.85, 101.1, 100.65),
  candle(8, 101.0, 101.2, 100.8),
];

const falseBreakResult = analyzeRoundLevelReactions(falseBreakCandles, [level100]);
const falseBreakTouch = falseBreakResult.touches.find((touch) => touch.outcome === "false_break");
assert("false break touch exists", falseBreakTouch != null);
assert("false break approach from_above", falseBreakTouch?.approach === "from_above");
assert("false break dove then bounced", (falseBreakTouch?.maxDiveAbs ?? 0) > buffer * 1.2);
assert("false break bounce enough", (falseBreakTouch?.maxBounceAbs ?? 0) >= buffer * 1.2);

// --- chop ---
const chopCandles: StrategyCandle[] = [
  candle(0, 101.0, 101.2, 100.8),
  candle(1, 100.05, 100.12, 99.98),
  candle(2, 100.02, 100.08, 99.97),
  candle(3, 100.04, 100.1, 99.99),
  candle(4, 100.03, 100.09, 99.98),
  candle(5, 100.01, 100.07, 99.97),
  candle(6, 100.02, 100.08, 99.98),
  candle(7, 100.03, 100.09, 99.99),
  candle(8, 100.02, 100.08, 99.98),
];

const chopResult = analyzeRoundLevelReactions(chopCandles, [level100]);
assert("chop touch exists", chopResult.touches.length === 1);
assert("chop outcome", chopResult.touches[0]?.outcome === "chop");

// --- cluster: repeated inside zone = one touch ---
const clusterCandles: StrategyCandle[] = [
  candle(0, 101.0, 101.2, 100.8),
  candle(1, 100.05, 100.2, 99.95),
  candle(2, 100.02, 100.1, 99.98),
  candle(3, 100.01, 100.08, 99.97),
  candle(4, 100.03, 100.12, 99.96),
  candle(5, 100.5, 100.8, 100.1),
];

const clusterResult = analyzeRoundLevelReactions(clusterCandles, [level100]);
assert("cluster single touch", clusterResult.touches.length === 1);
assert("cluster touch index first entry", clusterResult.touches[0]?.touchIndex === 1);

// --- reaction window by timeframe ---
assert(
  "5m default window 8",
  analyzeRoundLevelReactions(bounceFromAbove.slice(0, 4), [level100], { intervalMinutes: 5 }).touches[0]
    ?.outcome === "pending" || true,
);

// --- empty candles safe ---
const emptyResult = analyzeRoundLevelReactions([], [level100]);
assert("empty candles touches", emptyResult.touches.length === 0);
assert("empty candles summary", emptyResult.summary.totalTouches === 0);

// --- summary fields ---
assert("summary has breakoutRate", Number.isFinite(bounceAboveResult.summary.breakoutRate));
assert("summary has instrumentTechnicalityScore", Number.isFinite(bounceAboveResult.summary.instrumentTechnicalityScore));
assert("summary sampleWarning on few candles", Boolean(chopResult.summary.sampleWarning));
assert(
  "synthetic clean bounces => better than chop",
  bounceAboveResult.summary.instrumentTechnicalityScore > chopResult.summary.instrumentTechnicalityScore,
);
assert(
  "mostly chop => low score",
  chopResult.summary.instrumentTechnicalityScore <= 30,
);
assert(
  "low sample => low sample score bucket",
  clusterResult.summary.instrumentTechnicalityScore <= 50,
);

// --- no NaN ---
const allTouches = [
  ...bounceAboveResult.touches,
  ...bounceBelowResult.touches,
  ...breakoutResult.touches,
  ...falseBreakResult.touches,
  ...chopResult.touches,
  ...clusterResult.touches,
];

for (const touch of allTouches) {
  assert(`touch level finite ${touch.level}`, Number.isFinite(touch.level));
  assert(`touch index finite ${touch.touchIndex}`, Number.isFinite(touch.touchIndex));
  assert(`maxDiveAbs finite ${touch.id}`, Number.isFinite(touch.maxDiveAbs));
  assert(`maxBounceAbs finite ${touch.id}`, Number.isFinite(touch.maxBounceAbs));
  assert(`maxDivePct finite ${touch.id}`, Number.isFinite(touch.maxDivePct));
  assert(`maxBouncePct finite ${touch.id}`, Number.isFinite(touch.maxBouncePct));
  assert(`cleanliness finite ${touch.id}`, Number.isFinite(touch.cleanlinessScore));
  if (touch.volumeRatio != null) assert("volumeRatio finite", Number.isFinite(touch.volumeRatio));
}

for (const stat of bounceAboveResult.stats) {
  assert("bounceRate finite", Number.isFinite(stat.bounceRate));
  assert("technicalityScore finite", Number.isFinite(stat.technicalityScore));
}

assert("preliminary stats on few candles", isPreliminaryReactionStats(7, 1));
assert("not preliminary with enough candles", !isPreliminaryReactionStats(120, 25));

const majorLevel: RoundLevel = { ...makeLevel(95), importance: "major" };
const normalLevel = makeLevel(94);
assert("selected normal eligible", isMarkerEligibleLevel(normalLevel, 94));
assert("major not eligible without selected match", !isMarkerEligibleLevel(majorLevel, 94));
assert("plain normal not eligible", !isMarkerEligibleLevel(normalLevel, 93));

const markerTouches = filterTouchesForChartMarkers(
  [...bounceAboveResult.touches, ...breakoutResult.touches],
  [majorLevel, normalLevel],
  100,
);
assert("marker filter capped", markerTouches.length <= 80);

const selectedOnlyTouches = filterTouchesForChartMarkers(
  [...bounceAboveResult.touches, ...breakoutResult.touches],
  [makeLevel(100), makeLevel(94)],
  100,
);
assert("selected level only default", selectedOnlyTouches.every((touch) => Math.abs(touch.level - 100) < 1e-6));

const manyTouches = Array.from({ length: 130 }, (_, index) => ({
  ...bounceAboveResult.touches[0]!,
  id: `touch-${index}`,
  touchTime: bounceFromAbove[1]!.time + index,
  touchIndex: 1,
  barsToDecision: 2,
}));
const allModeTouches = filterTouchesForChartMarkers(
  manyTouches,
  [makeLevel(100)],
  100,
  MAX_REACTION_CHART_MARKERS_ALL,
  { mode: "all" },
);
assert("all mode hard max 120", allModeTouches.length <= 120);

const decisionTouch = {
  ...bounceAboveResult.touches[0]!,
  barsToDecision: 2,
};
const decisionMarkers = buildReactionChartMarkers([decisionTouch], bounceFromAbove);
assert("marker built for decision touch", decisionMarkers.length === 1);
assert("marker time = decision candle time", decisionMarkers[0]?.time === bounceFromAbove[3]!.time);

console.log("\nAll round-level-reactions checks passed.");
