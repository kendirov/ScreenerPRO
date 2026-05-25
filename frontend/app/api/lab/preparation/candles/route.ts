import { NextResponse } from "next/server";
import type { PreparationInstrumentMarket } from "@/lib/domain/preparation-watchlist";
import { buildPreparationCandlesResponse } from "@/lib/server/services/preparation-candles";

function parseDays(raw: string | null): number {
  const n = Number(raw ?? 5);
  if (!Number.isFinite(n)) return 5;
  return Math.min(10, Math.max(3, Math.trunc(n)));
}

function parseItems(raw: string | null): Array<{ secid: string; market: PreparationInstrumentMarket }> {
  if (!raw?.trim()) return [];

  return raw
    .split(",")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [secid, marketRaw] = chunk.split(":");
      const market = (marketRaw ?? "moex-stock") as PreparationInstrumentMarket;
      return { secid: secid!.trim().toUpperCase(), market };
    })
    .filter((item) => item.secid.length > 0);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseDays(searchParams.get("days"));
  const interval = Number(searchParams.get("interval") ?? 24);
  const items = parseItems(searchParams.get("items"));

  if (interval !== 24 && interval !== 60) {
    return NextResponse.json(
      { error: "Поддерживаются interval=24 (дневные) или interval=60 (пока как 24)" },
      { status: 400 },
    );
  }

  if (!items.length) {
    return NextResponse.json({ error: "Укажите параметр items=SECID:market,..." }, { status: 400 });
  }

  try {
    const body = await buildPreparationCandlesResponse(items, days);
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
