import { NextResponse } from "next/server";
import { moscowTodayKey } from "@/lib/domain/trading-calendar";
import { buildTradingStockMarketContext } from "@/lib/server/services/trading-stock-market-context";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawDate = searchParams.get("date")?.trim() ?? "";
  const requestedDateKey = DATE_KEY.test(rawDate) ? rawDate : moscowTodayKey();

  try {
    const body = await buildTradingStockMarketContext(requestedDateKey);
    return NextResponse.json(body, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
