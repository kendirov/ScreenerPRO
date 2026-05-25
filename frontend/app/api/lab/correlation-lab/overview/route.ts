import { NextResponse } from "next/server";
import { buildCorrelationLabOverviewResponse } from "@/lib/server/services/correlation-lab";

export async function GET() {
  try {
    const body = await buildCorrelationLabOverviewResponse();
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
