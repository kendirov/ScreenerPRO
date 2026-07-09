/**
 * QA Round Level Approaches — pnpm -C frontend verify:round-approaches
 */
import {
  computeRoundLevelApproaches,
  type RoundLevelApproachSegment,
} from "../lib/strategies/round-level-approach-engine";
import type { StrategyCandle } from "../lib/screener/strategies/strategy-candles";
import type { ZigZagSegment } from "../lib/strategies/zigzag-lite-engine";

function assert(label: string, condition: boolean): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`OK: ${label}`);
}

function makeCandle(time: number, open: number, high: number, low: number, close: number): StrategyCandle {
  return { time, open, high, low, close };
}

function assertNoNaN(segment: RoundLevelApproachSegment, label: string): void {
  const values = [
    segment.level,
    segment.fromIndex,
    segment.toIndex,
    segment.startTime,
    segment.endTime,
    segment.startPrice,
    segment.endPrice,
    segment.reactionZone.from,
    segment.reactionZone.to,
    segment.breakZone.from,
    segment.breakZone.to,
  ];
  assert(`${label} no NaN`, values.every(Number.isFinite));
}

// up segment from 94.2 to 95.1 creates target level 95
{
  const candles = [
    makeCandle(1, 94.2, 94.3, 94.1, 94.2),
    makeCandle(2, 94.2, 94.8, 94.2, 94.7),
    makeCandle(3, 94.7, 95.1, 94.7, 95.05),
  ];
  const zigzagSegments: ZigZagSegment[] = [
    {
      from: { type: "low", candleIndex: 0, time: 1, price: 94.2, confirmedAtIndex: 0 },
      to: { type: "high", candleIndex: 2, time: 3, price: 95.1, confirmedAtIndex: 2 },
      direction: "up",
      changePct: 0.95,
      bars: 2,
    },
  ];
  const result = computeRoundLevelApproaches({ candles, levels: [94, 95, 96], buffer: 0.1, zigzagSegments });
  assert("up segment creates one approach", result.length === 1);
  assert("up segment target level 95", result[0]?.level === 95);
  assert("up segment direction up", result[0]?.direction === "up");
}

// down segment from 94.8 to 93.9 creates target level 94
{
  const candles = [
    makeCandle(1, 94.8, 94.9, 94.7, 94.8),
    makeCandle(2, 94.8, 94.8, 94.2, 94.3),
    makeCandle(3, 94.3, 94.3, 93.8, 93.9),
  ];
  const zigzagSegments: ZigZagSegment[] = [
    {
      from: { type: "high", candleIndex: 0, time: 1, price: 94.8, confirmedAtIndex: 0 },
      to: { type: "low", candleIndex: 2, time: 3, price: 93.9, confirmedAtIndex: 2 },
      direction: "down",
      changePct: -0.95,
      bars: 2,
    },
  ];
  const result = computeRoundLevelApproaches({ candles, levels: [93, 94, 95], buffer: 0.1, zigzagSegments });
  assert("down segment creates one approach", result.length === 1);
  assert("down segment target level 94", result[0]?.level === 94);
  assert("down segment direction down", result[0]?.direction === "down");
}

// up crossing 94 and 95 creates two approach segments
{
  const candles = [
    makeCandle(1, 93.7, 93.8, 93.6, 93.7),
    makeCandle(2, 93.7, 94.4, 93.7, 94.3),
    makeCandle(3, 94.3, 95.2, 94.2, 95.1),
  ];
  const zigzagSegments: ZigZagSegment[] = [
    {
      from: { type: "low", candleIndex: 0, time: 1, price: 93.7, confirmedAtIndex: 0 },
      to: { type: "high", candleIndex: 2, time: 3, price: 95.2, confirmedAtIndex: 2 },
      direction: "up",
      changePct: 1.6,
      bars: 2,
    },
  ];
  const result = computeRoundLevelApproaches({ candles, levels: [94, 95, 96], buffer: 0.1, zigzagSegments });
  assert("crossing creates two segments", result.length === 2);
  assert("crossing levels 94 then 95", result[0]?.level === 94 && result[1]?.level === 95);
}

// reaction/break zones correct
{
  const candles = [
    makeCandle(1, 94.2, 94.3, 94.1, 94.2),
    makeCandle(2, 94.2, 95.1, 94.2, 95.0),
  ];
  const zigzagSegments: ZigZagSegment[] = [
    {
      from: { type: "low", candleIndex: 0, time: 1, price: 94.2, confirmedAtIndex: 0 },
      to: { type: "high", candleIndex: 1, time: 2, price: 95.1, confirmedAtIndex: 1 },
      direction: "up",
      changePct: 1,
      bars: 1,
    },
  ];
  const result = computeRoundLevelApproaches({ candles, levels: [95], buffer: 0.1, zigzagSegments });
  assert("reaction zone up correct", result[0]?.reactionZone.from === 94.9 && result[0]?.reactionZone.to === 95);
  assert("break zone up correct", result[0]?.breakZone.from === 95 && result[0]?.breakZone.to === 95.1);
}

// no NaN + sorted by time
{
  const candles = [
    makeCandle(10, 93.7, 93.8, 93.6, 93.7),
    makeCandle(20, 93.7, 94.4, 93.7, 94.3),
    makeCandle(30, 94.3, 95.2, 94.2, 95.1),
  ];
  const zigzagSegments: ZigZagSegment[] = [
    {
      from: { type: "low", candleIndex: 0, time: 10, price: 93.7, confirmedAtIndex: 0 },
      to: { type: "high", candleIndex: 2, time: 30, price: 95.2, confirmedAtIndex: 2 },
      direction: "up",
      changePct: 1.6,
      bars: 2,
    },
  ];
  const result = computeRoundLevelApproaches({ candles, levels: [94, 95], buffer: 0.1, zigzagSegments });
  result.forEach((segment, index) => assertNoNaN(segment, `segment ${index}`));
  assert(
    "sorted by time",
    result.every((segment, index) => index === 0 || result[index - 1]!.startTime <= segment.startTime),
  );
}

console.log("\nverify:round-approaches — all checks passed");

