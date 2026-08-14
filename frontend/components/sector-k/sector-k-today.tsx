"use client";

import type { ScreenerRow } from "@screenerpro/shared";
import { ArrowDownRight, ArrowUpRight, Layers3 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { SectorKDataError, SectorKLoading, SectorKSource } from "@/components/sector-k/sector-k-data-state";
import { buildFuturesFamilies } from "@/lib/domain/futures-family";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import { buildStockScreenerUniverse } from "@/lib/screener/stock-universe-filter";
import {
  formatSectorKPercent,
  formatSectorKPrice,
  formatSectorKTurnover,
  getSectorKMarketBreadth,
  getSectorKTotalTrades,
  sortSectorKStocks,
} from "@/lib/sector-k/market";

function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function marketStatusLabel(value: string | null | undefined): string {
  if (value === "open") return "Торги идут";
  if (value === "auction") return "Аукцион";
  if (value === "halted") return "Торги остановлены";
  if (value === "closed") return "Торги закрыты";
  return "Статус не определён";
}

export function SectorKToday() {
  const stocks = useScreenerQuery("stock");
  const futures = useScreenerQuery("future");
  const rawStockRows = useMemo(() => stocks.data?.rows ?? [], [stocks.data?.rows]);
  const stockUniverse = useMemo(() => buildStockScreenerUniverse(rawStockRows), [rawStockRows]);
  const stockRows = stockUniverse.stockRows;
  const futureRows = useMemo(() => futures.data?.rows ?? [], [futures.data?.rows]);
  const topTurnover = useMemo(() => sortSectorKStocks(stockRows, "turnover", "desc").slice(0, 9), [stockRows]);
  const topTrades = useMemo(() => sortSectorKStocks(stockRows, "trades", "desc").slice(0, 7), [stockRows]);
  const topRanges = useMemo(() => sortSectorKStocks(stockRows, "range", "desc").slice(0, 7), [stockRows]);
  const gainers = useMemo(() => sortSectorKStocks(stockRows.filter((row) => (row.percentChange ?? 0) > 0), "change", "desc").slice(0, 4), [stockRows]);
  const decliners = useMemo(() => sortSectorKStocks(stockRows.filter((row) => (row.percentChange ?? 0) < 0), "change", "asc").slice(0, 4), [stockRows]);
  const families = useMemo(() => buildFuturesFamilies(futureRows).sort((a, b) => b.totalTurnover - a.totalTurnover).slice(0, 5), [futureRows]);
  const breadth = useMemo(() => getSectorKMarketBreadth(stockRows), [stockRows]);
  const totalTurnover = useMemo(() => stockRows.reduce((sum, row) => sum + (row.turnover ?? 0), 0), [stockRows]);
  const totalTrades = useMemo(() => getSectorKTotalTrades(stockRows), [stockRows]);
  const benchmark = stocks.data?.benchmarks.find((item) => item.code === "IMOEX" || item.code === "IMOEX2") ?? stocks.data?.benchmarks[0] ?? null;
  const status = stocks.data?.status;
  const queryError = stocks.error instanceof Error ? stocks.error : null;

  return (
    <div className="sk-page">
      <header className="sk-page-head sk-page-head--compact">
        <div className="sk-page-head__copy">
          <p className="sk-kicker">MOEX · рынок сейчас</p>
          <h1>Рынок сейчас</h1>
          <p>Акции: оборот, сделки, движение и диапазон. Фьючерсы: семейства и активные контракты.</p>
        </div>
        <div className="sk-page-head__aside">
          <SectorKSource status={status} error={queryError} />
          <span className="sk-mono sk-muted">{stockRows.length || "—"} акций · {futureRows.length || "—"} фьючерсов</span>
        </div>
      </header>

      {queryError ? <SectorKDataError error={queryError} /> : null}

      <section className="sk-market-strip" aria-label="Состояние рынка">
        <div className="sk-market-stat sk-market-stat--status">
          <span>Сессия</span>
          <strong>{marketStatusLabel(status?.marketStatus)}</strong>
          <small>{status?.resolvedTradingDateKey ?? status?.tradingDateKey ?? "—"}</small>
        </div>
        <div className="sk-market-stat">
          <span>{benchmark?.code ?? "IMOEX"}</span>
          <strong>{formatSectorKPrice(benchmark?.lastValue)}</strong>
          <small className={(benchmark?.percentChange ?? 0) >= 0 ? "sk-change--positive" : "sk-change--negative"}>{formatSectorKPercent(benchmark?.percentChange, 2)}</small>
        </div>
        <div className="sk-market-stat">
          <span>Ширина рынка</span>
          <strong><b className="sk-good">↑ {breadth.advancing}</b><b className="sk-bad">↓ {breadth.declining}</b></strong>
          <small>без изменения {breadth.unchanged}</small>
        </div>
        <div className="sk-market-stat">
          <span>Оборот акций</span>
          <strong>{formatSectorKTurnover(totalTurnover)}</strong>
          <small>{stockRows.length || "—"} инструментов</small>
        </div>
        <div className="sk-market-stat">
          <span>Сделки</span>
          <strong>{formatCount(totalTrades)}</strong>
          <small>Сумма по рынку акций</small>
        </div>
      </section>

      <div className="sk-cockpit">
        <main className="sk-cockpit__main">
          <section className="sk-panel sk-money-panel">
            <div className="sk-panel__head">
              <div><h2>Где деньги</h2><span>Лидеры оборота акций</span></div>
              <Link href="/sector-k/stocks?sort=turnover&dir=desc">Все акции →</Link>
            </div>
            {stocks.isPending && !stocks.data ? <SectorKLoading /> : (
              <div className="sk-table-wrap">
                <table className="sk-market-table">
                  <thead><tr><th>Инструмент</th><th>Цена</th><th>Изм.</th><th>Оборот</th><th>Сделки</th></tr></thead>
                  <tbody>{topTurnover.map((row) => <MarketRow key={row.ticker} row={row} />)}</tbody>
                </table>
              </div>
            )}
          </section>

          <div className="sk-cockpit__split">
            <section className="sk-panel">
              <div className="sk-panel__head"><div><h2>Движение</h2><span>Лидеры роста и снижения</span></div><Link href="/sector-k/stocks?sort=change&dir=desc">Рынок →</Link></div>
              <div className="sk-movers">
                <LeaderColumn label="Рост" rows={gainers} direction="up" />
                <LeaderColumn label="Снижение" rows={decliners} direction="down" />
              </div>
            </section>

            <section className="sk-panel">
              <div className="sk-panel__head"><div><h2>Диапазон дня</h2><span>High − low к закрытию</span></div><Link href="/sector-k/stocks?sort=range&dir=desc">Сортировать →</Link></div>
              <ol className="sk-ranked-list">
                {topRanges.map((row, index) => (
                  <li key={row.ticker}><span>{String(index + 1).padStart(2, "0")}</span><Link href={`/stocks/${row.ticker}`}><strong>{row.ticker}</strong><small>{row.shortName}</small></Link><b>{formatSectorKPercent(row.metrics.dayRangePct)}</b></li>
                ))}
              </ol>
            </section>
          </div>
        </main>

        <aside className="sk-cockpit__rail">
          <section className="sk-panel">
            <div className="sk-panel__head"><div><h2>Фьючерсные активы</h2><span>Активный контракт внутри семьи</span></div><Link href="/sector-k/futures"><Layers3 size={15} /></Link></div>
            {futures.isPending && !futures.data ? <SectorKLoading label="Загрузка фьючерсов…" /> : (
              <ul className="sk-family-list">
                {families.map((family) => (
                  <li key={family.familyKey}>
                    <div><strong>{family.familyLabel}</strong><span className="sk-mono">{family.activeContractTicker}</span></div>
                    <div><b>{formatSectorKTurnover(family.totalTurnover)}</b><small>{family.activeContractTicker} · {family.rollStatus}</small></div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="sk-panel">
            <div className="sk-panel__head"><div><h2>Больше всего сделок</h2><span>Количество сделок MOEX</span></div><Link href="/sector-k/stocks?sort=trades&dir=desc">Сортировать →</Link></div>
            <ol className="sk-ranked-list">
              {topTrades.map((row, index) => (
                <li key={row.ticker}><span>{String(index + 1).padStart(2, "0")}</span><Link href={`/stocks/${row.ticker}`}><strong>{row.ticker}</strong><small>{formatSectorKTurnover(row.turnover)}</small></Link><b>{formatCount(row.tradesCount)}</b></li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

function MarketRow({ row }: { row: ScreenerRow }) {
  return (
    <tr>
      <td><Link className="sk-market-instrument" href={`/stocks/${row.ticker}`}><strong>{row.ticker}</strong><small>{row.shortName}</small></Link></td>
      <td>{formatSectorKPrice(row.lastPrice)}</td>
      <td className={(row.percentChange ?? 0) >= 0 ? "sk-change--positive" : "sk-change--negative"}>{formatSectorKPercent(row.percentChange)}</td>
      <td>{formatSectorKTurnover(row.turnover)}</td>
      <td>{formatCount(row.tradesCount)}</td>
    </tr>
  );
}

function LeaderColumn({ rows, label, direction }: { rows: ScreenerRow[]; label: string; direction: "up" | "down" }) {
  const Icon = direction === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="sk-leader-column">
      <div className="sk-leader-column__head"><Icon size={14} /><span>{label}</span></div>
      <ul>{rows.map((row) => <li key={row.ticker}><Link href={`/stocks/${row.ticker}`}><strong>{row.ticker}</strong><small>{row.shortName}</small></Link><b className={direction === "up" ? "sk-good" : "sk-bad"}>{formatSectorKPercent(row.percentChange)}</b></li>)}</ul>
    </div>
  );
}
