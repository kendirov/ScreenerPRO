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

type SafeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export class BitgetPrivateConfigError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing Bitget server secrets: ${missing.join(", ")}`);
    this.name = "BitgetPrivateConfigError";
  }
}

function requireSecrets() {
  const raw = {
    apiKey: process.env.BITGET_API_KEY,
    apiSecret: process.env.BITGET_API_SECRET,
    passphrase: process.env.BITGET_API_PASSPHRASE,
  };
  const missing = [
    !raw.apiKey ? "BITGET_API_KEY" : null,
    !raw.apiSecret ? "BITGET_API_SECRET" : null,
    !raw.passphrase ? "BITGET_API_PASSPHRASE" : null,
  ].filter((value): value is string => Boolean(value));

  if (missing.length > 0) throw new BitgetPrivateConfigError(missing);

  const values = {
    apiKey: raw.apiKey!.trim(),
    apiSecret: raw.apiSecret!.trim(),
    passphrase: raw.passphrase!.trim(),
  };

  return {
    ...values,
    meta: {
      apiKeyLength: values.apiKey.length,
      apiSecretLength: values.apiSecret.length,
      passphraseLength: values.passphrase.length,
      apiKeyLooksBitget: values.apiKey.startsWith("bg_"),
      hadOuterWhitespace:
        raw.apiKey !== values.apiKey ||
        raw.apiSecret !== values.apiSecret ||
        raw.passphrase !== values.passphrase,
    },
  };
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

async function safe<T>(label: string, action: () => Promise<T>): Promise<SafeResult<T>> {
  try {
    return { ok: true as const, data: await action() };
  } catch (error) {
    if (error instanceof BitgetPrivateConfigError) throw error;
    return {
      ok: false as const,
      error: `${label}: ${error instanceof Error ? error.message : "request failed"}`,
    };
  }
}

function productParams(productType: (typeof POSITION_CATEGORIES)[number]) {
  return new URLSearchParams({ productType });
}

function numberFrom(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((row): row is JsonRecord => Boolean(row) && typeof row === "object")
    : [];
}

function accountBalanceSummary(result: SafeResult<JsonRecord[]>) {
  if (!result.ok) return result;

  const accounts = result.data.map((row) => ({
    accountType: String(row.accountType ?? "unknown"),
    usdtBalance: numberFrom(row.usdtBalance),
  }));

  return {
    ok: true as const,
    data: accounts,
    totalUsdt: accounts.reduce((sum, row) => sum + row.usdtBalance, 0),
  };
}

function nonZeroAssets(result: SafeResult<JsonRecord[]>, valueKeys: string[]) {
  if (!result.ok) return result;

  return {
    ok: true as const,
    data: result.data.filter((row) =>
      valueKeys.some((key) => Math.abs(numberFrom(row[key])) > 0),
    ),
    rawCount: result.data.length,
  };
}

function utaAssetsSummary(result: SafeResult<JsonRecord>) {
  if (!result.ok) return result;

  const assetRows = records(result.data.assets);
  const assets = assetRows
    .filter((row) =>
      ["equity", "usdValue", "balance", "available", "locked", "bonus", "debt"].some(
        (key) => Math.abs(numberFrom(row[key])) > 0,
      ),
    )
    .map((row) => ({
      coin: String(row.coin ?? ""),
      equity: numberFrom(row.equity),
      usdValue: numberFrom(row.usdValue),
      balance: numberFrom(row.balance),
      available: numberFrom(row.available),
      locked: numberFrom(row.locked),
      bonus: numberFrom(row.bonus),
      debt: numberFrom(row.debt),
    }));

  return {
    ok: true as const,
    data: {
      accountEquityUsd: numberFrom(result.data.accountEquity),
      usdtEquity: numberFrom(result.data.usdtEquity),
      btcEquity: numberFrom(result.data.btcEquity),
      unrealisedPnlUsd: numberFrom(result.data.unrealisedPnl),
      usdtUnrealisedPnl: numberFrom(result.data.usdtUnrealisedPnl),
      effectiveEquityUsd: numberFrom(result.data.effEquity),
      maintenanceMarginUsd: numberFrom(result.data.mmr),
      initialMarginUsd: numberFrom(result.data.imr),
      marginRatio: numberFrom(result.data.mgnRatio),
      positionMarginRatio: numberFrom(result.data.positionMgnRatio),
      positionValueUsd: numberFrom(result.data.positionValue),
      leverage: numberFrom(result.data.leverage),
      assets,
    },
    rawAssetCount: assetRows.length,
  };
}

function utaFundingSummary(result: SafeResult<JsonRecord[]>) {
  return nonZeroAssets(result, ["balance", "available", "frozen"]);
}

function utaPageList(result: SafeResult<JsonRecord>, valueKey?: string) {
  if (!result.ok) return result;
  const list = records(result.data.list);
  return {
    ok: true as const,
    data: valueKey
      ? list.filter((row) => Math.abs(numberFrom(row[valueKey])) > 0)
      : list,
    rawCount: list.length,
  };
}

async function getUtaV3Snapshot() {
  const [info, settings, assetsRaw, fundingAssetsRaw, openOrdersRaw, ...positionResults] =
    await Promise.all([
      safe("UTA account info", () => privateGet<JsonRecord>("/api/v3/account/info")),
      safe("UTA account settings", () => privateGet<JsonRecord>("/api/v3/account/settings")),
      safe("UTA account assets", () => privateGet<JsonRecord>("/api/v3/account/assets")),
      safe("UTA funding assets", () => privateGet<JsonRecord[]>("/api/v3/account/funding-assets")),
      safe("UTA open orders", () => privateGet<JsonRecord>("/api/v3/trade/unfilled-orders")),
      ...POSITION_CATEGORIES.map((category) =>
        safe(`UTA ${category} positions`, () =>
          privateGet<JsonRecord>(
            "/api/v3/position/current-position",
            new URLSearchParams({ category }),
          ),
        ),
      ),
    ]);

  return {
    info,
    settings,
    assets: utaAssetsSummary(assetsRaw),
    fundingAssets: utaFundingSummary(fundingAssetsRaw),
    positions: Object.fromEntries(
      POSITION_CATEGORIES.map((category, index) => [
        category,
        utaPageList(positionResults[index], "total"),
      ]),
    ),
    openOrders: utaPageList(openOrdersRaw),
  };
}

async function getClassicV2Snapshot() {
  const [info, allAccountBalanceRaw, fundingAssetsRaw, spotAssetsRaw, ...rest] = await Promise.all([
    safe("classic account info", () => privateGet<JsonRecord>("/api/v2/spot/account/info")),
    safe("classic all account balance", () =>
      privateGet<JsonRecord[]>("/api/v2/account/all-account-balance"),
    ),
    safe("classic funding assets", () =>
      privateGet<JsonRecord[]>("/api/v2/account/funding-assets"),
    ),
    safe("classic spot assets", () =>
      privateGet<JsonRecord[]>(
        "/api/v2/spot/account/assets",
        new URLSearchParams({ assetType: "all" }),
      ),
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

  return {
    info,
    allAccountBalance: accountBalanceSummary(allAccountBalanceRaw),
    fundingAssets: nonZeroAssets(fundingAssetsRaw, ["available", "frozen", "usdtValue"]),
    spotAssets: nonZeroAssets(spotAssetsRaw, ["available", "frozen", "locked", "limitAvailable"]),
    futures,
  };
}

export async function getBitgetPrivateBalanceSummary() {
  const startedAt = Date.now();
  const utaV3 = await getUtaV3Snapshot();

  if (utaV3.assets.ok) {
    return {
      mode: "read-only" as const,
      accountMode: "UTA" as const,
      source: "bitget-uta-v3" as const,
      asOf: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      utaV3,
    };
  }

  const classicV2 = await getClassicV2Snapshot();
  return {
    mode: "read-only" as const,
    accountMode: "CLASSIC_FALLBACK" as const,
    source: "bitget-classic-v2-fallback" as const,
    asOf: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    utaError: utaV3.assets,
    classicV2,
  };
}

export async function getBitgetPrivateReadOnlySnapshot() {
  const startedAt = Date.now();
  const secrets = requireSecrets();
  const utaV3 = await getUtaV3Snapshot();

  if (utaV3.assets.ok) {
    return {
      mode: "read-only" as const,
      accountMode: "UTA" as const,
      source: "bitget-private-uta-v3" as const,
      asOf: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      credentialShape: secrets.meta,
      utaV3,
    };
  }

  const classicV2 = await getClassicV2Snapshot();
  return {
    mode: "read-only" as const,
    accountMode: "CLASSIC_FALLBACK" as const,
    source: "bitget-private-auto-fallback" as const,
    asOf: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    credentialShape: secrets.meta,
    utaV3,
    classicV2,
  };
}
