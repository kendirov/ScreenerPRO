"use client";

import * as React from "react";
import type { ScreenerBenchmark } from "@screenerpro/shared";
import { ScreenerTable } from "@/components/screener/screener-table";
import { futuresColumns, stockColumns } from "@/components/screener/columns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tradingFormat } from "@/lib/formatters/trading";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";

function useTickerFilter<T extends { ticker: string; shortName: string }>(rows: T[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;
  return rows.filter((row) => row.ticker.toLowerCase().includes(normalized) || row.shortName.toLowerCase().includes(normalized));
}

type StockActivityFilter = "active" | "has_activity" | "all";

function useStockActivityFilter<T extends { stockActivityClass: "active" | "has_activity" | "inactive" | "unknown" }>(rows: T[], mode: StockActivityFilter) {
  if (mode === "all") return rows;
  return rows.filter((row) => row.stockActivityClass === mode);
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

function BenchmarkStrip({ benchmark }: { benchmark: ScreenerBenchmark | null }) {
  if (!benchmark) {
    return (
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 px-3.5 py-2.5 text-xs text-slate-300 shadow-[0_6px_24px_rgba(2,6,23,0.32)]">
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
    <div className="rounded-xl border border-slate-700/80 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.08),transparent_48%),rgba(15,23,42,0.8)] px-3.5 py-3 shadow-[0_10px_28px_rgba(2,6,23,0.34)] backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        <div className="min-w-[190px]">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Рынок</p>
          <p className="font-semibold text-slate-100">
            {benchmark.code} <span className="font-normal text-slate-300">{benchmark.name}</span>
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-200">
          <p>
            <span className="text-slate-400">Значение</span>{" "}
            <span className="font-mono tabular-nums text-slate-100">{tradingFormat.formatDynamicPrice(benchmark.lastValue)}</span>
          </p>
          <p>
            <span className="text-slate-400">Изм.</span>{" "}
            <span className={`font-mono tabular-nums ${changeClass}`}>{tradingFormat.formatSignedPercent(benchmark.percentChange)}</span>
          </p>
          <p>
            <span className="text-slate-400">Диапазон</span>{" "}
            <span className="font-mono tabular-nums text-slate-100">{tradingFormat.formatSignedPercent(benchmark.dayRangePct)}</span>
          </p>
          <p>
            <span className="text-slate-400">Оборот</span>{" "}
            <span className="font-mono tabular-nums text-slate-100">{tradingFormat.formatTurnoverRub(benchmark.aggregateTurnover)}</span>
          </p>
          <p>
            <span className="text-slate-400">Сделки</span>{" "}
            <span className="font-mono tabular-nums text-slate-100">{tradingFormat.formatInteger(benchmark.aggregateTrades)}</span>
          </p>
        </div>
      </div>
      <p className="mt-1.5 border-t border-slate-800/70 pt-1.5 text-[10px] text-slate-400/90">
        Оборот и сделки - агрегаты по текущей выборке акций скринера.
      </p>
    </div>
  );
}

function ActivityExplainer({ mode }: { mode: StockActivityFilter }) {
  const modeText =
    mode === "active"
      ? "Активные: бумага уже идет в рабочем темпе относительно ожидаемого прогресса сессии."
      : mode === "has_activity"
        ? "Есть активность: поток уже появился, но до полного активного режима инструмент пока не дошел."
        : "Все: полный список бумаг, включая раннюю и слабую активность.";

  return (
    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-slate-200">
      <p className="font-medium text-cyan-200">Логика активности</p>
      <p className="mt-1 text-slate-300">{modeText}</p>
      <p className="mt-1 text-slate-400">Сравнение строится по обороту: текущая сессия к вчерашнему полному дню. Порог для «Активные» адаптируется по времени сессии.</p>
    </div>
  );
}

export function HomePageScreener() {
  const [search, setSearch] = React.useState("");
  const [stockActivity, setStockActivity] = React.useState<StockActivityFilter>("active");
  const stocksQuery = useScreenerQuery("stock");
  const futuresQuery = useScreenerQuery("future");

  const stocksByText = useTickerFilter(stocksQuery.data?.rows ?? [], search);
  const stocks = useStockActivityFilter(stocksByText, stockActivity);
  const activeCount = stocksByText.filter((row) => row.stockActivityClass === "active").length;
  const hasActivityCount = stocksByText.filter((row) => row.stockActivityClass === "has_activity").length;
  const futures = useTickerFilter(futuresQuery.data?.rows ?? [], search);
  const stockBenchmark = stocksQuery.data?.benchmarks[0] ?? null;
  const status = stocksQuery.data?.status ?? futuresQuery.data?.status ?? null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-700/80 bg-[linear-gradient(110deg,rgba(15,23,42,0.85),rgba(15,23,42,0.65)_45%,rgba(8,47,73,0.45)_100%)] px-3.5 py-2.5 shadow-[0_10px_24px_rgba(2,6,23,0.3)] backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-300">
          <span className="font-semibold tracking-wide text-slate-100">Скринер MOEX</span>
          {status?.source === "moex" ? <SourceBadge text="MOEX ISS" tone="ok" /> : <SourceBadge text="Fallback" tone="warn" />}
          <span className="rounded-md border border-slate-700/80 bg-slate-900/55 px-1.5 py-0.5 text-slate-300">Акции {stocksQuery.data?.status.stockRows ?? 0}</span>
          <span className="rounded-md border border-slate-700/80 bg-slate-900/55 px-1.5 py-0.5 text-slate-300">Фьючерсы {futuresQuery.data?.status.futuresRows ?? 0}</span>
          {status?.fallbackReason ? <span className="text-amber-200/95">Причина: {status.fallbackReason}</span> : null}
          <span className="ml-auto text-slate-400">Обновлено {status ? new Date(status.fetchTimestamp).toLocaleTimeString("ru-RU") : "—"}</span>
        </div>
      </div>

      <Tabs defaultValue="stocks" className="space-y-2.5">
        <div className="flex flex-col gap-2 rounded-xl border border-slate-700/80 bg-slate-900/60 p-2.5 shadow-[0_8px_20px_rgba(2,6,23,0.24)] lg:flex-row lg:items-center">
          <TabsList className="h-10 w-fit shrink-0 rounded-lg border border-slate-700/80 bg-slate-950/70 p-1">
            <TabsTrigger
              value="stocks"
              className="h-8 rounded-md px-3 text-sm font-medium text-slate-300 transition hover:text-slate-100 data-[state=active]:border data-[state=active]:border-cyan-400/30 data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-100"
            >
              Акции
            </TabsTrigger>
            <TabsTrigger
              value="futures"
              className="h-8 rounded-md px-3 text-sm font-medium text-slate-300 transition hover:text-slate-100 data-[state=active]:border data-[state=active]:border-cyan-400/30 data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-100"
            >
              Фьючерсы
            </TabsTrigger>
          </TabsList>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Фильтр по тикеру или названию..."
            className="w-full rounded-lg border border-slate-700/80 bg-slate-950/85 px-3 py-1.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-500/15"
          />
        </div>
        <TabsContent value="stocks">
          <div className="mb-2">
            <BenchmarkStrip benchmark={stockBenchmark} />
          </div>
          <div className="mb-2.5 rounded-xl border border-slate-700/80 bg-slate-900/60 p-2 shadow-[0_8px_18px_rgba(2,6,23,0.22)]">
            <div className="flex items-center justify-between">
            <div className="inline-flex rounded-lg border border-slate-700/80 bg-slate-950/70 p-1">
              <button
                onClick={() => setStockActivity("active")}
                className={`rounded-md px-2.5 py-1 text-xs transition ${
                  stockActivity === "active"
                    ? "border border-emerald-400/25 bg-emerald-500/15 text-emerald-100 shadow-[0_0_0_1px_rgba(16,185,129,0.08)_inset]"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-slate-100"
                }`}
              >
                Активные
                <span className={`ml-1 text-[10px] ${stockActivity === "active" ? "text-emerald-200" : "text-slate-500"}`}>{activeCount}</span>
              </button>
              <button
                onClick={() => setStockActivity("has_activity")}
                className={`rounded-md px-2.5 py-1 text-xs transition ${
                  stockActivity === "has_activity"
                    ? "border border-cyan-400/25 bg-cyan-500/15 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.08)_inset]"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-slate-100"
                }`}
              >
                Есть активность
                <span className={`ml-1 text-[10px] ${stockActivity === "has_activity" ? "text-cyan-200" : "text-slate-500"}`}>{hasActivityCount}</span>
              </button>
              <button
                onClick={() => setStockActivity("all")}
                className={`rounded-md px-2.5 py-1 text-xs transition ${
                  stockActivity === "all"
                    ? "border border-slate-500/40 bg-slate-800/90 text-slate-100 shadow-[0_0_0_1px_rgba(148,163,184,0.08)_inset]"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-slate-100"
                }`}
              >
                Все
              </button>
            </div>
            <span className="rounded-md border border-slate-700/80 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-300">Показано: {stocks.length}</span>
            </div>
            <div className="mt-2">
              <ActivityExplainer mode={stockActivity} />
            </div>
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
