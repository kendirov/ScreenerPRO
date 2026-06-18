import { NextResponse } from "next/server";
import { buildIntradaySparklineHover } from "@/lib/server/services/stock-screener-candles";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = (searchParams.get("ticker") ?? "").trim().toUpperCase();
  const sessions = searchParams.get("sessions");

  if (!ticker) {
    return NextResponse.json({ error: "Укажите ticker=SBER" }, { status: 400 });
  }

  if (sessions != null && sessions !== "2") {
    return NextResponse.json({ error: "Поддерживается только sessions=2" }, { status: 400 });
  }

  try {
    const body = await buildIntradaySparklineHover(ticker);
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
