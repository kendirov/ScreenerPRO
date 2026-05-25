import { NextResponse } from "next/server";
import { analyzeEventReactions } from "@/lib/server/services/event-reactions";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { eventId?: string };
    if (!body.eventId) {
      return NextResponse.json({ error: "eventId обязателен" }, { status: 400 });
    }

    const result = await analyzeEventReactions(body.eventId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
