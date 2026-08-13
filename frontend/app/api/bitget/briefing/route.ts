import { NextResponse } from "next/server";
import { buildBitgetBriefing } from "@/lib/bitget/briefing-engine";
import { getBitgetGlobalScreener } from "@/lib/server/services/bitget-market";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    const snapshot = await getBitgetGlobalScreener();
    return NextResponse.json(buildBitgetBriefing(snapshot.rows, snapshot.status, started), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bitget briefing unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
