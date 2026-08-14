"use client";

import type { ScreenerBenchmark } from "@screenerpro/shared";
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
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import { useSelectedTradingDate } from "@/lib/hooks/use-selected-trading-date";
import { buildStockScreenerUniverse } from "@/lib/screener/stock-universe-filter";
import {
  buildSectorKStockActivity,
  formatSectorKPercent,
  formatSectorKPrice,
  formatSectorKTurnover,
  getSectorKLiquidTickers,
  selectSectorKImpulses,
  selectSectorKInPlay,
  sortSectorKStocks,
  type SectorKSortDirection,
  type SectorKStockActivity,
  type SectorKStockSortKey,
} from "@/lib/sector-k/market";
import { formatCompactDateKey, moscowTodayKey } from "@/lib/domain/trading-calendar";

const SORT_KEYS = new Set<SectorKStockSortKey>(["price", "change", "turnover", "trades", "range"]);
const STOCK_COLUMNS: Array<{ id: SectorKStockSortKey; label: string }> = [
  { id: "price", label: "Цена" },
  { id: "change", label: "Изменение" },
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

function ratioLabel(item: SectorKStockActivity): string {
  return item.volumeRatioNow == null ? "—" : `x${item.volumeRatioNow.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}`;
}

export function SectorKStocks() {
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
  const inPlay = useMemo(() => date.isLive ? selectSectorKInPlay(activity) : [], [activity, date.isLive]);
  const impulses = useMemo(() => selectSectorKImpulses(activity), [activity]);

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

  const benchmarks = useMemo(
    () => [...(query.data?.benchmarks ?? [])].sort((left, right) => benchmarkOrder(left) - benchmarkOrder(right)),
    [query.data?.benchmarks],
  );
  const expandedRow = expandedTicker ? universe.stockRows.find((row) => row.ticker === expandedTicker) ?? null : null;
  const error = query.error instanceof Error ? query.error : null;
  const hasCustomState =
    sortKey !== "trades" ||
    direction !== "desc" ||
    Boolean(search) ||
    !hideIlliquid ||
    visibleColumns.size !== STOCK_COLUMNS.length;
  const resolvedDateKey = query.data?.status.resolvedTradingDateKey ?? date.selectedDateKey;
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
    const nextDirection = sortKey === nextKey
      ? direction === "desc" ? "asc" : "desc"
      : defaultDirection(nextKey);
    replaceQuery({
      sort: nextKey === "trades" ? null : nextKey,
      dir: nextDirection === "asc" ? "asc" : null,
    });
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
    document.getElementById(`sk-stock-${ticker}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="sk-page sk-stocks-page">
      <h1 className="sk-sr-only">Акции</h1>

      <StockSignalStrip inPlay={inPlay} impulses={impulses} onFocus={focusTicker} />

      {error ? <SectorKDataError error={error} /> : null}

      <section className="sk-panel sk-screener-workspace">
        <div className="sk-screener-toolbar">
          <div className="sk-toolbar-group">
            <label className="sk-date-control" title="Торговая дата">
              <CalendarDays size={14} />
              <input
                type="date"
                value={date.selectedDateKey}
                max={moscowTodayKey()}
                onChange={(event) => date.setPickedDate(event.target.value)}
                aria-label="Торговая дата"
              />
            </label>
            {!date.isLive ? <button className="sk-compact-action" type="button" onClick={date.setToday}>Сейчас</button> : null}
            <label className="sk-liquidity-toggle" title="Скрывает нижний хвост рынка одновременно по обороту и сделкам">
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
              <span>Скрыть неликвиды</span>
            </label>
          </div>

          <div className="sk-toolbar-group sk-toolbar-group--right">
            <label className="sk-search" aria-label="Поиск инструмента">
              <Search size={14} />
              <input
                className="sk-input"
                value={search}
                onChange={(event) => replaceQuery({ q: event.target.value || null })}
                placeholder="Тикер или название"
              />
              {search ? <button type="button" onClick={() => replaceQuery({ q: null })} aria-label="Очистить поиск"><X size={13} /></button> : null}
            </label>
            <details className="sk-column-menu">
              <summary aria-label="Настроить колонки" title="Колонки"><SlidersHorizontal size={14} /></summary>
              <div className="sk-column-menu__panel">
                {STOCK_COLUMNS.map((column) => (
                  <label key={column.id}>
                    <input type="checkbox" checked={visibleColumns.has(column.id)} onChange={() => toggleColumn(column.id)} />
                    <span>{column.label}</span>
                  </label>
                ))}
              </div>
            </details>
            {hasCustomState ? <button type="button" className="sk-reset sk-reset--icon" onClick={reset} aria-label="Сбросить" title="Сбросить"><RotateCcw size={14} /></button> : null}
          </div>
        </div>

        {query.isPending && !query.data ? <SectorKLoading /> : (
          <div className="sk-table-wrap sk-table-wrap--market">
            <table className="sk-table sk-table--stocks">
              <thead>
                <tr>
                  <th className="sk-table__sticky">Инструмент</th>
                  {visibleColumns.has("price") ? <SortableHeader label="Цена" sortKey="price" activeKey={sortKey} direction={direction} onSort={setSort} /> : null}
                  {visibleColumns.has("change") ? <SortableHeader label="Изменение" sortKey="change" activeKey={sortKey} direction={direction} onSort={setSort} /> : null}
                  {visibleColumns.has("turnover") ? <SortableHeader label="Оборот" sortKey="turnover" activeKey={sortKey} direction={direction} onSort={setSort} /> : null}
                  {visibleColumns.has("trades") ? <SortableHeader label="Сделки" sortKey="trades" activeKey={sortKey} direction={direction} onSort={setSort} /> : null}
                  {visibleColumns.has("range") ? <SortableHeader label="Диапазон" sortKey="range" activeKey={sortKey} direction={direction} onSort={setSort} /> : null}
                  <th className="sk-table__chart-head"><span className="sk-sr-only">График</span></th>
                </tr>
              </thead>
              <tbody className="sk-index-rows">
                {benchmarks.map((benchmark) => (
                  <BenchmarkRow benchmark={benchmark} visibleColumns={visibleColumns} key={benchmark.code} />
                ))}
              </tbody>
              <tbody>
                {visible.map((row) => {
                  const selected = row.ticker === selectedTicker;
                  const expanded = row.ticker === expandedTicker;
                  return (
                    <Fragment key={row.ticker}>
                      <tr
                        id={`sk-stock-${row.ticker}`}
                        className={selected ? "is-selected" : undefined}
                        onClick={() => setSelectedTicker(row.ticker)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") setSelectedTicker(row.ticker);
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
                        {visibleColumns.has("change") ? <td className={`sk-mono ${(row.percentChange ?? 0) >= 0 ? "sk-change--positive" : "sk-change--negative"}`}>{formatSectorKPercent(row.percentChange)}</td> : null}
                        {visibleColumns.has("turnover") ? <td className="sk-mono">{formatSectorKTurnover(row.turnover)}</td> : null}
                        {visibleColumns.has("trades") ? <td className="sk-mono">{row.tradesCount?.toLocaleString("ru-RU") ?? "—"}</td> : null}
                        {visibleColumns.has("range") ? <td className="sk-mono">{formatSectorKPercent(row.metrics.dayRangePct)}</td> : null}
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
                            <ChartNoAxesCombined size={14} />
                          </button>
                        </td>
                      </tr>
                      {expanded && expandedRow ? (
                        <tr className="sk-chart-row">
                          <td colSpan={visibleColumns.size + 2}>
                            <SectorKStockChart row={expandedRow} dateKey={chartDateKey} onClose={() => setExpandedTicker(null)} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {!visible.length ? <div className="sk-empty"><div><h2>Нет инструментов</h2><button className="sk-reset" type="button" onClick={reset}><RotateCcw size={13} />Сбросить</button></div></div> : null}
          </div>
        )}

        <footer className="sk-table-meta">
          <SectorKSource status={query.data?.status} error={error} />
          <span className="sk-mono">TQBR · {formatCompactDateKey(resolvedDateKey)} · {visible.length}/{universe.stockRows.length}</span>
        </footer>
      </section>
    </div>
  );
}

function StockSignalStrip({
  inPlay,
  impulses,
  onFocus,
}: {
  inPlay: SectorKStockActivity[];
  impulses: SectorKStockActivity[];
  onFocus: (ticker: string) => void;
}) {
  return (
    <section className="sk-stock-signals" aria-label="Акции в игре и импульсы">
      <div className="sk-stock-signals__lane">
        <header><strong>В игре</strong><span className="sk-mono">{inPlay.length || "—"}</span></header>
        <div className="sk-stock-signals__items">
          {inPlay.map((item) => (
            <button type="button" key={item.row.ticker} onClick={() => onFocus(item.row.ticker)} title={`Оборот к норме на тот же момент: ${ratioLabel(item)}`}>
              <strong>{item.row.ticker}</strong><span>{ratioLabel(item)}</span>
            </button>
          ))}
          {!inPlay.length ? <span className="sk-stock-signals__empty">—</span> : null}
        </div>
      </div>
      <div className="sk-stock-signals__lane sk-stock-signals__lane--impulse">
        <header><strong>Импульсы</strong><span className="sk-mono">{impulses.length || "—"}</span></header>
        <div className="sk-stock-signals__items">
          {impulses.map((item) => {
            const positive = (item.row.percentChange ?? 0) >= 0;
            return (
              <button className={positive ? "is-positive" : "is-negative"} type="button" key={item.row.ticker} onClick={() => onFocus(item.row.ticker)}>
                <strong>{item.row.ticker}</strong><span>{formatSectorKPercent(item.row.percentChange)}</span>
              </button>
            );
          })}
          {!impulses.length ? <span className="sk-stock-signals__empty">—</span> : null}
        </div>
      </div>
    </section>
  );
}

function BenchmarkRow({
  benchmark,
  visibleColumns,
}: {
  benchmark: ScreenerBenchmark;
  visibleColumns: Set<SectorKStockSortKey>;
}) {
  return (
    <tr className="sk-index-row">
      <td className="sk-table__sticky sk-table__instrument">
        <span className="sk-ticker"><strong>{benchmark.code}</strong><small>Индекс МосБиржи</small></span>
      </td>
      {visibleColumns.has("price") ? <td className="sk-mono">{formatSectorKPrice(benchmark.lastValue)}</td> : null}
      {visibleColumns.has("change") ? <td className={`sk-mono ${(benchmark.percentChange ?? 0) >= 0 ? "sk-change--positive" : "sk-change--negative"}`}>{formatSectorKPercent(benchmark.percentChange)}</td> : null}
      {visibleColumns.has("turnover") ? <td className="sk-mono" title="Суммарный оборот рынка акций">{formatSectorKTurnover(benchmark.aggregateTurnover)}</td> : null}
      {visibleColumns.has("trades") ? <td className="sk-mono" title="Суммарные сделки рынка акций">{benchmark.aggregateTrades?.toLocaleString("ru-RU") ?? "—"}</td> : null}
      {visibleColumns.has("range") ? <td className="sk-mono">{formatSectorKPercent(benchmark.dayRangePct)}</td> : null}
      <td />
    </tr>
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
