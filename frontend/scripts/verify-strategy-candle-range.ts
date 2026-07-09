/**
 * QA Strategy Candle Range — pnpm -C frontend verify:strategy-candle-range
 */
import { normalizeStrategyCandles } from "../lib/strategies/strategy-candles-normalizer";
import {
  capStrategyCandles,
  hashStrategyCandles,
  moscowDateKey,
  resolveStrategyCandleDateRange,
  resolveStrategyCandleDateRangeFromParams,
  STRATEGY_MAX_CANDLES,
  type StrategyCandlePeriodId,
} from "../lib/screener/strategies/strategy-candle-range";

function assert(label: string, condition: boolean): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`OK: ${label}`);
}

const fixedNow = new Date("2026-07-08T12:00:00+03:00");

function expectRange(periodId: StrategyCandlePeriodId, from: string, till: string, days: number) {
  const range = resolveStrategyCandleDateRange({ periodId, now: fixedNow });
  assert(`${periodId} till is Moscow today`, range.till === moscowDateKey(fixedNow));
  assert(`${periodId} from=${from}`, range.from === from);
  assert(`${periodId} till=${till}`, range.till === till);
  assert(`${periodId} calendarDays=${days}`, range.calendarDays === days);
}

expectRange("today", "2026-07-08", "2026-07-08", 1);
expectRange("3d", "2026-07-06", "2026-07-08", 3);
expectRange("10d", "2026-06-29", "2026-07-08", 10);
expectRange("20d", "2026-06-19", "2026-07-08", 20);

const explicitRange = resolveStrategyCandleDateRangeFromParams({
  period: "10d",
  from: "2026-07-01",
  till: "2026-07-08",
  now: fixedNow,
});
assert("explicit from/till respected", explicitRange.from === "2026-07-01" && explicitRange.till === "2026-07-08");
assert("explicit range days inclusive", explicitRange.calendarDays === 8);

const duplicateBatch = normalizeStrategyCandles([
  { begin: "2026-07-07 10:05:00", open: 1, high: 2, low: 1, close: 1.5 },
  { begin: "2026-07-07 10:05:00", open: 2, high: 3, low: 2, close: 2.5 },
  { begin: "2026-07-07 10:10:00", open: 3, high: 4, low: 3, close: 3.5 },
]);
assert("duplicate merge → 2 candles", duplicateBatch.diagnostics.normalizedCount === 2);
assert("duplicate count recorded", duplicateBatch.diagnostics.duplicateTimeCount === 1);

const sortedBatch = normalizeStrategyCandles([
  { begin: "2026-07-07 10:15:00", open: 3, high: 4, low: 3, close: 3.5 },
  { begin: "2026-07-07 10:05:00", open: 1, high: 2, low: 1, close: 1.5 },
  { begin: "2026-07-07 10:10:00", open: 2, high: 3, low: 2, close: 2.5 },
]);
assert(
  "sorted asc by time",
  sortedBatch.candles[0]!.time < sortedBatch.candles[1]!.time &&
    sortedBatch.candles[1]!.time < sortedBatch.candles[2]!.time,
);

const baseTime = Math.floor(new Date("2026-07-07T10:00:00+03:00").getTime() / 1000);
const manyCandles = Array.from({ length: STRATEGY_MAX_CANDLES + 120 }, (_, index) => ({
  time: baseTime + index * 300,
  open: 90 + index * 0.01,
  high: 90.2 + index * 0.01,
  low: 89.8 + index * 0.01,
  close: 90.1 + index * 0.01,
}));
const normalizedMany = normalizeStrategyCandles(manyCandles);
const capped = capStrategyCandles(normalizedMany.candles, STRATEGY_MAX_CANDLES);
assert("max candles cap trims to 5000", capped.candles.length === STRATEGY_MAX_CANDLES);
assert("max candles cap flagged", capped.capped === true);
assert("cap keeps latest candles", capped.candles.at(-1)?.close === normalizedMany.candles.at(-1)?.close);

const hashA = hashStrategyCandles(sortedBatch.candles);
const hashB = hashStrategyCandles([...sortedBatch.candles]);
assert("candles hash stable for same data", hashA === hashB);
assert("candles hash changes with length", hashA !== hashStrategyCandles(sortedBatch.candles.slice(0, 2)));

console.log("\nverify:strategy-candle-range — all checks passed");
