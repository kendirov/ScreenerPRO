import { NextResponse } from "next/server";
import { buildCorrelationLabSourcesResponse } from "@/lib/server/services/correlation-lab";

export async function GET() {
  return NextResponse.json(buildCorrelationLabSourcesResponse());
}
