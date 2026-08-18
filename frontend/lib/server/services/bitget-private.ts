import { createHmac } from "node:crypto";

const BITGET_API = "https://api.bitget.com";
const POSITION_CATEGORIES = ["USDT-FUTURES", "USDC-FUTURES", "COIN-FUTURES"] as const;

type BitgetEnvelope<T = unknown> = {
  code?: string;
  msg?: string;
  message?: string;
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

  let body: BitgetEnvelope<T>;
  try {
    body = (await response.json()) as BitgetEnvelope<T>;
  } catch {
    throw new Error(`Bitget HTTP ${response.status} for ${path}`);
  }

  if (!response.ok || body.code !== "00000") {
    const detail = body.msg ?? body.message ?? "request failed";
    throw new Error(`Bitget ${body.code ?? `HTTP ${response.status}`}: ${detail}`);
  }
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

function productParams(productType: (typeof POSITION_CATEGORIES)[number]) {
  return new URLSearchParams({ productType });
}

async function getUtaV3Snapshot() {
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

  return {
    info,
    assets,
    fundingAssets,
    positions: Object.fromEntries(POSITION_CATEGORIES.map((category, index) => [category, positions[index]])),
    openOrders,
  };
}

async function getClassicV2Snapshot() {
  const [spotAssets, ...rest] = await Promise.all([
    safe("classic spot assets", () =>
      privateGet<JsonRecord[]>("/api/v2/spot/account/assets", new URLSearchParams({ assetType: "all" })),
    ),
    ...POSITION_CATEGORIES.flatMap((category) => [
      safe(`${category} classic accounts`, () =>
        privateGet<JsonRecord[]>("/api/v2/mix/account/accounts", productParams(category)),
      ),
      safe(`${category} classic positions`, () =>
        privateGet<JsonRecord[]>("/api/v2/mix/position/all-position", productParams(category)),
      ),
      safe(`${category} classic open orders`, () =>
        privateGet<JsonRecord>("/api/v2/mix/order/orders-pending", productParams(category)),
      ),
    ]),
  ]);

  const futures = Object.fromEntries(
    POSITION_CATEGORIES.map((category, index) => {
      const offset = index * 3;
      return [
        category,
        {
          accounts: rest[offset],
          positions: rest[offset + 1],
          openOrders: rest[offset + 2],
        },
      ];
    }),
  );

  return { spotAssets, futures };
}

export async function getBitgetPrivateReadOnlySnapshot() {
  const startedAt = Date.now();
  requireSecrets();

  const [utaV3, classicV2] = await Promise.all([getUtaV3Snapshot(), getClassicV2Snapshot()]);

  return {
    mode: "read-only" as const,
    source: "bitget-private-auto" as const,
    asOf: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    utaV3,
    classicV2,
  };
}
