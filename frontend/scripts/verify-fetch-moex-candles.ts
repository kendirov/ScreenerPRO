/**
 * Smoke tests for fetchMoexCandles param validation.
 * Run: pnpm -C frontend verify:fetch-moex-candles
 */

import { fetchMoexCandles } from "@/lib/moex/fetch-moex-candles";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

async function main() {
  const result = await fetchMoexCandles({
    engine: "stock",
    market: "shares",
    board: "TQBR",
    security: "SBER",
    date: "2099-01-01",
    interval: 60 as 1,
  });
  assert(result.status === "error", "invalid interval → error");
  assert(result.candles.length === 0, "invalid interval → empty candles");
  assert(Boolean(result.errorMessage), "invalid interval → errorMessage");

  console.log("\nAll fetchMoexCandles checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
