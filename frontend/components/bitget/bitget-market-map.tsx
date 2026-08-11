"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  Bitcoin,
  Boxes,
  ChartCandlestick,
  CircleDollarSign,
  Coins,
  Gem,
  Landmark,
  Layers3,
  Orbit,
  Scale,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { BitgetMarketGroup, BitgetScreenerResponse, BitgetScreenerRow } from "@/lib/bitget/types";

type NodeId =
  | "CRYPTO_SPOT"
  | "MARGIN"
  | "CRYPTO_FUTURES"
  | "US_STOCK"
  | "RTOKEN_SPOT"
  | "STOCK_PLUS"
  | "STOCK_PERPS"
  | "OPTIONS"
  | "GLOBAL_MARKET"
  | "COMMODITY_PERPS"
  | "TRADFI";

type Detail = {
  eyebrow: string;
  title: string;
  thesis: string;
  ownership: string;
  mechanics: string;
  driver: string;
  risk: string;
  check: string;
  family: string[];
  group?: BitgetMarketGroup;
  screenerGroup?: BitgetMarketGroup;
  apiStatus: string;
};

const DETAILS: Record<NodeId, Detail> = {
  CRYPTO_SPOT: {
    eyebrow: "БАЗОВЫЙ КРИПТО-РЫНОК",
    title: "Крипто · Спот",
    thesis: "Торгуется сам токен. Это базовая цена, относительно которой читаются маржинальные позиции и крипто-деривативы.",
    ownership: "Сам криптоактив",
    mechanics: "Покупка / продажа за собственные средства. Нет perpetual funding и нет обязательного займа.",
    driver: "Спрос и предложение в спотовом рынке, общий крипто-режим, новости и ликвидность конкретного токена.",
    risk: "Движение цены самого актива и ликвидность пары.",
    check: "Оборот → спред → локальный ход → связь с BTC/ETH и сектором.",
    family: ["Спот", "→", "Margin", "→", "Futures"],
    group: "CRYPTO_SPOT",
    screenerGroup: "CRYPTO_SPOT",
    apiStatus: "Живые инструменты доступны в public UTA v3.",
  },
  MARGIN: {
    eyebrow: "СПОТ + ЗАЁМ",
    title: "Маржинальный спот",
    thesis: "Предмет сделки остаётся спотовым активом, но позиция меняется: в ней появляется долг, стоимость займа и риск ликвидации.",
    ownership: "Спот-позиция с заёмной частью",
    mechanics: "Собственные средства + займ. Возможны увеличенный long и заёмный short.",
    driver: "Тот же базовый спотовый рынок, но результат позиции дополнительно зависит от плеча и стоимости займа.",
    risk: "Ликвидация, процент за займ и рост риска при увеличении позиции.",
    check: "Сначала спот → затем доступный займ → плечо → цена ликвидации.",
    family: ["Спот", "+", "Заём", "=", "Margin"],
    group: "MARGIN",
    screenerGroup: "MARGIN",
    apiStatus: "Список margin-инструментов доступен в public UTA v3.",
  },
  CRYPTO_FUTURES: {
    eyebrow: "КРИПТО-ДЕРИВАТИВ",
    title: "Крипто · Фьючерсы",
    thesis: "Торгуется контракт на движение цены, а не сам токен. Здесь появляются long/short, маржа, open interest и funding для perpetual.",
    ownership: "Производный контракт",
    mechanics: "Маржа + плечо + long/short. Perpetual не имеет обычной даты экспирации и использует funding-механику.",
    driver: "Базовый крипто-рынок + позиционирование в деривативах + ликвидации + изменение OI.",
    risk: "Ликвидация, экстремальный funding и расхождение дериватива с базовым рынком.",
    check: "Цена → OI → funding → спред → где находится инициатива: spot или futures.",
    family: ["Токен", "→", "Perpetual", "→", "Funding / OI"],
    group: "CRYPTO_FUTURES",
    screenerGroup: "CRYPTO_FUTURES",
    apiStatus: "USDT/USDC/COIN futures читаются bulk-запросами public UTA v3.",
  },
  US_STOCK: {
    eyebrow: "БАЗОВЫЙ ФОНДОВЫЙ UNDERLYING",
    title: "Акция / ETF США",
    thesis: "Один и тот же underlying на Bitget может появляться в разных торговых оболочках. Их нельзя считать одним инструментом только потому, что на экране написан тот же тикер.",
    ownership: "Базовый фондовый актив",
    mechanics: "Underlying формирует экономический смысл семейства: Stock+, rToken, perpetual и option chain.",
    driver: "Основная фондовая сессия, корпоративные события, сектор, индекс и поток в базовом активе.",
    risk: "Перенести механику одной оболочки на другую и потерять различия во времени, ликвидности и риске.",
    check: "Сначала определить underlying → затем конкретную торговую оболочку → только потом читать её стакан и риск.",
    family: ["US Stock / ETF", "→", "Stock+ · rToken · Perp · Options"],
    apiStatus: "Это смысловой центр семейства; отдельные продукты Bitget используют разные API-контуры.",
  },
  RTOKEN_SPOT: {
    eyebrow: "ТОКЕНИЗИРОВАННАЯ ФОНДОВАЯ ЭКСПОЗИЦИЯ",
    title: "Акции · rToken",
    thesis: "rToken связан с ценой фондового underlying, но живёт внутри крипто-инфраструктуры. В интерфейсе R отделяем от привычного тикера: R · SPY.",
    ownership: "Токенизированный продукт",
    mechanics: "Spot-подобная торговля токеном, связанным с фондовым underlying. Это не то же самое, что Stock+ акция.",
    driver: "Базовая акция/ETF + режим токенизированного рынка + ликвидность конкретного rToken.",
    risk: "Риск underlying плюс особенности токенизированной оболочки и её торгового времени.",
    check: "Underlying → время базового рынка → оборот rToken → спред → расхождение с фондовой ценой.",
    family: ["US Stock / ETF", "→", "R", "·", "rToken"],
    group: "RTOKEN_SPOT",
    screenerGroup: "RTOKEN_SPOT",
    apiStatus: "Reality/rToken размечаются через public UTA instruments.",
  },
  STOCK_PLUS: {
    eyebrow: "БРОКЕРСКИЙ КОНТУР",
    title: "Stock+ · Акции и ETF",
    thesis: "Это отдельный фондовый продукт Bitget. Его нельзя смешивать в одну таблицу с rToken только из-за одинакового underlying.",
    ownership: "Фондовая позиция через Stock+ контур",
    mechanics: "Отдельная инфраструктура securities/Stock+ с собственным market-data и account API.",
    driver: "Базовый американский рынок и события самого эмитента/ETF.",
    risk: "Рыночный риск underlying, торговые часы, региональные ограничения и доступ к market data.",
    check: "Статус сессии → котировка underlying → ликвидность → доступность продукта для аккаунта.",
    family: ["US Stock / ETF", "→", "Stock+"],
    apiStatus: "Отдельный signed Stock+ adapter — следующий слой проекта.",
  },
  STOCK_PERPS: {
    eyebrow: "ФОНДОВЫЙ PERPETUAL",
    title: "Акции · Перпетуалы",
    thesis: "Тот же фондовый тикер, но уже производный контракт: акция не принадлежит трейдеру, зато появляются плечо и funding-механика.",
    ownership: "Бессрочный производный контракт",
    mechanics: "Long/short + маржа + плечо + funding. Контракт следует за фондовым underlying.",
    driver: "Underlying + деривативное позиционирование + состояние крипто-площадки вне основной фондовой сессии.",
    risk: "Ликвидация, funding и отклонение perpetual от базового рынка.",
    check: "Underlying → режим сессии → basis → funding → OI → локальный спред.",
    family: ["US Stock / ETF", "→", "Perpetual", "→", "Funding / OI"],
    group: "STOCK_PERPS",
    screenerGroup: "STOCK_PERPS",
    apiStatus: "Stock-type futures уже выделяются из public UTA universe.",
  },
  OPTIONS: {
    eyebrow: "НЕЛИНЕЙНЫЙ ДЕРИВАТИВ",
    title: "Опционы США",
    thesis: "Один underlying превращается в целое дерево контрактов: экспирация → страйк → call/put. Здесь уже недостаточно смотреть только направление цены.",
    ownership: "Опционный контракт",
    mechanics: "Underlying → expiry → strike → call/put. Цена зависит не только от движения underlying, но и от времени и волатильности.",
    driver: "Underlying, implied volatility, срок до экспирации и структура конкретной серии.",
    risk: "Theta, изменение волатильности, Greeks и ликвидность отдельного страйка.",
    check: "Событие → expiry → IV → strike → bid/ask → open interest/ликвидность серии.",
    family: ["US Stock / ETF", "→", "Expiry", "→", "Strike", "→", "Call / Put"],
    apiStatus: "Option chain живёт в отдельном signed Stock+ API и будет отдельным адаптером.",
  },
  GLOBAL_MARKET: {
    eyebrow: "БАЗОВЫЙ TRADFI-КОНТЕКСТ",
    title: "Глобальный рынок",
    thesis: "Золото, нефть, FX и индексы имеют собственный основной рынок. Производный инструмент на Bitget нужно читать вместе с его внешним поводырём.",
    ownership: "Внешний базовый рынок",
    mechanics: "Цена формируется не только внутри локального стакана Bitget; важна связь с основным рынком underlying.",
    driver: "Макро, процентные ставки, товарные потоки, индексы и глобальные торговые сессии.",
    risk: "Локальная ликвидность может обещать одно, а основной рынок уже двигаться в другую сторону.",
    check: "Сначала внешний рынок → затем локальный контракт → потом спред/funding/реакция.",
    family: ["Global underlying", "→", "Bitget derivative / CFD"],
    apiStatus: "Смысловой центр для commodity-perps и TradFi/CFD.",
  },
  COMMODITY_PERPS: {
    eyebrow: "ТОВАРНЫЙ ДЕРИВАТИВ",
    title: "Товары · Перпетуалы",
    thesis: "Металл или commodity торгуется как бессрочный дериватив. Локальный контракт нельзя читать в отрыве от основного рынка золота, нефти или другого underlying.",
    ownership: "Производный контракт",
    mechanics: "Perpetual + плечо + funding/OI там, где поля доступны.",
    driver: "Глобальный commodity-underlying + макро + локальное позиционирование на Bitget.",
    risk: "Ликвидация, разрыв торговых режимов и расхождение с внешним рынком.",
    check: "Underlying → сессия → локальный оборот → спред → funding/OI.",
    family: ["Gold / Oil / Commodity", "→", "Perpetual"],
    group: "COMMODITY_PERPS",
    screenerGroup: "COMMODITY_PERPS",
    apiStatus: "Metal/commodity futures уже классифицируются в public UTA universe.",
  },
  TRADFI: {
    eyebrow: "ОТДЕЛЬНЫЙ TRADFI-КОНТУР",
    title: "Forex / Индексы / CFD",
    thesis: "Это не ещё одна строка crypto-futures. Здесь свои символы, торговые часы, источники цены и спецификации инструмента.",
    ownership: "CFD / TradFi-позиция",
    mechanics: "Отдельный торговый контур с собственной спецификацией и расписанием.",
    driver: "FX, индексы, металлы и другие глобальные рынки в их основных сессиях.",
    risk: "Плечо, торговые часы, overnight/сессионные разрывы и спецификация конкретного CFD.",
    check: "Что является underlying → какая сейчас сессия → спецификация → спред → риск позиции.",
    family: ["FX / Index / Metal", "→", "TradFi CFD"],
    apiStatus: "Будет отдельным TradFi adapter; не маскируем отсутствие данных под public UTA.",
  },
};

const nodeTone: Record<NodeId, string> = {
  CRYPTO_SPOT: "cyan",
  MARGIN: "amber",
  CRYPTO_FUTURES: "violet",
  US_STOCK: "slate",
  RTOKEN_SPOT: "cyan",
  STOCK_PLUS: "emerald",
  STOCK_PERPS: "violet",
  OPTIONS: "amber",
  GLOBAL_MARKET: "slate",
  COMMODITY_PERPS: "cyan",
  TRADFI: "emerald",
};

function toneClasses(id: NodeId, active: boolean) {
  const tone = nodeTone[id];
  if (tone === "amber") return active ? "border-amber-300/60 bg-amber-300/12 text-amber-100 shadow-[0_0_45px_rgba(251,191,36,0.12)]" : "border-amber-300/20 bg-amber-300/[0.035] text-amber-100/75 hover:border-amber-300/40";
  if (tone === "violet") return active ? "border-violet-300/60 bg-violet-300/12 text-violet-100 shadow-[0_0_45px_rgba(167,139,250,0.12)]" : "border-violet-300/20 bg-violet-300/[0.035] text-violet-100/75 hover:border-violet-300/40";
  if (tone === "emerald") return active ? "border-emerald-300/60 bg-emerald-300/12 text-emerald-100 shadow-[0_0_45px_rgba(52,211,153,0.12)]" : "border-emerald-300/20 bg-emerald-300/[0.035] text-emerald-100/75 hover:border-emerald-300/40";
  if (tone === "slate") return active ? "border-slate-200/45 bg-white/[0.09] text-slate-100 shadow-[0_0_45px_rgba(148,163,184,0.08)]" : "border-white/12 bg-white/[0.025] text-slate-300 hover:border-white/25";
  return active ? "border-cyan-300/60 bg-cyan-300/12 text-cyan-100 shadow-[0_0_45px_rgba(34,211,238,0.12)]" : "border-cyan-300/20 bg-cyan-300/[0.035] text-cyan-100/75 hover:border-cyan-300/40";
}

function MapNode({ id, label, icon, selected, onSelect, liveCount }: { id: NodeId; label: string; icon: React.ReactNode; selected: NodeId; onSelect: (id: NodeId) => void; liveCount?: number }) {
  const active = selected === id;
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`group relative flex min-h-20 w-full items-center gap-3 rounded-[999px] border px-4 py-3 text-left transition duration-300 hover:-translate-y-0.5 ${toneClasses(id, active)}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition ${active ? "border-current/35 bg-black/20" : "border-current/20 bg-black/10"}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold leading-tight">{label}</span>
        <span className="mt-1 block font-mono text-[9px] text-slate-500">{liveCount != null ? `${liveCount} инструментов` : DETAILS[id].apiStatus}</span>
      </span>
      <span className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-current shadow-[0_0_14px_currentColor]" : "bg-current/35"}`} />
    </button>
  );
}

function countByGroup(data: BitgetScreenerResponse | null, group: BitgetMarketGroup) {
  return (data?.rows ?? []).filter((row) => row.status.toLowerCase() === "online" && row.marketGroup === group).length;
}

function topRows(data: BitgetScreenerResponse | null, group?: BitgetMarketGroup): BitgetScreenerRow[] {
  if (!group) return [];
  return (data?.rows ?? [])
    .filter((row) => row.status.toLowerCase() === "online" && row.marketGroup === group && row.turnover24h != null)
    .slice()
    .sort((a, b) => (b.turnover24h ?? 0) - (a.turnover24h ?? 0))
    .slice(0, 4);
}

function displayTicker(row: BitgetScreenerRow) {
  const base = (row.baseCoin || row.symbol).toUpperCase();
  return row.isReality && base.startsWith("R") && base.length > 1 ? base.slice(1) : base;
}

function compact(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)} млрд`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)} млн`;
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(0)} тыс.`;
  return `$${value.toFixed(0)}`;
}

function RouteWord({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return <span className={strong ? "text-slate-100" : "text-slate-500"}>{children}</span>;
}

export function BitgetMarketMap() {
  const [selected, setSelected] = React.useState<NodeId>("CRYPTO_SPOT");
  const [data, setData] = React.useState<BitgetScreenerResponse | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void fetch("/api/bitget/screener", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: BitgetScreenerResponse | null) => { if (!cancelled && payload) setData(payload); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const detail = DETAILS[selected];
  const leaders = React.useMemo(() => topRows(data, detail.group), [data, detail.group]);

  const select = (id: NodeId) => setSelected(id);

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-7 pb-16">
      <header className="relative overflow-hidden border-b border-white/[0.06] pb-6 pt-1">
        <div className="pointer-events-none absolute -left-16 top-0 h-40 w-80 rounded-full bg-cyan-400/[0.035] blur-3xl" />
        <Link href="/screener/bitget" className="relative text-[10px] text-cyan-300/70 transition hover:text-cyan-200">← Вернуться в скринер</Link>
        <div className="relative mt-4 max-w-5xl">
          <p className="text-[9px] uppercase tracking-[0.28em] text-cyan-300/50">BITGET · КАРТА МЕХАНИКИ</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100 md:text-3xl">Один тикер может означать совершенно разные сделки</h1>
          <p className="mt-2 max-w-4xl text-[12px] leading-6 text-slate-500">Карта построена не как меню биржи. Сначала определяем, <span className="text-slate-300">что именно принадлежит трейдеру</span>, затем — где формируется цена, где появляется заём, где начинается дериватив и какие данные нужно проверить перед входом.</p>
        </div>
      </header>

      <section className="relative min-h-[760px] overflow-hidden rounded-[36px] border border-white/[0.055] bg-[radial-gradient(circle_at_50%_8%,rgba(34,211,238,0.075),transparent_26%),linear-gradient(180deg,rgba(3,8,22,0.78),rgba(2,6,17,0.42))] px-4 py-7 md:px-7 lg:px-10">
        <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:44px_44px]" />
        <svg className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block" viewBox="0 0 1400 760" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="cyanPath" x1="0" x2="1"><stop offset="0" stopColor="rgba(34,211,238,.08)"/><stop offset="1" stopColor="rgba(34,211,238,.42)"/></linearGradient>
            <linearGradient id="violetPath" x1="0" x2="1"><stop offset="0" stopColor="rgba(167,139,250,.08)"/><stop offset="1" stopColor="rgba(167,139,250,.34)"/></linearGradient>
          </defs>
          <path d="M700 112 C520 150 355 175 220 250" fill="none" stroke="url(#cyanPath)" strokeWidth="1.5" />
          <path d="M700 112 C700 175 700 205 700 250" fill="none" stroke="url(#violetPath)" strokeWidth="1.5" />
          <path d="M700 112 C900 150 1050 180 1180 250" fill="none" stroke="url(#cyanPath)" strokeWidth="1.5" />
          <path d="M220 305 C165 365 135 430 130 510" fill="none" stroke="rgba(251,191,36,.22)" strokeWidth="1.2" />
          <path d="M220 305 C235 385 260 435 295 510" fill="none" stroke="rgba(167,139,250,.24)" strokeWidth="1.2" />
          <path d="M700 305 C605 365 560 420 520 505" fill="none" stroke="rgba(34,211,238,.22)" strokeWidth="1.2" />
          <path d="M700 305 C670 380 655 430 650 505" fill="none" stroke="rgba(52,211,153,.22)" strokeWidth="1.2" />
          <path d="M700 305 C760 375 805 430 825 505" fill="none" stroke="rgba(167,139,250,.24)" strokeWidth="1.2" />
          <path d="M700 305 C845 355 900 420 965 505" fill="none" stroke="rgba(251,191,36,.22)" strokeWidth="1.2" />
          <path d="M1180 305 C1130 390 1110 445 1105 520" fill="none" stroke="rgba(34,211,238,.22)" strokeWidth="1.2" />
          <path d="M1180 305 C1235 390 1260 445 1270 520" fill="none" stroke="rgba(52,211,153,.22)" strokeWidth="1.2" />
        </svg>

        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center">
          <button type="button" onClick={() => select("US_STOCK")} className="group relative flex h-28 w-28 flex-col items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-300/[0.055] text-center shadow-[0_0_80px_rgba(34,211,238,0.07)] transition hover:scale-[1.03] hover:border-cyan-300/45">
            <Orbit className="h-5 w-5 text-cyan-300" />
            <span className="mt-2 font-mono text-[12px] font-semibold tracking-[0.12em] text-slate-100">BITGET</span>
            <span className="mt-0.5 text-[8px] uppercase tracking-[0.18em] text-slate-600">universe</span>
            <span className="absolute -bottom-1 h-2 w-2 rounded-full bg-cyan-300/70 shadow-[0_0_14px_rgba(34,211,238,.7)]" />
          </button>

          <div className="mt-10 grid w-full gap-10 lg:grid-cols-[1fr_1.35fr_1fr] lg:gap-14">
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.22em] text-cyan-300/45"><Bitcoin className="h-3.5 w-3.5" /> Крипто</div>
              <MapNode id="CRYPTO_SPOT" label="Крипто · Спот" icon={<Coins className="h-4 w-4" />} selected={selected} onSelect={select} liveCount={countByGroup(data, "CRYPTO_SPOT")} />
              <div className="grid gap-3 pl-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <MapNode id="MARGIN" label="Маржинальный спот" icon={<Scale className="h-4 w-4" />} selected={selected} onSelect={select} liveCount={countByGroup(data, "MARGIN")} />
                <MapNode id="CRYPTO_FUTURES" label="Крипто · Фьючерсы" icon={<ChartCandlestick className="h-4 w-4" />} selected={selected} onSelect={select} liveCount={countByGroup(data, "CRYPTO_FUTURES")} />
              </div>
              <p className="pl-5 text-[9px] leading-5 text-slate-700">Спот — базовый рынок. Margin добавляет долг. Futures меняет сам предмет сделки на производный контракт.</p>
            </div>

            <div className="space-y-5 lg:-mt-1">
              <div className="flex items-center justify-center gap-2 text-[9px] uppercase tracking-[0.22em] text-violet-300/45"><Landmark className="h-3.5 w-3.5" /> Акции и RWA</div>
              <div className="mx-auto max-w-sm"><MapNode id="US_STOCK" label="Базовая акция / ETF США" icon={<TrendingUp className="h-4 w-4" />} selected={selected} onSelect={select} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <MapNode id="RTOKEN_SPOT" label="R · rToken" icon={<Gem className="h-4 w-4" />} selected={selected} onSelect={select} liveCount={countByGroup(data, "RTOKEN_SPOT")} />
                <MapNode id="STOCK_PLUS" label="Stock+ · Акция / ETF" icon={<BadgeDollarSign className="h-4 w-4" />} selected={selected} onSelect={select} />
                <MapNode id="STOCK_PERPS" label="Stock · Perpetual" icon={<Layers3 className="h-4 w-4" />} selected={selected} onSelect={select} liveCount={countByGroup(data, "STOCK_PERPS")} />
                <MapNode id="OPTIONS" label="Options · Call / Put" icon={<Sparkles className="h-4 w-4" />} selected={selected} onSelect={select} />
              </div>
              <p className="text-center text-[9px] leading-5 text-slate-700">Один underlying — четыре разные торговые оболочки. Совпадение тикера не означает совпадение механики.</p>
            </div>

            <div className="space-y-5">
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.22em] text-emerald-300/40"><CircleDollarSign className="h-3.5 w-3.5" /> TradFi / Macro</div>
              <MapNode id="GLOBAL_MARKET" label="Внешний базовый рынок" icon={<Boxes className="h-4 w-4" />} selected={selected} onSelect={select} />
              <div className="grid gap-3 pl-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <MapNode id="COMMODITY_PERPS" label="Товары · Perpetual" icon={<Gem className="h-4 w-4" />} selected={selected} onSelect={select} liveCount={countByGroup(data, "COMMODITY_PERPS")} />
                <MapNode id="TRADFI" label="Forex / Индексы / CFD" icon={<CircleDollarSign className="h-4 w-4" />} selected={selected} onSelect={select} />
              </div>
              <p className="pl-5 text-[9px] leading-5 text-slate-700">Локальный инструмент может быть второй ногой. Перед входом нужно понимать, где сейчас находится основной источник движения.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden py-2">
        <div className="pointer-events-none absolute left-1/2 top-0 h-52 w-[70%] -translate-x-1/2 rounded-full bg-cyan-300/[0.025] blur-3xl" />
        <div className="relative grid gap-7 xl:grid-cols-[0.9fr_2.1fr] xl:gap-12">
          <div>
            <p className="text-[9px] uppercase tracking-[0.24em] text-cyan-300/45">{detail.eyebrow}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">{detail.title}</h2>
            <p className="mt-3 text-[13px] leading-6 text-slate-400">{detail.thesis}</p>

            <div className="mt-5 flex flex-wrap items-center gap-2 font-mono text-[10px]">
              {detail.family.map((item, index) => <React.Fragment key={`${item}-${index}`}><RouteWord strong={index === 0 || index === detail.family.length - 1}>{item}</RouteWord></React.Fragment>)}
            </div>

            <div className="mt-6 border-l border-cyan-300/20 pl-4">
              <p className="text-[8px] uppercase tracking-[0.2em] text-slate-700">Статус данных</p>
              <p className="mt-1.5 text-[10px] leading-5 text-slate-500">{detail.apiStatus}</p>
            </div>

            {detail.screenerGroup ? (
              <Link href={`/screener/bitget?group=${detail.screenerGroup}`} className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.045] px-4 py-2 text-[10px] font-medium text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.08]">
                Показать эти инструменты в скринере <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>

          <div>
            <div className="relative hidden h-8 md:block"><div className="absolute left-3 right-3 top-1/2 h-px bg-gradient-to-r from-cyan-300/15 via-white/12 to-rose-300/10" /></div>
            <div className="grid gap-5 md:grid-cols-5">
              {[
                ["01", "Что у вас", detail.ownership, <Landmark key="a" className="h-4 w-4" />],
                ["02", "Механика", detail.mechanics, <Orbit key="b" className="h-4 w-4" />],
                ["03", "Откуда движение", detail.driver, <TrendingUp key="c" className="h-4 w-4" />],
                ["04", "Главный риск", detail.risk, <ShieldAlert key="d" className="h-4 w-4" />],
                ["05", "Перед входом", detail.check, <CircleDollarSign key="e" className="h-4 w-4" />],
              ].map(([num, label, text, icon]) => (
                <div key={String(num)} className="relative border-t border-white/[0.07] pt-4 md:border-t-0 md:pt-0">
                  <div className="mb-4 flex items-center justify-between"><span className="font-mono text-[9px] text-cyan-300/55">{num}</span><span className="text-slate-700">{icon}</span></div>
                  <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">{label}</p>
                  <p className="mt-2 text-[11px] leading-5 text-slate-300">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {detail.group ? (
        <section className="border-t border-white/[0.06] pt-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-700">Живые представители секции</p>
              <p className="mt-1 text-[11px] text-slate-500">Не рекомендации. Просто самые крупные по текущему 24ч обороту среди доступных public-инструментов.</p>
            </div>
            <span className="font-mono text-[9px] text-slate-700">{countByGroup(data, detail.group)} online</span>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-4">
            {leaders.length ? leaders.map((row, index) => (
              <div key={row.id} className="group min-w-40 border-l border-white/[0.07] pl-3 transition hover:border-cyan-300/30">
                <p className="font-mono text-[9px] text-slate-700">0{index + 1}</p>
                <p className="mt-1 font-mono text-[13px] font-semibold text-slate-200">{row.isReality ? <span className="mr-1 text-violet-300">R ·</span> : null}{displayTicker(row)}</p>
                <p className="mt-1 text-[9px] text-slate-600">оборот {compact(row.turnover24h)}</p>
              </div>
            )) : <p className="text-[10px] text-slate-700">Живые данные этой секции пока не получены.</p>}
          </div>
        </section>
      ) : null}

      <footer className="border-t border-white/[0.05] pt-5 text-[9px] leading-5 text-slate-700">
        Карта объясняет устройство рынка, а не выдаёт торговый сигнал. Динамические поля берутся из текущего Bitget public API; Stock+, options и TradFi подключаются отдельными адаптерами, поэтому отсутствие live-count не подменяется нулём.
      </footer>
    </div>
  );
}
