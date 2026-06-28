/**
 * Verify screener API response for a given MOEX_DATA_MODE without starting Next dev.
 * Usage: pnpm -C frontend exec tsx scripts/verify-moex-data-mode.ts live|fallback|off
 */
import { getScreenerResponse } from "../lib/server/services/moex-screener";
import { getMoexDataMode } from "../lib/server/screener-env";

async function main() {
  const modeArg = process.argv[2]?.trim().toLowerCase();
  if (modeArg === "live" || modeArg === "fallback" || modeArg === "off") {
    process.env.MOEX_DATA_MODE = modeArg;
  }

  const started = performance.now();
  let http = 200;
  try {
    const response = await getScreenerResponse("stock");
    const elapsed = Math.round(performance.now() - started);
    console.log(
      JSON.stringify(
        {
          mode: getMoexDataMode(),
          http,
          ms: elapsed,
          rows: response.rows.length,
          source: response.status.source,
          isDemo: response.status.isDemo,
          fallbackReason: response.status.fallbackReason,
          message: response.status.message,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    http = 503;
    const elapsed = Math.round(performance.now() - started);
    console.log(
      JSON.stringify(
        {
          mode: getMoexDataMode(),
          http,
          ms: elapsed,
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
}

main();
