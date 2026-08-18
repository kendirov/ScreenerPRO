import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const preferredRegion = "fra1";

const SOURCES = {
  binance: "https://fapi.binance.com/fapi/v1/ticker/24hr",
  bybit: "https://api.bybit.com/v5/market/tickers?category=linear",
  okx: "https://www.okx.com/api/v5/market/tickers?instType=SWAP",
  bitget: "https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES",
} as const;

async function probe(name: keyof typeof SOURCES, url: string) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        "user-agent": "ScreenerPRO/crypto-radar",
      },
      signal: AbortSignal.timeout(12_000),
    });
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    let count: number | null = null;
    if (name === "binance" && Array.isArray(parsed)) count = parsed.length;
    if (name === "bybit") {
      const list = (parsed as { result?: { list?: unknown[] } } | null)?.result?.list;
      if (Array.isArray(list)) count = list.length;
    }
    if (name === "okx") {
      const data = (parsed as { data?: unknown[] } | null)?.data;
      if (Array.isArray(data)) count = data.length;
    }
    if (name === "bitget") {
      const data = (parsed as { data?: unknown[] } | null)?.data;
      if (Array.isArray(data)) count = data.length;
    }

    return {
      ok: response.ok,
      status: response.status,
      count,
      latencyMs: Date.now() - started,
      sample: response.ok ? null : text.slice(0, 240),
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      count: null,
      latencyMs: Date.now() - started,
      sample: error instanceof Error ? error.message : "request failed",
    };
  }
}

export async function GET() {
  const entries = await Promise.all(
    Object.entries(SOURCES).map(async ([name, url]) => [name, await probe(name as keyof typeof SOURCES, url)] as const),
  );

  return NextResponse.json(
    {
      asOf: new Date().toISOString(),
      intendedRuntime: "edge",
      intendedRegion: "fra1",
      sources: Object.fromEntries(entries),
    },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );
}
