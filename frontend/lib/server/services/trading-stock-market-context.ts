import type {
  TradingIndexPoint,
  TradingIndexSession,
  TradingMarketContextResponse,
  TradingTurnoverSession,
} from "@/lib/domain/trading-market-context";
import { shiftCalendarDaysKey } from "@/lib/domain/trading-calendar";
import { indexCandlesUrl } from "@/lib/server/integrations/moex/endpoints";
import { moexGetJson } from "@/lib/server/integrations/moex/client";
import { mapIntradayCandlesBars } from "@/lib/server/integrations/moex/mappers";
import { moexPayloadSchema } from "@/lib/server/integrations/moex/validators";
import { getHistoricalStockSnapshot, resolveNearestTradingDateKey } from "@/lib/server/services/moex-screener-history";

const CONTEXT_CACHE_TTL_MS = 120_000;
const contextCache = new Map<string, { expiresAt: number; payload: TradingMarketContextResponse }>();

function sessionKey(timestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

async function resolveRecentSessions(requestedDateKey: string, count: number): Promise<string[]> {
  const result: string[] = [];
  let cursor = requestedDateKey;

  for (let attempt = 0; attempt < 24 && result.length < count; attempt += 1) {
    const resolved = await resolveNearestTradingDateKey(cursor, 8);
    if (!resolved) break;
    if (!result.includes(resolved)) result.push(resolved);
    cursor = shiftCalendarDaysKey(resolved, -1);
  }

  return result.sort();
}

function normalizeIndexSession(dateKey: string, bars: Array<{ timestamp: string; close: number | null }>): TradingIndexSession | null {
  const valid = bars.filter((bar) => bar.close != null && Number.isFinite(bar.close));
  const first = valid[0]?.close;
  if (first == null || first === 0) return null;

  const points: TradingIndexPoint[] = valid.map((bar) => ({
    time: bar.timestamp,
    close: bar.close!,
    normalizedPct: ((bar.close! - first) / first) * 100,
  }));

  return points.length >= 3 ? { dateKey, points } : null;
}

async function fetchIndexSessions(from: string, till: string): Promise<TradingIndexSession[]> {
  const payload = moexPayloadSchema.parse(await moexGetJson(indexCandlesUrl("IMOEX", from, till, 10), 90));
  const table = payload.candles;
  if (!table?.data?.length) return [];

  const bySession = new Map<string, ReturnType<typeof mapIntradayCandlesBars>>();
  for (const bar of mapIntradayCandlesBars(table.columns, table.data).sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    const key = sessionKey(bar.timestamp);
    const current = bySession.get(key) ?? [];
    current.push(bar);
    bySession.set(key, current);
  }

  return [...bySession.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-3)
    .map(([dateKey, bars]) => normalizeIndexSession(dateKey, bars))
    .filter((session): session is TradingIndexSession => session !== null);
}

async function fetchTurnoverSessions(dateKeys: string[]): Promise<TradingTurnoverSession[]> {
  const snapshots = await Promise.all(dateKeys.map((dateKey) => getHistoricalStockSnapshot(dateKey)));
  return snapshots.map((snapshot, index) => ({
    dateKey: snapshot.status.resolvedTradingDateKey ?? dateKeys[index]!,
    turnover: snapshot.stocks.reduce((sum, row) => sum + (row.turnover ?? 0), 0),
    trades: snapshot.stocks.reduce((sum, row) => sum + (row.tradesCount ?? 0), 0),
  }));
}

export async function buildTradingStockMarketContext(requestedDateKey: string): Promise<TradingMarketContextResponse> {
  const cacheKey = requestedDateKey;
  const cached = contextCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;

  const dateKeys = await resolveRecentSessions(requestedDateKey, 8);
  const resolvedDateKey = dateKeys.at(-1) ?? null;
  const from = dateKeys.at(-3) ?? shiftCalendarDaysKey(requestedDateKey, -8);
  const till = resolvedDateKey ?? requestedDateKey;

  const [indexSessions, turnoverSessions] = await Promise.all([
    fetchIndexSessions(from, till).catch(() => []),
    fetchTurnoverSessions(dateKeys).catch(() => []),
  ]);

  const payload: TradingMarketContextResponse = {
    fetchedAt: new Date().toISOString(),
    resolvedDateKey,
    indexCode: "IMOEX",
    indexSessions,
    turnoverSessions,
  };

  contextCache.set(cacheKey, { expiresAt: Date.now() + CONTEXT_CACHE_TTL_MS, payload });
  return payload;
}
