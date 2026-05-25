import { NextResponse } from "next/server";
import { listFindings } from "@/lib/server/services/event-reactions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "30");
    const findings = await listFindings(Number.isFinite(limit) ? limit : 30);
    return NextResponse.json({ findings });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ findings: [], error: message }, { status: 200 });
  }
}
