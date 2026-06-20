/**
 * Smoke tests for CBR reaction calculation on real candle shapes.
 * Run: pnpm -C frontend verify:calculate-cbr-reaction
 */

import {
  calculateReactionMetrics,
  calculateReturnPct,
  getPriceAtOrBefore,
} from "@/lib/cbr/calculate-cbr-reaction";
import { mskTimeToUnix } from "@/lib/domain/cbr-rate-event-window";

const DATE = "2024-12-20";

function candle(hhmm: string, close: number, open = close): { time: number; open: number; high: number; low: number; close: number } {
  return {
    time: mskTimeToUnix(DATE, hhmm),
    open,
    high: close + 0.1,
    low: close - 0.1,
    close,
  };
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

assert(calculateReturnPct(100, 101) === 1, "return pct +1%");
assert(calculateReturnPct(null, 100) === null, "null from price");

{
  const empty = calculateReactionMetrics([]);
  assert(empty.status === "no_data", "empty → no_data");
  assert(empty.reaction5mPct === null, "no fake 5m");
}

{
  const one = calculateReactionMetrics([candle("13:30", 100)]);
  assert(one.status === "no_data", "single candle → no_data");
}

{
  const candles = [
    candle("12:00", 100),
    candle("13:30", 100),
    candle("13:35", 101),
    candle("14:00", 102),
    candle("15:30", 103),
    candle("18:00", 104),
  ];
  const m = calculateReactionMetrics(candles, DATE);
  assert(m.status === "ok", "decision coverage → ok");
  assert(m.reaction5mPct != null, "5m computed");
  assert(m.reaction30mPct != null, "30m computed");
  assert(m.reactionDayPct != null, "day computed");
}

{
  const candles = [candle("10:00", 100), candle("10:05", 100.5)];
  const m = calculateReactionMetrics(candles, DATE);
  assert(m.status === "incomplete", "no 13:30 → incomplete");
  assert(m.reaction5mPct === null, "incomplete blocks 5m");
  assert(m.reaction30mPct === null, "incomplete blocks 30m");
}

{
  const candles = [candle("12:00", 100), candle("12:05", 100)];
  const price = getPriceAtOrBefore(candles, mskTimeToUnix(DATE, "12:30"));
  assert(price === 100, "price at or before");
}

console.log("\nAll calculate-cbr-reaction checks passed.");
