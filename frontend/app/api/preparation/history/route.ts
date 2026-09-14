import { NextResponse } from "next/server";
import { findExternalAsset } from "@/lib/server/services/external-assets-registry";
import { fetchExternalAssetHistory } from "@/lib/server/services/external-market-provider";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const asset = findExternalAsset(params.get("id") ?? "");
  const timeframe = params.get("timeframe");
  const range = timeframe === "1D" ? "1d" : timeframe === "5D" ? "5d" : "1mo";
  if (!asset?.active) return NextResponse.json({ error: "Инструмент не найден" }, { status: 404 });
  const result = await fetchExternalAssetHistory(asset, range);
  return NextResponse.json({ status: result.candles.length ? "ok" : "no-data", source: "Yahoo Finance chart", timeframe: timeframe ?? "1M", ...result, fetchedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
