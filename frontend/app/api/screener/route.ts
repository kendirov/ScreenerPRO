import { NextResponse } from "next/server";
import { getScreenerDiagnostics, getScreenerRows } from "@/lib/server/services/screener-query";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const assetClass = searchParams.get("assetClass") ?? "all";
  const normalized = assetClass === "stock" || assetClass === "future" || assetClass === "all" ? assetClass : "all";
  const [rows, diagnostics] = await Promise.all([getScreenerRows(normalized), getScreenerDiagnostics()]);
  const emptyReason =
    rows.length > 0
      ? null
      : diagnostics.databaseConfigured
        ? diagnostics.marketSnapshotsCount === 0
          ? "db-empty-or-ingest-not-run"
          : "query-returned-empty"
        : "database-not-initialized";
  return NextResponse.json({ rows, assetClass: normalized, diagnostics, emptyReason });
}
