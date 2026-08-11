"use client";

import * as React from "react";
import Link from "next/link";

const SECTIONS = [
  ["Крипто", "S", "Крипто · Спот", "Сам токен. Без займа и perpetual funding."],
  ["Крипто", "M", "Маржинальный спот", "Спот с заёмными средствами, процентом и риском ликвидации."],
  ["Крипто", "F", "Крипто · Фьючерсы", "Производный контракт: long/short, плечо, funding и open interest."],
  ["Акции и RWA", "R", "Акции · rToken", "Токенизированная экспозиция. rSPY в интерфейсе читается как R · SPY."],
  ["Акции и RWA", "P", "Акции · Перпетуалы", "Бессрочный дериватив на фондовый underlying, не владение акцией."],
  ["Акции и RWA", "+", "Stock+ · Акции и ETF", "Отдельный брокерский контур Bitget через securities partners."],
  ["Акции и RWA", "O", "Опционы США", "Underlying → экспирация → страйк → call/put."],
  ["TradFi", "C", "Товары · Перпетуалы", "Металлы и commodities в деривативном контуре."],
  ["TradFi", "T", "Forex / индексы / CFD", "Отдельный TradFi-адаптер с собственными правилами и символами."],
] as const;

const DETAILS: Record<string, { what: string; mechanics: string; risk: string; use: string }> = {
  "Крипто · Спот": {
    what: "Покупка и продажа самого криптоактива. Это базовый рынок, с которым сравниваются деривативы.",
    mechanics: "Спотовый стакан · собственные средства · комиссия сделки.",
    risk: "Рыночное движение актива.",
    use: "Направление, ликвидность и базовая цена рынка.",
  },
  "Маржинальный спот": {
    what: "Предмет сделки остаётся спотовым активом, но часть позиции может финансироваться займом.",
    mechanics: "Спот + долг + процент · возможна ликвидация.",
    risk: "Цена, стоимость займа и плечо.",
    use: "Увеличение позиции или заёмная короткая позиция.",
  },
  "Крипто · Фьючерсы": {
    what: "Торгуется производный контракт, а не сам токен. Доступны long и short.",
    mechanics: "Плечо · маржа · funding для perpetual · open interest.",
    risk: "Ликвидация, basis и funding.",
    use: "Интрадей, хедж и торговля направлением без покупки базового токена.",
  },
  "Акции · rToken": {
    what: "Токенизированный продукт, связанный с ценой фондового underlying. Это не то же самое, что Stock+ акция.",
    mechanics: "Префикс r показываем отдельным маркером R, а основной тикер оставляем привычным трейдеру.",
    risk: "Риск underlying + особенности токенизированного продукта.",
    use: "Связь американских акций и ETF с крипто-контуром.",
  },
  "Акции · Перпетуалы": {
    what: "Бессрочный производный контракт на фондовый underlying. Это не владение акцией.",
    mechanics: "Long/short · плечо · funding.",
    risk: "Ликвидация и отклонение дериватива от базового рынка.",
    use: "Торговля фондовым движением в derivatives-контуре Bitget.",
  },
  "Stock+ · Акции и ETF": {
    what: "Отдельный фондовый продукт Bitget через securities partners.",
    mechanics: "Отдельный Stock+ market-data/account API.",
    risk: "Риск акции или ETF и региональные правила доступа.",
    use: "Полный фондовый universe и сопоставление с rToken/perpetual.",
  },
  "Опционы США": {
    what: "Каждый опцион — отдельный контракт с underlying, экспирацией, страйком и типом call/put.",
    mechanics: "Underlying → expiry → strike → call/put.",
    risk: "Время, волатильность, Greeks и ликвидность серии.",
    use: "События, хедж и волатильностные конструкции.",
  },
  "Товары · Перпетуалы": {
    what: "Деривативы на metals/commodities, отделённые от крипто-фьючерсов.",
    mechanics: "Плечо · funding/OI там, где они доступны.",
    risk: "Ликвидность и специфика базового рынка.",
    use: "Золото, нефть и макро-связки для брифинга.",
  },
  "Forex / индексы / CFD": {
    what: "Отдельный TradFi-контур, который не смешиваем с текущим public v3 universe.",
    mechanics: "Собственные символы, торговые часы и спецификации.",
    risk: "Плечо и режим торгов.",
    use: "Макро-контекст и межрыночные связи.",
  },
};

export function BitgetMarketMap() {
  const [selected, setSelected] = React.useState("Крипто · Спот");
  const detail = DETAILS[selected];

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 pb-10">
      <header className="border-b border-white/[0.06] pb-4">
        <Link href="/screener/bitget" className="text-[10px] text-cyan-300/80 hover:text-cyan-200">← Вернуться в скринер</Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-100">Карта рынков Bitget</h1>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">Не меню биржи, а карта механики: что именно вы торгуете и где появляется заём, плечо, funding или опционная нелинейность.</p>
      </header>

      <section className="rounded-lg border border-white/[0.08] bg-slate-950/45 p-4">
        <div className="mb-4 flex justify-center"><div className="rounded-full border border-cyan-400/25 bg-cyan-400/[0.06] px-5 py-2 text-center"><p className="text-[9px] uppercase tracking-[0.24em] text-cyan-300/60">единый universe</p><p className="font-mono text-sm text-slate-100">BITGET</p></div></div>
        <div className="grid gap-3 lg:grid-cols-3">
          {["Крипто", "Акции и RWA", "TradFi"].map((zone) => (
            <div key={zone} className="rounded-md border border-white/[0.06] bg-black/10 p-2.5">
              <p className="mb-2 px-1 text-[9px] uppercase tracking-[0.18em] text-slate-500">{zone}</p>
              <div className="space-y-2">
                {SECTIONS.filter((item) => item[0] === zone).map((item) => (
                  <button key={item[2]} type="button" onClick={() => setSelected(item[2])} className={`w-full rounded-md border p-3 text-left transition ${selected === item[2] ? "border-cyan-400/35 bg-cyan-400/[0.07]" : "border-white/[0.06] bg-white/[0.018] hover:border-white/[0.12]"}`}>
                    <div className="flex gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-white/10 font-mono text-[11px] text-cyan-300">{item[1]}</div><div><p className="text-[12px] font-medium text-slate-200">{item[2]}</p><p className="mt-1 text-[10px] leading-relaxed text-slate-500">{item[3]}</p></div></div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-white/[0.08] bg-slate-950/50 p-4">
        <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">выбранная секция</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-100">{selected}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded border border-white/[0.06] bg-white/[0.015] p-3 md:col-span-2"><p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">Что это</p><p className="mt-1.5 text-[12px] leading-relaxed text-slate-300">{detail?.what}</p></div>
          <div className="rounded border border-white/[0.06] bg-white/[0.015] p-3"><p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">Механика</p><p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">{detail?.mechanics}</p></div>
          <div className="rounded border border-white/[0.06] bg-white/[0.015] p-3"><p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">Главный риск</p><p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">{detail?.risk}</p></div>
          <div className="rounded border border-cyan-400/10 bg-cyan-400/[0.025] p-3 md:col-span-2"><p className="text-[9px] uppercase tracking-[0.14em] text-cyan-300/60">Зачем трейдеру</p><p className="mt-1.5 text-[12px] leading-relaxed text-slate-300">{detail?.use}</p></div>
        </div>
      </section>
    </div>
  );
}
