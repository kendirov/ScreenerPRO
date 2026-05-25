import { NextResponse } from "next/server";
import { saveManualNews } from "@/lib/server/services/event-reactions";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sourceId?: string | null;
      sourceUrl?: string | null;
      title?: string | null;
      text?: string;
      publishedAt?: string | null;
    };

    if (!body.text?.trim()) {
      return NextResponse.json({ error: "Текст новости обязателен" }, { status: 400 });
    }

    const news = await saveManualNews({
      sourceId: body.sourceId,
      sourceUrl: body.sourceUrl,
      title: body.title,
      text: body.text,
      publishedAt: body.publishedAt,
    });

    return NextResponse.json({ news, status: "saved" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
