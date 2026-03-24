"use client";

import Link from "next/link";
import * as React from "react";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import { tradingFormat } from "@/lib/formatters/trading";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/5 bg-slate-950/45 p-3 shadow-[0_10px_24px_rgba(2,6,23,0.2)] backdrop-blur-md">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-200">{title}</h3>
      {children}
    </section>
  );
}

export function ScreenerHomePage() {
  const stocksQuery = useScreenerQuery("stock");
  const futuresQuery = useScreenerQuery("future");
  const stocks = React.useMemo(() => stocksQuery.data?.rows ?? [], [stocksQuery.data?.rows]);
  const futures = React.useMemo(() => futuresQuery.data?.rows ?? [], [futuresQuery.data?.rows]);

  const topInPlayStocks = React.useMemo(
    () =>
      [...stocks]
        .filter((row) => (row.metrics.inPlayTags ?? []).includes("IN_PLAY"))
        .sort((a, b) => (b.metrics.inPlayScore ?? 0) - (a.metrics.inPlayScore ?? 0))
        .slice(0, 5),
    [stocks],
  );
  const topFutures = React.useMemo(() => [...futures].sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0)).slice(0, 5), [futures]);
  const volatile = React.useMemo(
    () => [...stocks].sort((a, b) => Math.abs(b.percentChange ?? 0) - Math.abs(a.percentChange ?? 0)).slice(0, 5),
    [stocks],
  );

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/5 bg-[linear-gradient(110deg,rgba(2,6,23,0.7),rgba(2,6,23,0.52)_45%,rgba(15,23,42,0.36)_100%)] px-3 py-2 shadow-[0_10px_24px_rgba(2,6,23,0.25)] backdrop-blur-md">
        <div className="flex items-center justify-between text-[11px] text-slate-300">
          <span className="font-semibold tracking-wide text-slate-100">Screener Dashboard</span>
          <span>Акции: {stocks.length} · Фьючерсы: {futures.length}</span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Market Overview">
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-lg border border-white/5 bg-black/20 p-2">
              <div className="text-slate-500">Top stock turnover</div>
              <div className="font-mono text-slate-200">{tradingFormat.formatTurnoverRub(Math.max(...stocks.map((s) => s.turnover ?? 0), 0))}</div>
            </div>
            <div className="rounded-lg border border-white/5 bg-black/20 p-2">
              <div className="text-slate-500">Top futures turnover</div>
              <div className="font-mono text-slate-200">{tradingFormat.formatTurnoverRub(Math.max(...futures.map((s) => s.turnover ?? 0), 0))}</div>
            </div>
            <div className="rounded-lg border border-white/5 bg-black/20 p-2">
              <div className="text-slate-500">In play stocks</div>
              <div className="font-mono text-slate-200">{topInPlayStocks.length}</div>
            </div>
          </div>
        </Card>

        <Card title="Быстрые переходы">
          <div className="grid grid-cols-2 gap-2">
            <Link href="/screener/stocks" className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200 hover:bg-black/35">Акции</Link>
            <Link href="/screener/futures" className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200 hover:bg-black/35">Фьючерсы</Link>
            <Link href="/academy" className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200 hover:bg-black/35">Академия</Link>
            <Link href="/materials" className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200 hover:bg-black/35">Материалы</Link>
          </div>
        </Card>

        <Card title="Top Stocks In Play">
          <div className="space-y-1">
            {topInPlayStocks.map((row) => (
              <div key={row.ticker} className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-200">{row.ticker}</span>
                <span className="font-mono text-slate-400">{tradingFormat.formatSignedPercent(row.percentChange)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Top Futures + Volatile Names">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              {topFutures.map((row) => (
                <div key={row.ticker} className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-200">{row.ticker}</span>
                  <span className="font-mono text-slate-400">{tradingFormat.formatTurnoverRub(row.turnover)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {volatile.map((row) => (
                <div key={row.ticker} className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-200">{row.ticker}</span>
                  <span className="font-mono text-slate-400">{tradingFormat.formatSignedPercent(row.percentChange)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
