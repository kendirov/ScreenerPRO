import { ingestDailyBars, ingestSnapshots, syncUniverse } from "@/lib/server/services/moex-ingest";

async function run() {
  const universe = await syncUniverse();
  const snapshots = await ingestSnapshots();
  const bars = await ingestDailyBars(120);
  console.info("MOEX ingest completed", { universe, snapshots, bars });
}

run().catch((error) => {
  console.error("MOEX ingest failed", error);
  process.exit(1);
});
