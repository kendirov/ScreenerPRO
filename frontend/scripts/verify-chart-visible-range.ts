/**
 * QA Chart Visible Range — pnpm -C frontend verify:chart-visible-range
 */
import type { IChartApi } from "lightweight-charts";

import {
  applyVisibleRangePreset,
  getLastNSessionsVisibleRange,
  getLastSessionVisibleRange,
} from "../lib/strategies/chart-visible-range";

import type { StrategyCandle } from "../lib/screener/strategies/strategy-candles";

function assert(label: string, condition: boolean): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`OK: ${label}`);
}

function createCandles(count: number, intervalSeconds: number): StrategyCandle[] {
  const candles: StrategyCandle[] = [];
  const startTime = 1_700_000_000;
  for (let i = 0; i < count; i += 1) {
    const time = startTime + i * intervalSeconds;
    candles.push({
      time,
      open: 100,
      high: 101,
      low: 99,
      close: 100.5,
    });
  }
  return candles;
}

function createChartStub() {
  let fitContentCalled = false;
  let setVisibleRangeArgs: { from: unknown; to: unknown } | null = null;
  let rightOffset: number | null = null;

  const chartStub = {
    timeScale() {
      return {
        fitContent: () => {
          fitContentCalled = true;
        },
        setVisibleRange: (range: { from: unknown; to: unknown }) => {
          setVisibleRangeArgs = { from: range.from, to: range.to };
        },
        applyOptions: (opts: { rightOffset?: number }) => {
          if (opts.rightOffset != null) rightOffset = opts.rightOffset;
        },
      };
    },
    __get() {
      return { fitContentCalled, setVisibleRangeArgs, rightOffset };
    },
  };

  return chartStub as unknown as IChartApi & {
    __get: () => { fitContentCalled: boolean; setVisibleRangeArgs: any; rightOffset: number | null };
  };
}

function assertNoNaN(label: string, value: unknown): void {
  const n = value as number;
  assert(label, Number.isFinite(n));
}

// Case: no candles safe
{
  const empty: StrategyCandle[] = [];
  assert("getLastSessionVisibleRange([]) => null", getLastSessionVisibleRange(empty) == null);
  assert("getLastNSessionsVisibleRange([]) => null", getLastNSessionsVisibleRange(empty, undefined, 2) == null);
  const chart = createChartStub();
  applyVisibleRangePreset(chart, empty, "two_sessions");
  const res = chart.__get();
  assert("no candles: fitContent not called", res.fitContentCalled === false);
  assert("no candles: setVisibleRange not called", res.setVisibleRangeArgs == null);
}

// Case: 500 candles => last 300 selected for two_sessions fallback
{
  const candles = createCandles(500, 300); // 5m step (300 sec)
  const range = getLastNSessionsVisibleRange(candles, undefined, 2);
  assert("two_sessions fallback returns range", range != null);
  assert("two_sessions fallback barsCount=300", range?.barsCount === 300);
  assertNoNaN("two_sessions fallback from finite", range?.from);
  assertNoNaN("two_sessions fallback to finite", range?.to);
  assert("two_sessions fallback range sorted", Number(range!.from as number) <= Number(range!.to as number));

  const expectedFromIndex = 500 - 300;
  assert("two_sessions fallback from matches expected index", range?.from === candles[expectedFromIndex]!.time);
  assert("two_sessions fallback to matches expected index", range?.to === candles[candles.length - 1]!.time);
}

// Case: all returns full range
{
  const candles = createCandles(123, 300);
  const chart = createChartStub();
  applyVisibleRangePreset(chart, candles, "all");
  const res = chart.__get();
  assert("all: setVisibleRange called", res.setVisibleRangeArgs != null);
  assert("all: from=first time", res.setVisibleRangeArgs.from === candles[0]!.time);
  assert("all: to=last time", res.setVisibleRangeArgs.to === candles[candles.length - 1]!.time);
  assertNoNaN("all: rightOffset is either null or finite", res.rightOffset == null ? 1 : res.rightOffset);
}

console.log("\nverify:chart-visible-range — all checks passed");

