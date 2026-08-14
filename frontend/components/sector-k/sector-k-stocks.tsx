"use client";

import type { ScreenerRow } from "@screenerpro/shared";
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { SectorKDataError, SectorKLoading, SectorKSource } from "@/components/sector-k/sector-k-data-state";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import {
  classifyStockUniverse,
  buildStockScreenerUniverse,
  type StockUniverseCategory,
} from "@/lib/screener/stock-universe-filter";
import {
  formatSectorKPercent,
  formatSectorKPrice,
  formatSectorKTurnover,
  sortSectorKStocks,
  type SectorKSortDirection,
  type SectorKStockSortKey,
} from "@/lib/sector-k/market";

type StockView = "all" | "common" | "preferred";

const STOCK_VIEWS: Array<{ id: StockView; label: string }> = [
  { id: "all", label: "Все акции" },
  { id: "common", label: "Обыкновенные" },
  { id: "preferred", label: "Привилегированные" },
];

const SORT_KEYS = new Set<SectorKStockSortKey>(["price", "change", "turnover", "trades", "range"]);
const VIEW_KEYS = new Set<StockView>(STOCK_VIEWS.map((item) => item.id));
const STOCK_COLUMNS: Array<{ id: SectorKStockSortKey; label: string }> = [
  { id: "price", label: "Цена" },
  { id: "change", label: "Изменение" },
  { id: "turnover", label: "Оборот" },
  { id: "trades", label: "Сделки" },
  { id: "range", label: "Диапазон" },
];

function categoryForRow(row: ScreenerRow): StockUniverseCategory {
  return classifyStockUniverse(row).category;
}

function defaultDirection(key: SectorKStockSortKey): SectorKSortDirection {
  return key === "price" ? "asc" : "desc";
}

export function SectorKStocks() {
  const query = useScreenerQuery("stock");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<SectorKStockSortKey>>(() => new Set(SORT_KEYS));
  const rawRows = useMemo(() => query.data?.rows ?? [], [query.data?.rows]);
  const universe = useMemo(() => buildStockScreenerUniverse(rawRows), [rawRows]);

  const viewParam = searchParams.get("view") as StockView | null;
  const view = viewParam && VIEW_KEYS.has(viewParam) ? viewParam : "all";
  const sortParam = searchParams.get("sort") as SectorKStockSortKey | null;
  const sortKey = sortParam && SORT_KEYS.has(sortParam) ? sortParam : "turnover";
  const direction: SectorKSortDirection = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const search = searchParams.get("q") ?? "";

  const counts = useMemo(() => {
    let common = 0;
    let preferred = 0;
    for (const row of universe.stockRows) {
      const category = categoryForRow(row);
      if (category === "preferred_stock") preferred += 1;
      else common += 1;
    }
    return { all: universe.stockRows.length, common, preferred };
  }, [universe.stockRows]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = universe.stockRows.filter((row) => {
      if (needle && !`${row.ticker} ${row.shortName}`.toLowerCase().includes(needle)) return false;
      const category = categoryForRow(row);
      if (view === "common") return category === "stock";
      if (view === "preferred") return category === "preferred_stock";
      return true;
    });
    return sortSectorKStocks(filtered, sortKey, direction);
  }, [direction, search, sortKey, universe.stockRows, view]);

  const resolvedSelectedTicker = selectedTicker && visible.some((row) => row.ticker === selectedTicker)
    ? selectedTicker
    : visible[0]?.ticker ?? null;
  const selected = visible.find((row) => row.ticker === resolvedSelectedTicker) ?? null;
  const error = query.error instanceof Error ? query.error : null;
  const hasCustomState = view !== "all" || sortKey !== "turnover" || direction !== "desc" || Boolean(search) || visibleColumns.size !== STOCK_COLUMNS.length;

  function replaceQuery(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.replace(next.size ? `${pathname}?${next.toString()}` : pathname, { scroll: false });
  }

  function setView(nextView: StockView) {
    replaceQuery({ view: nextView === "all" ? null : nextView });
  }

  function setSort(nextKey: SectorKStockSortKey) {
    const nextDirection = sortKey === nextKey
      ? direction === "desc" ? "asc" : "desc"
      : defaultDirection(nextKey);
    replaceQuery({ sort: nextKey, dir: nextDirection });
  }

  function reset() {
    setVisibleColumns(new Set(SORT_KEYS));
    router.replace(pathname, { scroll: false });
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

  return (
    <div className="sk-page">
      <header className="sk-page-head sk-page-head--compact">
        <div className="sk-page-head__copy">
          <p className="sk-kicker">MOEX · TQBR · акции</p>
          <h1>Акции</h1>
          <p>Цена, изменение, оборот, сделки и диапазон дня по всему рынку акций.</p>
        </div>
        <div className="sk-page-head__aside">
          <SectorKSource status={query.data?.status} error={error} />
          <span className="sk-mono sk-muted">{counts.all} акций · {counts.common} обычных · {counts.preferred} прив.</span>
          <span className="sk-mono sk-muted">TQBR: {universe.rawCount} строк · исключено {universe.excludedCount}</span>
        </div>
      </header>

      {error ? <SectorKDataError error={error} /> : null}

      <div className="sk-screener-layout">
        <section className="sk-panel sk-screener-workspace">
          <div className="sk-screener-toolbar">
            <div className="sk-toolbar-group" role="group" aria-label="Состав рынка">
              {STOCK_VIEWS.map((item) => {
                const count = item.id === "all" ? counts.all : item.id === "common" ? counts.common : counts.preferred;
                return (
                  <button className={`sk-chip ${view === item.id ? "is-active" : ""}`} type="button" key={item.id} onClick={() => setView(item.id)}>
                    {item.label}<span>{count}</span>
                  </button>
                );
              })}
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
                <summary><SlidersHorizontal size={13} />Колонки</summary>
                <div className="sk-column-menu__panel">
                  {STOCK_COLUMNS.map((column) => (
                    <label key={column.id}>
                      <input type="checkbox" checked={visibleColumns.has(column.id)} onChange={() => toggleColumn(column.id)} />
                      <span>{column.label}</span>
                    </label>
                  ))}
                </div>
              </details>
              {hasCustomState ? <button type="button" className="sk-reset" onClick={reset}><RotateCcw size={13} />Сбросить</button> : null}
            </div>
          </div>

          <div className="sk-table-caption">
            <span>{visible.length} из {counts.all}</span>
            <span>Сортировка: {sortKey === "price" ? "цена" : sortKey === "change" ? "изменение" : sortKey === "turnover" ? "оборот" : sortKey === "trades" ? "сделки" : "диапазон"} {direction === "desc" ? "↓" : "↑"}</span>
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
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const selectedRow = row.ticker === resolvedSelectedTicker;
                    const category = categoryForRow(row);
                    return (
                      <tr className={selectedRow ? "is-selected" : undefined} key={row.ticker} onClick={() => setSelectedTicker(row.ticker)} aria-selected={selectedRow}>
                        <td className="sk-table__sticky sk-table__instrument">
                          <Link href={`/stocks/${row.ticker}`} onClick={(event) => event.stopPropagation()}>
                            <span className="sk-ticker"><strong>{row.ticker}</strong><small>{row.shortName}</small></span>
                            {category === "preferred_stock" ? <span className="sk-security-type">прив.</span> : null}
                          </Link>
                        </td>
                        {visibleColumns.has("price") ? <td className="sk-mono">{formatSectorKPrice(row.lastPrice)}</td> : null}
                        {visibleColumns.has("change") ? <td className={`sk-mono ${(row.percentChange ?? 0) >= 0 ? "sk-change--positive" : "sk-change--negative"}`}>{formatSectorKPercent(row.percentChange)}</td> : null}
                        {visibleColumns.has("turnover") ? <td className="sk-mono">{formatSectorKTurnover(row.turnover)}</td> : null}
                        {visibleColumns.has("trades") ? <td className="sk-mono">{row.tradesCount?.toLocaleString("ru-RU") ?? "—"}</td> : null}
                        {visibleColumns.has("range") ? <td className="sk-mono">{formatSectorKPercent(row.metrics.dayRangePct)}</td> : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!visible.length ? <div className="sk-empty"><div><h2>Нет инструментов</h2><p>Сбросьте поиск или фильтр состава рынка.</p><button className="sk-reset" type="button" onClick={reset}><RotateCcw size={13} />Сбросить</button></div></div> : null}
            </div>
          )}
        </section>

        <aside className="sk-screener-inspector">
          {selected ? <StockInspector row={selected} /> : <div className="sk-panel sk-empty"><div><h2>Выберите инструмент</h2></div></div>}
        </aside>
      </div>
    </div>
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

function StockInspector({ row }: { row: ScreenerRow }) {
  const category = categoryForRow(row);
  return (
    <section className="sk-panel sk-inspector">
      <div className="sk-panel__head"><span>Инструмент</span><span>{category === "preferred_stock" ? "Привилегированная" : "Обыкновенная"}</span></div>
      <div className="sk-inspector__hero">
        <div className="sk-inspector__title">
          <div><h2 className="sk-mono">{row.ticker}</h2><p className="sk-lede">{row.shortName}</p></div>
          <div className="sk-inspector__price"><strong>{formatSectorKPrice(row.lastPrice)}</strong><small className={(row.percentChange ?? 0) >= 0 ? "sk-change--positive" : "sk-change--negative"}>{formatSectorKPercent(row.percentChange)}</small></div>
        </div>
        <div className="sk-tags"><span className="sk-tag">лот {row.lotSize ?? "—"}</span><span className="sk-tag">MOEX ISS</span></div>
      </div>
      <dl className="sk-facts">
        <div className="sk-fact"><dt>Оборот</dt><dd>{formatSectorKTurnover(row.turnover)}</dd></div>
        <div className="sk-fact"><dt>Сделки</dt><dd>{row.tradesCount?.toLocaleString("ru-RU") ?? "—"}</dd></div>
        <div className="sk-fact"><dt>Максимум</dt><dd>{formatSectorKPrice(row.high)}</dd></div>
        <div className="sk-fact"><dt>Минимум</dt><dd>{formatSectorKPrice(row.low)}</dd></div>
        <div className="sk-fact"><dt>Диапазон</dt><dd>{formatSectorKPercent(row.metrics.dayRangePct)}</dd></div>
        <div className="sk-fact"><dt>Открытие</dt><dd>{formatSectorKPrice(row.open)}</dd></div>
      </dl>
      <div className="sk-inspector__actions">
        <Link className="sk-inspector__link" href={`/stocks/${row.ticker}`}>График и детали <ArrowUpRight size={14} /></Link>
        <span>Свечи и карточка инструмента</span>
      </div>
    </section>
  );
}
