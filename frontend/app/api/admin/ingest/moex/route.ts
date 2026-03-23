import { NextResponse } from "next/server";
import { ingestDailyBars, ingestSnapshots, syncUniverse } from "@/lib/server/services/moex-ingest";

export async function POST() {
  const universe = await syncUniverse();
  const snapshots = await ingestSnapshots();
  const history = await ingestDailyBars(120);
  return NextResponse.json({
    ok: true,
    universe,
    snapshots,
    history,
  });
}
