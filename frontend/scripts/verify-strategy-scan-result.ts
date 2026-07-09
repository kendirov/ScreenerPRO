import { access, readFile } from "node:fs/promises";
import path from "node:path";

const TARGET = path.resolve(process.cwd(), "public/strategy-runs/round-levels-stocks-5m-10d.json");

function assert(label: string, condition: boolean): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`OK: ${label}`);
}

async function main(): Promise<void> {
  await access(TARGET);
  assert("JSON exists", true);

  const raw = await readFile(TARGET, "utf8");
  const parsed = JSON.parse(raw) as {
    generatedAt?: string;
    strategyId?: string;
    assetClass?: string;
    timeframe?: string;
    period?: string;
    universeCount?: number;
    successCount?: number;
    failedCount?: number;
    results?: Array<{
      strategyId?: string;
      secid?: string;
      board?: string;
      timeframe?: string;
      period?: string;
      score?: number;
      badge?: string;
      metrics?: Record<string, number | string>;
      updatedAt?: string;
    }>;
  };

  assert("results array exists", Array.isArray(parsed.results));
  const results = parsed.results ?? [];
  assert("generatedAt exists", typeof parsed.generatedAt === "string" && parsed.generatedAt.length > 0);
  assert("strategyId exists", parsed.strategyId === "round-levels");

  for (let index = 0; index < results.length; index += 1) {
    const result = results[index]!;
    assert(`result ${index} secid exists`, typeof result.secid === "string" && result.secid.length > 0);
    assert(`result ${index} board exists`, typeof result.board === "string" && result.board.length > 0);
    assert(`result ${index} timeframe exists`, typeof result.timeframe === "string" && result.timeframe.length > 0);
    assert(`result ${index} period exists`, typeof result.period === "string" && result.period.length > 0);
    assert(`result ${index} badge exists`, typeof result.badge === "string" && result.badge.length > 0);
    assert(`result ${index} updatedAt exists`, typeof result.updatedAt === "string" && result.updatedAt.length > 0);
    assert(`result ${index} metrics exists`, result.metrics != null && typeof result.metrics === "object");
    assert(`result ${index} score finite`, typeof result.score === "number" && Number.isFinite(result.score));
    assert(`result ${index} score range`, (result.score ?? -1) >= 0 && (result.score ?? 101) <= 100);

    if (index > 0) {
      assert(
        `results sorted desc ${index}`,
        (results[index - 1]?.score ?? -1) >= (result.score ?? -1),
      );
    }

    if (result.metrics) {
      for (const [key, value] of Object.entries(result.metrics)) {
        if (typeof value === "number") {
          assert(`metric ${result.secid}:${key} finite`, Number.isFinite(value));
        }
      }
    }
  }

  console.log("\nAll strategy scan result checks passed.");
}

void main().catch((error) => {
  console.error("FAIL: verify-strategy-scan-result", error);
  process.exit(1);
});
