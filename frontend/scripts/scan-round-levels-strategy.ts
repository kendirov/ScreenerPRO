import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildStrategyChartSeries } from "../lib/server/services/strategy-candles";
import { resolveStrategyCandleDateRange, type StrategyCandlePeriodId } from "../lib/screener/strategies/strategy-candle-range";
import { strategyCandlesWithDiagnosticsFromExpandedSeries, type StrategyTimeframeMinutes } from "../lib/screener/strategies/strategy-candles";
import { RoundLevelsStrategyRunner } from "../lib/strategies/round-levels-strategy-runner";
import type { StrategyRunInput, StrategyRunResult, StrategyScanSnapshot } from "../lib/strategies/strategy-runner-types";

const UNIVERSE = ["GAZP", "SBER", "VTBR", "ROSN", "LKOH", "T", "IRAO", "TRNFP", "SIBN", "NVTK"] as const;
const DEFAULT_TIMEFRAME: StrategyTimeframeMinutes = 5;
const DEFAULT_PERIOD: Exclude<StrategyCandlePeriodId, "today"> = "10d";
const CONCURRENCY = 3;
const RETRIES = 2;
const RETRY_DELAY_MS = 1500;
const BOARD = "TQBR";
const OUTPUT_PATH = path.resolve(process.cwd(), "public/strategy-runs/round-levels-stocks-5m-10d.json");

type ScanError = { secid: string; message: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetries<T>(label: string, task: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === RETRIES) break;
      console.warn(`[retry] ${label} attempt ${attempt + 1}/${RETRIES}`);
      await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastError;
}

function ensureFiniteMetrics(metrics: Record<string, number | string>): Record<string, number | string> {
  const sanitized: Record<string, number | string> = {};
  for (const [key, value] of Object.entries(metrics)) {
    if (typeof value === "number") {
      sanitized[key] = Number.isFinite(value) ? value : 0;
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

async function scanOne(secid: string, timeframe: StrategyTimeframeMinutes, period: Exclude<StrategyCandlePeriodId, "today">): Promise<StrategyRunResult> {
  const range = resolveStrategyCandleDateRange({ periodId: period });
  const response = await withRetries(`${secid} candles`, () =>
    buildStrategyChartSeries({
      secid,
      interval: timeframe,
      board: BOARD,
      from: range.from,
      till: range.till,
      periodId: period,
      maxCandles: 5000,
    }),
  );

  if (response.series.status !== "ok") {
    throw new Error(response.series.error ?? "series status is not ok");
  }

  const { candles } = strategyCandlesWithDiagnosticsFromExpandedSeries(response.series);
  if (candles.length === 0) {
    throw new Error("no normalized candles");
  }

  const input: StrategyRunInput = {
    secid,
    board: BOARD,
    assetClass: "stock",
    timeframe: `${timeframe}m`,
    period,
    candles,
  };

  const result = RoundLevelsStrategyRunner.run(input);
  return {
    ...result,
    score: Number.isFinite(result.score) ? Math.max(0, Math.min(100, result.score)) : 0,
    metrics: ensureFiniteMetrics(result.metrics),
  };
}

async function runPool<T>(items: readonly string[], worker: (item: string) => Promise<T>): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(items.length);
  let cursor = 0;

  async function consume(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index]!;
      try {
        results[index] = { status: "fulfilled", value: await worker(item) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => consume()));
  return results;
}

async function main(): Promise<void> {
  const timeframe = DEFAULT_TIMEFRAME;
  const period = DEFAULT_PERIOD;

  console.log(`[scan] strategy=${RoundLevelsStrategyRunner.id} universe=${UNIVERSE.length} tf=${timeframe}m period=${period}`);

  const settled = await runPool(UNIVERSE, async (secid) => {
    console.log(`[scan] loading ${secid}`);
    const result = await scanOne(secid, timeframe, period);
    console.log(`[scan] done ${secid} score=${result.score}`);
    return result;
  });

  const results: StrategyRunResult[] = [];
  const errors: ScanError[] = [];

  settled.forEach((entry, index) => {
    const secid = UNIVERSE[index]!;
    if (entry.status === "fulfilled") {
      results.push(entry.value);
      return;
    }
    const reason = entry.reason instanceof Error ? entry.reason.message : String(entry.reason);
    console.warn(`[scan] failed ${secid}: ${reason}`);
    errors.push({ secid, message: reason });
  });

  results.sort((a, b) => b.score - a.score || a.secid.localeCompare(b.secid));

  const snapshot: StrategyScanSnapshot = {
    generatedAt: new Date().toISOString(),
    strategyId: RoundLevelsStrategyRunner.id,
    assetClass: "stock",
    timeframe: `${timeframe}m`,
    period,
    universeCount: UNIVERSE.length,
    successCount: results.length,
    failedCount: errors.length,
    results,
    errors,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  console.log(`[scan] saved ${OUTPUT_PATH}`);
  console.log(`[scan] success=${snapshot.successCount} failed=${snapshot.failedCount}`);
  for (const top of results.slice(0, 5)) {
    console.log(`[scan] top ${top.secid} score=${top.score} badge=${top.badge}`);
  }
}

void main().catch((error) => {
  console.error("[scan] fatal", error);
  process.exit(1);
});
