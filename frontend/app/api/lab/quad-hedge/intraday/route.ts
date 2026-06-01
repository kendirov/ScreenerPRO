import { NextResponse } from "next/server";
import {
  parseSpreadLabHistoryDepth,
  spreadLabFetchParams,
} from "@/lib/domain/quad-hedge/spread-lab-config";
import { buildQuadHedgeIntradayResponse } from "@/lib/server/services/quad-hedge-intraday";

function parseInterval(raw: string | null): number {
  const n = Number(raw ?? 5);
  if (!Number.isFinite(n)) return 5;
  const allowed = [1, 5, 10, 15, 60, 24] as const;
  return (allowed as readonly number[]).includes(n) ? n : 5;
}

function parseWindowScope(raw: string | null): "today" | "yesterday" | "pick" | "week" {
  if (raw === "today" || raw === "yesterday" || raw === "week") return raw;
  return "pick";
}

export const maxDuration = 120;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const historyDepth = parseSpreadLabHistoryDepth(searchParams.get("historyDepth"));
  const fetchParams = spreadLabFetchParams(historyDepth);
  const interval = parseInterval(searchParams.get("interval"));
  const windowScope = parseWindowScope(searchParams.get("windowScope"));

  try {
    const body = await buildQuadHedgeIntradayResponse({
      days: fetchParams.calendarDays,
      interval,
      windowScope,
      historyMode: fetchParams.historyMode,
      historyDepth,
    });
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
