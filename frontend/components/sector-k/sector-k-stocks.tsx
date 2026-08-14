"use client";

import type { ScreenerRow } from "@screenerpro/shared";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { SectorKDataError, SectorKLoading, SectorKSource } from "@/components/sector-k/sector-k-data-state";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import {
  formatSectorKPercent,
  formatSectorKPrice,
  formatSectorKTurnover,
  getSectorKDisposition,
  getSectorKReasons,
} from "@/lib/sector-k/market";

type StockPreset = "focus" | "in-play" | "liquid" | "movement" | "all";
type StockSort = "priority" | "turnover" | "change" | "range";

function rankRow(row: ScreenerRow): number {
  const disposition = getSectorKDisposition(row);
  const dispositionScore = disposition === "in-play" ? 300 : disposition === "focus" ? 200 : 100;
  return dispositionScore + (row.metrics.inPlayScore ?? 0) + (row.metrics.turnoverPercentile ?? 0) * 0.3;
}

export function SectorKStocks() {
  const query = useScreenerQuery("stock");
  const [preset, setPreset] = useState<StockPreset>("focus");
  const [sort, setSort] = useState<StockSort>("priority");
  const [search, setSearch] = useState("");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const rows = useMemo(() => query.data?.rows ?? [], [query.data?.rows]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (needle && !`${row.ticker} ${row.shortName}`.toLowerCase().includes(needle)) return false;
        if (preset === "in-play") return row.metrics.isInPlay;
        if (preset === "focus") return getSectorKDisposition(row) !== "watch";
        if (preset === "liquid") return (row.metrics.turnoverPercentile ?? 0) >= 80;
        if (preset === "movement") return Math.abs(row.percentChange ?? 0) >= 1.5 || (row.metrics.dayRangePct ?? 0) >= 2.2;
        return true;
      })
      .sort((a, b) => {
        if (sort === "turnover") return (b.turnover ?? 0) - (a.turnover ?? 0);
        if (sort === "change") return Math.abs(b.percentChange ?? 0) - Math.abs(a.percentChange ?? 0);
        if (sort === "range") return (b.metrics.dayRangePct ?? 0) - (a.metrics.dayRangePct ?? 0);
        return rankRow(b) - rankRow(a);
      });
  }, [preset, rows, search, sort]);

  const resolvedSelectedTicker = selectedTicker && visible.some((row) => row.ticker === selectedTicker) ? selectedTicker : visible[0]?.ticker ?? null;
  const selected = visible.find((row) => row.ticker === resolvedSelectedTicker) ?? null;
  const error = query.error instanceof Error ? query.error : null;

  return (
    <div className="sk-page">
      <header className="sk-page-head">
        <div className="sk-page-head__copy">
          <p className="sk-kicker">MOEX · акции</p>
          <h1>Акции в игре и активные акции</h1>
          <p>Статус, цена, изменение, оборот, сделки, диапазон и качество baseline.</p>
        </div>
        <div className="sk-page-head__aside"><SectorKSource status={query.data?.status} error={error} /><span className="sk-mono sk-muted">{visible.length} / {rows.length} инструментов</span></div>
      </header>

      {error ? <SectorKDataError error={error} /> : null}

      <div className="sk-dashboard">
        <section className="sk-panel sk-dashboard__main">
          <div className="sk-panel__head sk-toolbar">
            {([
              ["focus", "Активные"], ["in-play", "В игре"], ["liquid", "Ликвидность"], ["movement", "Движение"], ["all", "Все"],
            ] as Array<[StockPreset, string]>).map(([id, label]) => (
              <button className={`sk-chip ${preset === id ? "is-active" : ""}`} type="button" key={id} onClick={() => setPreset(id)}>{label}</button>
            ))}
            <span className="sk-toolbar__spacer" />
            <label className="sk-source" aria-label="Поиск инструмента">
              <Search size={14} />
              <input className="sk-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Тикер или название" />
            </label>
            <select className="sk-select" value={sort} onChange={(event) => setSort(event.target.value as StockSort)} aria-label="Сортировка">
              <option value="priority">Приоритет</option>
              <option value="turnover">Оборот</option>
              <option value="change">Абс. движение</option>
              <option value="range">Диапазон</option>
            </select>
          </div>

          {query.isPending && !query.data ? <SectorKLoading /> : (
            <div className="sk-table-wrap">
              <table className="sk-table">
                <thead><tr><th>Статус</th><th>Инструмент</th><th>Цена</th><th>Изм.</th><th>Оборот</th><th>Сделки</th><th>Диапазон</th><th>Baseline</th></tr></thead>
                <tbody>
                  {visible.map((row) => {
                    const disposition = getSectorKDisposition(row);
                    const selectedRow = row.ticker === resolvedSelectedTicker;
                    return (
                      <tr className={selectedRow ? "is-selected" : undefined} key={row.ticker} onClick={() => setSelectedTicker(row.ticker)} aria-selected={selectedRow}>
                        <td><span className={`sk-tag ${disposition === "in-play" ? "sk-tag--positive" : disposition === "focus" ? "sk-tag--accent" : ""}`}>{disposition === "in-play" ? "В игре" : disposition === "focus" ? "Активная" : "Остальные"}</span></td>
                        <td><span className="sk-ticker"><strong>{row.ticker}</strong><small>{row.shortName}</small></span></td>
                        <td className="sk-mono">{formatSectorKPrice(row.lastPrice)}</td>
                        <td className={`sk-mono ${(row.percentChange ?? 0) >= 0 ? "sk-change--positive" : "sk-change--negative"}`}>{formatSectorKPercent(row.percentChange)}</td>
                        <td className="sk-mono">{formatSectorKTurnover(row.turnover)}</td>
                        <td className="sk-mono">{row.tradesCount?.toLocaleString("ru-RU") ?? "—"}</td>
                        <td className="sk-mono">{formatSectorKPercent(row.metrics.dayRangePct)}</td>
                        <td><span className={`sk-tag ${row.metrics.baselineIsReliable ? "sk-tag--positive" : "sk-tag--warning"}`}>{row.metrics.baselineIsReliable ? "same-time" : "нет / rough"}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!visible.length ? <div className="sk-empty"><div><h2>Нет инструментов по фильтру</h2></div></div> : null}
            </div>
          )}
        </section>

        <aside className="sk-dashboard__rail">
          {selected ? <StockInspector row={selected} /> : <div className="sk-panel sk-empty"><div><h2>Выберите инструмент</h2></div></div>}
        </aside>
      </div>
    </div>
  );
}

function StockInspector({ row }: { row: ScreenerRow }) {
  const disposition = getSectorKDisposition(row);
  return (
    <section className="sk-panel sk-inspector">
      <div className="sk-panel__head"><span>Инструмент</span><span className={`sk-tag ${disposition === "in-play" ? "sk-tag--positive" : "sk-tag--accent"}`}>{disposition === "in-play" ? "В игре" : disposition === "focus" ? "Активная" : "Остальные"}</span></div>
      <div className="sk-inspector__hero">
        <div className="sk-inspector__title">
          <div><h2 className="sk-mono">{row.ticker}</h2><p className="sk-lede">{row.shortName}</p></div>
          <div className="sk-inspector__price"><strong>{formatSectorKPrice(row.lastPrice)}</strong><small className={(row.percentChange ?? 0) >= 0 ? "sk-change--positive" : "sk-change--negative"}>{formatSectorKPercent(row.percentChange)}</small></div>
        </div>
        <div className="sk-tags"><span className="sk-tag">{row.tradingStatus}</span><span className="sk-tag">лот {row.lotSize ?? "—"}</span><span className="sk-tag">MOEX ISS</span></div>
      </div>
      <dl className="sk-facts">
        <div className="sk-fact"><dt>Оборот</dt><dd>{formatSectorKTurnover(row.turnover)}</dd></div>
        <div className="sk-fact"><dt>Сделки</dt><dd>{row.tradesCount?.toLocaleString("ru-RU") ?? "—"}</dd></div>
        <div className="sk-fact"><dt>Диапазон дня</dt><dd>{formatSectorKPercent(row.metrics.dayRangePct)}</dd></div>
        <div className="sk-fact"><dt>In-play score</dt><dd>{row.metrics.inPlayScore?.toFixed(0) ?? "—"}</dd></div>
        <div className="sk-fact"><dt>Activity ratio</dt><dd>{row.metrics.activityRatio?.toFixed(2) ?? "—"}</dd></div>
        <div className="sk-fact"><dt>Baseline</dt><dd className={row.metrics.baselineIsReliable ? "sk-good" : "sk-warn"}>{row.metrics.baselineIsReliable ? "надёжен" : "не подтверждён"}</dd></div>
      </dl>
      <div className="sk-reasons"><h3>Причины статуса</h3><ul>{getSectorKReasons(row).map((reason) => <li key={reason}>{reason}</li>)}</ul></div>
    </section>
  );
}
