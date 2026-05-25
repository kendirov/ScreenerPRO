import { NextResponse } from "next/server";
import type { StockExpandedChartInterval } from "@/lib/domain/stock-expanded-chart";
import { buildStockExpandedChartSeries } from "@/lib/server/services/stock-expanded-candles";
import { buildStockSparklineBatch, STOCK_SPARKLINE_MAX_SECIDS } from "@/lib/server/services/stock-screener-candles";

function parseSecids(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(
    0,
    STOCK_SPARKLINE_MAX_SECIDS,
  );
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

function parseDays(raw: string | null): number {
  const n = Number(raw ?? 5);
  if (!Number.isFinite(n)) return 5;
  return Math.min(10, Math.max(1, Math.trunc(n)));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view");
  const secids = parseSecids(searchParams.get("secids"));
  const secid = (searchParams.get("secid") ?? secids[0] ?? "").trim().toUpperCase();

  if (view === "chart") {
    if (!secid) {
      return NextResponse.json({ error: "Укажите secid=SBER для графика" }, { status: 400 });
    }

    const interval = parseChartInterval(searchParams.get("interval"));

    try {
      const body = await buildStockExpandedChartSeries(secid, interval);
      return NextResponse.json(body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const interval = parseInterval(searchParams.get("interval"));
  const days = parseDays(searchParams.get("days"));

  if (!secids.length) {
    return NextResponse.json({ error: "Укажите secids=SBER,GAZP,… (макс. 8)" }, { status: 400 });
  }

  try {
    const body = await buildStockSparklineBatch(secids, { interval, days });
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
