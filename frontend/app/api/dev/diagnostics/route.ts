import { NextResponse } from "next/server";
import { getBaselineAuditTop, getScreenerDiagnostics } from "@/lib/server/services/moex-screener";

export const dynamic = "force-dynamic";

export async function GET() {
  const diagnostics = await getScreenerDiagnostics();
  const isDev = process.env.NODE_ENV === "development";

  const payload: Record<string, unknown> = { ...diagnostics };

  if (isDev) {
    try {
      payload.baselineAudit = await getBaselineAuditTop(20);
      payload.baselineAuditNote =
        "volumeRatioNow = currentTurnover / avgCumulativeTurnoverAtCurrentTime (top-35 MOEX 10m). turnoverVsAverage = current / full daily avg (отдельно, не Vol x). Trades x только при intraday-истории сделок (сейчас нет).";
    } catch (error) {
      payload.baselineAuditError = error instanceof Error ? error.message : String(error);
    }
  }

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
