import { NextResponse } from "next/server";
import { getScreenerRows } from "@/lib/server/services/screener-query";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const assetClass = searchParams.get("assetClass") ?? "all";
  const normalized = assetClass === "stock" || assetClass === "future" || assetClass === "all" ? assetClass : "all";
  const data = await getScreenerRows(normalized);
  return NextResponse.json({ rows: data, assetClass: normalized });
}
