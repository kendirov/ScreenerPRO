"use client";

import Link from "next/link";
import { ArrowUpRight, Database, Layers3 } from "lucide-react";
import { useMemo } from "react";
import { SectorKDataError, SectorKLoading, SectorKSource } from "@/components/sector-k/sector-k-data-state";
import { buildFuturesFamilies } from "@/lib/domain/futures-family";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import {
  formatSectorKPercent,
  formatSectorKPrice,
  formatSectorKTurnover,
  formatSectorKFutureSignal,
  getSectorKDisposition,
  getSectorKReasons,
  selectSectorKFocusRows,
} from "@/lib/sector-k/market";

export function SectorKToday() {
  const stocks = useScreenerQuery("stock");
  const futures = useScreenerQuery("future");
  const stockRows = useMemo(() => stocks.data?.rows ?? [], [stocks.data?.rows]);
  const futureRows = useMemo(() => futures.data?.rows ?? [], [futures.data?.rows]);
  const focus = useMemo(() => selectSectorKFocusRows(stockRows, 7), [stockRows]);
  const families = useMemo(() => buildFuturesFamilies(futureRows).slice(0, 4), [futureRows]);
  const totalTurnover = useMemo(() => stockRows.reduce((sum, row) => sum + (row.turnover ?? 0), 0), [stockRows]);
  const inPlayCount = useMemo(() => stockRows.filter((row) => row.metrics.isInPlay).length, [stockRows]);
  const activeCount = useMemo(() => stockRows.filter((row) => getSectorKDisposition(row) !== "watch").length, [stockRows]);
  const baselineRows = useMemo(() => stockRows.filter((row) => row.metrics.baselineIsReliable).length, [stockRows]);
  const status = stocks.data?.status;
  const queryError = stocks.error instanceof Error ? stocks.error : null;

  return (
    <div className="sk-page">
      <header className="sk-page-head">
        <div className="sk-page-head__copy">
          <p className="sk-kicker">MOEX · read-only</p>
          <h1>Активные инструменты MOEX</h1>
          <p>Акции в игре, активные акции, лидеры оборота и фьючерсные семьи.</p>
        </div>
        <div className="sk-page-head__aside">
          <SectorKSource status={status} error={queryError} />
        </div>
      </header>

      {queryError ? <SectorKDataError error={queryError} /> : null}

      <section className="sk-panel" aria-label="Снимок сессии">
        <div className="sk-metric-grid">
          <div className="sk-metric">
            <span className="sk-metric__label">Акции в игре</span>
            <strong className="sk-metric__value">{stocks.isPending ? "—" : inPlayCount}</strong>
            <span className="sk-metric__note">isInPlay = true</span>
          </div>
          <div className="sk-metric">
            <span className="sk-metric__label">Активные акции</span>
            <strong className="sk-metric__value">{stocks.isPending ? "—" : activeCount}</strong>
            <span className="sk-metric__note">score ≥ 70 / activity ≥ 82</span>
          </div>
          <div className="sk-metric">
            <span className="sk-metric__label">Оборот выборки</span>
            <strong className="sk-metric__value">{formatSectorKTurnover(totalTurnover)}</strong>
            <span className="sk-metric__note">Сумма turnover, ₽</span>
          </div>
          <div className="sk-metric">
            <span className="sk-metric__label">Надёжный baseline</span>
            <strong className="sk-metric__value">{stockRows.length ? `${baselineRows}/${stockRows.length}` : "—"}</strong>
            <span className="sk-metric__note">same-time baseline</span>
          </div>
        </div>
      </section>

      <div className="sk-dashboard">
        <div className="sk-dashboard__main">
          <section className="sk-panel">
            <div className="sk-panel__head">
              <h2>Активные акции</h2>
              <Link href="/sector-k/stocks">Вся таблица →</Link>
            </div>
            {stocks.isPending && !stocks.data ? <SectorKLoading /> : (
              <ul className="sk-list">
                {focus.map((row) => {
                  const disposition = getSectorKDisposition(row);
                  return (
                    <li className="sk-list__row" key={row.ticker}>
                      <div className="sk-list__primary">
                        <div className="sk-list__title">
                          <strong className="sk-mono">{row.ticker}</strong>
                          <span>{row.shortName}</span>
                          <span className={`sk-tag ${disposition === "in-play" ? "sk-tag--positive" : disposition === "focus" ? "sk-tag--accent" : ""}`}>
                            {disposition === "in-play" ? "В игре" : disposition === "focus" ? "Активная" : "Остальные"}
                          </span>
                        </div>
                        <div className="sk-tags">
                          {getSectorKReasons(row, 2).map((reason) => <span className="sk-tag" key={reason}>{reason}</span>)}
                        </div>
                      </div>
                      <div className="sk-list__value">
                        <strong>{formatSectorKPrice(row.lastPrice)}</strong>
                        <small className={(row.percentChange ?? 0) >= 0 ? "sk-change--positive" : "sk-change--negative"}>{formatSectorKPercent(row.percentChange)}</small>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="sk-grid sk-grid--2">
            <Link className="sk-panel sk-card-link" href="/sector-k/materials/intraday-selection">
              <div className="sk-card-link__top">
                <span className="sk-tag sk-tag--violet">Калькулятор</span>
                <ArrowUpRight className="sk-arrow" size={18} />
              </div>
              <div>
                <h2>Расходы на вход и выход</h2>
                <p>Цена, лот, комиссия, спред и проскальзывание.</p>
              </div>
            </Link>
            <Link className="sk-panel sk-card-link" href="/sector-k/strategies">
              <div className="sk-card-link__top">
                <span className="sk-tag">Лаборатория</span>
                <ArrowUpRight className="sk-arrow" size={18} />
              </div>
              <div>
                <h2>Стратегии и тесты</h2>
                <p>Действующие лаборатории ScreenerPRO.</p>
              </div>
            </Link>
          </section>
        </div>

        <aside className="sk-dashboard__rail">
          <section className="sk-panel">
            <div className="sk-panel__head"><h2>Фьючерсные семьи</h2><Layers3 size={15} /></div>
            {futures.isPending && !futures.data ? <SectorKLoading label="Загрузка фьючерсов…" /> : (
              <ul className="sk-list">
                {families.map((family) => (
                  <li className="sk-list__row" key={family.familyKey}>
                    <div className="sk-list__primary">
                      <div className="sk-list__title"><strong>{family.familyLabel}</strong><span className="sk-mono">{family.activeContractTicker}</span></div>
                      <div className="sk-tags"><span className="sk-tag">{formatSectorKFutureSignal(family.signal)}</span><span className="sk-tag">{family.rollStatus}</span></div>
                    </div>
                    <div className="sk-list__value"><strong>{formatSectorKPrice(family.activePrice)}</strong><small>{formatSectorKTurnover(family.totalTurnover)}</small></div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="sk-panel">
            <div className="sk-panel__head"><h2>Данные</h2><Database size={15} /></div>
            <div className="sk-panel__body sk-grid">
              <div className="sk-tags">
                <span className={`sk-tag ${status?.source === "moex" ? "sk-tag--positive" : "sk-tag--warning"}`}>{status?.source ?? "ожидание"}</span>
                <span className={`sk-tag ${status?.degraded ? "sk-tag--warning" : "sk-tag--positive"}`}>{status?.degraded ? "degraded" : "normal"}</span>
                <span className={`sk-tag ${status?.baselineStatus === "ok" ? "sk-tag--positive" : "sk-tag--warning"}`}>baseline {status?.baselineStatus ?? "—"}</span>
              </div>
              <div className="sk-tags"><span className="sk-tag">Акции: {status?.stockRows ?? "—"}</span><span className="sk-tag">Фьючерсы: {status?.futuresRows ?? "—"}</span></div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
