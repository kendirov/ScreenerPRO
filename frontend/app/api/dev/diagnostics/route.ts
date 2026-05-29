import { NextResponse } from "next/server";
import { getScreenerDiagnostics } from "@/lib/server/services/moex-screener";

export const dynamic = "force-dynamic";

export async function GET() {
  const diagnostics = await getScreenerDiagnostics();
  return NextResponse.json(diagnostics, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
