import { NextResponse } from "next/server";
import {
  parseCorrelationInterval,
  parseCorrelationPeriod,
} from "@/lib/domain/correlation-api";
import { buildCorrelationOverview } from "@/lib/server/services/correlation-api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = parseCorrelationPeriod(searchParams.get("period"));
  const interval = parseCorrelationInterval(searchParams.get("interval"), period);

  try {
    const body = await buildCorrelationOverview(period, interval);
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
