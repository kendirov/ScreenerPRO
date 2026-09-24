import { NextResponse } from "next/server";
import type { StockExpandedChartInterval } from "@/lib/domain/stock-expanded-chart";
import {
  isStrategyCandlePeriodId,
  parseStrategyCandleLimit,
  resolveStrategyCandleDateRangeFromParams,
} from "@/lib/screener/strategies/strategy-candle-range";
import { buildStockExpandedChartSeries } from "@/lib/server/services/stock-expanded-candles";
import { buildStrategyChartSeries } from "@/lib/server/services/strategy-candles";
import { buildStockSparklineBatch, RADAR_SPARKLINE_MAX_SECIDS, STOCK_SPARKLINE_MAX_SECIDS } from "@/lib/server/services/stock-screener-candles";

function parseSecids(raw: string | null, max: number): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, max);
}

function parseInterval(raw: string | null): 10 | 60 {
  const n = Number(raw ?? 10);
  return n === 60 ? 60 : 10;
}

function parseChartInterval(raw: string | null): StockExpandedChartInterval {
  const n = Number(raw ?? 10);
  if (n === 5) return 5;
  if (n === 30) return 30;
  if (n === 24) return 24;
  return 10;
}

function parseStrategyChartInterval(raw: string | null): 1 | 5 | 15 | 30 | 60 {
  const n = Number(raw ?? 5);
  if (n === 1) return 1;
  if (n === 5) return 5;
  if (n === 15) return 15;
  if (n === 30) return 30;
  if (n === 60) return 60;
  if (n === 10) return 15;
  return 5;
}

function parseDays(raw: string | null): number {
  const n = Number(raw ?? 5);
  if (!Number.isFinite(n)) return 5;
  return Math.min(10, Math.max(1, Math.trunc(n)));
}

function parseSessions(raw: string | null): 1 | 2 | 3 {
  if (raw === "3") return 3;
  return raw === "2" ? 2 : 1;
}

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view");
  const sessions = parseSessions(searchParams.get("sessions"));
  const maxSecids = sessions >= 2 ? RADAR_SPARKLINE_MAX_SECIDS : STOCK_SPARKLINE_MAX_SECIDS;
  const secids = parseSecids(searchParams.get("secids"), maxSecids);
  const secid = (searchParams.get("secid") ?? secids[0] ?? "").trim().toUpperCase();

  if (view === "chart") {
    if (!secid) {
      return NextResponse.json({ error: "Укажите secid=SBER для графика" }, { status: 400 });
    }

    const intervalParam = searchParams.get("interval");
    const board = (searchParams.get("board") ?? "TQBR").trim().toUpperCase();
    const periodParam = searchParams.get("period");
    const fromParam = searchParams.get("from");
    const tillParam = searchParams.get("till");
    const limit = parseStrategyCandleLimit(searchParams.get("limit"));
    const hasRangeParams =
      isStrategyCandlePeriodId(periodParam) || Boolean(fromParam?.trim()) || Boolean(tillParam?.trim());

    try {
      if (hasRangeParams) {
        const strategyInterval = parseStrategyChartInterval(intervalParam);
        const range = resolveStrategyCandleDateRangeFromParams({
          period: periodParam,
          from: fromParam,
          till: tillParam,
        });
        const body = await buildStrategyChartSeries({
          secid,
          interval: strategyInterval,
          board,
          from: range.from,
          till: range.till,
          periodId: range.periodId,
          maxCandles: limit,
        });
        return NextResponse.json(body, { headers: NO_STORE_HEADERS });
      }

      const interval = parseChartInterval(intervalParam);
      const body = await buildStockExpandedChartSeries(secid, interval);
      return NextResponse.json(body, { headers: NO_STORE_HEADERS });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE_HEADERS });
    }
  }

  const interval = parseInterval(searchParams.get("interval"));
  const days = parseDays(searchParams.get("days"));

  if (!secids.length) {
    return NextResponse.json({ error: "Укажите secids=SBER,GAZP,… (макс. 8)" }, { status: 400 });
  }

  try {
    const body = await buildStockSparklineBatch(secids, { interval, days, sessions });
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
