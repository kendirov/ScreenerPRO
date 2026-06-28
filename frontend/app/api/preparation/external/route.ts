import { NextResponse } from "next/server";
import { buildExternalMarketResponse } from "@/lib/server/services/external-market-scanner";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const body = await buildExternalMarketResponse();
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        status: "error",
        updatedAt: new Date().toISOString(),
        summary: { tone: "calm", line: "Ошибка загрузки", moversCount: 0 },
        groups: [],
        allAssetsCount: 0,
        activeAssetsCount: 0,
        disabledAssetsCount: 0,
        criticalAssetsCount: 0,
        criticalSuccessRate: 0,
        moversCount: 0,
        errors: [message],
        diagnostics: [],
        assetDiagnostics: [],
      },
      { status: 500 },
    );
  }
}
