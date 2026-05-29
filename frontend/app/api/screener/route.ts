import { NextResponse } from "next/server";
import {
  buildUnavailableScreenerResponse,
  getScreenerResponse,
  ScreenerUnavailableError,
} from "@/lib/server/services/moex-screener";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const assetClass = searchParams.get("assetClass") ?? "all";
  const normalized = assetClass === "stock" || assetClass === "future" || assetClass === "all" ? assetClass : "all";

  try {
    const payload = await getScreenerResponse(normalized);
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ScreenerUnavailableError) {
      const payload = buildUnavailableScreenerResponse(normalized, error.reason, error.message);
      return NextResponse.json(payload, {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }
    throw error;
  }
}
