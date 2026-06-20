/**
 * Smoke tests for MOEX instrument resolver (sync paths).
 * Run: pnpm -C frontend verify:moex-instrument-resolver
 */

import {
  resolveEquityInstrument,
  resolveIndexInstrument,
} from "@/lib/moex/moex-instrument-resolver";
import { lookupManualFuturesContract } from "@/data/moex-futures-contract-map";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

{
  const sber = resolveEquityInstrument("SBER");
  assert(sber.status === "resolved", "SBER resolved");
  assert(sber.engine === "stock" && sber.market === "shares" && sber.board === "TQBR", "SBER route");
  assert(sber.security === "SBER", "SBER security");
}

{
  const imoex = resolveIndexInstrument("IMOEX");
  assert(imoex.status === "resolved" && imoex.market === "index", "IMOEX index");
  assert(imoex.security === "IMOEX", "IMOEX security");
}

{
  const rgbi = resolveIndexInstrument("RGBI");
  assert(rgbi.status === "resolved", "RGBI resolved");
}

{
  const bad = resolveIndexInstrument("SPX");
  assert(bad.status === "no_data", "unknown index → no_data");
  assert(Boolean(bad.reason), "unknown index has reason");
}

{
  const manual = lookupManualFuturesContract("Si", "2024-12-20");
  assert(manual === null, "empty manual map returns null");
}

console.log("\nAll MOEX instrument resolver checks passed.");
