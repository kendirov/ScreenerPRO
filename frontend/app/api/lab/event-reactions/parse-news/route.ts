import { NextResponse } from "next/server";
import { parseNewsItem } from "@/lib/server/services/event-reactions";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { rawNewsItemId?: string };
    if (!body.rawNewsItemId) {
      return NextResponse.json({ error: "rawNewsItemId обязателен" }, { status: 400 });
    }

    const result = await parseNewsItem(body.rawNewsItemId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
