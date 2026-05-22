import { NextResponse } from "next/server";
import { buildCurrencyHistoryResponse } from "@/lib/server/services/currency-correlation-history";

function parseTickers(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean))];
}

function parseDays(raw: string | null): number {
  const n = Number(raw ?? 60);
  if (!Number.isFinite(n)) return 60;
  return Math.min(120, Math.max(5, Math.trunc(n)));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickers = parseTickers(searchParams.get("tickers"));
  const days = parseDays(searchParams.get("days"));
  const interval = Number(searchParams.get("interval") ?? 24);
  const coverageSelect = searchParams.get("coverage") !== "0";

  if (interval !== 24) {
    return NextResponse.json(
      { error: "Поддерживается только interval=24 (дневные свечи MOEX ISS candles)" },
      { status: 400 },
    );
  }

  if (!coverageSelect && !tickers.length) {
    return NextResponse.json({ error: "Укажите параметр tickers или coverage=1" }, { status: 400 });
  }

  try {
    const body = await buildCurrencyHistoryResponse({
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
