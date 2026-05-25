import { NextResponse } from "next/server";
import type { SmartLabCalendarMode, SmartLabCalendarType } from "@/lib/domain/smartlab-calendar";
import { fetchSmartLabCalendarResponse } from "@/lib/server/services/smartlab-calendar";

function parseMode(raw: string | null): SmartLabCalendarMode {
  return raw === "week" ? "week" : "day";
}

function parseType(raw: string | null): SmartLabCalendarType {
  if (raw === "stocks" || raw === "dividends" || raw === "macro" || raw === "all") return raw;
  return "all";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = parseMode(searchParams.get("mode"));
  const type = parseType(searchParams.get("type"));

  try {
    const body = await fetchSmartLabCalendarResponse(mode, type);
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        source: "Smart-Lab",
        updatedAt: new Date().toISOString(),
        status: "error",
        events: [],
        diagnostics: {
          fetchedUrl: "https://smart-lab.ru/calendar/",
          parsedEvents: 0,
          warning: message,
        },
      },
      { status: 200 },
    );
  }
}
