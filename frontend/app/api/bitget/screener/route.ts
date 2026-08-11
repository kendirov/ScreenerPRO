import { NextResponse } from "next/server";
import { getBitgetGlobalScreener } from "@/lib/server/services/bitget-market";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await getBitgetGlobalScreener();
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "BITGET_SCREENER_UNAVAILABLE",
        message: error instanceof Error ? error.message : "Не удалось загрузить Bitget",
      },
      { status: 502 },
    );
  }
}
