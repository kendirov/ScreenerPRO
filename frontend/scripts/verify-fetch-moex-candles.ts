/**
 * Smoke tests for MOEX ISS interval mapping and resampling.
 * Run: pnpm -C frontend verify:fetch-moex-candles
 */

import {
  aggregateMoexCandles,
  resolveMoexIssFetchPlan,
  resolveMoexCandlesBoard,
} from "@/lib/moex/moex-iss-interval";
import { fetchMoexCandles } from "@/lib/moex/fetch-moex-candles";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

async function main() {
  const plan5 = resolveMoexIssFetchPlan(5);
  assert(plan5.issIntervalMinutes === 1, "5м UI → ISS 1м");
  assert(plan5.resampleToMinutes === 5, "5м UI → resample 5м");

  const plan15 = resolveMoexIssFetchPlan(15);
  assert(plan15.issIntervalMinutes === 1, "15м UI → ISS 1м");
  assert(plan15.resampleToMinutes === 15, "15м UI → resample 15м");

  const plan60 = resolveMoexIssFetchPlan(60);
  assert(plan60.issIntervalMinutes === 60, "60м UI → ISS 60м");

  assert(resolveMoexCandlesBoard("stock", "shares") === "TQBR", "shares default board TQBR");
  assert(resolveMoexCandlesBoard("stock", "index") === undefined, "index no default board");

  const base = [
    { time: 0, open: 100, high: 101, low: 99, close: 100.5, volume: 10 },
    { time: 60, open: 100.5, high: 102, low: 100, close: 101, volume: 20 },
    { time: 120, open: 101, high: 103, low: 100.5, close: 102, volume: 30 },
    { time: 180, open: 102, high: 104, low: 101, close: 103, volume: 40 },
    { time: 240, open: 103, high: 105, low: 102, close: 104, volume: 50 },
  ];
  const resampled = aggregateMoexCandles(base, 5);
  assert(resampled.length === 1, "5×1м → 1 свеча 5м");
  assert(resampled[0]!.open === 100, "5м open = first open");
  assert(resampled[0]!.close === 104, "5м close = last close");
  assert(resampled[0]!.volume === 150, "5м volume summed");

  const result = await fetchMoexCandles({
    engine: "stock",
    market: "shares",
    board: "TQBR",
    security: "SBER",
    date: "2099-01-01",
    interval: 99 as 1,
  });
  assert(result.status === "error", "invalid interval → error");
  assert(result.candles.length === 0, "invalid interval → empty candles");
  assert(Boolean(result.errorMessage), "invalid interval → errorMessage");

  console.log("\nAll fetch-moex-candles / ISS interval checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
