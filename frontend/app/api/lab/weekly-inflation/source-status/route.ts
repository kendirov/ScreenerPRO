import { NextResponse } from "next/server";
import { getWeeklyInflationSourceStatus } from "@/lib/server/services/weekly-inflation-sources";

export async function GET() {
  try {
    const body = getWeeklyInflationSourceStatus();
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        updatedAt: new Date().toISOString(),
        adapters: [],
        warnings: [`Не удалось собрать статус адаптеров: ${message}`],
      },
      { status: 200 },
    );
  }
}
