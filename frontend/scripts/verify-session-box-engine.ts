/**
 * QA Session Box Engine — pnpm -C frontend verify:session-box
 */
import type { StrategyCandle } from "../lib/screener/strategies/strategy-candles";
import {
  computeSessionBoxes,
  type SessionPreset,
} from "../lib/strategies/session-box-engine";

function assert(label: string, condition: boolean): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`OK: ${label}`);
}

function candle(
  iso: string,
  open: number,
  high: number,
  low: number,
  close: number,
): StrategyCandle {
  return {
    time: Math.floor(new Date(iso).getTime() / 1000),
    open,
    high,
    low,
    close,
  };
}

function assertFiniteBoxFields(label: string, preset: SessionPreset, boxes: ReturnType<typeof computeSessionBoxes>) {
  for (const box of boxes) {
    assert(`${label} ${preset} open finite`, Number.isFinite(box.open));
    assert(`${label} ${preset} high finite`, Number.isFinite(box.high));
    assert(`${label} ${preset} low finite`, Number.isFinite(box.low));
    assert(`${label} ${preset} close finite`, Number.isFinite(box.close));
    assert(`${label} ${preset} rangeAbs finite`, Number.isFinite(box.rangeAbs));
    assert(`${label} ${preset} rangePct finite`, Number.isFinite(box.rangePct));
    assert(`${label} ${preset} high >= low`, box.high >= box.low);
  }
}

const moexDay = [
  candle("2026-07-08T09:50:00+03:00", 100, 101, 99.5, 100.4),
  candle("2026-07-08T11:00:00+03:00", 100.4, 102.2, 100.2, 101.9),
  candle("2026-07-08T18:50:00+03:00", 101.9, 102.6, 100.8, 101.1),
];

const moexBoxes = computeSessionBoxes(moexDay, "moex_stocks");
assert("one moex session -> one box", moexBoxes.length === 1);
assert("moex open correct", moexBoxes[0]?.open === 100);
assert("moex high correct", moexBoxes[0]?.high === 102.6);
assert("moex low correct", moexBoxes[0]?.low === 99.5);
assert("moex close correct", moexBoxes[0]?.close === 101.1);
assert("moex rangeAbs correct", Math.abs((moexBoxes[0]?.rangeAbs ?? 0) - 3.1) < 1e-6);
assert("moex rangePct correct", Math.abs((moexBoxes[0]?.rangePct ?? 0) - 3.1) < 1e-6);

const multipleDays = [
  ...moexDay,
  candle("2026-07-09T09:50:00+03:00", 101.1, 101.4, 100.4, 100.9),
  candle("2026-07-09T18:45:00+03:00", 100.9, 103.1, 100.7, 102.8),
];
const multiBoxes = computeSessionBoxes(multipleDays, "moex_stocks");
assert("multiple days -> multiple moex boxes", multiBoxes.length === 2);

const utcCandles = [
  candle("2026-07-08T00:10:00Z", 200, 201, 199, 200.5),
  candle("2026-07-08T23:40:00Z", 200.5, 202, 200.2, 201.8),
  candle("2026-07-09T00:10:00Z", 201.8, 202.2, 201.4, 201.9),
];
const utcBoxes = computeSessionBoxes(utcCandles, "utc_day");
assert("UTC day preset groups by utc date", utcBoxes.length === 2);
assert("UTC first box date", utcBoxes[0]?.date === "2026-07-08");
assert("UTC second box date", utcBoxes[1]?.date === "2026-07-09");

const extendedCandles = [
  candle("2026-07-08T06:59:00+03:00", 90, 90, 90, 90),
  candle("2026-07-08T07:00:00+03:00", 91, 92, 90.5, 91.5),
  candle("2026-07-08T23:50:00+03:00", 91.5, 93, 91, 92.2),
];
const extendedBoxes = computeSessionBoxes(extendedCandles, "extended_msk");
assert("extended preset includes 07:00 and 23:50", extendedBoxes.length === 1);
assert("extended preset excludes pre-session candle", extendedBoxes[0]?.open === 91);

assertFiniteBoxFields("finite", "moex_stocks", moexBoxes);
assertFiniteBoxFields("finite", "moex_stocks", multiBoxes);
assertFiniteBoxFields("finite", "utc_day", utcBoxes);
assertFiniteBoxFields("finite", "extended_msk", extendedBoxes);

console.log("\nAll session-box-engine checks passed.");
