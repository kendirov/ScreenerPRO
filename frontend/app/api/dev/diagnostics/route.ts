import { NextResponse } from "next/server";
import { getScreenerDiagnostics } from "@/lib/server/services/moex-screener";

export async function GET() {
  const diagnostics = await getScreenerDiagnostics();
  return NextResponse.json(diagnostics);
}
