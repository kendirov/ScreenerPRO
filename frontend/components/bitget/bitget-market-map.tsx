"use client";

import * as React from "react";
import Link from "next/link";
import type { BitgetMarketGroup, BitgetScreenerResponse, BitgetScreenerRow } from "@/lib/bitget/types";

type NodeId = BitgetMarketGroup | "STOCK_PLUS" | "OPTIONS" | "TRADFI";
type Zone = "Крипто" | "Акции и RWA" | "Деривативы TradFi";

type MarketNode = {
  id: NodeId;
  zone: Zone;
  title: string;
  short: string;
  what: string;
  mechanics: string;
  leverage: string;
  cashflow: string;
  risk: string;
  traderUse: string;
  liveGroup?: BitgetMarketGroup;
  status: "live" | "separate";
  mark: string;
};

const NODES: MarketNode[] = [
  {
    id: "CRYPTO_SPOT", zone: "Крипто", title: "Крипто · Спот", mark: "S",
    short: "Покупка и продажа самого токена.",
    what: "Вы обмениваете один актив на другой: например BTC на USDT. Позиция существует в самом активе, а не в производном контракте.",
    mechanics: "Цена формируется в спотовом стакане. Funding отсутствует. При обычной спот-сделке без займа нет принудительной ликвидации из-за плеча.",
    leverage: "Нет по умолчанию", cashflow: "Комиссия сделки", risk: "Рыночное движение самого актива",
    traderUse: "База рынка: направление, ликвидность и цена, с которой сравниваются деривативы.", liveGroup: "CRYPTO_SPOT", status: "live",
  },
  {
    id: "MARGIN", zone: "Крипто", title: "Маржинальный спот", mark: "M",
    short: "Тот же спот, но с заёмными средствами.",
    what: "Предмет сделки остаётся спотовым активом, но часть позиции может финансироваться займом. Это принципиально отличается от фьючерса.",
    mechanics: "Есть долг и процент за заём. Плечо увеличивает чувствительность капитала к цене и создаёт риск ликвидации.",
    leverage: "Есть, зависит от пары", cashflow: "Комиссия + процент по займу", risk: "Цена + стоимость займа + ликвидация",
    traderUse: "Когда нужен именно спотовый актив, но требуется увеличить размер позиции или использовать заём.", liveGroup: "MARGIN", status: "live",
  },
  {
    id: "CRYPTO_FUTURES", zone: "Крипто", title: "Крипто · Фьючерсы", mark: "F",
    short: "Контракт на цену криптоактива, long или short.",
    what: "Вы торгуете производным контрактом, а не покупаете сам токен. В Bitget общий контур включает USDT-, USDC- и Coin-margined futures.",
    mechanics: "Для бессрочных контрактов используется funding, чтобы цена контракта оставалась связанной со спотом. Доступны плечо и маржинальная ликвидация.",
    leverage: "Да", cashflow: "Комиссия + funding для perpetual", risk: "Плечо, ликвидация, basis и funding",
    traderUse: "Интрадей, short, хедж и торговля направлением без покупки базового токена.", liveGroup: "CRYPTO_FUTURES", status: "live",
  },
  {
    id: "RTOKEN_SPOT", zone: "Акции и RWA", title: "Акции · rToken", mark: "R",
    short: "Токенизированная экспозиция на акцию или ETF.",
    what: "Reality-issued rToken связан с ценой американской акции или ETF и торгуется внутри криптовалютной инфраструктуры Bitget.",
    mechanics: "В интерфейсе префикс r отделён от обычного биржевого тикера: rSPY показывается как R · SPY. Так токен не путается с самой акцией.",
    leverage: "Спот; режимы обеспечения отдельно", cashflow: "Спотовая комиссия", risk: "Базовая акция + особенности токенизированного продукта",
    traderUse: "Связать движение американских акций и ETF с крипто-средой и круглосуточным наблюдением, где продукт доступен.", liveGroup: "RTOKEN_SPOT", status: "live",
  },
  {
    id: "STOCK_PERPS", zone: "Акции и RWA", title: "Акции · Перпетуалы", mark: "P",
    short: "Бессрочный дериватив на цену акции или индекса.",
    what: "Это не владение акцией. Трейдер держит perpetual-контракт, который следует за ценой связанного фондового актива.",
    mechanics: "Есть long/short, плечо и funding. Поэтому SPY, rSPY и SPY-perpetual — три разных инструмента с разной механикой риска.",
    leverage: "Да", cashflow: "Комиссия + funding", risk: "Плечо, ликвидация и отклонение дериватива от базового рынка",
    traderUse: "Торговля американским фондовым движением в деривативном контуре Bitget.", liveGroup: "STOCK_PERPS", status: "live",
  },
  {
    id: "STOCK_PLUS", zone: "Акции и RWA", title: "Stock+ · Акции и ETF", mark: "+",
    short: "Брокерский контур американских акций и ETF.",
    what: "Stock+ — отдельный фондовый продукт Bitget через securities partners. Это другой контур, чем rToken и stock perpetuals.",
    mechanics: "У него отдельные market-data и account API. Мы подключим этот слой отдельным адаптером, чтобы не выдавать rToken за реальную акцию.",
    leverage: "Зависит от продукта и региона", cashflow: "Правила фондового продукта", risk: "Рыночный риск акции/ETF и правила доступа региона",
    traderUse: "Полный фондовый universe и сопоставление акции с rToken/perpetual на тот же underlying.", status: "separate",
  },
  {
    id: "OPTIONS", zone: "Акции и RWA", title: "Опционы США", mark: "O",
    short: "Call/put по страйкам и экспирациям.",
    what: "Опцион — отдельный контракт с underlying, датой экспирации, страйком и типом call/put. Его нельзя сводить к одной строке акции.",
    mechanics: "Карта будет строиться как underlying → экспирация → страйк → call/put, а не как плоский список тикеров.",
    leverage: "Нелинейный риск", cashflow: "Премия опциона", risk: "Время, волатильность, Greeks и ликвидность серии",
    traderUse: "События, хедж, направленные и волатильностные конструкции.", status: "separate",
  },
  {
    id: "COMMODITY_PERPS", zone: "Деривативы TradFi", title: "Товары · Перпетуалы", mark: "C",
    short: "Золото, металлы и товарные контракты в futures-контуре.",
    what: "Bitget помечает часть futures-инструментов как metal или commodity. В скринере мы отделяем их от крипто-фьючерсов.",
    mechanics: "По структуре это дериватив: цена, плечо, funding/OI где они доступны, а не владение физическим товаром.",
    leverage: "Да", cashflow: "Комиссия + funding для perpetual", risk: "Плечо, ликвидность и торговый режим базового рынка",
    traderUse: "Связь крипто-терминала с золотом, нефтью и макро-движениями.", liveGroup: "COMMODITY_PERPS", status: "live",
  },
  {
    id: "TRADFI", zone: "Деривативы TradFi", title: "Forex / индексы / CFD", mark: "T",
    short: "Отдельный TradFi-контур Bitget.",
    what: "FX, индексы и иные TradFi-продукты не входят в универсальные категории текущего публичного v3 market endpoint, поэтому их нельзя честно дорисовать как будто они уже в этой выборке.",
    mechanics: "Подключается отдельным источником с собственными торговыми часами, символами и правилами.",
    leverage: "Зависит от продукта", cashflow: "Зависит от контракта", risk: "Режим торгов, плечо и спецификация контракта",
    traderUse: "Макро-контекст и межрыночные связки для брифинга.", status: "separate",
  },
];

const ZONES: Zone[] = ["Крипто", "Акции и RWA", "Деривативы TradFi"];

function compact(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)} млрд`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)} млн`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)} тыс.`;
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function displayTicker(row: BitgetScreenerRow) {
  const base = (row.baseCoin || row.symbol).toUpperCase();
  return row.isReality && base.startsWith("R") && base.length > 1 ? base.slice(1) : base;
}

export function BitgetMarketMap() {
  const [data, setData] = React.useState<BitgetScreenerResponse | null>(null);
  const [selectedId, setSelectedId] = React.useState<NodeId>("CRYPTO_SPOT");

  React.useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/bitget/screener", { cache: "no-store" });
        if (!response.ok) return;
        setData((await response.json()) as BitgetScreenerResponse);
      } catch {
        setData(null);
      }
    })();
  }, []);

  const selected = React.useMemo(() => NODES.find((node) => node.id === selectedId) ?? NODES[0], [selectedId]);
  const liveGroup = selected.liveGroup;
  const rows = React.useMemo(() => {
    if (!liveGroup) return [];
    return (data?.rows ?? [])
      .filter((row) => row.marketGroup === liveGroup && row.status.toLowerCase() === "online")
      .slice()
      .sort((a, b) => (b.turnover24h ?? 0) - (a.turnover24h ?? 0));
  }, [data, liveGroup]);
  const count = liveGroup ? (data?.rows ?? []).filter((row) => row.marketGroup === liveGroup).length : null;

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div>
          <Link href="/screener/bitget" className="text-[10px] text-cyan-300/80 hover:text-cyan-200">← Вернуться в скринер</Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-100">Карта рынков Bitget</h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">Схема того, что именно торгуется: сам актив, актив с займом, токенизированная экспозиция или производный контракт.</p>
        </div>
        <div className="rounded border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[10px] text-slate-500">LIVE — уже в скринере · ОТДЕЛЬНО — следующий API-контур</div>
      </header>

      <section className="relative overflow-hidden rounded-lg border border-white/[0.08] bg-slate-950/45 p-4">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.025)_1px,transparent_1px)] bg-[size:28px_28px]" />
        <div className="relative mb-4 flex justify-center">
          <div className="rounded-full border border-cyan-400/25 bg-cyan-400/[0.06] px-5 py-2 text-center">
            <p className="text-[9px] uppercase tracking-[0.24em] text-cyan-300/60">единый universe</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-slate-100">BITGET</p>
          </div>
        </div>
        <div className="relative grid gap-3 lg:grid-cols-3">
          {ZONES.map((zone) => (
            <div key={zone} className="rounded-md border border-white/[0.06] bg-black/10 p-2.5">
              <p className="mb-2 px-1 text-[9px] uppercase tracking-[0.18em] text-slate-500">{zone}</p>
              <div className="space-y-2">
                {NODES.filter((node) => node.zone === zone).map((node) => {
                  const active = node.id === selectedId;
                  const nodeGroup = node.liveGroup;
                  const nodeCount = nodeGroup ? (data?.rows ?? []).filter((row) => row.marketGroup === nodeGroup).length : null;
                  return (
                    <button key={node.id} type="button" onClick={() => setSelectedId(node.id)} className={`w-full rounded-md border p-3 text-left transition ${active ? "border-cyan-400/35 bg-cyan-400/[0.07]" : "border-white/[0.06] bg-white/[0.018] hover:border-white/[0.12] hover:bg-white/[0.03]"}`}>
                      <div className="flex items-start gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded border font-mono text-[11px] ${node.status === "live" ? "border-cyan-400/20 text-cyan-300" : "border-white/10 text-slate-500"}`}>{node.mark}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2"><span className="text-[12px] font-medium text-slate-200">{node.title}</span><span className="font-mono text-[9px] text-slate-600">{nodeCount != null ? nodeCount : "отдельно"}</span></div>
                          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{node.short}</p>
                        </div>
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
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">выбранная секция</p><h2 className="mt-1 text-lg font-semibold text-slate-100">{selected.title}</h2><p className="mt-1 text-xs text-slate-500">{selected.short}</p></div>
            {count != null ? <span className="font-mono text-xl text-slate-200">{count}</span> : null}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded border border-white/[0.06] bg-white/[0.015] p-3 md:col-span-2"><p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">Что это</p><p className="mt-1.5 text-[12px] leading-relaxed text-slate-300">{selected.what}</p></div>
            {[["Механика", selected.mechanics], ["Плечо", selected.leverage], ["Денежный поток", selected.cashflow], ["Главный риск", selected.risk]].map(([label, value]) => (
              <div key={label} className="rounded border border-white/[0.06] bg-white/[0.015] p-3"><p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">{label}</p><p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">{value}</p></div>
            ))}
            <div className="rounded border border-cyan-400/10 bg-cyan-400/[0.025] p-3 md:col-span-2"><p className="text-[9px] uppercase tracking-[0.14em] text-cyan-300/60">Зачем трейдеру</p><p className="mt-1.5 text-[12px] leading-relaxed text-slate-300">{selected.traderUse}</p></div>
          </div>
          {liveGroup ? <Link href={`/screener/bitget?group=${liveGroup}`} className="mt-4 inline-flex rounded border border-cyan-400/20 bg-cyan-400/[0.05] px-3 py-1.5 text-[10px] text-cyan-200 hover:bg-cyan-400/[0.09]">Открыть секцию в скринере →</Link> : <p className="mt-4 text-[10px] text-slate-600">Этот контур будет подключён отдельным адаптером и намеренно не смешан с текущим v3 universe.</p>}
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-slate-950/50 p-4">
          <div className="flex items-center justify-between"><div><p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">живой срез</p><h3 className="mt-1 text-sm font-semibold text-slate-200">Самые ликвидные в секции</h3></div><span className={`text-[9px] ${selected.status === "live" ? "text-cyan-300/70" : "text-slate-600"}`}>{selected.status === "live" ? "LIVE" : "ОТДЕЛЬНЫЙ КОНТУР"}</span></div>
          <div className="mt-3 divide-y divide-white/[0.05]">
            {rows.length ? rows.slice(0, 10).map((row, index) => (
              <div key={row.id} className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-2 py-2 text-[10px]">
                <span className="font-mono text-slate-700">{String(index + 1).padStart(2, "0")}</span>
                <div className="min-w-0"><div className="flex items-center gap-1.5">{row.isReality ? <span className="rounded border border-violet-400/20 bg-violet-400/[0.06] px-1 text-[8px] text-violet-300">R</span> : null}<span className="truncate font-mono font-semibold text-slate-200">{displayTicker(row)}</span></div><p className="mt-0.5 truncate text-[9px] text-slate-600">{row.symbol}</p></div>
                <span className="font-mono tabular-nums text-slate-400">{row.change24hPct == null ? "—" : `${row.change24hPct > 0 ? "+" : ""}${row.change24hPct.toFixed(2)}%`}</span>
                <span className="min-w-[6rem] text-right font-mono tabular-nums text-slate-500">${compact(row.turnover24h)}</span>
              </div>
            )) : <div className="py-10 text-center text-[11px] leading-relaxed text-slate-600">{selected.status === "live" ? "Ждём live-данные этой секции." : "Здесь появится отдельный каталог после подключения следующего API."}</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
