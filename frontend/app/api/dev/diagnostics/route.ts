import { NextResponse } from "next/server";
import { getScreenerDiagnostics } from "@/lib/server/services/screener-query";

export async function GET() {
  const diagnostics = await getScreenerDiagnostics();
  return NextResponse.json(diagnostics);
}
