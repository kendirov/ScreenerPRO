"use client";

import type { ScreenerBenchmark, ScreenerDataStatus, ScreenerRow } from "@screenerpro/shared";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  ChartNoAxesCombined,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Fragment, startTransition, useMemo, useOptimistic, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SectorKDataError, SectorKLoading, SectorKSource } from "@/components/sector-k/sector-k-data-state";
import { SectorKStockChart } from "@/components/sector-k/sector-k-stock-chart";
import { TradingMiniChart } from "@/components/trading/trading-mini-chart";
import type { StockSparklineSeries } from "@/lib/domain/stock-sparkline";
import type { TradingIndexSession, TradingTurnoverSession } from "@/lib/domain/trading-market-context";
import { formatCompactDateKey, moscowTodayKey } from "@/lib/domain/trading-calendar";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import { useRadarSparklineCandles } from "@/lib/hooks/use-radar-sparkline-candles";
import { useSelectedTradingDate } from "@/lib/hooks/use-selected-trading-date";
import { useTradingMarketContext } from "@/lib/hooks/use-trading-market-context";
import { computeMarketPriority, type PriorityInstrument } from "@/lib/screener/market-priority-engine";
import { buildStockScreenerUniverse } from "@/lib/screener/stock-universe-filter";
import {
  buildSectorKStockActivity,
  formatSectorKMagnitudePercent,
  formatSectorKPercent,
  formatSectorKPrice,
  formatSectorKTurnover,
  getSectorKLiquidTickers,
  sortSectorKStocks,
  type SectorKSortDirection,
  type SectorKStockSortKey,
} from "@/lib/sector-k/market";
import {
  buildTradingWhyReasons,
  isFiniteMetric,
  summarizeTradingTurnoverComparison,
  summarizeTradingMarket,
  tradingTurnoverComparisonForRow,
  tradingBenchmarkPosition,
  tradingDayPosition,
  tradingMarketDelta,
  type TradingMarketSummary,
  type TradingTurnoverComparison,
} from "@/lib/trading/stocks-radar";

type StockPriority = PriorityInstrument<ScreenerRow>;

const SORT_KEYS = new Set<SectorKStockSortKey>(["price", "change", "turnover", "trades", "range"]);
const STOCK_COLUMNS: Array<{ id: SectorKStockSortKey; label: string }> = [
  { id: "price", label: "Цена" },
  { id: "change", label: "%" },
  { id: "turnover", label: "Оборот" },
  { id: "trades", label: "Сделки" },
  { id: "range", label: "Диапазон" },
];

function defaultDirection(key: SectorKStockSortKey): SectorKSortDirection {
  return key === "price" ? "asc" : "desc";
}

function benchmarkOrder(benchmark: ScreenerBenchmark): number {
  if (benchmark.code === "IMOEX2") return 0;
  if (benchmark.code === "IMOEX") return 1;
  return 2;
}

function chooseBenchmark(benchmarks: ScreenerBenchmark[]): ScreenerBenchmark | null {
  const sorted = [...benchmarks].sort((left, right) => benchmarkOrder(left) - benchmarkOrder(right));
  return sorted.find((item) => item.code === "IMOEX2") ?? sorted.find((item) => item.code === "IMOEX") ?? null;
}

function formatMarketDelta(value: number | null): string {
  if (!isFiniteMetric(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} п.п.`;
}

function formatTrades(value: number | null | undefined): string {
  return isFiniteMetric(value) ? Math.round(value).toLocaleString("ru-RU") : "—";
}

function changeClass(value: number | null | undefined): string {
  if (!isFiniteMetric(value) || value === 0) return "";
  return value > 0 ? "sk-change--positive" : "sk-change--negative";
}

function changeValueClass(value: number | null | undefined): string {
  const direction = changeClass(value);
  if (!direction || !isFiniteMetric(value)) return "";
  const magnitude = Math.abs(value);
  const intensity = magnitude >= 5 ? "tr-change--strong" : magnitude >= 2.5 ? "tr-change--medium" : "tr-change--soft";
  return `${direction} ${intensity}`;
}

function focusScore(item: StockPriority): number {
  const ratio = tradingTurnoverComparisonForRow(item.row)?.ratio ?? null;
  const activityBonus = ratio == null ? 0 : ratio >= 2.5 ? 12 : ratio >= 1.8 ? 8 : ratio >= 1.25 ? 4 : 0;
  return item.inPlayScore + activityBonus;
}

function selectTradingFocus(items: StockPriority[]): StockPriority[] {
  return items
    .filter((item) => {
      const change = Math.abs(item.row.percentChange ?? 0);
      const range = Math.abs(item.row.metrics.dayRangePct ?? 0);
      const liquidMove = item.liquidityScore >= 90 && change >= 2 && range >= 2.5;
      const liquidRange = item.liquidityScore >= 90 && change >= 1.5 && range >= 3.5;
      return focusScore(item) >= 72 || liquidMove || liquidRange;
    })
    .sort((left, right) => focusScore(right) - focusScore(left));
}

function selectTradingLiquidity(items: StockPriority[]): StockPriority[] {
  return items.filter((item) => item.liquidityScore >= 92);
}

function selectTradingShots(items: StockPriority[], focus: StockPriority[]): StockPriority[] {
  const focusTickers = new Set(focus.map((item) => item.secid));
  return items
    .filter((item) => {
      if (focusTickers.has(item.secid) || item.isHardExcluded) return false;
      const row = item.row;
      const change = Math.abs(row.percentChange ?? 0);
      const range = Math.abs(row.metrics.dayRangePct ?? 0);
      const turnover = row.turnover ?? 0;
      const trades = row.tradesCount ?? 0;
      const tradableThinMove = turnover >= 5_000_000 && turnover < 50_000_000 && trades >= 500;
      const extremeIlliquidMove = turnover >= 500_000 && turnover < 5_000_000 && range >= 8 && change >= 5;
      return range >= 5 && change >= 3 && (tradableThinMove || extremeIlliquidMove);
    })
    .sort((left, right) => {
      const leftMove = Math.abs(left.row.metrics.dayRangePct ?? 0) + Math.abs(left.row.percentChange ?? 0);
      const rightMove = Math.abs(right.row.metrics.dayRangePct ?? 0) + Math.abs(right.row.percentChange ?? 0);
      return rightMove - leftMove;
    });
}

export function TradingStocks() {
  const date = useSelectedTradingDate();
  const query = useScreenerQuery("stock", date.apiDateParam);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [copiedTicker, setCopiedTicker] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<SectorKStockSortKey>>(() => new Set(SORT_KEYS));
  const hideIlliquidParam = searchParams.get("illiquid") !== "show";
  const [hideIlliquid, setOptimisticHideIlliquid] = useOptimistic(hideIlliquidParam);

  const rawRows = useMemo(() => query.data?.rows ?? [], [query.data?.rows]);
  const universe = useMemo(() => buildStockScreenerUniverse(rawRows), [rawRows]);
  const activity = useMemo(() => buildSectorKStockActivity(universe.stockRows), [universe.stockRows]);
  const liquidTickers = useMemo(() => getSectorKLiquidTickers(activity), [activity]);
  const priority = useMemo(
    () => computeMarketPriority(universe.stockRows, {
      mode: "strict",
      maxLiquidity: Math.max(1, universe.stockRows.length),
      maxInPlay: 8,
      maxVolatility: Math.max(1, universe.stockRows.length),
      variant: "stock-live-v0",
    }),
    [universe.stockRows],
  );
  const benchmark = useMemo(() => chooseBenchmark(query.data?.benchmarks ?? []), [query.data?.benchmarks]);
  const market = useMemo(() => summarizeTradingMarket(universe.stockRows), [universe.stockRows]);
  const marketContextDateKey = query.data?.status.resolvedTradingDateKey ?? date.selectedDateKey;
  const marketContext = useTradingMarketContext(marketContextDateKey);
  const focusItems = useMemo(() => selectTradingFocus(priority.inPlayCandidateLeaders), [priority.inPlayCandidateLeaders]);
  const liquidityItems = useMemo(() => selectTradingLiquidity(priority.liquidityLeaders), [priority.liquidityLeaders]);
  const shotItems = useMemo(() => selectTradingShots(priority.all, focusItems), [focusItems, priority.all]);
  const focusTickers = useMemo(() => focusItems.map((item) => item.row.ticker), [focusItems]);
  const focusCharts = useRadarSparklineCandles(focusTickers, date.isLive);
  const turnoverComparison = useMemo(() => summarizeTradingTurnoverComparison(universe.stockRows), [universe.stockRows]);

  const sortParam = searchParams.get("sort") as SectorKStockSortKey | null;
  const sortKey = sortParam && SORT_KEYS.has(sortParam) ? sortParam : "trades";
  const direction: SectorKSortDirection = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const search = searchParams.get("q") ?? "";
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = universe.stockRows.filter((row) => {
      if (hideIlliquid && !liquidTickers.has(row.ticker)) return false;
      return !needle || `${row.ticker} ${row.shortName}`.toLowerCase().includes(needle);
    });
    return sortSectorKStocks(filtered, sortKey, direction);
  }, [direction, hideIlliquid, liquidTickers, search, sortKey, universe.stockRows]);

  const expandedRow = expandedTicker ? universe.stockRows.find((row) => row.ticker === expandedTicker) ?? null : null;
  const error = query.error instanceof Error ? query.error : null;
  const hasCustomState = sortKey !== "trades" || direction !== "desc" || Boolean(search) || !hideIlliquid || visibleColumns.size !== STOCK_COLUMNS.length;
  const resolvedDateKey = marketContext.data?.resolvedDateKey ?? query.data?.status.resolvedTradingDateKey ?? date.selectedDateKey;
  const chartDateKey = date.isLive ? null : resolvedDateKey;

  function replaceQuery(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.replace(next.size ? `${pathname}?${next.toString()}` : pathname, { scroll: false });
  }

  function setSort(nextKey: SectorKStockSortKey) {
    const nextDirection = sortKey === nextKey ? direction === "desc" ? "asc" : "desc" : defaultDirection(nextKey);
    replaceQuery({ sort: nextKey === "trades" ? null : nextKey, dir: nextDirection === "asc" ? "asc" : null });
  }

  function reset() {
    setVisibleColumns(new Set(SORT_KEYS));
    const next = new URLSearchParams(searchParams.toString());
    for (const key of ["q", "sort", "dir", "illiquid"]) next.delete(key);
    startTransition(() => {
      setOptimisticHideIlliquid(true);
      router.replace(next.size ? `${pathname}?${next.toString()}` : pathname, { scroll: false });
    });
  }

  function toggleColumn(column: SectorKStockSortKey) {
    setVisibleColumns((current) => {
      const next = new Set(current);
      if (next.has(column)) {
        if (next.size > 1) next.delete(column);
      } else {
        next.add(column);
      }
      return next;
    });
  }

  async function copyTicker(ticker: string) {
    setSelectedTicker(ticker);
    try {
      await navigator.clipboard.writeText(ticker);
      setCopiedTicker(ticker);
      window.setTimeout(() => setCopiedTicker((current) => current === ticker ? null : current), 1_400);
    } catch {
      setCopiedTicker(null);
    }
  }

  function focusTicker(ticker: string) {
    setSelectedTicker(ticker);
    setExpandedTicker(ticker);
    window.requestAnimationFrame(() => {
      document.getElementById(`tr-stock-${ticker}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  return (
    <div className="sk-page tr-stocks-page">
      <h1 className="sk-sr-only">Акции</h1>

      <div className="tr-session-switcher" aria-label="Период рыночного среза">
        <span className="tr-label">Срез рынка</span>
        <div role="group" aria-label="Быстрый выбор периода">
          <button className={date.mode === "today" ? "is-active" : undefined} type="button" onClick={date.setToday}>Сегодня</button>
          <button className={date.mode === "yesterday" ? "is-active" : undefined} type="button" onClick={date.setYesterday}>Прошлая сессия</button>
        </div>
        <label className="tr-session-picker" title="Выбрать торговую дату">
          <CalendarDays size={13} aria-hidden />
          <input name="trading-date" autoComplete="off" type="date" value={date.selectedDateKey} max={moscowTodayKey()} onChange={(event) => date.setPickedDate(event.target.value)} aria-label="Торговая дата" />
        </label>
        <span className="tr-session-resolved sk-mono">данные {formatCompactDateKey(resolvedDateKey)}</span>
      </div>

      <MarketStrip
        benchmark={benchmark}
        summary={market}
        status={query.data?.status}
        indexSessions={marketContext.data?.indexSessions ?? []}
        turnoverSessions={marketContext.data?.turnoverSessions ?? []}
        contextLoading={marketContext.isLoading}
        isLive={date.isLive}
        turnoverComparison={turnoverComparison}
      />
      <div className="tr-priority-workspace">
        <InPlayWorkspace
          items={focusItems}
          benchmark={benchmark}
          universe={universe.stockRows}
          seriesByTicker={focusCharts.seriesByTicker}
          chartsLoading={focusCharts.isLoading}
          chartsError={focusCharts.isError}
          chartsEnabled={date.isLive}
          onFocus={focusTicker}
        />
        <aside className="tr-support-rails" aria-label="Дополнительные радары">
          <PriorityRail kind="liquidity" items={liquidityItems} onFocus={focusTicker} />
          <PriorityRail kind="shots" items={shotItems} onFocus={focusTicker} />
        </aside>
      </div>

      {error ? <SectorKDataError error={error} /> : null}

      <section className="sk-panel tr-screener-workspace">
        <div className="tr-table-heading">
          <div><span className="tr-label">Скринер акций</span><strong>Полный список</strong></div>
          <span className="sk-mono">показано {visible.length} из {universe.stockRows.length}</span>
        </div>

        <div className="sk-screener-toolbar tr-screener-toolbar">
          <div className="sk-toolbar-group">
            <label className="sk-liquidity-toggle" title="Скрывает бумаги из нижних 42% рынка одновременно по обороту и сделкам в текущем срезе">
              <input
                type="checkbox"
                checked={hideIlliquid}
                onChange={(event) => {
                  const nextChecked = event.target.checked;
                  startTransition(() => {
                    setOptimisticHideIlliquid(nextChecked);
                    replaceQuery({ illiquid: nextChecked ? null : "show" });
                  });
                }}
              />
              <span>Скрыть жёсткий неликвид</span>
            </label>
          </div>

          <div className="sk-toolbar-group sk-toolbar-group--right">
            <label className="sk-search" aria-label="Поиск инструмента">
              <Search size={14} aria-hidden />
              <input name="stock-search" autoComplete="off" className="sk-input" value={search} onChange={(event) => replaceQuery({ q: event.target.value || null })} placeholder="Тикер или название…" />
              {search ? <button type="button" onClick={() => replaceQuery({ q: null })} aria-label="Очистить поиск"><X size={13} aria-hidden /></button> : null}
            </label>
            <details className="sk-column-menu">
              <summary aria-label="Настроить колонки" title="Колонки"><SlidersHorizontal size={14} aria-hidden /></summary>
              <div className="sk-column-menu__panel">
                {STOCK_COLUMNS.map((column) => (
                  <label key={column.id}>
                    <input type="checkbox" checked={visibleColumns.has(column.id)} onChange={() => toggleColumn(column.id)} />
                    <span>{column.label}</span>
                  </label>
                ))}
              </div>
            </details>
            {hasCustomState ? <button type="button" className="sk-reset sk-reset--icon" onClick={reset} aria-label="Сбросить" title="Сбросить"><RotateCcw size={14} aria-hidden /></button> : null}
          </div>
        </div>

        {query.isPending && !query.data ? <SectorKLoading /> : (
          <div className="sk-table-wrap sk-table-wrap--market tr-table-wrap">
            <table className="sk-table sk-table--stocks tr-stock-table">
              <thead>
                <tr>
                  <th className="sk-table__sticky">Инструмент</th>
                  {visibleColumns.has("price") ? <SortableHeader label="Цена" sortKey="price" activeKey={sortKey} direction={direction} onSort={setSort} /> : null}
                  {visibleColumns.has("change") ? <SortableHeader label="%" sortKey="change" activeKey={sortKey} direction={direction} onSort={setSort} /> : null}
                  {visibleColumns.has("turnover") ? <SortableHeader label="Оборот" sortKey="turnover" activeKey={sortKey} direction={direction} onSort={setSort} /> : null}
                  {visibleColumns.has("trades") ? <SortableHeader label="Сделки" sortKey="trades" activeKey={sortKey} direction={direction} onSort={setSort} /> : null}
                  {visibleColumns.has("range") ? <SortableHeader label="Диапазон" sortKey="range" activeKey={sortKey} direction={direction} onSort={setSort} /> : null}
                  <th title="Положение закрытия внутри диапазона дня">Закрытие</th>
                  <th title="Изменение бумаги минус изменение индекса MOEX">От рынка</th>
                  <th className="sk-table__chart-head"><span className="sk-sr-only">График</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const selected = row.ticker === selectedTicker;
                  const expanded = row.ticker === expandedTicker;
                  const relative = tradingMarketDelta(row, benchmark);
                  return (
                    <Fragment key={row.ticker}>
                      <tr
                        id={`tr-stock-${row.ticker}`}
                        className={selected ? "is-selected" : undefined}
                        onClick={() => setSelectedTicker(row.ticker)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedTicker(row.ticker);
                          }
                        }}
                        tabIndex={0}
                        aria-selected={selected}
                      >
                        <td className="sk-table__sticky sk-table__instrument">
                          <button className="sk-ticker-copy" type="button" onClick={(event) => { event.stopPropagation(); void copyTicker(row.ticker); }} title="Скопировать тикер">
                            <span className="sk-ticker"><strong>{row.ticker}</strong><small>{row.shortName}</small></span>
                            {copiedTicker === row.ticker ? <span className="sk-copy-state">Скопирован</span> : null}
                          </button>
                        </td>
                        {visibleColumns.has("price") ? <td className="sk-mono">{formatSectorKPrice(row.lastPrice)}</td> : null}
                        {visibleColumns.has("change") ? <td className={`sk-mono tr-change-value ${changeValueClass(row.percentChange)}`}>{formatSectorKPercent(row.percentChange)}</td> : null}
                        {visibleColumns.has("turnover") ? <td className="sk-mono">{formatSectorKTurnover(row.turnover)}</td> : null}
                        {visibleColumns.has("trades") ? <td className="sk-mono">{formatTrades(row.tradesCount)}</td> : null}
                        {visibleColumns.has("range") ? <td className="sk-mono">{formatSectorKMagnitudePercent(row.metrics.dayRangePct)}</td> : null}
                        <td title="Положение закрытия: 0% — минимум дня, 100% — максимум"><DayPosition value={tradingDayPosition(row)} compact /></td>
                        <td className="sk-mono tr-market-relative" title="Изменение бумаги минус изменение индекса MOEX. Минус — слабее рынка, плюс — сильнее.">{formatMarketDelta(relative)}</td>
                        <td className="sk-table__chart-cell">
                          <button
                            type="button"
                            className={expanded ? "is-active" : undefined}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedTicker(row.ticker);
                              setExpandedTicker(expanded ? null : row.ticker);
                            }}
                            aria-expanded={expanded}
                            aria-label={`${expanded ? "Закрыть" : "Открыть"} график ${row.ticker}`}
                          >
                            <ChartNoAxesCombined size={14} aria-hidden />
                          </button>
                        </td>
                      </tr>
                      {expanded && expandedRow ? (
                        <tr className="sk-chart-row">
                          <td colSpan={visibleColumns.size + 4}>
                            <SectorKStockChart row={expandedRow} dateKey={chartDateKey} onClose={() => setExpandedTicker(null)} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {!visible.length ? <div className="sk-empty"><div><h2>—</h2><button className="sk-reset" type="button" onClick={reset}><RotateCcw size={13} />Сбросить</button></div></div> : null}
          </div>
        )}

        <footer className="sk-table-meta">
          <SectorKSource status={query.data?.status} error={error} />
          <span className="sk-mono">{formatCompactDateKey(resolvedDateKey)} · {visible.length}/{universe.stockRows.length}</span>
        </footer>
      </section>
    </div>
  );
}

function MarketStrip({
  benchmark,
  summary,
  status,
  indexSessions,
  turnoverSessions,
  contextLoading,
  isLive,
  turnoverComparison,
}: {
  benchmark: ScreenerBenchmark | null;
  summary: TradingMarketSummary;
  status?: ScreenerDataStatus;
  indexSessions: TradingIndexSession[];
  turnoverSessions: TradingTurnoverSession[];
  contextLoading: boolean;
  isLive: boolean;
  turnoverComparison: TradingTurnoverComparison | null;
}) {
  const position = tradingBenchmarkPosition(benchmark);
  const directional = summary.risingTurnover + summary.fallingTurnover;
  const upShare = directional > 0 ? (summary.risingTurnover / directional) * 100 : 50;
  const downShare = directional > 0 ? (summary.fallingTurnover / directional) * 100 : 50;
  const balance = summary.turnoverBalancePct;
  const sourceLabel = status?.source === "moex" ? "MOEX ISS" : (status?.source ?? "источник");
  const resolvedDate = status?.resolvedTradingDateKey ?? turnoverSessions.at(-1)?.dateKey ?? null;

  return (
    <section className="tr-market-strip" aria-label="Состояние рынка акций">
      <div className="tr-market-index">
        <div className="tr-market-index__top">
          <span className="tr-label">Рынок · {sourceLabel}</span>
          <strong className="tr-market-code">MOEX <small className="sk-mono">{benchmark?.code ?? "IMOEX2"}</small></strong>
        </div>
        <div className="tr-market-index__quote">
          <b className="sk-mono">{formatSectorKPrice(benchmark?.lastValue)}</b>
          <span className={`sk-mono tr-change-value ${changeValueClass(benchmark?.percentChange)}`}>{formatSectorKPercent(benchmark?.percentChange)}</span>
        </div>
        <MarketIndexSessions sessions={indexSessions} loading={contextLoading} indexCode={benchmark?.code ?? "IMOEX2"} isLive={isLive} />
        <div className="tr-range-line" title="Положение закрытия внутри диапазона последней сессии">
          <span className="sk-mono">L {formatSectorKPrice(benchmark?.low)}</span>
          <DayPosition value={position} />
          <span className="sk-mono">H {formatSectorKPrice(benchmark?.high)}</span>
        </div>
      </div>

      <MarketTurnoverFact
        current={summary.totalTurnover}
        sessions={turnoverSessions}
        loading={contextLoading}
        isLive={isLive}
        currentDate={resolvedDate}
        comparison={turnoverComparison}
      />
      <MarketInternalsFact
        summary={summary}
        balance={balance}
        upShare={upShare}
        downShare={downShare}
      />
    </section>
  );
}

function MarketInternalsFact({
  summary,
  balance,
  upShare,
  downShare,
}: {
  summary: TradingMarketSummary;
  balance: number | null;
  upShare: number;
  downShare: number;
}) {
  return (
    <div className="tr-market-internals">
      <span className="tr-label">Рынок в цифрах</span>
      <div className="tr-internals-grid">
        <div>
          <small>Ширина</small>
          <strong className="sk-mono"><span className="sk-change--positive">{summary.rising} ↑</span><span className="sk-change--negative">{summary.falling} ↓</span></strong>
        </div>
        <div>
          <small>Баланс оборота</small>
          <strong className="sk-mono">{formatSectorKPercent(balance, 0)}</strong>
        </div>
        <div>
          <small>Сделки</small>
          <strong className="sk-mono">{formatTrades(summary.totalTrades)}</strong>
        </div>
      </div>
      <div className="tr-balance-numbers sk-mono">
        <span className="sk-change--positive">↑ {formatSectorKTurnover(summary.risingTurnover)}</span>
        <span className="sk-change--negative">{formatSectorKTurnover(summary.fallingTurnover)} ↓</span>
      </div>
      <div className="tr-balance-bar" aria-label={`Оборот растущих ${upShare.toFixed(0)}%, падающих ${downShare.toFixed(0)}%`}>
        <span className="is-up" style={{ width: `${upShare}%` }} />
        <span className="is-down" style={{ width: `${downShare}%` }} />
      </div>
      <small className="tr-internals-foot sk-mono">без изменений {summary.flat} · источник направления — изменение к предыдущему закрытию</small>
    </div>
  );
}

function MarketTurnoverFact({
  current,
  sessions,
  loading,
  isLive,
  currentDate,
  comparison,
}: {
  current: number | null;
  sessions: TradingTurnoverSession[];
  loading: boolean;
  isLive: boolean;
  currentDate: string | null;
  comparison: TradingTurnoverComparison | null;
}) {
  const completed = sessions.filter((session) => !isLive || session.dateKey !== currentDate);
  const values = isLive && currentDate && isFiniteMetric(current)
    ? [...completed.slice(-7), { dateKey: currentDate, turnover: current, trades: 0 }]
    : sessions.slice(-8).map((session, index, list) => ({
        ...session,
        turnover: index === list.length - 1 && isFiniteMetric(current) ? current : session.turnover,
      }));
  const max = Math.max(...values.map((item) => item.turnover), 1);
  const ratioTone = comparison == null ? "is-muted" : comparison.ratio >= 1.15 ? "is-strong" : comparison.ratio <= 0.85 ? "is-weak" : "is-normal";
  const ratioLabel = comparison
    ? `${comparison.ratio >= 1.15 ? "выше" : comparison.ratio <= 0.85 ? "ниже" : "около"} прошлых ${comparison.sessions} сессий к ${comparison.timeMsk ?? "текущему времени"}`
    : isLive ? "сравнение к этому времени недоступно" : "8 завершённых сессий";
  return (
    <div className="tr-market-fact tr-market-turnover">
      <span className="tr-label">Оборот рынка</span>
      <div className="tr-turnover-quote">
        <strong className="sk-mono">{formatSectorKTurnover(current)}</strong>
        {comparison ? <b className={`sk-mono tr-turnover-ratio ${ratioTone}`}>{comparison.ratio.toFixed(1)}×</b> : null}
      </div>
      <div className="tr-turnover-bars" aria-label="Оборот за восемь последних торговых сессий">
        {values.map((item, index) => (
          <i
            className={index === values.length - 1 ? "is-current" : ""}
            key={item.dateKey}
            style={{ height: `${Math.max(8, (item.turnover / max) * 100)}%` }}
            title={`${formatCompactDateKey(item.dateKey)} · ${formatSectorKTurnover(item.turnover)}`}
          />
        ))}
        {!values.length && !loading ? <span>истории нет</span> : null}
        {loading ? <span>история…</span> : null}
      </div>
      <small title={comparison ? `Покрытие ${comparison.coveragePct.toFixed(0)}% оборота · ${comparison.instruments} инструментов` : undefined}>{ratioLabel}</small>
    </div>
  );
}

const MARKET_DAY_MARKERS = [
  { minutes: 7 * 60, label: "07 утро", title: "Утренняя сессия" },
  { minutes: 9 * 60 + 50, label: "10 основная", title: "Основная сессия" },
  { minutes: 15 * 60, label: "15 США", title: "США · вторая половина" },
  { minutes: 19 * 60, label: "19 вечер", title: "Вечерняя сессия" },
] as const;

function moscowMinutes(raw: string): number | null {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
}

function MarketIndexSessions({ sessions, loading, indexCode, isLive }: { sessions: TradingIndexSession[]; loading: boolean; indexCode: string; isLive: boolean }) {
  const width = 420;
  const height = 72;
  const previousWidth = 126;
  const currentStart = 146;
  const marketStart = 7 * 60;
  const marketEnd = 23 * 60 + 50;
  const todayKey = moscowTodayKey();
  const targetDateKey = isLive ? todayKey : sessions.at(-1)?.dateKey ?? null;
  const currentSession = targetDateKey ? sessions.find((session) => session.dateKey === targetDateKey) : undefined;
  const previousSessions = sessions.filter((session) => session.dateKey !== targetDateKey).slice(-2);
  const visibleSessions = [...previousSessions, ...(currentSession ? [currentSession] : [])];
  const allValues = visibleSessions.flatMap((session) => session.points.map((point) => point.close));
  const low = allValues.length > 0 ? Math.min(...allValues) : 0;
  const high = allValues.length > 0 ? Math.max(...allValues) : 1;
  const span = high - low || 1;
  const padding = span * 0.08;
  const chartTop = 14;
  const chartBottom = height - 7;
  const yFor = (value: number) => chartBottom - ((value - (low - padding)) / (span + padding * 2)) * (chartBottom - chartTop);
  const coordinates = (session: TradingIndexSession, xStart: number, xEnd: number, byTime = false) => session.points.map((point, index) => {
    const minute = byTime ? moscowMinutes(point.time) : null;
    const progress = minute == null
      ? index / Math.max(1, session.points.length - 1)
      : Math.min(1, Math.max(0, (minute - marketStart) / (marketEnd - marketStart)));
    return { x: xStart + progress * (xEnd - xStart), y: yFor(point.close) };
  });
  const path = (points: Array<{ x: number; y: number }>) => points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const previousSegments = previousSessions.map((session, index) => {
    const segment = previousWidth / Math.max(1, previousSessions.length);
    const xStart = index * segment;
    return { session, points: coordinates(session, xStart, xStart + segment - 7) };
  });
  const currentPoints = currentSession ? coordinates(currentSession, currentStart, width, true) : [];
  const renderedSegments = [...previousSegments, ...(currentSession ? [{ session: currentSession, points: currentPoints }] : [])];
  const gapPaths = renderedSegments.slice(1).map((segment, index) => {
    const previous = renderedSegments[index]?.points.at(-1);
    const next = segment.points[0];
    return previous && next ? `M${previous.x.toFixed(2)},${previous.y.toFixed(2)} L${next.x.toFixed(2)},${next.y.toFixed(2)}` : "";
  }).filter(Boolean);
  const nowMinutes = isLive ? moscowMinutes(new Date().toISOString()) : null;
  const nowX = nowMinutes == null ? null : currentStart + Math.min(1, Math.max(0, (nowMinutes - marketStart) / (marketEnd - marketStart))) * (width - currentStart);
  const currentPoint = currentPoints.at(-1);
  const shortDate = (dateKey: string) => dateKey.slice(5).split("-").reverse().join(".");

  return (
    <div className="tr-index-sessions">
      <div className="tr-index-sessions__legend">
        <span>{previousSessions.length ? `прошлые · ${previousSessions.map((session) => shortDate(session.dateKey)).join(" / ")}` : "прошлые сессии —"}</span>
        <i className="is-current">{isLive ? "сегодня" : "сессия"} · {currentSession ? shortDate(currentSession.dateKey) : "данных пока нет"}</i>
      </div>
      {visibleSessions.length ? (
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${indexCode}: фактические уровни двух прошлых сессий и выбранной сессии; разрывы между днями сохранены`}>
          <line className="tr-index-sessions__grid" x1="0" x2={width} y1={height / 2} y2={height / 2} />
          <line className="tr-index-sessions__divider" x1="136" x2="136" y1="5" y2={height} />
          {previousSegments.map(({ session, points }) => <path d={path(points)} key={session.dateKey} />)}
          {gapPaths.map((gap, index) => <path className="is-gap" d={gap} key={`gap-${index}`} />)}
          {MARKET_DAY_MARKERS.map((marker) => {
            const x = currentStart + ((marker.minutes - marketStart) / (marketEnd - marketStart)) * (width - currentStart);
            const future = isLive && nowMinutes != null && marker.minutes > nowMinutes;
            return (
              <g className={`tr-index-sessions__marker ${future ? "is-future" : ""}`} key={marker.minutes}>
                <title>{marker.title}</title>
                <line x1={x} x2={x} y1="11" y2={height} />
                <text x={x + 3} y="8">{marker.label}</text>
              </g>
            );
          })}
          {currentSession ? <path className="is-current" d={path(currentPoints)} /> : null}
          {isLive && nowX != null ? <line className="tr-index-sessions__now" x1={nowX} x2={nowX} y1="12" y2={height} /> : null}
          {isLive && currentPoint ? <circle className="tr-index-sessions__current-point" cx={currentPoint.x} cy={currentPoint.y} r="2.4" /> : null}
        </svg>
      ) : <div className="tr-index-sessions__empty">{loading ? "получаем IMOEX" : "интрадей недоступен"}</div>}
    </div>
  );
}

function InPlayWorkspace({
  items,
  benchmark,
  universe,
  seriesByTicker,
  chartsLoading,
  chartsError,
  chartsEnabled,
  onFocus,
}: {
  items: StockPriority[];
  benchmark: ScreenerBenchmark | null;
  universe: ScreenerRow[];
  seriesByTicker: Map<string, StockSparklineSeries>;
  chartsLoading: boolean;
  chartsError: boolean;
  chartsEnabled: boolean;
  onFocus: (ticker: string) => void;
}) {
  return (
    <section className="tr-inplay-workspace" aria-label="Акции в игре">
      <header className="tr-inplay-workspace__head">
        <div>
          <span className="tr-label">Главный фокус</span>
          <h2>В игре <b className="sk-mono">{items.length || "—"}</b></h2>
        </div>
      </header>
      <div className="tr-inplay__rows">
        {items.map((item) => (
          <InPlayRow
            item={item}
            benchmark={benchmark}
            universe={universe}
            series={seriesByTicker.get(item.row.ticker)}
            chartLoading={chartsEnabled && chartsLoading}
            chartError={chartsEnabled && chartsError}
            chartsEnabled={chartsEnabled}
            onFocus={onFocus}
            key={item.secid}
          />
        ))}
        {!items.length ? (
          <div className="tr-inplay-empty">
            <strong>Подтверждённых ситуаций нет</strong>
            <span>Интерфейс не заполняет «В игре» случайными ликвидными бумагами.</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function InPlayRow({
  item,
  benchmark,
  universe,
  series,
  chartLoading,
  chartError,
  chartsEnabled,
  onFocus,
}: {
  item: StockPriority;
  benchmark: ScreenerBenchmark | null;
  universe: ScreenerRow[];
  series?: StockSparklineSeries;
  chartLoading: boolean;
  chartError: boolean;
  chartsEnabled: boolean;
  onFocus: (ticker: string) => void;
}) {
  const row = item.row;
  const relative = tradingMarketDelta(row, benchmark);
  const position = tradingDayPosition(row);
  const turnoverComparison = tradingTurnoverComparisonForRow(row);
  const reasons = buildTradingWhyReasons(row, benchmark, universe);

  return (
    <button className="tr-inplay-row" type="button" onClick={() => onFocus(row.ticker)} title={`Открыть ${row.shortName} в таблице и показать график`}>
      <div className="tr-inplay-row__identity">
        <div>
          <strong className="sk-mono">{row.ticker}</strong>
          <small>{row.shortName}</small>
        </div>
        <div className="tr-inplay-row__quote">
          <b className="sk-mono">{formatSectorKPrice(row.lastPrice)}</b>
          <span className={`sk-mono tr-change-value ${changeValueClass(row.percentChange)}`}>{formatSectorKPercent(row.percentChange)}</span>
        </div>
      </div>
      <TradingMiniChart
        series={series}
        change={row.percentChange}
        loading={chartLoading}
        error={chartError || !chartsEnabled}
        unavailableLabel={chartsEnabled ? undefined : "график только для текущей сессии"}
      />
      <div className="tr-inplay-row__analysis">
        <div className="tr-inplay-row__facts">
          <InPlayFact label="Оборот" value={formatSectorKTurnover(row.turnover)} />
          <InPlayFact
            label="Оборот ×"
            value={turnoverComparison ? `${turnoverComparison.ratio.toFixed(1)}×` : "—"}
            title={turnoverComparison ? `К прошлым ${turnoverComparison.sessions} сессиям на ${turnoverComparison.timeMsk ?? "это время"}; ${turnoverComparison.quality === "confirmed" ? "подтверждённая" : "частичная"} база` : "Сопоставимой истории к этому времени нет"}
          />
          <InPlayFact label="Сделки" value={formatTrades(row.tradesCount)} />
          <InPlayFact label="Диапазон" value={formatSectorKMagnitudePercent(row.metrics.dayRangePct)} />
          <InPlayFact label="Закрытие" value={isFiniteMetric(position) ? `${position.toFixed(0)}% снизу` : "—"} title="0% — минимум дня, 100% — максимум" />
          <InPlayFact label="От рынка" value={formatMarketDelta(relative)} title="Изменение бумаги минус изменение MOEX" />
        </div>
        <div className="tr-inplay-row__why">
          <span className="tr-label">Факторы</span>
          <div>
            {reasons.map((reason) => <span className={`is-${reason.tone}`} key={reason.code}>{reason.label}</span>)}
            {!reasons.length ? <span className="is-neutral">причина не подтверждена</span> : null}
          </div>
        </div>
      </div>
    </button>
  );
}

function PriorityRail({
  kind,
  items,
  onFocus,
}: {
  kind: "liquidity" | "shots";
  items: StockPriority[];
  onFocus: (ticker: string) => void;
}) {
  const liquidity = kind === "liquidity";
  return (
    <section className={`tr-support-rail is-${kind}`}>
      <header>
        <div>
          <span className="tr-label">{liquidity ? "Исполнение" : "Тонкое движение"}</span>
          <h3>{liquidity ? "Ликвидность" : "Прострелы"}</h3>
        </div>
        <b className="sk-mono">{items.length}</b>
      </header>
      <div className="tr-support-rail__list">
        {items.map((item) => {
          const row = item.row;
          return (
            <button type="button" key={item.secid} onClick={() => onFocus(row.ticker)}>
              <span><strong className="sk-mono">{row.ticker}</strong><small>{row.shortName}</small></span>
              <span className="sk-mono">
                <b className={liquidity ? "" : changeClass(row.percentChange)}>
                  {liquidity ? formatSectorKTurnover(row.turnover) : formatSectorKMagnitudePercent(row.metrics.dayRangePct)}
                </b>
                <small>{liquidity ? `${formatTrades(row.tradesCount)} сделок` : `${formatSectorKPercent(row.percentChange)} · ${formatSectorKTurnover(row.turnover)}`}</small>
              </span>
            </button>
          );
        })}
        {!items.length ? <div className="tr-support-rail__empty">—</div> : null}
      </div>
    </section>
  );
}

function InPlayFact({ label, value, title }: { label: string; value: string; title?: string }) {
  return <span title={title}><small>{label}</small><strong className="sk-mono">{value}</strong></span>;
}

function DayPosition({ value, compact = false }: { value: number | null; compact?: boolean }) {
  const pct = isFiniteMetric(value) ? value : 50;
  return (
    <span className={`tr-day-position ${compact ? "is-compact" : ""}`} title={isFiniteMetric(value) ? `${value.toFixed(0)}% диапазона дня` : "Нет полного диапазона"}>
      <i style={{ left: `${pct}%` }} />
      {compact ? <b className="sk-mono">{isFiniteMetric(value) ? `${value.toFixed(0)}%` : "—"}</b> : null}
    </span>
  );
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SectorKStockSortKey;
  activeKey: SectorKStockSortKey;
  direction: SectorKSortDirection;
  onSort: (key: SectorKStockSortKey) => void;
}) {
  const active = sortKey === activeKey;
  const Icon = !active ? ArrowUpDown : direction === "desc" ? ArrowDown : ArrowUp;
  return (
    <th aria-sort={active ? direction === "desc" ? "descending" : "ascending" : "none"}>
      <button className={`sk-sort-button ${active ? "is-active" : ""}`} type="button" onClick={() => onSort(sortKey)}>
        <span>{label}</span><Icon size={12} aria-hidden />
      </button>
    </th>
  );
}
