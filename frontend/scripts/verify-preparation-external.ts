#!/usr/bin/env tsx
/**
 * Verify external preparation market data.
 * Usage: pnpm -C frontend exec tsx scripts/verify-preparation-external.ts
 */

import { clearExternalMarketCache, buildExternalMarketResponse } from "../lib/server/services/external-market-scanner";
import {
  EXTERNAL_ASSETS_REGISTRY,
  getActiveExternalAssets,
  getCriticalExternalAssets,
  getDisabledExternalAssets,
} from "../lib/server/services/external-assets-registry";

async function main() {
  clearExternalMarketCache();
  const registryBefore = EXTERNAL_ASSETS_REGISTRY.length;
  const active = getActiveExternalAssets();
  const disabled = getDisabledExternalAssets();
  const critical = getCriticalExternalAssets();

  console.log("=== PREPARATION EXTERNAL VERIFY ===");
  console.log(`registry count before: ${registryBefore}`);
  console.log(`active count: ${active.length}`);
  console.log(`disabled count: ${disabled.length}`);
  console.log(`critical count: ${critical.length}`);

  const response = await buildExternalMarketResponse();

  console.log(`critical success rate: ${(response.criticalSuccessRate * 100).toFixed(0)}%`);
  console.log(`movers count: ${response.moversCount}`);
  console.log(`external status: ${response.status}`);

  const errorsByGroup = new Map<string, number>();
  for (const diag of response.assetDiagnostics) {
    if (diag.status === "error" || diag.status === "insufficient") {
      errorsByGroup.set(diag.group, (errorsByGroup.get(diag.group) ?? 0) + 1);
    }
  }
  console.log("errors by group:", Object.fromEntries(errorsByGroup));

  const okSamples = response.assetDiagnostics.filter((d) => d.status === "ok").slice(0, 5);
  console.log("sample points:");
  for (const s of okSamples) {
    console.log(
      `  ${s.id} | ${s.symbol} | pts=${s.points} | ${s.firstDate}→${s.lastDate} | ${s.firstValue?.toFixed(2)}→${s.lastValue?.toFixed(2)}`,
    );
  }

  console.log("sample movers:");
  for (const group of response.groups) {
    const items = group.movers.length ? group.movers : group.critical;
    for (const m of items.slice(0, 2)) {
      console.log(
        `  ${m.symbol} | ${group.title} | 1D ${m.change1dPct?.toFixed(2)}% | 5D ${m.change5dPct?.toFixed(2)}% | pts ${m.series5d.length}`,
      );
    }
  }

  if (disabled.length) {
    console.log("disabled symbols:");
    for (const d of disabled) {
      console.log(`  ${d.id}: ${d.disabledReason}`);
    }
  }

  console.log("diagnostics:", response.diagnostics.join(" | "));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
