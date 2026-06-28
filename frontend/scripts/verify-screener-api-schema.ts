import { screenerApiResponseSchema } from "@screenerpro/shared";

async function main() {
  const base = process.argv[2] ?? "https://screenerpro.vercel.app";
  const url = `${base}/api/screener?assetClass=stock`;
  const res = await fetch(url);
  const payload = await res.json();
  const parsed = screenerApiResponseSchema.safeParse(payload);
  if (!parsed.success) {
    console.error("SCHEMA FAIL", parsed.error.issues.slice(0, 10));
    process.exit(1);
  }
  console.log("OK", res.status, parsed.data.rows.length, parsed.data.status.source);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
