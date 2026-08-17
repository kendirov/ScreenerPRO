import { NextResponse } from "next/server";
import { buildTradingFuturesActivity } from "@/lib/server/services/trading-futures-activity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secids = (searchParams.get("secids") ?? "").split(",");
  if (!secids.some((secid) => secid.trim())) {
    return NextResponse.json({ error: "Укажите secids" }, { status: 400 });
  }
  return NextResponse.json(await buildTradingFuturesActivity(secids), {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
