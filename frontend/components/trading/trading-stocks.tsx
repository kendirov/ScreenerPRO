"use client";

import type { ScreenerBenchmark, ScreenerRow } from "@screenerpro/shared";
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
import { Fragment, startTransition, useMemo, useOptimistic, useState, type CSSProperties } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SectorKDataError, SectorKLoading, SectorKSource } from "@/components/sector-k/sector-k-data-state";
import { SectorKStockChart } from "@/components/sector-k/sector-k-stock-chart";
import { resolveHonestTradesRatio, resolveHonestVolumeRatio } from "@/lib/domain/baseline-info";
import { formatCompactDateKey, moscowTodayKey } from "@/lib/domain/trading-calendar";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import { useSelectedTradingDate } from "@/lib/hooks/use-selected-trading-date";
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

type TableView = "all" | "in-play" | "liquidity" | "shots";
type StockPriority = PriorityInstrument<ScreenerRow>;

type MarketSummary = {
  rising: number;
  falling: number;
  flat: number;
  totalTurnover: number;
  totalTrades: number;
  risingTurnover: number;
  fallingTurnover: number;
  flatTurnover: number;
  turnoverBalancePct: number | null;
};

type SharedScales = {
  turnover: number;
  trades: number;
  range: number;
  marketDelta: number;
};

const SORT_KEYS = new Set<SectorKStockSortKey>(["price", "change", "turnover", "trades", "range"]);
const STOCK_COLUMNS: Array<{ id: SectorKStockSortKey; label: string }> = [
  { id: "price", label: "Цена" },
  { id: "change", label: "%" },
  { id: "turnover", label: "Оборот" },
  { id: "trades", label: "Сделки" },
  { id: "range", label: "Диапазон" },
];

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

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

function summarizeMarket(rows: ScreenerRow[]): MarketSummary {
  let rising = 0;
  let falling = 0;
  let flat = 0;
  let totalTurnover = 0;
  let totalTrades = 0;
  let risingTurnover = 0;
  let fallingTurnover = 0;
  let flatTurnover = 0;

  for (const row of rows) {
    const change = finite(row.percentChange) ? row.percentChange : 0;
    const turnover = finite(row.turnover) ? row.turnover : 0;
    const trades = finite(row.tradesCount) ? row.tradesCount : 0;
    totalTurnover += turnover;
    totalTrades += trades;
    if (change > 0) {
      rising += 1;
      risingTurnover += turnover;
    } else if (change < 0) {
      falling += 1;
      fallingTurnover += turnover;
    } else {
      flat += 1;
      flatTurnover += turnover;
    }
  }

  const directionalTurnover = risingTurnover + fallingTurnover;
  return {
    rising,
    falling,
    flat,
    totalTurnover,
    totalTrades,
    risingTurnover,
    fallingTurnover,
    flatTurnover,
    turnoverBalancePct: directionalTurnover > 0
      ? ((risingTurnover - fallingTurnover) / directionalTurnover) * 100
      : null,
  };
}

function dayPosition(row: ScreenerRow): number | null {
  if (!finite(row.lastPrice) || !finite(row.low) || !finite(row.high) || row.high <= row.low) return null;
  return Math.min(100, Math.max(0, ((row.lastPrice - row.low) / (row.high - row.low)) * 100));
}

function benchmarkPosition(benchmark: ScreenerBenchmark | null): number | null {
  if (!benchmark || !finite(benchmark.lastValue) || !finite(benchmark.low) || !finite(benchmark.high) || benchmark.high <= benchmark.low) return null;
  return Math.min(100, Math.max(0, ((benchmark.lastValue - benchmark.low) / (benchmark.high - benchmark.low)) * 100));
}

function marketDelta(row: ScreenerRow, benchmark: ScreenerBenchmark | null): number | null {
  if (!finite(row.percentChange) || !benchmark || !finite(benchmark.percentChange)) return null;
  return row.percentChange - benchmark.percentChange;
}

function formatMarketDelta(value: number | null): string {
  if (!finite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} п.п.`;
}

function formatTrades(value: number | null | undefined): string {
  return finite(value) ? Math.round(value).toLocaleString("ru-RU") : "—";
}

function formatRatio(value: number | null): string {
  return finite(value) ? `x${value.toFixed(1)}` : "—";
}

function changeClass(value: number | null | undefined): string {
  if (!finite(value) || value === 0) return "";
  return value > 0 ? "sk-change--positive" : "sk-change--negative";
}

function scalePct(value: number | null | undefined, max: number): number {
  if (!finite(value) || max <= 0) return 0;
  return Math.min(100, Math.max(4, (Math.abs(value) / max) * 100));
}

function buildSharedScales(items: StockPriority[], benchmark: ScreenerBenchmark | null): SharedScales {
  let turnover = 0;
  let trades = 0;
  let range = 0;
  let delta = 0;
  for (const item of items) {
    turnover = Math.max(turnover, finite(item.row.turnover) ? item.row.turnover : 0);
    trades = Math.max(trades, finite(item.row.tradesCount) ? item.row.tradesCount : 0);
    range = Math.max(range, finite(item.row.metrics.dayRangePct) ? Math.abs(item.row.metrics.dayRangePct) : 0);
    const relative = marketDelta(item.row, benchmark);
    delta = Math.max(delta, finite(relative) ? Math.abs(relative) : 0);
  }
  return { turnover, trades, range, marketDelta: delta };
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
      maxLiquidity: 6,
      maxInPlay: 3,
      maxVolatility: 6,
      variant: "stock-live-v0",
    }),
    [universe.stockRows],
  );
  const benchmark = useMemo(() => chooseBenchmark(query.data?.benchmarks ?? []), [query.data?.benchmarks]);
  const market = useMemo(() => summarizeMarket(universe.stockRows), [universe.stockRows]);
  const sharedScales = useMemo(() => buildSharedScales(priority.focusInPlayLeaders, benchmark), [benchmark, priority.focusInPlayLeaders]);

  const sortParam = searchParams.get("sort") as SectorKStockSortKey | null;
  const sortKey = sortParam && SORT_KEYS.has(sortParam) ? sortParam : "trades";
  const direction: SectorKSortDirection = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const search = searchParams.get("q") ?? "";
  const viewParam = searchParams.get("view");
  const view: TableView = viewParam === "in-play" || viewParam === "liquidity" || viewParam === "shots" ? viewParam : "all";

  const inPlayTickers = useMemo(() => new Set(priority.focusInPlayLeaders.map((item) => item.row.ticker)), [priority.focusInPlayLeaders]);
  const liquidityTickers = useMemo(() => new Set(priority.liquidityLeaders.map((item) => item.row.ticker)), [priority.liquidityLeaders]);
  const shotTickers = useMemo(() => new Set(priority.volatilityLeaders.map((item) => item.row.ticker)), [priority.volatilityLeaders]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = universe.stockRows.filter((row) => {
      if (view === "in-play" && !inPlayTickers.has(row.ticker)) return false;
      if (view === "liquidity" && !liquidityTickers.has(row.ticker)) return false;
      if (view === "shots" && !shotTickers.has(row.ticker)) return false;
      if (view === "all" && hideIlliquid && !liquidTickers.has(row.ticker)) return false;
      return !needle || `${row.ticker} ${row.shortName}`.toLowerCase().includes(needle);
    });
    return sortSectorKStocks(filtered, sortKey, direction);
  }, [direction, hideIlliquid, inPlayTickers, liquidTickers, liquidityTickers, search, shotTickers, sortKey, universe.stockRows, view]);

  const expandedRow = expandedTicker ? universe.stockRows.find((row) => row.ticker === expandedTicker) ?? null : null;
  const error = query.error instanceof Error ? query.error : null;
  const hasCustomState = sortKey !== "trades" || direction !== "desc" || Boolean(search) || !hideIlliquid || view !== "all" || visibleColumns.size !== STOCK_COLUMNS.length;
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
    const nextDirection = sortKey === nextKey ? direction === "desc" ? "asc" : "desc" : defaultDirection(nextKey);
    replaceQuery({ sort: nextKey === "trades" ? null : nextKey, dir: nextDirection === "asc" ? "asc" : null });
  }

  function reset() {
    setVisibleColumns(new Set(SORT_KEYS));
    const next = new URLSearchParams(searchParams.toString());
    for (const key of ["q", "sort", "dir", "illiquid", "view"]) next.delete(key);
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
    document.getElementById(`tr-stock-${ticker}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="sk-page tr-stocks-page">
      <h1 className="sk-sr-only">Акции</h1>

      <MarketStrip benchmark={benchmark} summary={market} />
      <PriorityWorkspace priority={priority} benchmark={benchmark} scales={sharedScales} onFocus={focusTicker} />

      {error ? <SectorKDataError error={error} /> : null}

      <section className="sk-panel tr-screener-workspace">
        <div className="tr-table-tabs" aria-label="Фильтр рынка">
          <FilterButton label="Все" count={universe.stockRows.length} active={view === "all"} onClick={() => replaceQuery({ view: null })} />
          <FilterButton label="В игре" count={priority.focusInPlayLeaders.length} active={view === "in-play"} onClick={() => replaceQuery({ view: "in-play" })} />
          <FilterButton label="Ликвидность" count={priority.liquidityLeaders.length} active={view === "liquidity"} onClick={() => replaceQuery({ view: "liquidity" })} />
          <FilterButton label="Прострелы" count={priority.volatilityLeaders.length} active={view === "shots"} onClick={() => replaceQuery({ view: "shots" })} />
        </div>

        <div className="sk-screener-toolbar tr-screener-toolbar">
          <div className="sk-toolbar-group">
            <label className="sk-date-control" title="Торговая дата">
              <CalendarDays size={14} />
              <input type="date" value={date.selectedDateKey} max={moscowTodayKey()} onChange={(event) => date.setPickedDate(event.target.value)} aria-label="Торговая дата" />
            </label>
            {!date.isLive ? <button className="sk-compact-action" type="button" onClick={date.setToday}>Сейчас</button> : null}
            <label className="sk-liquidity-toggle" title="Скрывает нижний хвост рынка по обороту и сделкам">
              <input
                type="checkbox"
                checked={hideIlliquid}
                disabled={view !== "all"}
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
              <input className="sk-input" value={search} onChange={(event) => replaceQuery({ q: event.target.value || null })} placeholder="Тикер или название" />
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
                  <th>Позиция</th>
                  <th>К рынку</th>
                  <th className="sk-table__chart-head"><span className="sk-sr-only">График</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const selected = row.ticker === selectedTicker;
                  const expanded = row.ticker === expandedTicker;
                  const relative = marketDelta(row, benchmark);
                  return (
                    <Fragment key={row.ticker}>
                      <tr id={`tr-stock-${row.ticker}`} className={selected ? "is-selected" : undefined} onClick={() => setSelectedTicker(row.ticker)} tabIndex={0} aria-selected={selected}>
                        <td className="sk-table__sticky sk-table__instrument">
                          <button className="sk-ticker-copy" type="button" onClick={(event) => { event.stopPropagation(); void copyTicker(row.ticker); }} title="Скопировать тикер">
                            <span className="sk-ticker"><strong>{row.ticker}</strong><small>{row.shortName}</small></span>
                            {copiedTicker === row.ticker ? <span className="sk-copy-state">Скопирован</span> : null}
                          </button>
                        </td>
                        {visibleColumns.has("price") ? <td className="sk-mono">{formatSectorKPrice(row.lastPrice)}</td> : null}
                        {visibleColumns.has("change") ? <td className={`sk-mono ${changeClass(row.percentChange)}`}>{formatSectorKPercent(row.percentChange)}</td> : null}
                        {visibleColumns.has("turnover") ? <td className="sk-mono">{formatSectorKTurnover(row.turnover)}</td> : null}
                        {visibleColumns.has("trades") ? <td className="sk-mono">{formatTrades(row.tradesCount)}</td> : null}
                        {visibleColumns.has("range") ? <td className="sk-mono">{formatSectorKMagnitudePercent(row.metrics.dayRangePct)}</td> : null}
                        <td><DayPosition value={dayPosition(row)} compact /></td>
                        <td className={`sk-mono ${changeClass(relative)}`}>{formatMarketDelta(relative)}</td>
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

function MarketStrip({ benchmark, summary }: { benchmark: ScreenerBenchmark | null; summary: MarketSummary }) {
  const position = benchmarkPosition(benchmark);
  const directional = summary.risingTurnover + summary.fallingTurnover;
  const upShare = directional > 0 ? (summary.risingTurnover / directional) * 100 : 50;
  const downShare = directional > 0 ? (summary.fallingTurnover / directional) * 100 : 50;
  const balance = summary.turnoverBalancePct;

  return (
    <section className="tr-market-strip" aria-label="Состояние рынка акций">
      <div className="tr-market-index">
        <div className="tr-market-index__top">
          <span className="tr-label">Рынок</span>
          <strong className="sk-mono">{benchmark?.code ?? "IMOEX"}</strong>
        </div>
        <div className="tr-market-index__quote">
          <b className="sk-mono">{formatSectorKPrice(benchmark?.lastValue)}</b>
          <span className={`sk-mono ${changeClass(benchmark?.percentChange)}`}>{formatSectorKPercent(benchmark?.percentChange)}</span>
        </div>
        <div className="tr-range-line">
          <span className="sk-mono">{formatSectorKPrice(benchmark?.low)}</span>
          <DayPosition value={position} />
          <span className="sk-mono">{formatSectorKPrice(benchmark?.high)}</span>
        </div>
      </div>

      <MarketFact label="Растёт / падает" value={`${summary.rising} / ${summary.falling}`} note={summary.flat ? `без изм. ${summary.flat}` : undefined} />
      <MarketFact label="Оборот рынка" value={formatSectorKTurnover(summary.totalTurnover)} />
      <MarketFact label="Сделки" value={formatTrades(summary.totalTrades)} />

      <div className="tr-turnover-balance">
        <div className="tr-turnover-balance__head">
          <span className="tr-label">Баланс оборота</span>
          <strong className={`sk-mono ${changeClass(balance)}`}>{formatSectorKPercent(balance, 0)}</strong>
        </div>
        <div className="tr-balance-numbers sk-mono">
          <span className="sk-change--positive">↑ {formatSectorKTurnover(summary.risingTurnover)}</span>
          <span className="sk-change--negative">{formatSectorKTurnover(summary.fallingTurnover)} ↓</span>
        </div>
        <div className="tr-balance-bar" aria-label={`Оборот растущих ${upShare.toFixed(0)}%, падающих ${downShare.toFixed(0)}%`}>
          <span className="is-up" style={{ width: `${upShare}%` }} />
          <span className="is-down" style={{ width: `${downShare}%` }} />
        </div>
      </div>
    </section>
  );
}

function MarketFact({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="tr-market-fact"><span className="tr-label">{label}</span><strong className="sk-mono">{value}</strong>{note ? <small>{note}</small> : null}</div>;
}

function PriorityWorkspace({
  priority,
  benchmark,
  scales,
  onFocus,
}: {
  priority: ReturnType<typeof computeMarketPriority<ScreenerRow>>;
  benchmark: ScreenerBenchmark | null;
  scales: SharedScales;
  onFocus: (ticker: string) => void;
}) {
  const inPlaySet = new Set(priority.focusInPlayLeaders.map((item) => item.row.ticker));
  const shots = priority.volatilityLeaders.filter((item) => !inPlaySet.has(item.row.ticker)).slice(0, 6);
  return (
    <section className="tr-priority" aria-label="Рабочий отбор акций">
      <div className="tr-priority__rail">
        <PriorityHead title="Ликвидность" count={priority.liquidityLeaders.length} />
        <div className="tr-compact-list">
          {priority.liquidityLeaders.slice(0, 6).map((item) => <LiquidityRow item={item} onFocus={onFocus} key={item.secid} />)}
        </div>
      </div>

      <div className="tr-inplay">
        <PriorityHead title="В игре" count={priority.focusInPlayLeaders.length} strong />
        <div className="tr-inplay__rows">
          {priority.focusInPlayLeaders.map((item) => <InPlayRow item={item} benchmark={benchmark} scales={scales} onFocus={onFocus} key={item.secid} />)}
          {!priority.focusInPlayLeaders.length ? <div className="tr-priority-empty sk-mono">—</div> : null}
        </div>
      </div>

      <div className="tr-priority__rail tr-priority__rail--shots">
        <PriorityHead title="Прострелы" count={shots.length} />
        <div className="tr-compact-list">
          {shots.map((item) => <ShotRow item={item} onFocus={onFocus} key={item.secid} />)}
          {!shots.length ? <div className="tr-priority-empty sk-mono">—</div> : null}
        </div>
      </div>
    </section>
  );
}

function PriorityHead({ title, count, strong = false }: { title: string; count: number; strong?: boolean }) {
  return <header className={`tr-priority-head ${strong ? "is-strong" : ""}`}><strong>{title}</strong><span className="sk-mono">{count || "—"}</span></header>;
}

function LiquidityRow({ item, onFocus }: { item: StockPriority; onFocus: (ticker: string) => void }) {
  return (
    <button className="tr-compact-row" type="button" onClick={() => onFocus(item.row.ticker)} title={item.row.shortName}>
      <strong className="sk-mono">{item.row.ticker}</strong>
      <span className="sk-mono">{formatSectorKTurnover(item.row.turnover)}</span>
      <small className="sk-mono">{formatTrades(item.row.tradesCount)}</small>
    </button>
  );
}

function ShotRow({ item, onFocus }: { item: StockPriority; onFocus: (ticker: string) => void }) {
  return (
    <button className="tr-shot-row" type="button" onClick={() => onFocus(item.row.ticker)} title={item.row.shortName}>
      <div><strong className="sk-mono">{item.row.ticker}</strong><span className={`sk-mono ${changeClass(item.row.percentChange)}`}>{formatSectorKPercent(item.row.percentChange)}</span></div>
      <div className="sk-mono"><span>↕ {formatSectorKMagnitudePercent(item.row.metrics.dayRangePct)}</span><span>{formatSectorKTurnover(item.row.turnover)}</span></div>
      <small className="sk-mono">{formatTrades(item.row.tradesCount)} сделок</small>
    </button>
  );
}

function InPlayRow({
  item,
  benchmark,
  scales,
  onFocus,
}: {
  item: StockPriority;
  benchmark: ScreenerBenchmark | null;
  scales: SharedScales;
  onFocus: (ticker: string) => void;
}) {
  const row = item.row;
  const relative = marketDelta(row, benchmark);
  const volumeRatio = resolveHonestVolumeRatio(row);
  const tradesRatio = resolveHonestTradesRatio(row);
  const range = row.metrics.dayRangePct;
  const barStyle = (pct: number) => ({ "--tr-bar": `${pct}%` } as CSSProperties);

  return (
    <button className="tr-inplay-row" type="button" onClick={() => onFocus(row.ticker)} title={row.shortName}>
      <div className="tr-inplay-row__identity">
        <div><strong className="sk-mono">{row.ticker}</strong><small>{row.shortName}</small></div>
        <b className={`sk-mono ${changeClass(row.percentChange)}`}>{formatSectorKPercent(row.percentChange)}</b>
      </div>

      <div className="tr-inplay-row__facts">
        <InPlayFact label="Оборот" value={formatSectorKTurnover(row.turnover)} />
        <InPlayFact label="Сделки" value={formatTrades(row.tradesCount)} />
        <InPlayFact label="Range" value={formatSectorKMagnitudePercent(range)} />
        <InPlayFact label="К рынку" value={formatMarketDelta(relative)} tone={changeClass(relative)} />
        <InPlayFact label="Vol x" value={formatRatio(volumeRatio)} />
        <InPlayFact label="Trades x" value={formatRatio(tradesRatio)} />
      </div>

      <div className="tr-comparison-bars" aria-label="Сравнение бумаг в игре">
        <ComparisonBar label="Оборот" style={barStyle(scalePct(row.turnover, scales.turnover))} />
        <ComparisonBar label="Сделки" style={barStyle(scalePct(row.tradesCount, scales.trades))} />
        <ComparisonBar label="Range" style={barStyle(scalePct(range, scales.range))} />
        <ComparisonBar label="к рынку" style={barStyle(scalePct(relative, scales.marketDelta))} tone={changeClass(relative)} />
      </div>
    </button>
  );
}

function InPlayFact({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return <span><small>{label}</small><strong className={`sk-mono ${tone}`}>{value}</strong></span>;
}

function ComparisonBar({ label, style, tone = "" }: { label: string; style: CSSProperties; tone?: string }) {
  return <span className="tr-comparison-bar"><small>{label}</small><i className={tone} style={style} /></span>;
}

function DayPosition({ value, compact = false }: { value: number | null; compact?: boolean }) {
  const pct = finite(value) ? value : 50;
  return (
    <span className={`tr-day-position ${compact ? "is-compact" : ""}`} title={finite(value) ? `${value.toFixed(0)}% диапазона дня` : "Нет полного диапазона"}>
      <i style={{ left: `${pct}%` }} />
      {compact ? <b className="sk-mono">{finite(value) ? `${value.toFixed(0)}%` : "—"}</b> : null}
    </span>
  );
}

function FilterButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return <button type="button" className={active ? "is-active" : undefined} onClick={onClick}><span>{label}</span><b className="sk-mono">{count}</b></button>;
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
