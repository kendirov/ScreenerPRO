import { NextResponse } from "next/server";
import { isWeeklyInflationFetchSource } from "@/lib/domain/weekly-inflation-sources";
import { fetchWeeklyInflationExperimental } from "@/lib/server/services/weekly-inflation-sources";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sourceRaw = searchParams.get("source");
  const url = searchParams.get("url");
  const indicatorId = searchParams.get("indicatorId");

  if (!isWeeklyInflationFetchSource(sourceRaw)) {
    return NextResponse.json(
      {
        source: "rosstat",
        status: "error",
        updatedAt: new Date().toISOString(),
        points: [],
        diagnostics: {
          parsedPoints: 0,
          warnings: ["Параметр source должен быть rosstat или fedstat."],
        },
      },
      { status: 200 },
    );
  }

  try {
    const body = await fetchWeeklyInflationExperimental(sourceRaw, { url, indicatorId });
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        source: sourceRaw,
        status: "error",
        updatedAt: new Date().toISOString(),
        points: [],
        diagnostics: {
          url: url ?? undefined,
          parsedPoints: 0,
          warnings: [message, "Используйте ручной CSV."],
        },
      },
      { status: 200 },
    );
  }
}
