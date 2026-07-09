/**
 * QA Strategy Candles Normalizer — pnpm -C frontend verify:strategy-candles
 */
import {
  normalizeStrategyCandles,
  parseStrategyCandleBegin,
  type StrategyCandle,
} from "../lib/strategies/strategy-candles-normalizer";

function assert(label: string, condition: boolean): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`OK: ${label}`);
}

const moscowBegin = "2026-07-07 10:05:00";
const moscowSeconds = parseStrategyCandleBegin(moscowBegin);
assert("MOEX begin parses to numeric seconds", moscowSeconds != null && Number.isInteger(moscowSeconds));
assert(
  "MOEX begin seconds match ISO +03:00",
  moscowSeconds === Math.floor(new Date("2026-07-07T10:05:00+03:00").getTime() / 1000),
);

const validBatch = normalizeStrategyCandles([
  {
    begin: "2026-07-07 10:10:00",
    open: 93.1,
    high: 93.3,
    low: 93.0,
    close: 93.2,
    volume: 1000,
  },
  {
    begin: moscowBegin,
    open: 93.0,
    high: 93.15,
    low: 92.95,
    close: 93.05,
  },
]);

assert("unsorted candles are sorted asc", validBatch.candles[0]!.time < validBatch.candles[1]!.time);
assert("normalized count is 2", validBatch.diagnostics.normalizedCount === 2);
assert("output time is number", validBatch.candles.every((c) => typeof c.time === "number"));
assert("output time is seconds, not milliseconds", validBatch.candles.every((c) => c.time < 10_000_000_000));
assert("first begin recorded", validBatch.diagnostics.firstBegin === moscowBegin);
assert("last begin recorded", validBatch.diagnostics.lastBegin === "2026-07-07 10:10:00");

const fiveMinuteBatch = normalizeStrategyCandles([
  { begin: "2026-07-07 10:15:00", open: "93,20", high: "93,30", low: "93,10", close: "93,25" },
  { begin: "2026-07-07 10:05:00", open: "93,00", high: "93,15", low: "92,95", close: "93,05" },
  { begin: "2026-07-07 10:10:00", open: "93,05", high: "93,25", low: "93,00", close: "93,20" },
]);

assert("comma decimal strings parse correctly", fiveMinuteBatch.diagnostics.normalizedCount === 3);
assert(
  "adjacent 5m candles diff 300 sec",
  fiveMinuteBatch.candles[1]!.time - fiveMinuteBatch.candles[0]!.time === 300 &&
    fiveMinuteBatch.candles[2]!.time - fiveMinuteBatch.candles[1]!.time === 300,
);
assert(
  "no duplicate times in 5m batch",
  new Set(fiveMinuteBatch.candles.map((c) => c.time)).size === fiveMinuteBatch.candles.length,
);

const invalidBatch = normalizeStrategyCandles([
  { begin: "2026-07-07 10:00:00", open: NaN, high: 1, low: 1, close: 1 },
  { begin: "2026-07-07 10:05:00", open: 10, high: 9, low: 8, close: 9.5 },
  { begin: "2026-07-07 10:10:00", open: 10, high: 11, low: 9, close: 10.5 },
]);

assert("invalid OHLC removed", invalidBatch.diagnostics.normalizedCount === 1);
assert("invalid count recorded", invalidBatch.diagnostics.invalidCount === 2);

const duplicateBatch = normalizeStrategyCandles([
  { begin: "2026-07-07 10:05:00", open: 1, high: 2, low: 1, close: 1.5 },
  { begin: "2026-07-07 10:05:00", open: 2, high: 3, low: 2, close: 2.5 },
  { begin: "2026-07-07 10:10:00", open: 3, high: 4, low: 3, close: 3.5 },
]);

assert("duplicate time squashed", duplicateBatch.diagnostics.normalizedCount === 2);
assert("duplicate count recorded", duplicateBatch.diagnostics.duplicateTimeCount === 1);
assert(
  "duplicate keeps last row",
  duplicateBatch.candles.find((c) => c.time === parseStrategyCandleBegin("2026-07-07 10:05:00")!)?.close === 2.5,
);

for (const candle of [...validBatch.candles, ...invalidBatch.candles, ...duplicateBatch.candles]) {
  assertNoNaN(candle);
}

function assertNoNaN(candle: StrategyCandle): void {
  assert(`no NaN in candle @${candle.time}`, !JSON.stringify(candle).includes("NaN"));
  assert(`time finite @${candle.time}`, Number.isFinite(candle.time));
  assert(`open finite @${candle.time}`, Number.isFinite(candle.open));
  assert(`high finite @${candle.time}`, Number.isFinite(candle.high));
  assert(`low finite @${candle.time}`, Number.isFinite(candle.low));
  assert(`close finite @${candle.time}`, Number.isFinite(candle.close));
}

console.log("\nverify:strategy-candles — all checks passed");
