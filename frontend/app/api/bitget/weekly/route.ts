import { NextRequest, NextResponse } from "next/server";

const BITGET_API = "https://api.bitget.com";
const ALLOWED = new Set(["SPOT", "MARGIN", "USDT-FUTURES", "USDC-FUTURES", "COIN-FUTURES"]);

type Item = { category: string; symbol: string };

type CandleRow = [string, string, string, string, string, string, string];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseItems(raw: string | null): Item[] {
  if (!raw) return [];
  const unique = new Map<string, Item>();
  for (const token of raw.split(",")) {
    const [category, symbol] = token.trim().split(":");
    if (!category || !symbol || !ALLOWED.has(category)) continue;
    const safeSymbol = symbol.replace(/[^A-Za-z0-9_-]/g, "").toUpperCase();
    if (!safeSymbol) continue;
    unique.set(`${category}:${safeSymbol}`, { category, symbol: safeSymbol });
  }
  return Array.from(unique.values()).slice(0, 60);
}

async function loadWeekly(item: Item) {
  const candleCategory = item.category === "MARGIN" ? "SPOT" : item.category;
  const url = `${BITGET_API}/api/v3/market/candles?category=${encodeURIComponent(candleCategory)}&symbol=${encodeURIComponent(item.symbol)}&interval=1D&type=market&limit=8`;
  const response = await fetch(url, {
    next: { revalidate: 900 },
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { code?: string; data?: unknown };
  if (payload.code !== "00000" || !Array.isArray(payload.data)) return null;

  const candles = payload.data
    .filter((row): row is CandleRow => Array.isArray(row) && row.length >= 7)
    .slice()
    .sort((a, b) => Number(a[0]) - Number(b[0]));

  if (candles.length < 2) return null;
  const firstOpen = Number(candles[0][1]);
  const lastClose = Number(candles[candles.length - 1][4]);
  const highs = candles.map((row) => Number(row[2])).filter(Number.isFinite);
  const lows = candles.map((row) => Number(row[3])).filter(Number.isFinite);
  if (!Number.isFinite(firstOpen) || firstOpen <= 0 || !Number.isFinite(lastClose) || lastClose <= 0) return null;

  const change7dPct = ((lastClose / firstOpen) - 1) * 100;
  const high = highs.length ? Math.max(...highs) : null;
  const low = lows.length ? Math.min(...lows) : null;
  const range7dPct = high != null && low != null ? ((high - low) / lastClose) * 100 : null;

  return {
    id: `${item.category}:${item.symbol}`,
    change7dPct,
    range7dPct,
    candleCount: candles.length,
  };
}

async function mapWithConcurrency<T, R>(items: T[], workers: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      output[index] = await fn(items[index]);
      await sleep(360);
    }
  }
  await Promise.all(Array.from({ length: Math.min(workers, items.length) }, () => worker()));
  return output;
}

export async function GET(request: NextRequest) {
  const items = parseItems(request.nextUrl.searchParams.get("items"));
  if (!items.length) return NextResponse.json({ metrics: [] });

  const metrics = (await mapWithConcurrency(items, 6, loadWeekly)).filter(Boolean);
  return NextResponse.json(
    { metrics },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } },
  );
}
