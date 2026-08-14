import type { ScreenerBenchmark } from "@screenerpro/shared";
import { fetchIssJson } from "@/lib/server/moex-iss/http";
import { moexIssPayloadSchema } from "@/lib/server/moex-iss/schemas";
import { shiftCalendarDaysKey } from "@/lib/domain/trading-calendar";
import { indexHistoryUrl } from "@/lib/server/integrations/moex/endpoints";
import { mapHistoryBars } from "@/lib/server/integrations/moex/mappers";
import { moexGetJson } from "@/lib/server/integrations/moex/client";
import { moexPayloadSchema } from "@/lib/server/integrations/moex/validators";

export const MOEX_INDEX_SECIDS = ["IMOEX2", "IMOEX"] as const;

const DISPLAY_NAME = "Индекс МосБиржи";

type TableRow = Record<string, unknown>;

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function rowToObject(columns: string[], row: unknown[]): TableRow {
  return Object.fromEntries(columns.map((column, idx) => [column, row[idx]]));
}

function pickRangeDenominator(previousClose: number | null, high: number | null, low: number | null): number | null {
  if (previousClose !== null && previousClose > 0) return previousClose;
  const fallback = Math.max(high ?? 0, low ?? 0);
  return fallback > 0 ? fallback : null;
}

function computeDayRangePct(high: number | null, low: number | null, denominator: number | null): number | null {
  if (high === null || low === null) return null;
  if (denominator === null || denominator <= 0) return null;
  return ((high - low) / denominator) * 100;
}

function computePercentChange(
  lastValue: number | null,
  previousClose: number | null,
  moexPercent: number | null,
): number | null {
  if (moexPercent !== null) return moexPercent;
  if (lastValue === null || previousClose === null || previousClose === 0) return null;
  return ((lastValue - previousClose) / previousClose) * 100;
}

function buildBenchmark(input: {
  code: string;
  lastValue: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  percentChange: number | null;
  dayRangePct: number | null;
  updatedAt: string;
  sourceUpdatedAt: string | null;
  aggregateTurnover?: number | null;
  aggregateTrades?: number | null;
}): ScreenerBenchmark {
  const absoluteChange =
    input.lastValue !== null && input.previousClose !== null ? input.lastValue - input.previousClose : null;

  return {
    code: input.code,
    name: DISPLAY_NAME,
    market: "stock",
    lastValue: input.lastValue,
    percentChange: input.percentChange,
    dayRangePct: input.dayRangePct,
    aggregateTurnover: input.aggregateTurnover ?? null,
    aggregateTrades: input.aggregateTrades ?? null,
    updatedAt: input.updatedAt,
    sourceUpdatedAt: input.sourceUpdatedAt,
    open: input.open,
    high: input.high,
    low: input.low,
    previousClose: input.previousClose,
    absoluteChange,
  };
}

/** Live IMOEX2 / IMOEX через MOEX ISS marketdata. */
async function fetchLiveMoexIndexBenchmarkBySecid(
  secid: (typeof MOEX_INDEX_SECIDS)[number],
  nowIso: string,
  aggregates?: { aggregateTurnover: number | null; aggregateTrades: number | null },
): Promise<ScreenerBenchmark | null> {
  try {
    const payload = moexIssPayloadSchema.parse(
      await fetchIssJson(
        `/engines/stock/markets/index/securities/${secid}.json?iss.meta=off&iss.only=securities,marketdata&securities.columns=SECID,SHORTNAME&marketdata.columns=SECID,CURRENTVALUE,LASTVALUE,OPENVALUE,LASTCHANGE,LASTCHANGEPRC,LASTCHANGEBP,PREVPRICE,OPEN,HIGH,LOW`,
      ),
    );

    if (payload.securities.data.length === 0 || payload.marketdata.data.length === 0) return null;

    const sec = rowToObject(payload.securities.columns, payload.securities.data[0] ?? []);
    const md = rowToObject(payload.marketdata.columns, payload.marketdata.data[0] ?? []);

    const lastValue = asNumber(md.CURRENTVALUE) ?? asNumber(md.LASTVALUE);
    const lastChange = asNumber(md.LASTCHANGE);
    const previousClose =
      asNumber(md.PREVPRICE) ??
      (lastValue !== null && lastChange !== null ? lastValue - lastChange : null);
    const open = asNumber(md.OPEN) ?? asNumber(md.OPENVALUE);
    const high = asNumber(md.HIGH);
    const low = asNumber(md.LOW);
    const moexChangePct = asNumber(md.LASTCHANGEPRC);

    if (lastValue === null && high === null && low === null) return null;

    const denominator = pickRangeDenominator(previousClose ?? open, high, low);
    return buildBenchmark({
      code: asString(sec.SECID) ?? secid,
      lastValue,
      open,
      high,
      low,
      previousClose,
      percentChange: computePercentChange(lastValue, previousClose, moexChangePct),
      dayRangePct: computeDayRangePct(high, low, denominator),
      updatedAt: nowIso,
      sourceUpdatedAt: null,
      aggregateTurnover: aggregates?.aggregateTurnover,
      aggregateTrades: aggregates?.aggregateTrades,
    });
  } catch {
    return null;
  }
}

export async function fetchLiveMoexIndexBenchmarks(
  nowIso: string,
  aggregates?: { aggregateTurnover: number | null; aggregateTrades: number | null },
): Promise<ScreenerBenchmark[]> {
  const settled = await Promise.all(
    MOEX_INDEX_SECIDS.map((secid) => fetchLiveMoexIndexBenchmarkBySecid(secid, nowIso, aggregates)),
  );
  return settled.filter((item): item is ScreenerBenchmark => item !== null);
}

export async function fetchLiveMoexIndexBenchmark(
  nowIso: string,
  aggregates?: { aggregateTurnover: number | null; aggregateTrades: number | null },
): Promise<ScreenerBenchmark | null> {
  const benchmarks = await fetchLiveMoexIndexBenchmarks(nowIso, aggregates);
  return pickPrimaryIndexBenchmark(benchmarks);
}

/** Дневной срез индекса за торговую дату (MOEX ISS history). */
async function fetchHistoricalMoexIndexBenchmarkBySecid(
  secid: (typeof MOEX_INDEX_SECIDS)[number],
  dateKey: string,
  nowIso: string,
  aggregates?: { aggregateTurnover: number | null; aggregateTrades: number | null },
): Promise<ScreenerBenchmark | null> {
  const fromKey = shiftCalendarDaysKey(dateKey, -10);

  try {
    const payload = moexPayloadSchema.parse(
      await moexGetJson(indexHistoryUrl(secid, fromKey, dateKey), 120),
    );
    const history = payload.history;
    if (!history?.data?.length) return null;

    const bars = mapHistoryBars(history.columns, history.data)
      .filter((bar) => bar.close != null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const targetMs = Date.parse(`${dateKey}T00:00:00.000Z`);
    const targetIdx = bars.findIndex((bar) => bar.date.getTime() === targetMs);
    const targetBar = targetIdx >= 0 ? bars[targetIdx] : bars[bars.length - 1];
    if (!targetBar) return null;

    const prevBar = targetIdx > 0 ? bars[targetIdx - 1] : bars.length >= 2 ? bars[bars.length - 2] : null;

    const lastValue = targetBar.close;
    const open = targetBar.open;
    const high = targetBar.high;
    const low = targetBar.low;
    const previousClose = prevBar?.close ?? null;

    if (lastValue === null && open === null) return null;

    const percentChange =
      lastValue !== null && previousClose !== null && previousClose !== 0
        ? ((lastValue - previousClose) / previousClose) * 100
        : lastValue !== null && open !== null && open !== 0
          ? ((lastValue - open) / open) * 100
          : null;

    const denominator = pickRangeDenominator(previousClose ?? open, high, low);

    return buildBenchmark({
      code: secid,
      lastValue,
      open,
      high,
      low,
      previousClose,
      percentChange,
      dayRangePct: computeDayRangePct(high, low, denominator),
      updatedAt: nowIso,
      sourceUpdatedAt: dateKey,
      aggregateTurnover: aggregates?.aggregateTurnover,
      aggregateTrades: aggregates?.aggregateTrades,
    });
  } catch {
    return null;
  }
}

export async function fetchHistoricalMoexIndexBenchmarks(
  dateKey: string,
  nowIso: string,
  aggregates?: { aggregateTurnover: number | null; aggregateTrades: number | null },
): Promise<ScreenerBenchmark[]> {
  const settled = await Promise.all(
    MOEX_INDEX_SECIDS.map((secid) => fetchHistoricalMoexIndexBenchmarkBySecid(secid, dateKey, nowIso, aggregates)),
  );
  return settled.filter((item): item is ScreenerBenchmark => item !== null);
}

export async function fetchHistoricalMoexIndexBenchmark(
  dateKey: string,
  nowIso: string,
  aggregates?: { aggregateTurnover: number | null; aggregateTrades: number | null },
): Promise<ScreenerBenchmark | null> {
  const benchmarks = await fetchHistoricalMoexIndexBenchmarks(dateKey, nowIso, aggregates);
  return pickPrimaryIndexBenchmark(benchmarks);
}

export function pickPrimaryIndexBenchmark(benchmarks: ScreenerBenchmark[]): ScreenerBenchmark | null {
  if (!benchmarks.length) return null;
  const preferred = benchmarks.find((b) => b.code === "IMOEX2") ?? benchmarks.find((b) => b.code === "IMOEX");
  return preferred ?? benchmarks[0] ?? null;
}
