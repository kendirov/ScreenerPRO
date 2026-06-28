/**
 * Повторяемая диагностика доступа к MOEX ISS и локальному screener API.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/diagnose-moex-connectivity.ts
 *   pnpm -C frontend exec tsx scripts/diagnose-moex-connectivity.ts --local-api http://localhost:3000
 *   pnpm -C frontend exec tsx scripts/diagnose-moex-connectivity.ts --production
 */

import { execSync } from "node:child_process";
import { getMoexHttpTimeoutMs } from "../lib/server/moex-timeout";

const MOEX_PROBE_URL =
  "https://iss.moex.com/iss/engines/stock/markets/shares/securities.json?iss.meta=off&iss.only=securities&securities.limit=1";

type ProbeResult = {
  ok: boolean;
  status?: number;
  ms: number;
  error?: string;
};

function parseArgs() {
  const args = process.argv.slice(2);
  let localApi = process.env.SCREENER_LOCAL_API ?? "http://localhost:3000";
  let production = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--local-api" && args[i + 1]) {
      localApi = args[++i];
    } else if (args[i] === "--production") {
      production = true;
    }
  }
  return { localApi, productionUrl: "https://screenerpro.vercel.app", production };
}

async function probeFetch(label: string, url: string, timeoutMs: number): Promise<ProbeResult> {
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return { ok: res.ok, status: res.status, ms: Date.now() - started };
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { ok: false, ms: Date.now() - started, error: message };
  }
}

function dnsLookup(host: string): string {
  try {
    return execSync(`nslookup ${host}`, { encoding: "utf8", timeout: 10_000 }).trim();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function curlHead(url: string, timeoutSec: number): string {
  try {
    return execSync(
      `curl -sS -o /dev/null -w "HTTP %{http_code} time_total=%{time_total}s" --connect-timeout ${timeoutSec} --max-time ${timeoutSec} -I "${url}"`,
      { encoding: "utf8", timeout: (timeoutSec + 5) * 1000 },
    ).trim();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function proxyEnv(): Record<string, string> {
  const keys = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy"];
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) out[key] = value;
  }
  return out;
}

async function probeScreenerApi(base: string, assetClass: "stock" | "future") {
  const url = `${base}/api/screener?assetClass=${assetClass}`;
  const started = Date.now();
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const body = (await res.json()) as {
    rows?: unknown[];
    status?: {
      source?: string;
      isDemo?: boolean;
      fallbackReason?: string | null;
      generatedAt?: string;
      message?: string | null;
    };
  };
  return {
    url,
    http: res.status,
    ms: Date.now() - started,
    rows: body.rows?.length ?? 0,
    source: body.status?.source ?? null,
    isDemo: body.status?.isDemo ?? null,
    fallbackReason: body.status?.fallbackReason ?? null,
    updatedAt: body.status?.generatedAt ?? null,
    message: body.status?.message ?? null,
  };
}

async function main() {
  const { localApi, productionUrl, production } = parseArgs();
  const timeoutMs = getMoexHttpTimeoutMs();

  console.log("=== MOEX connectivity diagnostics ===");
  console.log("MOEX_HTTP_TIMEOUT_MS:", timeoutMs);
  console.log("MOEX_BASE_URL:", process.env.MOEX_BASE_URL ?? "(default https://iss.moex.com/iss)");
  console.log("MOEX_DATA_MODE:", process.env.MOEX_DATA_MODE ?? "(default live)");
  console.log("proxy env:", Object.keys(proxyEnv()).length ? proxyEnv() : "(none)");

  console.log("\n--- DNS iss.moex.com ---");
  console.log(dnsLookup("iss.moex.com"));

  console.log("\n--- curl HEAD (15s) ---");
  console.log(curlHead(MOEX_PROBE_URL, 15));

  console.log("\n--- Node fetch MOEX ISS ---");
  const moex = await probeFetch("moex", MOEX_PROBE_URL, timeoutMs);
  console.log(moex);

  if (production) {
    console.log("\n--- Production API ---");
    for (const assetClass of ["stock", "future"] as const) {
      console.log(await probeScreenerApi(productionUrl, assetClass));
    }
  }

  console.log("\n--- Local API (if dev server running) ---");
  for (const assetClass of ["stock", "future"] as const) {
    try {
      console.log(await probeScreenerApi(localApi, assetClass));
    } catch (error) {
      console.log({
        url: `${localApi}/api/screener?assetClass=${assetClass}`,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
