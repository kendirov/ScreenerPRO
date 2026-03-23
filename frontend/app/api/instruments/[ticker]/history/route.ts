import { NextResponse } from "next/server";
import { getInstrumentHistory } from "@/lib/server/services/screener-query";

export async function GET(request: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 120);
  const bars = await getInstrumentHistory(ticker, Number.isFinite(limit) ? limit : 120);
  return NextResponse.json({ ticker: ticker.toUpperCase(), bars });
}
