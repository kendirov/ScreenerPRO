import { NextResponse } from "next/server";
const BASE = process.env.TQS_INTELLIGENCE_URL ?? "http://127.0.0.1:8787";
export async function GET(request: Request) {
  const u = new URL(request.url);
  const q = new URLSearchParams();
  for (const key of ["limit","asset_class","provider","min_score"]) {
    const v = u.searchParams.get(key); if (v) q.set(key, v);
  }
  try {
    const r = await fetch(`${BASE}/api/anomalies?${q}`, { cache: "no-store" });
    return NextResponse.json(await r.json(), { status: r.status, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }
}
