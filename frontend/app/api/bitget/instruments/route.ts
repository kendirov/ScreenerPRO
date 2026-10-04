import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BITGET = "https://api.bitget.com";
const MARKETS = ["SPOT", "USDT-FUTURES", "USDC-FUTURES", "COIN-FUTURES"] as const;

type JsonRecord = Record<string, unknown>;

function asArray(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object");
  if (value && typeof value === "object") {
    const record = value as JsonRecord;
    for (const key of ["list", "data", "symbols", "instruments"]) {
      if (Array.isArray(record[key])) return asArray(record[key]);
    }
  }
  return [];
}

function pick(record: JsonRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return null;
}

function num(record: JsonRecord, ...keys: string[]): number | null {
  const value = pick(record, ...keys);
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getJson(path: string) {
  const response = await fetch(`${BITGET}${path}`, {
    headers: { accept: "application/json", "user-agent": "ScreenerPRO/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const json = (await response.json()) as JsonRecord;
  const code = pick(json, "code");
  if (code && code !== "00000" && code !== "0") throw new Error(pick(json, "msg", "message") ?? code);
  return json.data ?? json;
}

async function fetchV3(marketType: string) {
  const [instrumentsRaw, tickersRaw] = await Promise.all([
    getJson(`/api/v3/market/instruments?category=${encodeURIComponent(marketType)}`),
    getJson(`/api/v3/market/tickers?category=${encodeURIComponent(marketType)}`),
  ]);
  return { instruments: asArray(instrumentsRaw), tickers: asArray(tickersRaw), source: "v3" };
}

async function fetchV2(marketType: string) {
  if (marketType === "SPOT") {
    const [instrumentsRaw, tickersRaw] = await Promise.all([
      getJson("/api/v2/spot/public/symbols"),
      getJson("/api/v2/spot/market/tickers"),
    ]);
    return { instruments: asArray(instrumentsRaw), tickers: asArray(tickersRaw), source: "v2" };
  }

  const productType = marketType === "USDT-FUTURES" ? "USDT-FUTURES" : marketType === "USDC-FUTURES" ? "USDC-FUTURES" : "COIN-FUTURES";
  const [instrumentsRaw, tickersRaw] = await Promise.all([
    getJson(`/api/v2/mix/market/contracts?productType=${productType}`),
    getJson(`/api/v2/mix/market/tickers?productType=${productType}`),
  ]);
  return { instruments: asArray(instrumentsRaw), tickers: asArray(tickersRaw), source: "v2" };
}

function normalize(market: string, instrument: JsonRecord, ticker?: JsonRecord) {
  const symbol = pick(instrument, "symbol", "instId") ?? pick(ticker ?? {}, "symbol", "instId") ?? "UNKNOWN";
  const last = num(ticker ?? {}, "lastPr", "last", "lastPrice", "close");
  const open24h = num(ticker ?? {}, "open24h", "openUtc", "open");
  let change24h = num(ticker ?? {}, "change24h", "changeUtc24h", "priceChangePercent");
  if (change24h !== null && Math.abs(change24h) <= 1.5) change24h *= 100;
  if (change24h === null && last !== null && open24h) change24h = ((last - open24h) / open24h) * 100;

  const quoteVolume = num(ticker ?? {}, "quoteVolume", "quoteVolume24h", "usdtVolume", "turnover24h");
  const baseVolume = num(ticker ?? {}, "baseVolume", "baseVolume24h", "volume24h");
  const bid = num(ticker ?? {}, "bidPr", "bidPrice", "bestBid");
  const ask = num(ticker ?? {}, "askPr", "askPrice", "bestAsk");
  const spreadBps = bid && ask && bid > 0 ? ((ask - bid) / ((ask + bid) / 2)) * 10_000 : null;
  const oi = num(ticker ?? {}, "holdingAmount", "openInterest", "openInterestUsd");
  const funding = num(ticker ?? {}, "fundingRate", "currentFundingRate");
  const high24h = num(ticker ?? {}, "high24h", "high");
  const low24h = num(ticker ?? {}, "low24h", "low");
  const range24h = high24h && low24h && low24h > 0 ? ((high24h - low24h) / low24h) * 100 : null;
  const activityScore = Math.min(
    100,
    Math.round(
      (quoteVolume ? Math.min(50, Math.log10(Math.max(quoteVolume, 1)) * 6) : 0) +
        Math.min(25, Math.abs(change24h ?? 0) * 2.5) +
        Math.min(15, (range24h ?? 0) * 1.5) +
        (spreadBps !== null ? Math.max(0, 10 - spreadBps) : 0),
    ),
  );

  return {
    symbol,
    market,
    baseCoin: pick(instrument, "baseCoin", "baseCurrency", "baseCcy") ?? symbol.replace(/USDT|USDC|USD|PERP/g, ""),
    quoteCoin: pick(instrument, "quoteCoin", "quoteCurrency", "quoteCcy") ?? (symbol.includes("USDC") ? "USDC" : "USDT"),
    status: pick(instrument, "status", "symbolStatus", "state") ?? "unknown",
    contractType: pick(instrument, "contractType", "symbolType", "type"),
    maxLeverage: num(instrument, "maxLever", "maxLeverage", "leverage"),
    launchTime: num(instrument, "launchTime", "listTime", "onlineTime"),
    pricePlace: num(instrument, "pricePlace", "pricePrecision", "priceScale"),
    quantityPlace: num(instrument, "quantityPlace", "quantityPrecision", "volumePlace"),
    minOrder: num(instrument, "minTradeAmount", "minTradeNum", "minOrderAmount", "minTradeUSDT"),
    last,
    change24h,
    high24h,
    low24h,
    range24h,
    baseVolume,
    quoteVolume,
    bid,
    ask,
    spreadBps,
    openInterest: oi,
    fundingRate: funding,
    activityScore,
  };
}

export async function GET() {
  const startedAt = Date.now();
  const results = await Promise.all(
    MARKETS.map(async (market) => {
      try {
        let payload;
        try {
          payload = await fetchV3(market);
        } catch {
          payload = await fetchV2(market);
        }
        const tickerMap = new Map(payload.tickers.map((item) => [pick(item, "symbol", "instId"), item]));
        const rows = payload.instruments.map((instrument) => normalize(market, instrument, tickerMap.get(pick(instrument, "symbol", "instId"))));
        return { market, rows, source: payload.source, error: null };
      } catch (error) {
        return { market, rows: [], source: null, error: error instanceof Error ? error.message : "unknown error" };
      }
    }),
  );

  const rows = results.flatMap((item) => item.rows);
  return NextResponse.json(
    {
      rows,
      meta: {
        total: rows.length,
        markets: results.map(({ market, rows: marketRows, source, error }) => ({ market, count: marketRows.length, source, error })),
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
