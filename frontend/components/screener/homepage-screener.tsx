"use client";

import * as React from "react";
import { ScreenerTable } from "@/components/screener/screener-table";
import { FuturesFamilyTable } from "@/components/screener/futures-family-table";
import { MarketRadar } from "@/components/screener/market-radar";
import { createStockColumns } from "@/components/screener/columns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { selectInPlayForRadar } from "@/lib/domain/stocks-screener-signals";
import { useInPlayStockCandles } from "@/lib/hooks/use-in-play-stock-candles";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";

const ILLIQUID_RATIO = 0.02;
const ILLIQUID_TURNOVER_FLOOR = 35_000_000;
const ILLIQUID_MIN_TRADES = 1_200;

function tradingThresholdText(value: number): string {
  return `${new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 }).format(value)} ₽`;
}

function SourceBadge({ text, tone }: { text: string; tone: "ok" | "warn" }) {
  return (
    <span
      className={
        tone === "ok"
          ? "rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-200 shadow-[0_0_0_1px_rgba(16,185,129,0.08)_inset]"
          : "rounded-full border border-amber-400/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-200 shadow-[0_0_0_1px_rgba(245,158,11,0.08)_inset]"
      }
    >
      {text}
    </span>
  );
}

export function HomePageScreener() {
  const [instrumentTab, setInstrumentTab] = React.useState<"stocks" | "futures">("stocks");
  const [hideIlliquid, setHideIlliquid] = React.useState(true);
  const stocksQuery = useScreenerQuery("stock");
  const futuresQuery = useScreenerQuery("future");

  const stocks = React.useMemo(() => {
    const rows = stocksQuery.data?.rows ?? [];
    const maxTurnoverNow = rows.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0);
    const illiquidThresholdTurnover = Math.max(maxTurnoverNow * ILLIQUID_RATIO, ILLIQUID_TURNOVER_FLOOR);
    if (!hideIlliquid) return rows;
    return rows.filter((row) => {
      const turnover = row.turnover ?? 0;
      const tradesCount = row.tradesCount ?? 0;
      const isIlliquid = turnover < illiquidThresholdTurnover && tradesCount < ILLIQUID_MIN_TRADES;
      return !isIlliquid;
    });
  }, [stocksQuery.data?.rows, hideIlliquid]);
  const illiquidHint = React.useMemo(() => {
    const rows = stocksQuery.data?.rows ?? [];
    const maxTurnoverNow = rows.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0);
    const threshold = Math.max(maxTurnoverNow * ILLIQUID_RATIO, ILLIQUID_TURNOVER_FLOOR);
    return tradingThresholdText(threshold);
  }, [stocksQuery.data?.rows]);
  const futures = futuresQuery.data?.rows ?? [];
  const stockUniverse = stocksQuery.data?.rows ?? [];
  const status = stocksQuery.data?.status ?? futuresQuery.data?.status ?? null;
  const maxTurnover = React.useMemo(
    () => stockUniverse.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0),
    [stockUniverse],
  );
  const stockTableColumns = React.useMemo(() => createStockColumns(maxTurnover), [maxTurnover]);

  const inPlayTickers = React.useMemo(
    () => selectInPlayForRadar(stocks).slice(0, 8).map((row) => row.ticker),
    [stocks],
  );
  const { seriesByTicker } = useInPlayStockCandles(inPlayTickers);
  const candleLookup = React.useMemo(
    () => ({
      get: (ticker: string) => seriesByTicker.get(ticker.toUpperCase()) ?? null,
    }),
    [seriesByTicker],
  );

  return (
    <div className="space-y-2">
      <Tabs value={instrumentTab} onValueChange={(value) => setInstrumentTab(value as "stocks" | "futures")} className="space-y-2">
        <div className="rounded-xl border border-white/5 bg-slate-950/45 px-2 py-1.5 shadow-[0_10px_24px_rgba(2,6,23,0.2)] backdrop-blur-md">
          <TabsList className="relative h-10 w-fit shrink-0 rounded-xl border border-white/5 bg-black/35 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_0_rgba(2,6,23,0.55)]">
            <span
              className={`pointer-events-none absolute bottom-1 top-1 z-0 w-[calc(50%-4px)] rounded-lg bg-[linear-gradient(145deg,rgba(51,65,85,0.9),rgba(15,23,42,0.94))] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18),0_0_20px_rgba(99,102,241,0.16)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                instrumentTab === "stocks" ? "translate-x-0" : "translate-x-[calc(100%+2px)]"
              }`}
            />
            <TabsTrigger
              value="stocks"
              className="relative z-10 h-8 rounded-lg px-4 text-sm font-medium text-slate-400 transition-colors duration-200 hover:text-slate-100 data-[state=active]:border-transparent data-[state=active]:bg-transparent data-[state=active]:text-slate-100"
            >
              Акции
            </TabsTrigger>
            <TabsTrigger
              value="futures"
              className="relative z-10 h-8 rounded-lg px-4 text-sm font-medium text-slate-400 transition-colors duration-200 hover:text-slate-100 data-[state=active]:border-transparent data-[state=active]:bg-transparent data-[state=active]:text-slate-100"
            >
              Фьючерсы
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="rounded-xl border border-white/5 bg-[linear-gradient(110deg,rgba(2,6,23,0.7),rgba(2,6,23,0.52)_45%,rgba(15,23,42,0.36)_100%)] px-3 py-2 shadow-[0_10px_24px_rgba(2,6,23,0.25)] backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-300">
            <span className="font-semibold tracking-wide text-slate-100">Скринер MOEX</span>
            {status?.source === "moex" ? <SourceBadge text="MOEX ISS" tone="ok" /> : <SourceBadge text="Fallback" tone="warn" />}
            <span className="rounded-md border border-slate-700/80 bg-slate-900/55 px-1.5 py-0.5 text-slate-300">Акции {stocksQuery.data?.status.stockRows ?? 0}</span>
            <span className="rounded-md border border-slate-700/80 bg-slate-900/55 px-1.5 py-0.5 text-slate-300">Фьючерсы {futuresQuery.data?.status.futuresRows ?? 0}</span>
            {status?.fallbackReason ? <span className="text-amber-200/95">Причина: {status.fallbackReason}</span> : null}
            <span className="ml-auto font-mono tabular-nums text-slate-400">Обновлено {status ? new Date(status.fetchTimestamp).toLocaleTimeString("ru-RU") : "—"}</span>
          </div>
        </div>
        <TabsContent value="stocks">
          <div className="sticky top-[4.05rem] z-30 mb-2 space-y-2 border-b border-white/5 bg-slate-950/80 pb-1.5 backdrop-blur-md">
            <MarketRadar rows={stocks} allRows={stockUniverse} candlesByTicker={candleLookup} />
          </div>
          <div className="mb-2.5 rounded-xl border border-white/5 bg-slate-950/45 p-2 shadow-[0_8px_18px_rgba(2,6,23,0.18)] backdrop-blur-md">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 rounded-xl border border-white/5 bg-black/30 px-2.5 py-1.5 text-xs text-slate-200">
                  <input
                    type="checkbox"
                    checked={hideIlliquid}
                    onChange={(event) => setHideIlliquid(event.target.checked)}
                    className="h-3.5 w-3.5 rounded border-white/20 bg-slate-950 text-emerald-400 accent-emerald-500"
                  />
                  <span className="font-medium">Скрыть неликвиды</span>
                </label>
                <span className="text-[11px] text-slate-500">&lt; 2% от лидера + слабая лента ({illiquidHint})</span>
              </div>
              <span className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 font-mono text-[11px] tabular-nums text-slate-300">Показано: {stocks.length}</span>
            </div>
          </div>
          <ScreenerTable
            rows={stocks}
            columns={stockTableColumns}
            emptyTitle={stocksQuery.isLoading ? "Загрузка акций..." : "Нет доступных акций"}
            emptyText={stocksQuery.error ? "MOEX временно недоступен. Используется fallback." : "По текущему фильтру ничего не найдено."}
          />
        </TabsContent>
        <TabsContent value="futures">
          <FuturesFamilyTable rows={futures} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
