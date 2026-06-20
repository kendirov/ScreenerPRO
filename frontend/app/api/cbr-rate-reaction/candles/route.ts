import { NextResponse } from "next/server";
import type { CbrFuturesAssetCode } from "@/lib/domain/cbr-rate-instrument-config";
import {
  fetchMoexCandlesForEvent,
  type CbrCandleInterval,
} from "@/lib/server/services/cbr-rate-reaction-candles";

const ALLOWED_INTERVALS = new Set<CbrCandleInterval>([1, 5, 15, 60]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseInterval(raw: string | null): CbrCandleInterval | null {
  const n = Number(raw ?? 1);
  if (!ALLOWED_INTERVALS.has(n as CbrCandleInterval)) return null;
  return n as CbrCandleInterval;
}

function parseBool(raw: string | null): boolean {
  return raw === "1" || raw === "true" || raw === "yes";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const ticker = searchParams.get("ticker")?.trim().toUpperCase() ?? "";
  const engine = searchParams.get("engine")?.trim().toLowerCase() ?? "";
  const market = searchParams.get("market")?.trim().toLowerCase() ?? "";
  const board = searchParams.get("board")?.trim().toUpperCase() || undefined;
  const date = searchParams.get("date")?.trim() ?? "";
  const interval = parseInterval(searchParams.get("interval"));
  const allowFallback = parseBool(searchParams.get("allowFallback"));
  const assetCode = searchParams.get("assetCode")?.trim() as CbrFuturesAssetCode | undefined;
  const currencyKey = searchParams.get("currencyKey")?.trim() as
    | import("@/lib/domain/cbr-currency-instrument").CurrencyInstrumentKey
    | undefined;

  if (!ticker) {
    return NextResponse.json({ error: "Укажите ticker" }, { status: 400 });
  }
  if (engine !== "stock" && engine !== "futures") {
    return NextResponse.json({ error: "engine должен быть stock или futures" }, { status: 400 });
  }
  if (!market) {
    return NextResponse.json({ error: "Укажите market" }, { status: 400 });
  }
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "date должен быть YYYY-MM-DD" }, { status: 400 });
  }
  if (!interval) {
    return NextResponse.json({ error: "interval: 1 | 5 | 15 | 60" }, { status: 400 });
  }

  try {
    const body = await fetchMoexCandlesForEvent({
      ticker,
      engine,
      market,
      board,
      date,
      interval,
      assetCode,
      currencyKey,
      allowFallback,
    });

    return NextResponse.json(body, {
      status: body.dataStatus === "error" && !allowFallback ? 200 : 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        ticker,
        resolvedTicker: ticker,
        engine,
        market,
        board: board ?? null,
        date,
        interval,
        dataStatus: allowFallback ? "fallback" : "error",
        source: "none",
        candles: [],
        error: message,
      },
      { status: 200 },
    );
  }
}
