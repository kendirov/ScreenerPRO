import { historyUrl } from "@/lib/server/integrations/moex/endpoints";
import { mapHistoryBars } from "@/lib/server/integrations/moex/mappers";
import { moexGetJson } from "@/lib/server/integrations/moex/client";
import { moexPayloadSchema } from "@/lib/server/integrations/moex/validators";
import type { CurrencyHistoryPoint } from "@/lib/domain/currency-correlation-history";

export type FetchFuturesHistoryResult = {
  points: CurrencyHistoryPoint[];
  status: "ok" | "empty" | "error";
  error?: string;
};

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toHistoryPoint(bar: ReturnType<typeof mapHistoryBars>[number]): CurrencyHistoryPoint | null {
  if (bar.close == null || !Number.isFinite(bar.close)) return null;
  return {
    date: formatDate(bar.date),
    close: bar.close,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    volume: bar.volume,
  };
}

/**
 * Дневная история через `/history/engines/stock/markets/forts/...` (используется ingest).
 * Для Lab-графиков — `moex-futures-candles.ts` (engines/futures/.../candles).
 */
export async function fetchFuturesDailyHistory(
  ticker: string,
  days: number,
): Promise<FetchFuturesHistoryResult> {
  const secid = ticker.trim().toUpperCase();
  if (!secid) {
    return { points: [], status: "empty", error: "Пустой тикер" };
  }

  const till = new Date();
  const from = new Date(till.getTime() - Math.max(days + 5, 10) * 24 * 3600 * 1000);
  const fromStr = formatDate(from);
  const tillStr = formatDate(till);

  try {
    const payload = moexPayloadSchema.parse(
      await moexGetJson(historyUrl("future", secid, fromStr, tillStr), 300),
    );
    const history = payload.history;
    if (!history?.data?.length) {
      return { points: [], status: "empty" };
    }

    const bars = mapHistoryBars(history.columns, history.data);
    const points = bars
      .map(toHistoryPoint)
      .filter((p): p is CurrencyHistoryPoint => p != null)
      .sort((a, b) => a.date.localeCompare(b.date));

    const trimmed = points.slice(-days);
    if (!trimmed.length) {
      return { points: [], status: "empty" };
    }

    return { points: trimmed, status: "ok" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { points: [], status: "error", error: message };
  }
}
