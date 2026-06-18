"use client";

import * as React from "react";
import { MarketRadarDebugPanel } from "@/components/screener/market-radar-debug-panel";
import { ScreenerTable } from "@/components/screener/screener-table";
import { sandboxFuturesColumns, sandboxStockColumns } from "@/components/screener/sandbox-columns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useScreenerDiagnostics, useScreenerQuery } from "@/lib/hooks/use-screener-query";

export default function SandboxPage() {
  const diagnostics = useScreenerDiagnostics();
  const stocksQuery = useScreenerQuery("stock");
  const futuresQuery = useScreenerQuery("future");
  const [search, setSearch] = React.useState("");

  const normalized = search.trim().toLowerCase();
  const stocks =
    normalized.length === 0
      ? stocksQuery.data?.rows ?? []
      : (stocksQuery.data?.rows ?? []).filter((row) => row.ticker.toLowerCase().includes(normalized) || row.shortName.toLowerCase().includes(normalized));
  const futures =
    normalized.length === 0
      ? futuresQuery.data?.rows ?? []
      : (futuresQuery.data?.rows ?? []).filter((row) => row.ticker.toLowerCase().includes(normalized) || row.shortName.toLowerCase().includes(normalized));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 backdrop-blur-md">
        <h1 className="text-lg font-semibold text-slate-100">Песочница данных MOEX</h1>
        <p className="mt-1 text-sm text-slate-400">
          Вторичный технический экран: raw-поля, расширенные колонки и отладка качества данных. Продакшен-скринер остаётся на главной странице.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <p className="text-xs text-slate-500">Источник</p>
          <p className="mt-1 font-mono text-slate-200">{diagnostics.data?.status.source ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <p className="text-xs text-slate-500">Всего строк</p>
          <p className="mt-1 font-mono text-slate-200">{diagnostics.data?.totalRows ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <p className="text-xs text-slate-500">Причина fallback</p>
          <p className="mt-1 font-mono text-slate-200">{diagnostics.data?.status.fallbackReason ?? "нет"}</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3 backdrop-blur-md">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Фильтр по тикеру или названию (песочница)..."
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-400"
        />
      </div>

      <Tabs defaultValue="stocks" className="space-y-3">
        <TabsList>
          <TabsTrigger value="stocks">Акции (raw)</TabsTrigger>
          <TabsTrigger value="futures">Фьючерсы (raw)</TabsTrigger>
        </TabsList>
        <TabsContent value="stocks">
          <ScreenerTable
            rows={stocks}
            columns={sandboxStockColumns}
            emptyTitle={stocksQuery.isLoading ? "Загрузка акций..." : "Нет строк"}
            emptyText={stocksQuery.error ? "Источник MOEX временно недоступен." : "По текущему фильтру ничего не найдено."}
          />
        </TabsContent>
        <TabsContent value="futures">
          <ScreenerTable
            rows={futures}
            columns={sandboxFuturesColumns}
            emptyTitle={futuresQuery.isLoading ? "Загрузка фьючерсов..." : "Нет строк"}
            emptyText={futuresQuery.error ? "Источник MOEX временно недоступен." : "По текущему фильтру ничего не найдено."}
          />
        </TabsContent>
      </Tabs>

      <MarketRadarDebugPanel />

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap text-xs text-slate-300">
          {JSON.stringify(
            {
              diagnostics: diagnostics.data,
              rowsSample: {
                stocks: (stocksQuery.data?.rows ?? []).slice(0, 12),
                futures: (futuresQuery.data?.rows ?? []).slice(0, 12),
              },
              loading: { diagnostics: diagnostics.isLoading, stocks: stocksQuery.isLoading, futures: futuresQuery.isLoading },
              errors: {
                diagnostics: diagnostics.error instanceof Error ? diagnostics.error.message : null,
                stocks: stocksQuery.error instanceof Error ? stocksQuery.error.message : null,
                futures: futuresQuery.error instanceof Error ? futuresQuery.error.message : null,
              },
            },
            null,
            2,
          )}
        </pre>
      </div>
    </div>
  );
}
