import { NextResponse } from "next/server";
import { buildPreparationEventsResponse } from "@/lib/server/services/events/events-provider-chain";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const body = await buildPreparationEventsResponse();
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        status: "error",
        loaded: false,
        updatedAt: new Date().toISOString(),
        providers: [],
        today: [],
        tomorrow: [],
        week: [],
        counts: { total: 0, high: 0, mediumShown: 0, lowHidden: 0 },
        source: "none",
        diagnostics: [message],
      },
      { status: 500 },
    );
  }
}
