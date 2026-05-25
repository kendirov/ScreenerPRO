import { NextResponse } from "next/server";
import { listMarketEvents } from "@/lib/server/services/event-reactions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "20");
    const events = await listMarketEvents(Number.isFinite(limit) ? limit : 20);
    return NextResponse.json({ events });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ events: [], error: message }, { status: 200 });
  }
}
