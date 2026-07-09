"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import type { ScreenerRow } from "@screenerpro/shared";
import { DataQualityCompact } from "@/components/screener/stocks/data-quality-compact";
import { MetricHelp } from "@/components/screener/stocks/metric-help";
import { StocksIndexStrip } from "@/components/screener/stocks/stocks-market-snapshot";
import { StockScreenerCommandBar } from "@/components/screener/stocks/stock-screener-command-bar";
import { StockScreenerQuickFilters } from "@/components/screener/stocks/stock-screener-quick-filters";
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
import { computeMarketPriority } from "@/lib/screener/market-priority-engine";
import {
  isMarketPriorityDebugVisible,
  MARKET_PRIORITY_DEBUG_QUERY_PARAM,
  formatFocusCandidatesDebugLine,
} from "@/lib/screener/market-priority-debug";
import {
  buildPriorityFilterSets,
  getQuickFilterSet,
  STOCK_QUICK_FILTER_EMPTY,
  type StockQuickFilter,
} from "@/lib/screener/stock-screener-priority-filters";
import { useStockScreenerPriorityMode } from "@/lib/hooks/use-stock-screener-priority-mode";
import { useSelectedTradingDate } from "@/lib/hooks/use-selected-trading-date";
import { useScreenerQuery, isScreenerInitialLoading } from "@/lib/hooks/use-screener-query";
import {
  buildStockScreenerUniverse,
  formatStockUniverseDebugLine,
} from "@/lib/screener/stock-universe-filter";

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
  const [selectedTicker, setSelectedTicker] = React.useState<string | null>(null);
  const [scrollToTicker, setScrollToTicker] = React.useState<string | null>(null);
  const [quickFilter, setQuickFilter] = React.useState<StockQuickFilter>("all");
  const [priorityMode, setPriorityMode] = useStockScreenerPriorityMode();
  const searchParams = useSearchParams();
  const showGateDebug = isMarketPriorityDebugVisible(
    searchParams.get(MARKET_PRIORITY_DEBUG_QUERY_PARAM),
  );
  const [sort, setSort] = React.useState<{ key: TableSortKey; dir: TableSortDir }>({
    key: "trades",
    dir: "desc",
  });
  const tradingDate = useSelectedTradingDate();
  const stocksQuery = useScreenerQuery("stock", tradingDate.apiDateParam);
  const isInitialLoading = isScreenerInitialLoading(stocksQuery);

  const apiRows = stocksQuery.data?.rows ?? [];

  /** Single filter pass — all blocks on /screener/stocks read stockRows from here. */
  const screenerUniverse = React.useMemo(() => buildStockScreenerUniverse(apiRows), [apiRows]);
  const stockRows = screenerUniverse.stockRows;

  const status = stocksQuery.data?.status;
  const diagnostics = stocksQuery.data?.diagnostics;
  const benchmarks = stocksQuery.data?.benchmarks ?? [];
  const primaryBenchmark =
    benchmarks.find((b) => b.code === "IMOEX2") ?? benchmarks.find((b) => b.code === "IMOEX") ?? benchmarks[0] ?? null;

  const radarModel = React.useMemo(
    () =>
      buildStocksRadarModel(stockRows, primaryBenchmark, {
        universePreFiltered: true,
        filterAudit: screenerUniverse.audit,
        sourceRawCount: screenerUniverse.rawCount,
      }),
    [stockRows, primaryBenchmark, screenerUniverse.audit, screenerUniverse.rawCount],
  );

  const marketPriority = React.useMemo(
    () =>
      stockRows.length > 0
        ? computeMarketPriority<ScreenerRow>(stockRows, {
            mode: priorityMode,
            maxLiquidity: 10,
            maxVolatility: 8,
            variant: "stock-live-v0",
          })
        : null,
    [stockRows, priorityMode],
  );

  const priorityFilterSets = React.useMemo(
    () => buildPriorityFilterSets(marketPriority),
    [marketPriority],
  );

  const focusCount = marketPriority?.focusInPlayLeaders.length ?? 0;
  const candidatesCount = marketPriority?.stats.inPlayCandidates ?? priorityFilterSets.inPlayCandidates.size;

  const gateDebugStats =
    showGateDebug && marketPriority && !isInitialLoading
      ? {
          mode: marketPriority.stats.mode,
          total: marketPriority.stats.total,
          eligible: marketPriority.stats.eligible,
          tradableCount: marketPriority.stats.tradableCount,
          rangeSignalCount: marketPriority.stats.rangeSignalCount,
          moveSignalCount: marketPriority.stats.moveSignalCount,
          participationSignalCount: marketPriority.stats.participationSignalCount,
          inPlayCandidates: marketPriority.stats.inPlayCandidates,
          finalInPlayCount: marketPriority.stats.finalInPlayCount,
          focusFinal: marketPriority.stats.focusFinal,
          confirmedActivityCount: marketPriority.stats.confirmedActivityCount,
          confirmedRangeCount: marketPriority.stats.confirmedRangeCount,
          fallbackOnlyRejected: marketPriority.stats.fallbackOnlyRejected,
        }
      : null;

  const universeCount = radarModel.diagnostics.universeCount;

  const filteredRows = React.useMemo(() => {
    let rows = applyIlliquidFilter(radarModel.normalizedRows, hideIlliquid);
    rows = searchRadarRows(rows, search);

    const bucketSet = getQuickFilterSet(quickFilter, priorityFilterSets);
    if (bucketSet) {
      rows = rows.filter((row) => bucketSet.has(row.ticker));
    }

    return rows;
  }, [radarModel.normalizedRows, hideIlliquid, search, quickFilter, priorityFilterSets]);

  const visibleRows = React.useMemo(
    () => sortRadarRows(filteredRows, sort.key, sort.dir),
    [filteredRows, sort],
  );

  const quickFilterEmpty =
    quickFilter !== "all" && filteredRows.length === 0
      ? STOCK_QUICK_FILTER_EMPTY[quickFilter]
      : null;

  const focusCandidatesDebugLine =
    showGateDebug && marketPriority && !isInitialLoading
      ? formatFocusCandidatesDebugLine(focusCount, candidatesCount)
      : null;

  const universeDebugLine =
    showGateDebug && screenerUniverse.rawCount > 0
      ? formatStockUniverseDebugLine(screenerUniverse)
      : null;

  const emptyState = resolveScreenerEmptyState({
    isLoading: isInitialLoading,
    error: Boolean(stocksQuery.error),
    status,
    diagnostics,
    visibleCount: visibleRows.length,
    apiRowCount: stockRows.length,
    hideIlliquid,
    historicalEmpty: status?.historicalEmpty === true,
  });

  const tableEmptyTitle = quickFilterEmpty?.title ?? emptyState?.title ?? "Фильтр пуст";
  const tableEmptyText = quickFilterEmpty?.text ?? emptyState?.text;

  const hasLiveRadar =
    !isInitialLoading && stockRows.length > 0 && status?.source === "moex" && !status.isDemo;

  const hasFallbackRadar =
    !isInitialLoading &&
    stockRows.length > 0 &&
    (status?.isDemo === true || status?.source === "fallback" || status?.source === "demo");

  const showRadar = hasLiveRadar || hasFallbackRadar;

  const handleScrollToTickerDone = React.useCallback(() => {
    setScrollToTicker(null);
  }, []);

  function handleCommandBarTickerClick(ticker: string) {
    const bucketSet = getQuickFilterSet(quickFilter, priorityFilterSets);
    if (bucketSet && !bucketSet.has(ticker)) {
      setQuickFilter("all");
    }
    setSelectedTicker(ticker);
    setScrollToTicker(ticker);
  }

  function handleTableRowClick(ticker: string) {
    setSelectedTicker((prev) => (prev === ticker ? null : ticker));
  }

  function clearSelection() {
    setSelectedTicker(null);
    setScrollToTicker(null);
  }

  function handleQuickFilterChange(next: StockQuickFilter) {
    setQuickFilter(next);
    if (selectedTicker) {
      const bucketSet = getQuickFilterSet(next, priorityFilterSets);
      if (bucketSet && !bucketSet.has(selectedTicker)) {
        clearSelection();
      }
    }
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

          {universeDebugLine ? (
            <p
              className="px-0.5 font-mono text-[9px] tabular-nums text-lab-text-dim"
              title="Stock-only universe filter (dev or ?debugPriority=1)"
            >
              {universeDebugLine}
            </p>
          ) : null}

          {focusCandidatesDebugLine ? (
            <p
              className="px-0.5 font-mono text-[9px] tabular-nums text-cyan-400/70"
              title="In Play Focus vs Candidates (dev or ?debugPriority=1)"
            >
              {focusCandidatesDebugLine}
            </p>
          ) : null}

          <StockScreenerCommandBar
            priority={marketPriority}
            mode={priorityMode}
            onModeChange={setPriorityMode}
            gateDebugStats={gateDebugStats}
            selectedTicker={selectedTicker}
            onTickerClick={handleCommandBarTickerClick}
            onClearSelection={clearSelection}
            isLoading={isInitialLoading}
          />

          <div className="space-y-1 border-t border-white/[0.05] pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <StockScreenerQuickFilters
                value={quickFilter}
                onChange={handleQuickFilterChange}
                sets={priorityFilterSets}
              />

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
              highlightedTicker={selectedTicker}
              scrollToTicker={scrollToTicker}
              onScrollToTickerDone={handleScrollToTickerDone}
              priorityFilterSets={priorityFilterSets}
              onClick={handleTableRowClick}
              emptyTitle={tableEmptyTitle}
              emptyText={tableEmptyText}
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
          rowsBeforeFilter={screenerUniverse.rawCount}
          stockOnlyCount={screenerUniverse.stockCount}
          rowsAfterFilter={visibleRows.length}
          breadthAudit={radarModel.diagnostics}
          errorMessage={stocksQuery.error instanceof Error ? stocksQuery.error.message : null}
        />
      ) : null}
    </div>
  );
}
