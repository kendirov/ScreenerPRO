import { NextResponse } from "next/server";
import { listNewsSources } from "@/lib/server/services/event-reactions";

export async function GET() {
  try {
    const sources = await listNewsSources();
    return NextResponse.json({ sources });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ sources: [], error: message }, { status: 200 });
  }
}
