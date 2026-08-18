import { NextResponse } from "next/server";
import {
  BitgetPrivateConfigError,
  getBitgetPrivateReadOnlySnapshot,
} from "@/lib/server/services/bitget-private";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json(
      {
        ok: false,
        error: "BITGET_PRIVATE_PREVIEW_ONLY",
      },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const snapshot = await getBitgetPrivateReadOnlySnapshot();
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof BitgetPrivateConfigError) {
      return NextResponse.json(
        {
          ok: false,
          error: "BITGET_PRIVATE_NOT_CONFIGURED",
          missing: error.missing,
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Bitget private account unavailable",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
