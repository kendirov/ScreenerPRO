"use client";

import { useMemo, useState } from "react";
import { SectorKDataError, SectorKLoading, SectorKSource } from "@/components/sector-k/sector-k-data-state";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import { formatSectorKPercent, formatSectorKPrice, formatSectorKTurnover, selectSectorKFocusRows } from "@/lib/sector-k/market";

function positiveNumber(value: string, fallback: number): number {
  const normalized = Number(value.replace(",", "."));
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : fallback;
}

export function SectorKMaterial() {
  const query = useScreenerQuery("stock");
  const allRows = useMemo(() => query.data?.rows ?? [], [query.data?.rows]);
  const rows = useMemo(() => selectSectorKFocusRows(allRows, 20), [allRows]);
  const inPlayCount = useMemo(() => allRows.filter((item) => item.metrics.isInPlay).length, [allRows]);
  const activeCount = useMemo(() => allRows.filter((item) => item.metrics.isInPlay || (item.metrics.inPlayScore ?? 0) >= 70 || (item.metrics.turnoverPercentile ?? 0) >= 82).length, [allRows]);
  const reliableBaselineCount = useMemo(() => allRows.filter((item) => item.metrics.baselineIsReliable).length, [allRows]);
  const [ticker, setTicker] = useState<string | null>(null);
  const [commissionSidePct, setCommissionSidePct] = useState("0.05");
  const [spreadBps, setSpreadBps] = useState("8");
  const [slippageSideBps, setSlippageSideBps] = useState("4");
  const [expectedMovePct, setExpectedMovePct] = useState("0.80");
  const row = rows.find((item) => item.ticker === ticker) ?? rows[0] ?? null;
  const price = row?.lastPrice ?? 0;
  const lot = row?.lotSize ?? 1;
  const frictionPct = positiveNumber(commissionSidePct, 0) * 2 + positiveNumber(spreadBps, 0) / 100 + positiveNumber(slippageSideBps, 0) * 2 / 100;
  const frictionRub = price * lot * (frictionPct / 100);
  const expected = positiveNumber(expectedMovePct, 0);
  const coverage = frictionPct > 0 ? expected / frictionPct : null;
  const error = query.error instanceof Error ? query.error : null;

  return (
    <article className="sk-page sk-article">
      <header className="sk-page-head">
        <div className="sk-page-head__copy">
          <p className="sk-kicker">Материал · версия 2 · на проверке</p>
          <h1>Отбор инструментов для внутридневной торговли</h1>
          <p>Текущие инструменты MOEX, расходы на сделку и фильтр отказа.</p>
        </div>
        <div className="sk-page-head__aside"><SectorKSource status={query.data?.status} error={error} /><span className="sk-tag sk-tag--violet">По ссылке</span></div>
      </header>

      {error ? <SectorKDataError error={error} /> : null}

      <section className="sk-article__scene sk-article__principle">
        <div className="sk-scene-index">01</div>
        <div>
          <p className="sk-kicker">Текущий снимок</p>
          <h2>Акции в игре и активные инструменты</h2>
          <div className="sk-live-summary">
            <div><span>Акции в игре</span><strong>{query.isPending ? "—" : inPlayCount}</strong><small>isInPlay = true</small></div>
            <div><span>Активные акции</span><strong>{query.isPending ? "—" : activeCount}</strong><small>score ≥ 70 или оборот top 18%</small></div>
            <div><span>Надёжный baseline</span><strong>{allRows.length ? `${reliableBaselineCount}/${allRows.length}` : "—"}</strong><small>same-time сравнение</small></div>
          </div>
        </div>
      </section>

      <section className="sk-panel sk-article__scene">
        <div className="sk-panel__head"><h2>02 · Активные инструменты MOEX</h2><span>цена · оборот · сделки · лот</span></div>
        {query.isPending && !query.data ? <SectorKLoading /> : (
          <div className="sk-panel__body sk-grid">
            <label className="sk-label">Активная акция
              <select className="sk-select" value={row?.ticker ?? ""} onChange={(event) => setTicker(event.target.value)}>
                {rows.map((item) => <option value={item.ticker} key={item.ticker}>{item.ticker} · {item.shortName}</option>)}
              </select>
            </label>
            {row ? (
              <div className="sk-metric-grid sk-snapshot-grid">
                <div className="sk-metric"><span className="sk-metric__label">Цена</span><strong className="sk-metric__value">{formatSectorKPrice(row.lastPrice)}</strong><span className="sk-metric__note">{formatSectorKPercent(row.percentChange)}</span></div>
                <div className="sk-metric"><span className="sk-metric__label">Оборот</span><strong className="sk-metric__value">{formatSectorKTurnover(row.turnover)}</strong><span className="sk-metric__note">Абсолютное значение</span></div>
                <div className="sk-metric"><span className="sk-metric__label">Сделки</span><strong className="sk-metric__value">{row.tradesCount?.toLocaleString("ru-RU") ?? "—"}</strong><span className="sk-metric__note">Количество сделок MOEX</span></div>
                <div className="sk-metric"><span className="sk-metric__label">Лот</span><strong className="sk-metric__value">{row.lotSize ?? "—"}</strong><span className="sk-metric__note">Стоимость лота ≈ {(price * lot).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽</span></div>
              </div>
            ) : <div className="sk-empty"><div><h2>Нет данных MOEX</h2></div></div>}
          </div>
        )}
      </section>

      <section className="sk-panel sk-article__scene">
        <div className="sk-panel__head"><h2>03 · Расходы на вход и выход</h2><span>цена MOEX · параметры пользователя</span></div>
        <div className="sk-calculator">
          <div className="sk-calculator__inputs">
            <label className="sk-label">Комиссия на сторону, %<input className="sk-input" inputMode="decimal" value={commissionSidePct} onChange={(event) => setCommissionSidePct(event.target.value)} /></label>
            <label className="sk-label">Спред целиком, bps<input className="sk-input" inputMode="decimal" value={spreadBps} onChange={(event) => setSpreadBps(event.target.value)} /></label>
            <label className="sk-label">Проскальзывание на сторону, bps<input className="sk-input" inputMode="decimal" value={slippageSideBps} onChange={(event) => setSlippageSideBps(event.target.value)} /></label>
            <label className="sk-label">Ожидаемое движение, %<input className="sk-input" inputMode="decimal" value={expectedMovePct} onChange={(event) => setExpectedMovePct(event.target.value)} /></label>
          </div>
          <div className="sk-calculator__result">
            <span className="sk-metric__label">Полные расходы</span>
            <strong className="sk-mono">{frictionPct.toFixed(2)}%</strong>
            <span>≈ {frictionRub.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽ на один лот {row?.ticker ?? "—"}</span>
            <div className="sk-divider" />
            <span className="sk-metric__label">Покрытие движением</span>
            <strong className={`sk-mono ${coverage !== null && coverage >= 3 ? "sk-good" : coverage !== null && coverage >= 2 ? "sk-warn" : "sk-bad"}`}>{coverage === null ? "—" : `${coverage.toFixed(1)}×`}</strong>
            <span>{coverage === null ? "Расходы = 0" : coverage >= 3 ? "≥ 3×" : coverage >= 2 ? "2–3×" : "< 2×"}</span>
          </div>
        </div>
        <div className="sk-note">Комиссия: тариф пользователя · спред и проскальзывание: ручной ввод · цена и лот: MOEX ISS.</div>
      </section>

      <section className="sk-grid sk-grid--2 sk-article__scene">
        <div className="sk-panel sk-panel__body">
          <p className="sk-kicker">04 · Фильтр</p>
          <h2 className="sk-scene-title">Добавить в список</h2>
          <ul className="sk-checklist"><li>baselineIsReliable = true.</li><li>Ожидаемое движение / расходы ≥ 3×.</li><li>Стоимость лота не превышает лимит позиции.</li><li>Заданы цена входа и стоп.</li></ul>
        </div>
        <div className="sk-panel sk-panel__body">
          <p className="sk-kicker">Стоп-фильтры</p>
          <h2 className="sk-scene-title">Не добавлять</h2>
          <ul className="sk-checklist sk-checklist--danger"><li>baselineIsReliable = false.</li><li>Спред выше установленного лимита.</li><li>Ожидаемое движение / расходы &lt; 2×.</li><li>Стоимость лота выше лимита позиции.</li></ul>
        </div>
      </section>
    </article>
  );
}
