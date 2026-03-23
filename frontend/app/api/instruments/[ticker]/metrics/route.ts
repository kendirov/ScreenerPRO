import { NextResponse } from "next/server";
import { getInstrumentDetail } from "@/lib/server/services/screener-query";

export async function GET(_request: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const detail = await getInstrumentDetail(ticker);
  if (!detail) return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
  return NextResponse.json({ ticker: detail.ticker, metrics: detail.metrics });
}
