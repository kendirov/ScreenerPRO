import { NextResponse } from "next/server";
import { listRawNewsItems } from "@/lib/server/services/event-reactions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "20");
    const news = await listRawNewsItems(Number.isFinite(limit) ? limit : 20);
    return NextResponse.json({ news });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ news: [], error: message }, { status: 200 });
  }
}
