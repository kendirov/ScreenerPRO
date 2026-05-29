import { NextResponse } from "next/server";
import { getScreenerHealth } from "@/lib/server/services/moex-screener";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const health = await getScreenerHealth();
  return NextResponse.json(health, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
