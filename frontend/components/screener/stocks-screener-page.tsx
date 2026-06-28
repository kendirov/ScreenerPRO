"use client";

import * as React from "react";
import { DataQualityCompact } from "@/components/screener/stocks/data-quality-compact";
import { MetricHelp } from "@/components/screener/stocks/metric-help";
import { StocksIndexStrip } from "@/components/screener/stocks/stocks-market-snapshot";
import { StocksLeaderStrip } from "@/components/screener/stocks/stocks-leader-strip";
import { StocksRadarTable } from "@/components/screener/stocks/stocks-radar-table";
import { ScreenerDevDebugPanel } from "@/components/screener/screener-dev-debug-panel";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { resolveScreenerEmptyState } from "@/lib/domain/screener-empty-state";
import {
  applyIlliquidFilter,
  buildStocksRadarModel,
  searchRadarRows,
  sortRadarRows,
  type TableSortDir,
  type TableSortKey,
} from "@/lib/screener/stocks-radar";
import { useSelectedTradingDate } from "@/lib/hooks/use-selected-trading-date";
import { useScreenerQuery, isScreenerInitialLoading } from "@/lib/hooks/use-screener-query";

function StocksEmptyPanel({
  title,
  text,
  status,
}: {
  title: string;
  text: string;
  status?: { source?: string; fallbackReason?: string | null; message?: string | null };
}) {
  return (
    <LabGlassPanel depth={20} className="px-4 py-8 text-center">
      <p className="text-base font-medium text-lab-text-main">{title}</p>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-lab-text-dim">{text}</p>
      {status?.source === "off" ? (
        <div className="mx-auto mt-4 max-w-md space-y-1.5 rounded-md border border-white/10 bg-slate-950/50 px-3 py-2 text-left font-mono text-[10px] text-lab-text-dim">
          <p className="text-amber-200/90">Сейчас включён MOEX_DATA_MODE=off</p>
          <p>Для live: pnpm -C frontend dev:live</p>
          <p>Для dev: pnpm -C frontend dev:fallback</p>
        </div>
      ) : null}
      {status?.source === "fallback" || status?.source === "demo" ? (
        <p className="mt-3 text-xs text-amber-200/85">DEV fallback · это не рынок</p>
      ) : null}
    </LabGlassPanel>
  );
}

export function StocksScreenerPage() {
  const [hideIlliquid, setHideIlliquid] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [focusedTicker, setFocusedTicker] = React.useState<string | null>(null);
  const [sort, setSort] = React.useState<{ key: TableSortKey; dir: TableSortDir }>({
    key: "trades",
    dir: "desc",
  });
  const tradingDate = useSelectedTradingDate();
  const stocksQuery = useScreenerQuery("stock", tradingDate.apiDateParam);
  const isInitialLoading = isScreenerInitialLoading(stocksQuery);

  const stockUniverse = stocksQuery.data?.rows ?? [];
  const status = stocksQuery.data?.status;
  const diagnostics = stocksQuery.data?.diagnostics;
  const benchmarks = stocksQuery.data?.benchmarks ?? [];
  const primaryBenchmark =
    benchmarks.find((b) => b.code === "IMOEX2") ?? benchmarks.find((b) => b.code === "IMOEX") ?? benchmarks[0] ?? null;

  const radarModel = React.useMemo(
    () => buildStocksRadarModel(stockUniverse, primaryBenchmark),
    [stockUniverse, primaryBenchmark],
  );

  const universeCount = radarModel.diagnostics.universeCount;

  const filteredRows = React.useMemo(() => {
    let rows = applyIlliquidFilter(radarModel.normalizedRows, hideIlliquid);
    rows = searchRadarRows(rows, search);
    return rows;
  }, [radarModel.normalizedRows, hideIlliquid, search]);

  const visibleRows = React.useMemo(
    () => sortRadarRows(filteredRows, sort.key, sort.dir),
    [filteredRows, sort],
  );

  const emptyState = resolveScreenerEmptyState({
    isLoading: isInitialLoading,
    error: Boolean(stocksQuery.error),
    status,
    diagnostics,
    visibleCount: visibleRows.length,
    apiRowCount: stockUniverse.length,
    hideIlliquid,
    historicalEmpty: status?.historicalEmpty === true,
  });

  const hasLiveRadar =
    !isInitialLoading && stockUniverse.length > 0 && status?.source === "moex" && !status.isDemo;

  const hasFallbackRadar =
    !isInitialLoading &&
    stockUniverse.length > 0 &&
    (status?.isDemo === true || status?.source === "fallback" || status?.source === "demo");

  const showRadar = hasLiveRadar || hasFallbackRadar;

  function handleRowClick(ticker: string) {
    setFocusedTicker((prev) => (prev === ticker ? null : ticker));
  }

  return (
    <div className="space-y-0.5 pb-4">
      <div className="flex h-12 items-center justify-between gap-2 border-b border-white/[0.05] pb-1">
        <div className="min-w-0">
          <h1 className="text-[13px] font-semibold leading-none text-lab-text-main">Рынок · Акции</h1>
          <p className="mt-0.5 text-[9px] text-lab-text-dim">Акции МосБиржи · интрадей</p>
        </div>
        <DataQualityCompact
          status={status}
          isLoading={isInitialLoading}
          visibleCount={visibleRows.length}
          universeCount={universeCount}
        />
      </div>

      {!showRadar && !isInitialLoading ? (
        <StocksEmptyPanel
          title={emptyState?.title ?? "Данных нет"}
          text={emptyState?.text ?? status?.message ?? "Нет строк от API"}
          status={status}
        />
      ) : (
        <>
          <StocksIndexStrip
            benchmarks={benchmarks}
            summary={radarModel.marketSummary}
            universeCount={universeCount}
            visibleCount={visibleRows.length}
            isLoading={isInitialLoading}
          />

          <StocksLeaderStrip
            liquidity={radarModel.liquidityLeaders}
            inPlay={radarModel.inPlayLeaders}
            inGameUniverseCount={radarModel.inGameUniverseCount}
            volatility={radarModel.volatilityLeaders}
            activeTicker={focusedTicker}
            onClick={handleRowClick}
          />

          <div className="space-y-1 border-t border-white/[0.05] pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-lab-text-main">
                <input
                  type="checkbox"
                  checked={hideIlliquid}
                  onChange={(e) => setHideIlliquid(e.target.checked)}
                  className="h-2.5 w-2.5 rounded border-white/20"
                />
                <span>Скрыть неликвиды</span>
                <MetricHelp text="Скрывает бумаги с низким оборотом и малым количеством сделок относительно текущего рынка. Летающие неликвиды могут оставаться в блоке Волатильность с пометкой «тонко»." />
              </label>

              <span className="font-mono text-[9px] tabular-nums text-lab-text-dim">
                Показано {visibleRows.length} из {universeCount}
              </span>

              {radarModel.inGameUniverseCount > 0 ? (
                <span className="font-mono text-[9px] tabular-nums text-lab-text-dim/80">
                  В игре: {radarModel.inGameUniverseCount}
                </span>
              ) : null}

              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Тикер"
                className="ml-auto w-[5.5rem] rounded border border-white/10 bg-slate-950/60 px-1.5 py-0.5 font-mono text-[9px] text-lab-text-main placeholder:text-lab-text-dim"
              />
            </div>

            <StocksRadarTable
              rows={visibleRows}
              highlightedTicker={focusedTicker}
              onClick={handleRowClick}
              emptyTitle={emptyState?.title ?? "Фильтр пуст"}
              emptyText={emptyState?.text}
              sort={sort}
              onSortChange={setSort}
            />
          </div>
        </>
      )}

      {process.env.NODE_ENV === "development" ? (
        <ScreenerDevDebugPanel
          endpoint={`/api/screener?assetClass=stock${tradingDate.apiDateParam ? `&date=${tradingDate.apiDateParam}` : ""}`}
          response={stocksQuery.data}
          rowsBeforeFilter={stockUniverse.length}
          rowsAfterFilter={visibleRows.length}
          breadthAudit={radarModel.diagnostics}
          errorMessage={stocksQuery.error instanceof Error ? stocksQuery.error.message : null}
        />
      ) : null}
    </div>
  );
}
