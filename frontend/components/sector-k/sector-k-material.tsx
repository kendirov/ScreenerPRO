"use client";

import { useMemo, useState } from "react";
import { SectorKDataError, SectorKLoading, SectorKSource } from "@/components/sector-k/sector-k-data-state";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import { buildStockScreenerUniverse } from "@/lib/screener/stock-universe-filter";
import { formatSectorKPercent, formatSectorKPrice, formatSectorKTurnover, getSectorKTotalTrades, sortSectorKStocks } from "@/lib/sector-k/market";

function positiveNumber(value: string, fallback: number): number {
  const normalized = Number(value.replace(",", "."));
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : fallback;
}

export function SectorKMaterial() {
  const query = useScreenerQuery("stock");
  const allRows = useMemo(() => query.data?.rows ?? [], [query.data?.rows]);
  const universe = useMemo(() => buildStockScreenerUniverse(allRows), [allRows]);
  const rows = useMemo(() => sortSectorKStocks(universe.stockRows, "turnover", "desc").slice(0, 40), [universe.stockRows]);
  const totalTurnover = useMemo(() => universe.stockRows.reduce((sum, item) => sum + (item.turnover ?? 0), 0), [universe.stockRows]);
  const totalTrades = useMemo(() => getSectorKTotalTrades(universe.stockRows), [universe.stockRows]);
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
      <header className="sk-page-head sk-page-head--compact">
        <div className="sk-page-head__copy">
          <p className="sk-kicker">Материал · версия 2 · на проверке</p>
          <h1>Отбор инструментов для внутридневной торговли</h1>
          <p>Рынок акций MOEX, стоимость исполнения и условия отказа.</p>
        </div>
        <div className="sk-page-head__aside"><SectorKSource status={query.data?.status} error={error} /><span className="sk-tag sk-tag--violet">По ссылке</span></div>
      </header>

      {error ? <SectorKDataError error={error} /> : null}

      <section className="sk-article__scene sk-article__principle">
        <div className="sk-scene-index">01</div>
        <div>
          <p className="sk-kicker">Рынок акций</p>
          <h2>Состав и активность торгов</h2>
          <div className="sk-live-summary">
            <div><span>Акции</span><strong>{query.isPending ? "—" : universe.stockRows.length}</strong><small>TQBR · фонды исключены</small></div>
            <div><span>Оборот</span><strong>{query.isPending ? "—" : formatSectorKTurnover(totalTurnover)}</strong><small>Сумма по рынку акций</small></div>
            <div><span>Сделки</span><strong>{query.isPending ? "—" : totalTrades.toLocaleString("ru-RU")}</strong><small>Количество сделок MOEX</small></div>
          </div>
        </div>
      </section>

      <section className="sk-panel sk-article__scene">
        <div className="sk-panel__head"><h2>02 · Инструменты по обороту</h2><span>40 акций · цена · сделки · лот</span></div>
        {query.isPending && !query.data ? <SectorKLoading /> : (
          <div className="sk-panel__body sk-grid">
            <label className="sk-label">Акция
              <select className="sk-select" value={row?.ticker ?? ""} onChange={(event) => setTicker(event.target.value)}>
                {rows.map((item) => <option value={item.ticker} key={item.ticker}>{item.ticker} · {item.shortName}</option>)}
              </select>
            </label>
            {row ? (
              <div className="sk-metric-grid sk-snapshot-grid">
                <div className="sk-metric"><span className="sk-metric__label">Цена</span><strong className="sk-metric__value">{formatSectorKPrice(row.lastPrice)}</strong><span className="sk-metric__note">{formatSectorKPercent(row.percentChange)}</span></div>
                <div className="sk-metric"><span className="sk-metric__label">Оборот</span><strong className="sk-metric__value">{formatSectorKTurnover(row.turnover)}</strong><span className="sk-metric__note">Ранг: {rows.findIndex((item) => item.ticker === row.ticker) + 1} из {universe.stockRows.length}</span></div>
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
          <ul className="sk-checklist"><li>Цена, оборот, сделки и диапазон подтверждены MOEX.</li><li>Ожидаемое движение / расходы ≥ 3×.</li><li>Стоимость лота не превышает лимит позиции.</li><li>Заданы цена входа, стоп и размер позиции.</li></ul>
        </div>
        <div className="sk-panel sk-panel__body">
          <p className="sk-kicker">Стоп-фильтры</p>
          <h2 className="sk-scene-title">Не добавлять</h2>
          <ul className="sk-checklist sk-checklist--danger"><li>Нет цены, оборота или количества сделок.</li><li>Спред выше установленного лимита.</li><li>Ожидаемое движение / расходы &lt; 2×.</li><li>Стоимость лота выше лимита позиции.</li></ul>
        </div>
      </section>
    </article>
  );
}
