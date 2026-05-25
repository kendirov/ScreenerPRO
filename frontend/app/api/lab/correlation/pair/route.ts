import { NextResponse } from "next/server";
import {
  isCorrelationApiFactorId,
  parseCorrelationInterval,
  parseCorrelationPeriod,
} from "@/lib/domain/correlation-api";
import { buildCorrelationPair } from "@/lib/server/services/correlation-api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stock = searchParams.get("stock")?.trim().toUpperCase();
  const factor = searchParams.get("factor")?.trim().toLowerCase();

  if (!stock) {
    return NextResponse.json({ error: "Укажите query-параметр stock=GAZP" }, { status: 400 });
  }

  if (!factor || !isCorrelationApiFactorId(factor)) {
    return NextResponse.json(
      { error: "Укажите factor=index|ruble|oil|gold|us|sector" },
      { status: 400 },
    );
  }

  const period = parseCorrelationPeriod(searchParams.get("period"));
  const interval = parseCorrelationInterval(searchParams.get("interval"), period);

  try {
    const body = await buildCorrelationPair(stock, factor, period, interval);
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
