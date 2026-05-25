import { NextResponse } from "next/server";
import {
  isCorrelationApiFactorId,
  parseCorrelationInterval,
  parseCorrelationPeriod,
} from "@/lib/domain/correlation-api";
import { buildCorrelationFactorDetail } from "@/lib/server/services/correlation-api";

export async function GET(
  request: Request,
  context: { params: Promise<{ factorId: string }> },
) {
  const { factorId } = await context.params;
  const { searchParams } = new URL(request.url);
  const period = parseCorrelationPeriod(searchParams.get("period"));
  const interval = parseCorrelationInterval(searchParams.get("interval"), period);

  if (!isCorrelationApiFactorId(factorId)) {
    return NextResponse.json({ error: `Неизвестный фактор: ${factorId}` }, { status: 400 });
  }

  try {
    const body = await buildCorrelationFactorDetail(factorId, period, interval);
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
