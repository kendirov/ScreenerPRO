import { NextResponse } from "next/server";
const BASE = process.env.TQS_INTELLIGENCE_URL ?? "http://127.0.0.1:8787";
export async function GET() {
  try {
    const r = await fetch(`${BASE}/api/moex/intelligence`, { cache: "no-store" });
    return NextResponse.json(await r.json(), { status: r.status, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ rows: [], error: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }
}
