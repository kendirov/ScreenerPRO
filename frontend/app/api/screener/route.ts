import { NextResponse } from "next/server";
import { getScreenerResponse } from "@/lib/server/services/moex-screener";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const assetClass = searchParams.get("assetClass") ?? "all";
  const normalized = assetClass === "stock" || assetClass === "future" || assetClass === "all" ? assetClass : "all";
  const payload = await getScreenerResponse(normalized);
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
