"use client";

import { useMemo, useState } from "react";
import { SectorKDataError, SectorKLoading, SectorKSource } from "@/components/sector-k/sector-k-data-state";
import { buildFuturesFamilies, rankFamiliesByMode, type FuturesFamilyGroup, type FuturesPageMode } from "@/lib/domain/futures-family";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import { formatSectorKFutureSignal, formatSectorKPercent, formatSectorKPrice, formatSectorKTurnover } from "@/lib/sector-k/market";

type FuturesView = "families" | "contracts";

export function SectorKFutures() {
  const query = useScreenerQuery("future");
  const [view, setView] = useState<FuturesView>("families");
  const [mode, setMode] = useState<FuturesPageMode>("market");
  const [expanded, setExpanded] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const allFamilies = useMemo(() => rankFamiliesByMode(buildFuturesFamilies(query.data?.rows ?? []), mode), [mode, query.data?.rows]);
  const families = expanded ? allFamilies : allFamilies.slice(0, 60);
  const selected = families.find((family) => family.familyKey === selectedKey) ?? families[0] ?? null;
  const error = query.error instanceof Error ? query.error : null;

  return (
    <div className="sk-page">
      <header className="sk-page-head">
        <div className="sk-page-head__copy">
          <p className="sk-kicker">MOEX · срочный рынок</p>
          <h1>Активные фьючерсы и перекат</h1>
          <p>Активный контракт, цена, оборот, открытый интерес, следующая серия и статус переката.</p>
        </div>
        <div className="sk-page-head__aside"><SectorKSource status={query.data?.status} error={error} /><span className="sk-mono sk-muted">{families.length} / {allFamilies.length} семейств</span></div>
      </header>

      {error ? <SectorKDataError error={error} /> : null}

      <section className="sk-panel">
        <div className="sk-panel__head sk-toolbar">
          <button className={`sk-chip ${view === "families" ? "is-active" : ""}`} type="button" onClick={() => setView("families")}>Семейства</button>
          <button className={`sk-chip ${view === "contracts" ? "is-active" : ""}`} type="button" onClick={() => setView("contracts")}>Контракты</button>
          <span className="sk-toolbar__spacer" />
          {([ ["market", "Рынок"], ["curve", "Кривая"], ["roll", "Перекат"] ] as Array<[FuturesPageMode, string]>).map(([id, label]) => (
            <button className={`sk-chip ${mode === id ? "is-active" : ""}`} type="button" key={id} onClick={() => setMode(id)}>{label}</button>
          ))}
          {allFamilies.length > 60 ? <button className="sk-chip" type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? "Свернуть до 60" : `Показать все ${allFamilies.length}`}</button> : null}
        </div>

        {query.isPending && !query.data ? <SectorKLoading label="Загрузка фьючерсов…" /> : view === "families" ? (
          <div className="sk-table-wrap">
            <table className="sk-table">
              <thead><tr><th>Состояние</th><th>Семейство / активный</th><th>Цена</th><th>Изм.</th><th>Оборот семьи</th><th>ОИ семьи</th><th>Перекат</th><th>Базис</th></tr></thead>
              <tbody>{families.map((family) => (
                <tr className={selected?.familyKey === family.familyKey ? "is-selected" : undefined} key={family.familyKey} onClick={() => setSelectedKey(family.familyKey)}>
                  <td><span className={`sk-tag ${family.rollStatus === "Активный" ? "sk-tag--warning" : ""}`}>{formatSectorKFutureSignal(family.signal)}</span></td>
                  <td><span className="sk-ticker"><strong>{family.familyLabel}</strong><small className="sk-mono">{family.activeContractTicker} · {family.contracts.length} контр.</small></span></td>
                  <td className="sk-mono">{formatSectorKPrice(family.activePrice)}</td>
                  <td className={`sk-mono ${(family.activePercentChange ?? 0) >= 0 ? "sk-change--positive" : "sk-change--negative"}`}>{formatSectorKPercent(family.activePercentChange)}</td>
                  <td className="sk-mono">{formatSectorKTurnover(family.totalTurnover)}</td>
                  <td className="sk-mono">{family.totalOpenInterest.toLocaleString("ru-RU")}</td>
                  <td><span className={`sk-tag ${family.rollStatus === "Активный" ? "sk-tag--warning" : ""}`}>{family.rollStatus} · {Math.round(family.rollRatio * 100)}%</span></td>
                  <td><span className="sk-tag sk-tag--warning">— · нет spot</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <ContractsTable families={families} />
        )}
      </section>

      {selected ? <FamilyInspector family={selected} /> : null}
      <div className="sk-note">Базис: — · spot-цена и единый timestamp не подключены.</div>
    </div>
  );
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
            <td><span className="sk-ticker"><strong>{contract.ticker}</strong><small>{contract.shortName}</small></span></td>
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
      <div className="sk-panel__head"><h2>{family.familyLabel}</h2><span>Главная линия: {family.mainTradingLineKey ?? "не определена"}</span></div>
      <div className="sk-grid sk-grid--3 sk-panel__body">
        <div className="sk-metric"><span className="sk-metric__label">Активный контракт</span><strong className="sk-metric__value">{family.activeContractTicker}</strong><span className="sk-metric__note">55% оборот · 30% ОИ · 15% expiry</span></div>
        <div className="sk-metric"><span className="sk-metric__label">Форма кривой</span><strong className="sk-metric__value" style={{ fontSize: 22 }}>{family.curve.curveShape}</strong><span className="sk-metric__note">Carry: {formatSectorKPercent(family.curve.annualizedCarry)}</span></div>
        <div className="sk-metric"><span className="sk-metric__label">Следующая серия</span><strong className="sk-metric__value">{family.nextSeriesTicker ?? "—"}</strong><span className="sk-metric__note">Перекат: {family.rollStatus} · {Math.round(family.rollRatio * 100)}%</span></div>
      </div>
    </section>
  );
}
