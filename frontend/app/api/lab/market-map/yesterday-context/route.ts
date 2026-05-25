import { NextResponse } from "next/server";
import { buildMarketMapYesterdayResponse } from "@/lib/server/services/market-map-yesterday";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers") ?? "";
  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  try {
    const payload = await buildMarketMapYesterdayResponse(tickers);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить контекст вчера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
