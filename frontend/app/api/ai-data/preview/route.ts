import { NextResponse } from "next/server";
import { getScreenerResponse } from "@/lib/server/services/moex-screener";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getScreenerResponse("stock");
  return NextResponse.json({ source: data.status.source, stale: Boolean(data.status.staleCache), generatedAt: data.status.generatedAt, covered: data.rows.length, missingHistory: data.rows.length }, { headers: { "Cache-Control": "no-store" } });
}
