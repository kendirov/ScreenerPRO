"use client";

import * as React from "react";
import type { ScreenerBenchmark } from "@screenerpro/shared";
import { ScreenerTable } from "@/components/screener/screener-table";
import { futuresColumns, stockColumns } from "@/components/screener/columns";
import { SectionHeader } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tradingFormat } from "@/lib/formatters/trading";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";

function useTickerFilter<T extends { ticker: string; shortName: string }>(rows: T[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;
  return rows.filter((row) => row.ticker.toLowerCase().includes(normalized) || row.shortName.toLowerCase().includes(normalized));
}

type StockLiquidityFilter = "liquid" | "all";

function useStockLiquidityFilter<T extends { liquidityClass: "liquid" | "illiquid" | "unknown" }>(rows: T[], mode: StockLiquidityFilter) {
  if (mode === "all") return rows;
  return rows.filter((row) => row.liquidityClass === "liquid");
}

function SourceBadge({ text, tone }: { text: string; tone: "ok" | "warn" }) {
  return (
    <span className={tone === "ok" ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300" : "rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300"}>
      {text}
    </span>
  );
}

function BenchmarkStrip({ benchmark }: { benchmark: ScreenerBenchmark | null }) {
  if (!benchmark) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-400">
        Эталон рынка временно недоступен.
      </div>
    );
  }

  const changeClass =
    benchmark.percentChange !== null && benchmark.percentChange > 0
      ? "text-emerald-300"
      : benchmark.percentChange !== null && benchmark.percentChange < 0
        ? "text-rose-300"
        : "text-slate-200";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/55 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Режим рынка</p>
          <p className="font-semibold text-slate-100">
            {benchmark.code} <span className="font-normal text-slate-400">{benchmark.name}</span>
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-x-6 gap-y-1 text-slate-300">
          <p>
            Значение: <span className="font-mono tabular-nums text-slate-100">{tradingFormat.formatDynamicPrice(benchmark.lastValue)}</span>
          </p>
          <p>
            Изм. %: <span className={`font-mono tabular-nums ${changeClass}`}>{tradingFormat.formatSignedPercent(benchmark.percentChange)}</span>
          </p>
          <p>
            Диапазон %: <span className="font-mono tabular-nums text-slate-100">{tradingFormat.formatSignedPercent(benchmark.dayRangePct)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export function HomePageScreener() {
  const [search, setSearch] = React.useState("");
  const [stockLiquidity, setStockLiquidity] = React.useState<StockLiquidityFilter>("liquid");
  const stocksQuery = useScreenerQuery("stock");
  const futuresQuery = useScreenerQuery("future");

  const stocksByText = useTickerFilter(stocksQuery.data?.rows ?? [], search);
  const stocks = useStockLiquidityFilter(stocksByText, stockLiquidity);
  const futures = useTickerFilter(futuresQuery.data?.rows ?? [], search);
  const stockBenchmark = stocksQuery.data?.benchmarks[0] ?? null;
  const status = stocksQuery.data?.status ?? futuresQuery.data?.status ?? null;

  return (
    <div className="space-y-4 py-2">
      <SectionHeader title="Скринер MOEX" subtitle="Реальные данные рынка акций и фьючерсов с серверной нормализацией." />

      <div className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
          <span>Источник:</span>
          {status?.source === "moex" ? <SourceBadge text="MOEX ISS (real data)" tone="ok" /> : <SourceBadge text="Fallback demo" tone="warn" />}
          <span className="text-slate-500">Акции: {stocksQuery.data?.status.stockRows ?? 0}</span>
          <span className="text-slate-500">Фьючерсы: {futuresQuery.data?.status.futuresRows ?? 0}</span>
          {status?.fallbackReason ? <span className="text-amber-300">Причина fallback: {status.fallbackReason}</span> : null}
          <span className="ml-auto text-slate-500">Обновлено: {status ? new Date(status.fetchTimestamp).toLocaleTimeString("ru-RU") : "—"}</span>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3 backdrop-blur-md">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Фильтр по тикеру или названию..."
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-400"
        />
      </div>

      <Tabs defaultValue="stocks" className="space-y-3">
        <TabsList>
          <TabsTrigger value="stocks">Акции</TabsTrigger>
          <TabsTrigger value="futures">Фьючерсы</TabsTrigger>
        </TabsList>
        <TabsContent value="stocks">
          <div className="mb-3">
            <BenchmarkStrip benchmark={stockBenchmark} />
          </div>
          <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 p-2">
            <div className="inline-flex rounded-lg bg-slate-900 p-1">
              <button
                onClick={() => setStockLiquidity("liquid")}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  stockLiquidity === "liquid" ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Ликвидные
              </button>
              <button
                onClick={() => setStockLiquidity("all")}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  stockLiquidity === "all" ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Все
              </button>
            </div>
            <span className="text-xs text-slate-500">Показано: {stocks.length}</span>
          </div>
          <ScreenerTable
            rows={stocks}
            columns={stockColumns}
            emptyTitle={stocksQuery.isLoading ? "Загрузка акций..." : "Нет доступных акций"}
            emptyText={stocksQuery.error ? "MOEX временно недоступен. Используется fallback." : "По текущему фильтру ничего не найдено."}
          />
        </TabsContent>
        <TabsContent value="futures">
          <ScreenerTable
            rows={futures}
            columns={futuresColumns}
            emptyTitle={futuresQuery.isLoading ? "Загрузка фьючерсов..." : "Нет доступных фьючерсов"}
            emptyText={futuresQuery.error ? "MOEX временно недоступен. Используется fallback." : "По текущему фильтру ничего не найдено."}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
