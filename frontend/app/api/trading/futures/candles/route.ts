import { NextResponse } from "next/server";
import type { IntradayCandlePoint } from "@/lib/domain/currency-correlation-intraday";
import type { StockExpandedChartInterval, StockExpandedChartResponse } from "@/lib/domain/stock-expanded-chart";
import { aggregateMoexCandles } from "@/lib/moex/moex-iss-interval";
import { fetchFuturesIntradayCandles } from "@/lib/server/services/moex-futures-candles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseInterval(raw: string | null): StockExpandedChartInterval {
  const value = Number(raw ?? 5);
  if (value === 10 || value === 30 || value === 24) return value;
  return 5;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secid = (searchParams.get("secid") ?? "").trim().toUpperCase();
  const interval = parseInterval(searchParams.get("interval"));
  if (!secid) return NextResponse.json({ error: "Укажите secid" }, { status: 400 });

  const fetched = await fetchFuturesIntradayCandles(secid, interval === 24 ? 180 : 3, interval);
  const latestSession = interval === 24 ? null : fetched.points.at(-1)?.timestamp.slice(0, 10) ?? null;
  const sessionPoints = latestSession ? fetched.points.filter((point) => point.timestamp.slice(0, 10) === latestSession) : fetched.points;
  const candles = normalizeChartCandles(sessionPoints, fetched.usedInterval, interval);
  const response: StockExpandedChartResponse = {
    fetchedAt: new Date().toISOString(),
    series: {
      secid,
      status: fetched.status === "ok" && candles.length ? "ok" : fetched.status === "error" ? "error" : "no-data",
      source: interval === 24 ? "daily" : "intraday",
      interval,
      candles,
      candleCount: candles.length,
      error: fetched.error,
      sessionFromCandles: true,
    },
  };
  return NextResponse.json(response, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

function normalizeChartCandles(points: IntradayCandlePoint[], usedInterval: number, targetInterval: StockExpandedChartInterval) {
  if (targetInterval < 24 && usedInterval < targetInterval) {
    return aggregateMoexCandles(points.map((point) => ({
      time: Math.floor(new Date(point.timestamp).getTime() / 1000),
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      volume: point.volume ?? undefined,
    })), targetInterval).map((point) => ({
      time: new Date(point.time * 1000).toISOString(),
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      volume: point.volume ?? null,
    }));
  }
  return points.map((point) => ({
    time: point.timestamp,
    open: point.open,
    high: point.high,
    low: point.low,
    close: point.close,
    volume: point.volume ?? null,
  }));
}
