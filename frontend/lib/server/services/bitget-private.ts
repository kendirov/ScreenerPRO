import { createHmac } from "node:crypto";

const BITGET_API = "https://api.bitget.com";
const POSITION_CATEGORIES = ["USDT-FUTURES", "USDC-FUTURES", "COIN-FUTURES"] as const;

type BitgetEnvelope<T = unknown> = {
  code?: string;
  msg?: string;
  requestTime?: number;
  data?: T;
};

type JsonRecord = Record<string, unknown>;

export class BitgetPrivateConfigError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing Bitget server secrets: ${missing.join(", ")}`);
    this.name = "BitgetPrivateConfigError";
  }
}

function requireSecrets() {
  const values = {
    apiKey: process.env.BITGET_API_KEY,
    apiSecret: process.env.BITGET_API_SECRET,
    passphrase: process.env.BITGET_API_PASSPHRASE,
  };
  const missing = [
    !values.apiKey ? "BITGET_API_KEY" : null,
    !values.apiSecret ? "BITGET_API_SECRET" : null,
    !values.passphrase ? "BITGET_API_PASSPHRASE" : null,
  ].filter((value): value is string => Boolean(value));

  if (missing.length > 0) throw new BitgetPrivateConfigError(missing);
  return values as { apiKey: string; apiSecret: string; passphrase: string };
}

function sign(timestamp: string, method: "GET", path: string, query: string, secret: string) {
  const prehash = `${timestamp}${method}${path}${query ? `?${query}` : ""}`;
  return createHmac("sha256", secret).update(prehash).digest("base64");
}

async function privateGet<T = unknown>(path: string, params?: URLSearchParams): Promise<T> {
  const { apiKey, apiSecret, passphrase } = requireSecrets();
  const query = params?.toString() ?? "";
  const timestamp = Date.now().toString();
  const response = await fetch(`${BITGET_API}${path}${query ? `?${query}` : ""}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      "ACCESS-KEY": apiKey,
      "ACCESS-SIGN": sign(timestamp, "GET", path, query, apiSecret),
      "ACCESS-TIMESTAMP": timestamp,
      "ACCESS-PASSPHRASE": passphrase,
      "Content-Type": "application/json",
      locale: "en-US",
    },
    signal: AbortSignal.timeout(12_000),
  });

  const body = (await response.json()) as BitgetEnvelope<T>;
  if (!response.ok) throw new Error(`Bitget HTTP ${response.status} for ${path}`);
  if (body.code !== "00000") throw new Error(`Bitget ${body.code ?? "unknown"}: ${body.msg ?? "request failed"}`);
  return body.data as T;
}

async function safe<T>(label: string, action: () => Promise<T>) {
  try {
    return { ok: true as const, data: await action() };
  } catch (error) {
    if (error instanceof BitgetPrivateConfigError) throw error;
    return { ok: false as const, error: `${label}: ${error instanceof Error ? error.message : "request failed"}` };
  }
}

export async function getBitgetPrivateReadOnlySnapshot() {
  const startedAt = Date.now();
  requireSecrets();

  const [info, assets, fundingAssets, openOrders, ...positions] = await Promise.all([
    safe("account info", () => privateGet<JsonRecord>("/api/v3/account/info")),
    safe("account assets", () => privateGet<JsonRecord>("/api/v3/account/assets")),
    safe("funding assets", () => privateGet<JsonRecord[]>("/api/v3/account/funding-assets")),
    safe("open orders", () => privateGet<JsonRecord>("/api/v3/trade/unfilled-orders")),
    ...POSITION_CATEGORIES.map((category) =>
      safe(`${category} positions`, () =>
        privateGet<JsonRecord>("/api/v3/position/current-position", new URLSearchParams({ category })),
      ),
    ),
  ]);

  const positionByCategory = Object.fromEntries(
    POSITION_CATEGORIES.map((category, index) => [category, positions[index]]),
  );

  return {
    mode: "read-only" as const,
    source: "bitget-uta-v3" as const,
    asOf: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    info,
    assets,
    fundingAssets,
    positions: positionByCategory,
    openOrders,
  };
}
