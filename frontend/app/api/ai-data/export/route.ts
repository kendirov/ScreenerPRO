import { NextResponse } from "next/server";
import { aiDataOptionsSchema } from "@/lib/ai-data/contracts";
import { buildAiDataExport } from "@/lib/ai-data/ai-data-export";
import { getScreenerResponse } from "@/lib/server/services/moex-screener";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = aiDataOptionsSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Некорректные параметры экспорта", details: parsed.error.flatten() }, { status: 400 });
  const live = await getScreenerResponse("stock");
  if (live.status.isDemo) return NextResponse.json({ error: "AI Data не экспортирует demo-данные." }, { status: 503 });
  return NextResponse.json(buildAiDataExport(live, parsed.data), { headers: { "Cache-Control": "no-store" } });
}
