import { NextResponse } from "next/server";
import {
  parseWeeksPairParam,
  WEEKS_DEFAULT_COUNT,
  WEEKS_MAX_COUNT,
} from "@/lib/domain/currency-correlation-weeks";
import { INTRADAY_INTERVAL_OPTIONS } from "@/lib/domain/currency-correlation-intraday";
import type { SpreadAnchorMode } from "@/lib/domain/currency-spread-anchor";
import { buildCurrencyCorrelationWeeksResponse } from "@/lib/server/services/currency-correlation-weeks";

function parseInterval(raw: string | null): number {
  const n = Number(raw ?? 5);
  if (!Number.isFinite(n)) return 5;
  const allowed = INTRADAY_INTERVAL_OPTIONS as readonly number[];
  return allowed.includes(n) ? n : 5;
}

function parseWeeks(raw: string | null): number {
  const n = Number(raw ?? WEEKS_DEFAULT_COUNT);
  if (!Number.isFinite(n)) return WEEKS_DEFAULT_COUNT;
  return Math.min(Math.max(1, Math.trunc(n)), WEEKS_MAX_COUNT);
}

function parseAnchor(raw: string | null): SpreadAnchorMode {
  if (raw === "period-start" || raw === "day-open" || raw === "manual") return raw;
  return "week-open";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pairRaw = searchParams.get("pair") ?? "SI-ED";
  const pairKey = parseWeeksPairParam(pairRaw);

  if (!pairKey) {
    return NextResponse.json(
      { error: "Параметр pair: SI-CNY, SI-ED или CNY-ED" },
      { status: 400 },
    );
  }

  const interval = parseInterval(searchParams.get("interval"));
  const weeks = parseWeeks(searchParams.get("weeks"));
  const anchor = parseAnchor(searchParams.get("anchor"));

  try {
    const body = await buildCurrencyCorrelationWeeksResponse({
      pairKey,
      interval,
      weeksCount: weeks,
      anchor,
    });
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
