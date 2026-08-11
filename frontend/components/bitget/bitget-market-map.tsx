"use client";

import * as React from "react";
import Link from "next/link";
import type { BitgetScreenerResponse } from "@/lib/bitget/types";

const SECTIONS = [
  { id: "CRYPTO_SPOT", zone: "Крипто", title: "Крипто · Спот", mark: "S", live: true, short: "Сам токен без займа.", what: "Покупка и продажа самого криптоактива. Нет funding; при обычной спот-сделке без займа нет ликвидации из-за плеча.", mechanics: "Стакан spot · собственные средства · комиссия сделки", risk: "Рыночное движение актива", use: "База рынка и ориентир для деривативов." },
  { id: "MARGIN", zone: "Крипто", title: "Маржинальный спот", mark: "M", live: true, short: "Спот с заёмными средствами.", what: "Предмет сделки остаётся спотовым активом, но часть позиции финансируется займом.", mechanics: "Спот + долг + процент · возможна ликвидация", risk: "Цена, стоимость займа и плечо", use: "Увеличение позиции или заёмная короткая позиция." },
  { id: "CRYPTO_FUTURES", zone: "Крипто", title: "Крипто · Фьючерсы", mark: "F", live: true, short: "Контракт на цену, long или short.", what: "Торгуется производный контракт, а не сам токен. В общий контур входят USDT-, USDC- и Coin-margined futures.", mechanics: "Плечо · маржа · funding для perpetual · OI", risk: "Ликвидация, basis и funding", use: "Интрадей, short и хедж без покупки базового токена." },
  { id: "RTOKEN_SPOT", zone: "Акции и RWA", title: "Акции · rToken", mark: "R", live: true, short: "Токенизированная экспозиция на акцию/ETF.", what: "Reality-issued rToken связан с ценой фондового актива, но это отдельный токенизированный продукт.", mechanics: "В интерфейсе rSPY показывается как R · SPY, чтобы его не путать с самой акцией.", risk: "Риск базовой акции + особенности tokenized product", use: "Связь американских акций и ETF с крипто-контуром." },
  { id: "STOCK_PERPS", zone: "Акции и RWA", title: "Акции · Перпетуалы", mark: "P", live: true, short: "Бессрочный дериватив на акцию.", what: "Это не владение акцией: трейдер держит perpetual-контракт, который следует за ценой фондового underlying.", mechanics: "Long/short · плечо · funding", risk: "Ликвидация и отклонение дериватива", use: "Торговля фондовым движением в derivatives-контуре Bitget." },
  { id: "STOCK_PLUS", zone: "Акции и RWA", title: "Stock+ · Акции и ETF", mark: "+", live: false, short: "Отдельный брокерский контур.", what: "Stock+ — фондовый продукт Bitget через securities partners. Это другой продукт, чем rToken и stock perpetuals.", mechanics: "Отдельные market-data и account API", risk: "Риск акции/ETF и региональные правила", use: "Полный фондовый universe и сопоставление с rToken/perpetual." },
  { id: "OPTIONS", zone: "Акции и RWA", title: "Опционы США", mark: "O", live: false, short: "Call/put по страйкам и экспирациям.", what: "Каждый контракт имеет underlying, дату экспирации, strike и call/put. Это не одна строка акции.", mechanics: "Underlying → expiry → strike → call/put", risk: "Время, волатильность, Greeks и ликвидность", use: "События, хедж и волатильностные конструкции." },
  { id: "COMMODITY_PERPS", zone: "TradFi derivatives", title: "Товары · Перпетуалы", mark: "C", live: true, short: "Металлы и commodities в futures-контуре.", what: "Bitget помечает часть futures как metal или commodity. В скринере они отделены от крипто-фьючерсов.", mechanics: "Дериватив · плечо · funding/OI где доступны", risk: "Ликвидность и специфика базового рынка", use: "Золото, нефть и макро-связки для брифинга." },
  { id: "TRADFI", zone: "TradFi derivatives", title: "Forex / индексы / CFD", mark: "T", live: false, short: "Отдельный TradFi-контур.", what: "Эти рынки не входят в текущие универсальные категории публичного v3 endpoint и будут подключены отдельным адаптером.", mechanics: "Собственные символы, часы и спецификации", risk: "Плечо и торговый режим", use: "Макро-контекст и межрыночные связи." },
] as const;

const ZONES = ["Крипто", "Акции и RWA", "TradFi derivatives"] as const;

function compact(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)} млрд`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)} млн`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)} тыс.`;
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function ticker(baseCoin: string, symbol: string, isReality: boolean) {
  const base = (baseCoin || symbol).toUpperCase();
  return isReality && base.startsWith("R") && base.length > 1 ? base.slice(1) : base;
}

export function BitgetMarketMap() {
  const [data, setData] = React.useState<BitgetScreenerResponse | null>(null);
  const [selectedId, setSelectedId] = React.useState<string>("CRYPTO_SPOT");

  React.useEffect(() => {
    void fetch("/api/bitget/screener", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => setData(payload as BitgetScreenerResponse | null))
      .catch(() => setData(null));
  }, []);

  const selected = SECTIONS.find((section) => section.id === selectedId) ?? SECTIONS[0];
  const liveId = selected.live ? selected.id : null;
  const sectionRows = liveId
    ? (data?.rows ?? []).filter((row) => row.marketGroup === liveId && row.status.toLowerCase() === "online").slice().sort((a, b) => (b.turnover24h ?? 0) - (a.turnover24h ?? 0))
    : [];
  const count = liveId ? (data?.rows ?? []).filter((row) => row.marketGroup === liveId).length : null;

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div>
          <Link href="/screener/bitget" className="text-[10px] text-cyan-300/80 hover:text-cyan-200">← Вернуться в скринер</Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-100">Карта рынков Bitget</h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">Что именно торгуется: сам актив, актив с займом, токенизированная экспозиция или производный контракт.</p>
        </div>
        <div className="rounded border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[10px] text-slate-500">LIVE — уже подключено · ОТДЕЛЬНО — следующий API-контур</div>
      </header>

      <section className="relative overflow-hidden rounded-lg border border-white/[0.08] bg-slate-950/45 p-4">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.025)_1px,transparent_1px)] bg-[size:28px_28px]" />
        <div className="relative mb-4 flex justify-center">
          <div className="rounded-full border border-cyan-400/25 bg-cyan-400/[0.06] px-5 py-2 text-center"><p className="text-[9px] uppercase tracking-[0.24em] text-cyan-300/60">единый universe</p><p className="mt-0.5 font-mono text-sm font-semibold text-slate-100">BITGET</p></div>
        </div>
        <div className="relative grid gap-3 lg:grid-cols-3">
          {ZONES.map((zone) => (
            <div key={zone} className="rounded-md border border-white/[0.06] bg-black/10 p-2.5">
              <p className="mb-2 px-1 text-[9px] uppercase tracking-[0.18em] text-slate-500">{zone}</p>
              <div className="space-y-2">
                {SECTIONS.filter((section) => section.zone === zone).map((section) => {
                  const nodeCount = section.live ? (data?.rows ?? []).filter((row) => row.marketGroup === section.id).length : null;
                  const active = section.id === selectedId;
                  return (
                    <button key={section.id} type="button" onClick={() => setSelectedId(section.id)} className={`w-full rounded-md border p-3 text-left transition ${active ? "border-cyan-400/35 bg-cyan-400/[0.07]" : "border-white/[0.06] bg-white/[0.018] hover:border-white/[0.12] hover:bg-white/[0.03]"}`}>
                      <div className="flex items-start gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded border font-mono text-[11px] ${section.live ? "border-cyan-400/20 text-cyan-300" : "border-white/10 text-slate-500"}`}>{section.mark}</div>
                        <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="text-[12px] font-medium text-slate-200">{section.title}</span><span className="font-mono text-[9px] text-slate-600">{nodeCount == null ? "отдельно" : nodeCount}</span></div><p className="mt-1 text-[10px] leading-relaxed text-slate-500">{section.short}</p></div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-lg border border-white/[0.08] bg-slate-950/50 p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">выбранная секция</p><h2 className="mt-1 text-lg font-semibold text-slate-100">{selected.title}</h2><p className="mt-1 text-xs text-slate-500">{selected.short}</p></div>{count != null ? <span className="font-mono text-xl text-slate-200">{count}</span> : null}</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded border border-white/[0.06] bg-white/[0.015] p-3 md:col-span-2"><p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">Что это</p><p className="mt-1.5 text-[12px] leading-relaxed text-slate-300">{selected.what}</p></div>
            <div className="rounded border border-white/[0.06] bg-white/[0.015] p-3"><p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">Механика</p><p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">{selected.mechanics}</p></div>
            <div className="rounded border border-white/[0.06] bg-white/[0.015] p-3"><p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">Главный риск</p><p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">{selected.risk}</p></div>
            <div className="rounded border border-cyan-400/10 bg-cyan-400/[0.025] p-3 md:col-span-2"><p className="text-[9px] uppercase tracking-[0.14em] text-cyan-300/60">Зачем трейдеру</p><p className="mt-1.5 text-[12px] leading-relaxed text-slate-300">{selected.use}</p></div>
          </div>
          {liveId ? <Link href={`/screener/bitget?group=${liveId}`} className="mt-4 inline-flex rounded border border-cyan-400/20 bg-cyan-400/[0.05] px-3 py-1.5 text-[10px] text-cyan-200 hover:bg-cyan-400/[0.09]">Открыть секцию в скринере →</Link> : <p className="mt-4 text-[10px] text-slate-600">Этот контур будет подключён отдельным адаптером и не смешивается с текущим public universe.</p>}
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-slate-950/50 p-4">
          <div className="flex items-center justify-between"><div><p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">живой срез</p><h3 className="mt-1 text-sm font-semibold text-slate-200">Самые ликвидные в секции</h3></div><span className={`text-[9px] ${selected.live ? "text-cyan-300/70" : "text-slate-600"}`}>{selected.live ? "LIVE" : "ОТДЕЛЬНО"}</span></div>
          <div className="mt-3 divide-y divide-white/[0.05]">
            {sectionRows.length ? sectionRows.slice(0, 10).map((row, index) => (
              <div key={row.id} className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-2 py-2 text-[10px]">
                <span className="font-mono text-slate-700">{String(index + 1).padStart(2, "0")}</span>
                <div className="min-w-0"><div className="flex items-center gap-1.5">{row.isReality ? <span className="rounded border border-violet-400/20 bg-violet-400/[0.06] px-1 text-[8px] text-violet-300">R</span> : null}<span className="truncate font-mono font-semibold text-slate-200">{ticker(row.baseCoin, row.symbol, row.isReality)}</span></div><p className="mt-0.5 truncate text-[9px] text-slate-600">{row.symbol}</p></div>
                <span className="font-mono tabular-nums text-slate-400">{row.change24hPct == null ? "—" : `${row.change24hPct > 0 ? "+" : ""}${row.change24hPct.toFixed(2)}%`}</span>
                <span className="min-w-[6rem] text-right font-mono tabular-nums text-slate-500">${compact(row.turnover24h)}</span>
              </div>
            )) : <div className="py-10 text-center text-[11px] leading-relaxed text-slate-600">{selected.live ? "Ждём live-данные этой секции." : "Здесь появится отдельный каталог после подключения следующего API."}</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
