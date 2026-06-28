#!/usr/bin/env tsx
/**
 * Verify preparation events provider chain.
 * Usage: pnpm -C frontend exec tsx scripts/verify-preparation-events.ts
 */

import { clearPreparationEventsCache, buildPreparationEventsResponse } from "../lib/server/services/events/events-provider-chain";
import { hasFinnhubKey } from "../lib/server/services/events/finnhub-events-provider";
import { hasTradingEconomicsKey } from "../lib/server/services/events/trading-economics-events-provider";

async function main() {
  clearPreparationEventsCache();
  const response = await buildPreparationEventsResponse();

  console.log("=== PREPARATION EVENTS VERIFY ===");
  console.log(`API keys: TE=${hasTradingEconomicsKey() ? "yes" : "no"} | Finnhub=${hasFinnhubKey() ? "yes" : "no"}`);
  console.log("providers enabled:");
  for (const p of response.providers) {
    console.log(`  ${p.id}: enabled=${p.enabled} status=${p.status} count=${p.count}${p.error ? ` err=${p.error}` : ""}`);
  }

  console.log(`loaded: ${response.loaded}`);
  console.log(`status: ${response.status}`);
  console.log(`source: ${response.source}`);
  console.log(`today count: ${response.today.length}`);
  console.log(`high count: ${response.counts.high}`);
  console.log(`medium shown: ${response.counts.mediumShown}`);
  console.log(`low hidden: ${response.counts.lowHidden}`);

  const sample = [...response.today, ...response.tomorrow, ...response.week].slice(0, 5);
  console.log("sample events:");
  for (const e of sample) {
    console.log(`  ${e.date} ${e.timeMsk ?? "—"} | ${e.title} | ${e.importance} | ${e.source}`);
  }

  console.log("diagnostics:", response.diagnostics.join(" | "));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
