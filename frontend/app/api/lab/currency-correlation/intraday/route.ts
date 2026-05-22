import { NextResponse } from "next/server";
import { INTRADAY_INTERVAL_OPTIONS } from "@/lib/domain/currency-correlation-intraday";
import { buildCurrencyIntradayResponse } from "@/lib/server/services/currency-correlation-intraday";

function parseTickers(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean))];
}

function parseDays(raw: string | null): number {
  const n = Number(raw ?? 1);
  if (!Number.isFinite(n)) return 1;
  if (n <= 1) return 1;
  if (n <= 2) return 2;
  return 5;
}

function parseInterval(raw: string | null): number {
  const n = Number(raw ?? 5);
  if (!Number.isFinite(n)) return 5;
  const allowed = INTRADAY_INTERVAL_OPTIONS as readonly number[];
  return allowed.includes(n) ? n : 5;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickers = parseTickers(searchParams.get("tickers"));
  const days = parseDays(searchParams.get("days"));
  const interval = parseInterval(searchParams.get("interval"));
  const coverageSelect = searchParams.get("coverage") !== "0";

  if (!coverageSelect && !tickers.length) {
    return NextResponse.json({ error: "Укажите параметр tickers или coverage=1" }, { status: 400 });
  }

  try {
    const body = await buildCurrencyIntradayResponse({
      days,
      interval,
      tickers: tickers.length ? tickers : undefined,
      coverageSelect,
    });
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
