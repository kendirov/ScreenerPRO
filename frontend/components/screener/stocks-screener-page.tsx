"use client";

import * as React from "react";
import { MarketRadar } from "@/components/screener/market-radar";
import { ScreenerTable } from "@/components/screener/screener-table";
import { stockColumns } from "@/components/screener/columns";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";

const ILLIQUID_RATIO = 0.02;
const ILLIQUID_TURNOVER_FLOOR = 35_000_000;
const ILLIQUID_MIN_TRADES = 1_200;

function tradingThresholdText(value: number): string {
  return `${new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 }).format(value)} ₽`;
}

export function StocksScreenerPage() {
  const [hideIlliquid, setHideIlliquid] = React.useState(true);
  const stocksQuery = useScreenerQuery("stock");

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

  const stockUniverse = stocksQuery.data?.rows ?? [];
  const imoexRangePct = stocksQuery.data?.benchmarks?.[0]?.dayRangePct ?? null;
  const status = stocksQuery.data?.status;

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-white/5 bg-[linear-gradient(110deg,rgba(2,6,23,0.7),rgba(2,6,23,0.52)_45%,rgba(15,23,42,0.36)_100%)] px-3 py-2 shadow-[0_10px_24px_rgba(2,6,23,0.25)] backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-300">
          <span className="font-semibold tracking-wide text-slate-100">Скринер MOEX: Акции</span>
          <span className="rounded-md border border-slate-700/80 bg-slate-900/55 px-1.5 py-0.5 text-slate-300">Показано {stocks.length}</span>
          <span className="ml-auto font-mono tabular-nums text-slate-400">Обновлено {status ? new Date(status.fetchTimestamp).toLocaleTimeString("ru-RU") : "—"}</span>
        </div>
      </div>

      <div className="sticky top-[4.05rem] z-30 mb-2 space-y-2 border-b border-white/5 bg-slate-950/80 pb-1.5 backdrop-blur-md">
        <MarketRadar rows={stocks} allRows={stockUniverse} imoexRangePct={imoexRangePct} />
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
        columns={stockColumns}
        emptyTitle={stocksQuery.isLoading ? "Загрузка акций..." : "Нет доступных акций"}
        emptyText={stocksQuery.error ? "MOEX временно недоступен. Используется fallback." : "По текущему фильтру ничего не найдено."}
      />
    </div>
  );
}
