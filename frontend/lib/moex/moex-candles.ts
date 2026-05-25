/**
 * MOEX ISS candles helper — server-side only (API routes / server services).
 * In-memory cache: secid + interval + from + till, TTL 120s.
 */

import {
  futuresCandlesUrl,
  historyUrl,
  indexHistoryUrl,
  stockCandlesUrl,
} from "@/lib/server/integrations/moex/endpoints";
import { mapCandlesBars, mapHistoryBars, mapIntradayCandlesBars } from "@/lib/server/integrations/moex/mappers";
import { moexGetJson } from "@/lib/server/integrations/moex/client";
import { moexPayloadSchema } from "@/lib/server/integrations/moex/validators";

export type MoexCandleDataStatus = "live" | "partial" | "no-history";

export type MoexCandlePoint = {
  t: string;
  close: number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
};

export type MoexCandlesResult = {
  secid: string;
  engine: string;
  market: string;
  board: string | null;
  interval: number;
  from: string;
  till: string;
  dataStatus: MoexCandleDataStatus;
  candles: MoexCandlePoint[];
  error?: string;
};

export type FactorCandidate = {
  secid: string;
  engine: "stock" | "futures";
  market: "shares" | "index" | "forts";
  board?: string | null;
  label: string;
};

const CACHE_TTL_MS = 120_000;
const cache = new Map<string, { expiresAt: number; payload: MoexCandlesResult }>();

function cacheKey(secid: string, interval: number, from: string, till: string, engine: string, market: string): string {
  return `${secid}|${engine}|${market}|${interval}|${from}|${till}`;
}

function emptyResult(
  secid: string,
  engine: string,
  market: string,
  board: string | null,
  interval: number,
  from: string,
  till: string,
  error?: string,
): MoexCandlesResult {
  return {
    secid,
    engine,
    market,
    board,
    interval,
    from,
    till,
    dataStatus: "no-history",
    candles: [],
    error,
  };
}

function resolveDataStatus(count: number, periodDays: number): MoexCandleDataStatus {
  if (count < 5) return "no-history";
  const minExpected = Math.min(periodDays * 0.4, periodDays);
  if (count < minExpected) return "partial";
  return "live";
}

/** Загрузка свечей MOEX ISS с кэшем. */
export async function getSecurityCandles(
  secid: string,
  engine: string,
  market: string,
  board: string | null,
  interval: number,
  from: string,
  till: string,
): Promise<MoexCandlesResult> {
  const key = secid.trim().toUpperCase();
  const fromStr = from.slice(0, 10);
  const tillStr = till.slice(0, 10);
  const ck = cacheKey(key, interval, fromStr, tillStr, engine, market);

  const hit = cache.get(ck);
  if (hit && hit.expiresAt > Date.now()) return hit.payload;

  try {
    let candles: MoexCandlePoint[] = [];

    if (engine === "stock" && market === "shares" && board === "TQBR") {
      if (interval >= 24) {
        const payload = moexPayloadSchema.parse(
          await moexGetJson(historyUrl("stock", key, fromStr, tillStr), 120),
        );
        const history = payload.history;
        if (history?.data?.length) {
          candles = mapHistoryBars(history.columns, history.data)
            .filter((b) => b.close != null && Number.isFinite(b.close))
            .map((b) => ({
              t: b.date.toISOString().slice(0, 10),
              close: b.close!,
              open: b.open,
              high: b.high,
              low: b.low,
            }));
        }
      } else {
        const payload = moexPayloadSchema.parse(
          await moexGetJson(stockCandlesUrl(key, fromStr, tillStr, interval), 90),
        );
        const table = payload.candles;
        if (table?.data?.length) {
          candles = mapIntradayCandlesBars(table.columns, table.data)
            .filter((b) => b.close != null && Number.isFinite(b.close))
            .map((b) => ({
              t: b.timestamp,
              close: b.close!,
              open: b.open,
              high: b.high,
              low: b.low,
            }));
        }
      }
    } else if (engine === "stock" && market === "index") {
      const payload = moexPayloadSchema.parse(
        await moexGetJson(indexHistoryUrl(key, fromStr, tillStr), 120),
      );
      const history = payload.history;
      if (history?.data?.length) {
        candles = mapHistoryBars(history.columns, history.data)
          .filter((b) => b.close != null && Number.isFinite(b.close))
          .map((b) => ({
            t: b.date.toISOString().slice(0, 10),
            close: b.close!,
            open: b.open,
            high: b.high,
            low: b.low,
          }));
      }
    } else if (engine === "futures" && market === "forts") {
      const payload = moexPayloadSchema.parse(
        await moexGetJson(futuresCandlesUrl(key, fromStr, tillStr, interval >= 24 ? 24 : interval), 120),
      );
      const table = payload.candles;
      if (table?.data?.length) {
        if (interval >= 24) {
          candles = mapCandlesBars(table.columns, table.data)
            .filter((b) => b.close != null && Number.isFinite(b.close))
            .map((b) => ({
              t: b.date.toISOString().slice(0, 10),
              close: b.close!,
              open: b.open,
              high: b.high,
              low: b.low,
            }));
        } else {
          candles = mapIntradayCandlesBars(table.columns, table.data)
            .filter((b) => b.close != null && Number.isFinite(b.close))
            .map((b) => ({
              t: b.timestamp,
              close: b.close!,
              open: b.open,
              high: b.high,
              low: b.low,
            }));
        }
      }
    }

    candles.sort((a, b) => a.t.localeCompare(b.t));

    const periodDays = Math.max(
      1,
      Math.ceil((new Date(tillStr).getTime() - new Date(fromStr).getTime()) / (24 * 3600 * 1000)),
    );

    const result: MoexCandlesResult = {
      secid: key,
      engine,
      market,
      board,
      interval,
      from: fromStr,
      till: tillStr,
      dataStatus: resolveDataStatus(candles.length, periodDays),
      candles,
    };

    cache.set(ck, { expiresAt: Date.now() + CACHE_TTL_MS, payload: result });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const result = emptyResult(key, engine, market, board, interval, fromStr, tillStr, message);
    cache.set(ck, { expiresAt: Date.now() + CACHE_TTL_MS, payload: result });
    return result;
  }
}

/** Первый кандидат с достаточной историей свечей. */
export async function getAvailableFactorCandidate(
  candidates: FactorCandidate[],
  interval: number,
  from: string,
  till: string,
  minCandles = 10,
): Promise<{ candidate: FactorCandidate | null; candles: MoexCandlePoint[]; dataStatus: MoexCandleDataStatus }> {
  for (const candidate of candidates) {
    const result = await getSecurityCandles(
      candidate.secid,
      candidate.engine,
      candidate.market,
      candidate.board ?? null,
      interval,
      from,
      till,
    );
    if (result.candles.length >= minCandles && result.dataStatus !== "no-history") {
      return { candidate, candles: result.candles, dataStatus: result.dataStatus };
    }
  }
  return { candidate: null, candles: [], dataStatus: "no-history" };
}

export function clearMoexCandlesCache(): void {
  cache.clear();
}
