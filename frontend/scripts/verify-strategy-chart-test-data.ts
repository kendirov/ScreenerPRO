/**
 * QA synthetic chart candles — pnpm -C frontend verify:strategy-chart-test-data
 */
import { createSyntheticCandles } from "../lib/strategies/strategy-chart-test-data";

function assert(label: string, condition: boolean): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`OK: ${label}`);
}

const candles = createSyntheticCandles();

assert("count is 80", candles.length === 80);
assert("all time values are finite numbers", candles.every((candle) => Number.isFinite(candle.time)));
assert(
  "sorted ascending by time",
  candles.every((candle, index) => index === 0 || candles[index - 1]!.time < candle.time),
);
assert(
  "no duplicate times",
  new Set(candles.map((candle) => candle.time)).size === candles.length,
);
assert(
  "valid OHLC for every candle",
  candles.every((candle) => {
    const values = [candle.open, candle.high, candle.low, candle.close];
    return (
      values.every(Number.isFinite) &&
      candle.high >= candle.low &&
      candle.high >= candle.open &&
      candle.high >= candle.close &&
      candle.low <= candle.open &&
      candle.low <= candle.close
    );
  }),
);

console.log("\nverify:strategy-chart-test-data — all checks passed");
