"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SectorKDataError, SectorKLoading, SectorKSource } from "@/components/sector-k/sector-k-data-state";
import { buildFuturesFamilies, rankFamiliesByMode, type FuturesFamilyGroup, type FuturesPageMode } from "@/lib/domain/futures-family";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import { formatSectorKPercent, formatSectorKPrice, formatSectorKTurnover, type SectorKSortDirection } from "@/lib/sector-k/market";

type FuturesView = "families" | "contracts";
type FuturesSortKey = "price" | "change" | "turnover" | "openInterest" | "roll";
type FuturesSortState = { key: FuturesSortKey; direction: SectorKSortDirection } | null;

function sortFamilyValue(family: FuturesFamilyGroup, key: FuturesSortKey): number | null {
  if (key === "price") return family.activePrice;
  if (key === "change") return family.activePercentChange;
  if (key === "turnover") return family.totalTurnover;
  if (key === "openInterest") return family.totalOpenInterest;
  return family.rollRatio;
}

function sortFamilies(families: FuturesFamilyGroup[], state: FuturesSortState): FuturesFamilyGroup[] {
  if (!state) return families;
  return [...families].sort((a, b) => {
    const left = sortFamilyValue(a, state.key);
    const right = sortFamilyValue(b, state.key);
    if (left === null && right === null) return a.familyLabel.localeCompare(b.familyLabel, "ru");
    if (left === null) return 1;
    if (right === null) return -1;
    const delta = left - right;
    return state.direction === "asc" ? delta : -delta;
  });
}

export function SectorKFutures() {
  const query = useScreenerQuery("future");
  const [view, setView] = useState<FuturesView>("families");
  const [mode, setMode] = useState<FuturesPageMode>("market");
  const [sortState, setSortState] = useState<FuturesSortState>(null);
  const [expanded, setExpanded] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const allFamilies = useMemo(() => {
    const ranked = rankFamiliesByMode(buildFuturesFamilies(query.data?.rows ?? []), mode);
    return sortFamilies(ranked, sortState);
  }, [mode, query.data?.rows, sortState]);
  const families = expanded ? allFamilies : allFamilies.slice(0, 60);
  const selected = families.find((family) => family.familyKey === selectedKey) ?? families[0] ?? null;
  const error = query.error instanceof Error ? query.error : null;

  function selectMode(nextMode: FuturesPageMode) {
    setMode(nextMode);
    setSortState(null);
  }

  function setSort(key: FuturesSortKey) {
    setSortState((current) => current?.key === key
      ? { key, direction: current.direction === "desc" ? "asc" : "desc" }
      : { key, direction: "desc" });
  }

  return (
    <div className="sk-page">
      <header className="sk-page-head sk-page-head--compact">
        <div className="sk-page-head__copy">
          <p className="sk-kicker">MOEX · срочный рынок</p>
          <h1>Фьючерсы</h1>
          <p>Активный контракт, оборот, открытый интерес, следующая серия и перекат.</p>
        </div>
        <div className="sk-page-head__aside"><SectorKSource status={query.data?.status} error={error} /><span className="sk-mono sk-muted">{families.length} / {allFamilies.length} семейств</span></div>
      </header>

      {error ? <SectorKDataError error={error} /> : null}

      <section className="sk-panel">
        <div className="sk-panel__head sk-toolbar">
          <button className={`sk-chip ${view === "families" ? "is-active" : ""}`} type="button" onClick={() => setView("families")}>Семейства</button>
          <button className={`sk-chip ${view === "contracts" ? "is-active" : ""}`} type="button" onClick={() => setView("contracts")}>Контракты</button>
          <span className="sk-toolbar__spacer" />
          {([ ["market", "Оборот"], ["curve", "Кривая"], ["roll", "Перекат"] ] as Array<[FuturesPageMode, string]>).map(([id, label]) => (
            <button className={`sk-chip ${mode === id && !sortState ? "is-active" : ""}`} type="button" key={id} onClick={() => selectMode(id)}>{label}</button>
          ))}
          {allFamilies.length > 60 ? <button className="sk-chip" type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? "Первые 60" : `Все ${allFamilies.length}`}</button> : null}
        </div>

        {query.isPending && !query.data ? <SectorKLoading label="Загрузка фьючерсов…" /> : view === "families" ? (
          <div className="sk-table-wrap">
            <table className="sk-table sk-table--futures">
              <thead><tr><th>Семейство / активный</th><FuturesSortableHeader label="Цена" sortKey="price" state={sortState} onSort={setSort} /><FuturesSortableHeader label="Изм." sortKey="change" state={sortState} onSort={setSort} /><FuturesSortableHeader label="Оборот" sortKey="turnover" state={sortState} onSort={setSort} /><FuturesSortableHeader label="ОИ" sortKey="openInterest" state={sortState} onSort={setSort} /><FuturesSortableHeader label="Перекат" sortKey="roll" state={sortState} onSort={setSort} /></tr></thead>
              <tbody>{families.map((family) => (
                <tr className={selected?.familyKey === family.familyKey ? "is-selected" : undefined} key={family.familyKey} onClick={() => setSelectedKey(family.familyKey)}>
                  <td><Link href={`/futures/${family.activeContractTicker}`} className="sk-ticker" onClick={(event) => event.stopPropagation()}><strong>{family.familyLabel}</strong><small className="sk-mono">{family.activeContractTicker} · {family.contracts.length} контр.</small></Link></td>
                  <td className="sk-mono">{formatSectorKPrice(family.activePrice)}</td>
                  <td className={`sk-mono ${(family.activePercentChange ?? 0) >= 0 ? "sk-change--positive" : "sk-change--negative"}`}>{formatSectorKPercent(family.activePercentChange)}</td>
                  <td className="sk-mono">{formatSectorKTurnover(family.totalTurnover)}</td>
                  <td className="sk-mono">{family.totalOpenInterest.toLocaleString("ru-RU")}</td>
                  <td><span className={`sk-tag ${family.rollStatus === "Активный" ? "sk-tag--warning" : ""}`}>{family.rollStatus} · {Math.round(family.rollRatio * 100)}%</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <ContractsTable families={families} />}
      </section>

      {selected ? <FamilyInspector family={selected} /> : null}
      <div className="sk-note">Базис не рассчитан: spot-цена и единый timestamp не подключены.</div>
    </div>
  );
}

function FuturesSortableHeader({ label, sortKey, state, onSort }: { label: string; sortKey: FuturesSortKey; state: FuturesSortState; onSort: (key: FuturesSortKey) => void }) {
  const active = state?.key === sortKey;
  const Icon = !active ? ArrowUpDown : state.direction === "desc" ? ArrowDown : ArrowUp;
  return <th aria-sort={active ? state.direction === "desc" ? "descending" : "ascending" : "none"}><button className={`sk-sort-button ${active ? "is-active" : ""}`} type="button" onClick={() => onSort(sortKey)}><span>{label}</span><Icon size={12} aria-hidden /></button></th>;
}

function ContractsTable({ families }: { families: FuturesFamilyGroup[] }) {
  const rows = families.flatMap((family) => family.contracts.map((contract) => ({ family, contract })));
  return (
    <div className="sk-table-wrap">
      <table className="sk-table">
        <thead><tr><th>Роль</th><th>Контракт</th><th>Семейство</th><th>Цена</th><th>Изм.</th><th>Оборот</th><th>ОИ</th><th>DTE</th></tr></thead>
        <tbody>{rows.map(({ family, contract }) => (
          <tr key={`${family.familyKey}:${contract.ticker}`}>
            <td><span className={`sk-tag ${family.activeContractTicker === contract.ticker ? "sk-tag--positive" : ""}`}>{family.activeContractTicker === contract.ticker ? "Активный" : "Серия"}</span></td>
            <td><Link className="sk-ticker" href={`/futures/${contract.ticker}`}><strong>{contract.ticker}</strong><small>{contract.shortName}</small></Link></td>
            <td>{family.familyLabel}</td>
            <td className="sk-mono">{formatSectorKPrice(contract.lastPrice)}</td>
            <td className={`sk-mono ${(contract.percentChange ?? 0) >= 0 ? "sk-change--positive" : "sk-change--negative"}`}>{formatSectorKPercent(contract.percentChange)}</td>
            <td className="sk-mono">{formatSectorKTurnover(contract.turnover)}</td>
            <td className="sk-mono">{contract.openInterest.toLocaleString("ru-RU")}</td>
            <td className="sk-mono">{contract.dte ?? "—"}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function FamilyInspector({ family }: { family: FuturesFamilyGroup }) {
  return (
    <section className="sk-panel">
      <div className="sk-panel__head"><h2>{family.familyLabel}</h2><span>{family.contracts.length} контрактов</span></div>
      <dl className="sk-family-facts">
        <div><dt>Активный</dt><dd><Link href={`/futures/${family.activeContractTicker}`}>{family.activeContractTicker}</Link></dd></div>
        <div><dt>Цена</dt><dd>{formatSectorKPrice(family.activePrice)}</dd></div>
        <div><dt>Следующая серия</dt><dd>{family.nextSeriesTicker ? <Link href={`/futures/${family.nextSeriesTicker}`}>{family.nextSeriesTicker}</Link> : "—"}</dd></div>
        <div><dt>Перекат</dt><dd>{family.rollStatus} · {Math.round(family.rollRatio * 100)}%</dd></div>
        <div><dt>Кривая</dt><dd>{family.curve.curveShape}</dd></div>
        <div><dt>Carry</dt><dd>{formatSectorKPercent(family.curve.annualizedCarry)}</dd></div>
      </dl>
    </section>
  );
}
