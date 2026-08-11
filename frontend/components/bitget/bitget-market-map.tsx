"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bitcoin,
  ChartCandlestick,
  CircleDollarSign,
  Coins,
  Gem,
  Landmark,
  Layers3,
  Orbit,
  Scale,
  ShieldAlert,
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
  section: string;
  title: string;
  plain: string;
  definition: string;
  mechanics: string;
  driver: string;
  risk: string;
  check: string;
  family: string;
  group?: BitgetMarketGroup;
  screenerGroup?: BitgetMarketGroup;
  apiStatus: string;
};

const DETAILS: Record<NodeId, Detail> = {
  CRYPTO_SPOT: {
    section: "КРИПТО · СПОТ",
    title: "Крипто-спот",
    plain: "Базовый рынок криптоактива.",
    definition: "Покупка и продажа самого токена. Позиция не требует обязательного займа и не использует perpetual funding.",
    mechanics: "Токен покупается или продаётся за доступный баланс. Цена формируется в спотовом стакане конкретной пары.",
    driver: "Спрос и предложение в токене, общий режим крипторынка, новости, ликвидность и сектор.",
    risk: "Движение цены самого актива и ликвидность конкретной пары.",
    check: "Оборот → спред → локальный ход → BTC/ETH → сектор.",
    family: "Криптоактив → Спот",
    group: "CRYPTO_SPOT",
    screenerGroup: "CRYPTO_SPOT",
    apiStatus: "Живые инструменты подключены к скринеру.",
  },
  MARGIN: {
    section: "КРИПТО · МАРЖИНАЛЬНЫЙ СПОТ",
    title: "Маржинальный спот",
    plain: "Спотовая позиция с заёмными средствами.",
    definition: "Предмет сделки остаётся криптоактивом, но к собственным средствам добавляется заём и стоимость его использования.",
    mechanics: "Спот + заём. Возможны увеличенная длинная позиция и заёмная короткая позиция; возникает риск ликвидации.",
    driver: "Базовый спотовый рынок. Результат позиции дополнительно зависит от размера займа и плеча.",
    risk: "Ликвидация, проценты за заём и ускоренный убыток при использовании плеча.",
    check: "Спот → доступный заём → плечо → цена ликвидации.",
    family: "Криптоактив → Спот + заём → Margin",
    group: "MARGIN",
    screenerGroup: "MARGIN",
    apiStatus: "Маржинальные пары подключены к скринеру.",
  },
  CRYPTO_FUTURES: {
    section: "КРИПТО · ФЬЮЧЕРСЫ",
    title: "Крипто-фьючерсы",
    plain: "Производный контракт на криптоактив.",
    definition: "Торгуется контракт на изменение цены, а не сам токен. Доступны long/short, маржа и open interest.",
    mechanics: "Perpetual использует funding и не имеет обычной даты экспирации. Delivery-контракт имеет дату расчёта.",
    driver: "Спотовый рынок + позиционирование во фьючерсах + OI + ликвидации + basis.",
    risk: "Ликвидация, funding у perpetual и отклонение контракта от базового рынка.",
    check: "Спот → basis → OI → funding → спред → ликвидации.",
    family: "Криптоактив → Futures → OI / Funding / Expiry",
    group: "CRYPTO_FUTURES",
    screenerGroup: "CRYPTO_FUTURES",
    apiStatus: "USDT/USDC/COIN futures подключены к скринеру.",
  },
  US_STOCK: {
    section: "АКЦИИ И ETF · БАЗОВЫЙ АКТИВ",
    title: "Акция или ETF США",
    plain: "Базовый фондовый underlying.",
    definition: "Акция представляет долю в компании. ETF — биржевой фонд: он может отслеживать индекс, сектор, товар или корзину активов, но сам торгуется как фондовая ценная бумага.",
    mechanics: "На Bitget один фондовый underlying может быть доступен через Stock+, rToken, perpetual и опционы. Эти продукты имеют разную механику и права.",
    driver: "Американский фондовый рынок, эмитент или структура ETF, отчёты, новости, сектор и базовый индекс/актив фонда.",
    risk: "Смешение разных торговых оболочек одного underlying и их правил риска.",
    check: "Underlying → продукт → торговые часы → ликвидность → спецификация продукта.",
    family: "Акция / ETF → Stock+ · rToken · Perpetual · Options",
    apiStatus: "Базовый объект фондовой ветви; продукты используют разные API-контуры.",
  },
  RTOKEN_SPOT: {
    section: "АКЦИИ И ETF · RTOKEN",
    title: "rToken",
    plain: "Токенизированная экспозиция на акцию или ETF.",
    definition: "rToken связан с фондовым underlying и выпускается Reality. Это отдельный токенизированный продукт, а не позиция Stock+.",
    mechanics: "Торговля проходит в крипто-инфраструктуре Bitget. В интерфейсе префикс R отделяется от привычного тикера: R · SPY.",
    driver: "Базовая акция/ETF + состояние rToken-рынка + его собственная ликвидность.",
    risk: "Риск underlying, ликвидность токена и особенности режима токенизированного продукта.",
    check: "Underlying → сессия США → оборот rToken → спред → отклонение цены.",
    family: "Акция / ETF → R · rToken",
    group: "RTOKEN_SPOT",
    screenerGroup: "RTOKEN_SPOT",
    apiStatus: "rToken подключены к public-скринеру.",
  },
  STOCK_PLUS: {
    section: "АКЦИИ И ETF · STOCK+",
    title: "Stock+",
    plain: "Акции и ETF в отдельном брокерском контуре Bitget.",
    definition: "Stock+ даёт доступ к американским акциям и ETF через лицензированных securities-партнёров Bitget.",
    mechanics: "Используются обычные фондовые тикеры и отдельные market-data/account API. Поддерживаются дробные доли для доступных бумаг.",
    driver: "Основной рынок США, эмитент, структура ETF, отчёты, сектор и индекс.",
    risk: "Рыночный риск underlying, торговые часы, региональная доступность и правила Stock+.",
    check: "Сессия → котировка → ликвидность → корпоративные события → доступность аккаунту.",
    family: "Акция / ETF → Stock+",
    apiStatus: "10 000+ акций и ETF на Bitget; data-adapter скринера следующий.",
  },
  STOCK_PERPS: {
    section: "АКЦИИ И ETF · PERPETUAL",
    title: "Фьючерсы на акции",
    plain: "Бессрочный дериватив на акцию или ETF.",
    definition: "Контракт следует за фондовым underlying, но владения акцией не создаёт. Доступны long/short и плечо.",
    mechanics: "Perpetual + маржа + плечо + funding. У контракта нет обычной даты экспирации.",
    driver: "Underlying + index/mark price + позиционирование в деривативе + OI.",
    risk: "Ликвидация, funding и отклонение perpetual от основного фондового рынка.",
    check: "Underlying → сессия → basis → funding → OI → спред.",
    family: "Акция / ETF → Perpetual → Funding / OI",
    group: "STOCK_PERPS",
    screenerGroup: "STOCK_PERPS",
    apiStatus: "Stock perpetuals подключены к скринеру.",
  },
  OPTIONS: {
    section: "АКЦИИ И ETF · ОПЦИОНЫ",
    title: "Опционы США",
    plain: "Опционный контракт на акцию или ETF.",
    definition: "Один underlying образует множество контрактов. Каждый определяется экспирацией, страйком и типом call/put.",
    mechanics: "Цена зависит от underlying, времени до экспирации и implied volatility. Для анализа важны Greeks и ликвидность серии.",
    driver: "Underlying + implied volatility + срок до экспирации + структура выбранной серии.",
    risk: "Theta, изменение волатильности и низкая ликвидность отдельного страйка.",
    check: "Событие → expiry → IV → strike → bid/ask → OI/ликвидность серии.",
    family: "Акция / ETF → Expiry → Strike → Call / Put",
    apiStatus: "2 800+ U.S. stock options на Bitget; option-chain adapter следующий.",
  },
  GLOBAL_MARKET: {
    section: "ГЛОБАЛЬНЫЕ РЫНКИ · БАЗОВЫЕ РЫНКИ",
    title: "Товары, Forex и индексы",
    plain: "Базовые рынки товаров, валют и индексов.",
    definition: "Золото, нефть и валюты имеют собственные внешние рынки. Индекс — расчётный показатель рынка; ETF на индекс является отдельной фондовой ценной бумагой.",
    mechanics: "Инструменты Bitget могут отслеживать внешний товарный, валютный или индексный underlying через perpetual или CFD-контур.",
    driver: "Макроэкономика, ставки, товарные потоки, мировые сессии и основной рынок underlying.",
    risk: "Локальная котировка Bitget может расходиться по ликвидности и режиму торгов с основным внешним рынком.",
    check: "Внешний рынок → сессия → локальный инструмент → спред/funding → реакция.",
    family: "Товар / FX / Индекс → Bitget derivative / CFD",
    apiStatus: "Базовый объект для commodity perpetuals и TradFi-контура.",
  },
  COMMODITY_PERPS: {
    section: "ГЛОБАЛЬНЫЕ РЫНКИ · ТОВАРЫ",
    title: "Товарные perpetuals",
    plain: "Бессрочный дериватив на товарный underlying.",
    definition: "Золото, серебро, нефть, газ и другие товары представлены как производные контракты без физической поставки.",
    mechanics: "USDT-M perpetual + маржа + плечо + funding. Обычной даты экспирации нет.",
    driver: "Глобальный commodity market + макро + локальное позиционирование на Bitget.",
    risk: "Ликвидация, funding и расхождение локального контракта с внешней ценой.",
    check: "Underlying → мировая сессия → оборот → спред → funding/OI.",
    family: "Gold / Oil / Gas → Perpetual",
    group: "COMMODITY_PERPS",
    screenerGroup: "COMMODITY_PERPS",
    apiStatus: "Товарные perpetuals подключены к public-скринеру.",
  },
  TRADFI: {
    section: "ГЛОБАЛЬНЫЕ РЫНКИ · TRADFI",
    title: "Forex / индексы / CFD",
    plain: "Forex, индексы и CFD в отдельном TradFi-контуре.",
    definition: "Эти инструменты имеют собственные символы, спецификации и торговые часы и не относятся к текущему crypto UTA universe.",
    mechanics: "Отдельные правила маржи, торгового времени и котирования в зависимости от конкретного FX, index или CFD-продукта.",
    driver: "Основной FX/index market + макроэкономика + мировые торговые сессии.",
    risk: "Плечо, смена торговых режимов и неверное чтение локальной котировки без внешнего контекста.",
    check: "Underlying → trading hours → спецификация → ликвидность → локальный спред.",
    family: "FX / Index → TradFi / CFD",
    apiStatus: "Раздел есть у Bitget; отдельный TradFi data-adapter следующий.",
  },
};

function glyph(id: NodeId) {
  const cls = "h-4 w-4";
  switch (id) {
    case "CRYPTO_SPOT": return <Bitcoin className={cls} />;
    case "MARGIN": return <Scale className={cls} />;
    case "CRYPTO_FUTURES": return <ChartCandlestick className={cls} />;
    case "US_STOCK": return <TrendingUp className={cls} />;
    case "RTOKEN_SPOT": return <Gem className={cls} />;
    case "STOCK_PLUS": return <Landmark className={cls} />;
    case "STOCK_PERPS": return <CircleDollarSign className={cls} />;
    case "OPTIONS": return <Layers3 className={cls} />;
    case "GLOBAL_MARKET": return <Orbit className={cls} />;
    case "COMMODITY_PERPS": return <Coins className={cls} />;
    case "TRADFI": return <CircleDollarSign className={cls} />;
  }
}

function symbolFor(id: NodeId) {
  switch (id) {
    case "CRYPTO_SPOT": return "₿";
    case "MARGIN": return "M";
    case "CRYPTO_FUTURES": return "∞";
    case "US_STOCK": return "US";
    case "RTOKEN_SPOT": return "R";
    case "STOCK_PLUS": return "+";
    case "STOCK_PERPS": return "∞";
    case "OPTIONS": return "C/P";
    case "GLOBAL_MARKET": return "GL";
    case "COMMODITY_PERPS": return "Au";
    case "TRADFI": return "FX";
  }
}

function shortFor(id: NodeId) {
  switch (id) {
    case "CRYPTO_SPOT": return "сам токен";
    case "MARGIN": return "спот + заём";
    case "CRYPTO_FUTURES": return "long/short · OI · funding";
    case "US_STOCK": return "базовая акция или ETF";
    case "RTOKEN_SPOT": return "токенизированная экспозиция";
    case "STOCK_PLUS": return "акции и ETF · broker-style";
    case "STOCK_PERPS": return "бессрочный дериватив";
    case "OPTIONS": return "expiry · strike · call/put";
    case "GLOBAL_MARKET": return "товары · валюты · индексы";
    case "COMMODITY_PERPS": return "золото · нефть · газ";
    case "TRADFI": return "Forex · индексы · CFD";
  }
}

function routeIncludes(root: NodeId, focus: NodeId) {
  if (root === focus) return true;
  if (root === "CRYPTO_SPOT" && (focus === "MARGIN" || focus === "CRYPTO_FUTURES")) return true;
  if (root === "US_STOCK" && ["RTOKEN_SPOT", "STOCK_PLUS", "STOCK_PERPS", "OPTIONS"].includes(focus)) return true;
  if (root === "GLOBAL_MARKET" && (focus === "COMMODITY_PERPS" || focus === "TRADFI")) return true;
  return false;
}

function compact(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)} трлн`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)} млрд`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)} млн`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)} тыс.`;
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function price(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const digits = value >= 1000 ? 2 : value >= 1 ? 4 : 7;
  return value.toLocaleString("ru-RU", { maximumFractionDigits: digits });
}

function pct(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function tone(value: number | null) {
  if (value == null || value === 0) return "text-slate-500";
  return value > 0 ? "text-emerald-300" : "text-rose-300";
}

function statusFor(id: NodeId, counts: Partial<Record<BitgetMarketGroup, number>>) {
  const group = DETAILS[id].group;
  if (group) return { text: `${counts[group] ?? 0} в скринере`, mode: "live" as const };
  if (id === "STOCK_PLUS") return { text: "10 000+ · адаптер следующий", mode: "pending" as const };
  if (id === "OPTIONS") return { text: "2 800+ · адаптер следующий", mode: "pending" as const };
  if (id === "TRADFI") return { text: "отдельный data-контур", mode: "pending" as const };
  return { text: "базовый underlying", mode: "context" as const };
}

function RootNode({ id, selected, hovered, counts, onSelect, onHover }: {
  id: NodeId;
  selected: NodeId;
  hovered: NodeId | null;
  counts: Partial<Record<BitgetMarketGroup, number>>;
  onSelect: (id: NodeId) => void;
  onHover: (id: NodeId | null) => void;
}) {
  const focus = hovered ?? selected;
  const active = routeIncludes(id, focus);
  const own = selected === id;
  const status = statusFor(id, counts);
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      className={`w-full text-left transition ${own ? "bg-cyan-400/[0.075] shadow-[0_0_42px_rgba(34,211,238,0.08)]" : active ? "bg-white/[0.025]" : "hover:bg-white/[0.02]"}`}
    >
      <div className={`border-l-2 px-4 py-4 ${own ? "border-cyan-300" : active ? "border-cyan-300/35" : "border-white/[0.08]"}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] ${own ? "border-cyan-300/40 bg-cyan-400/[0.09] text-cyan-100" : "border-white/[0.09] bg-white/[0.02] text-slate-400"}`}>{symbolFor(id)}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={active ? "text-cyan-300" : "text-slate-500"}>{glyph(id)}</span>
              <h3 className="text-[15px] font-semibold text-slate-100">{DETAILS[id].title}</h3>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">{shortFor(id)}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 pl-[60px] text-[9px]">
          <span className={`h-1.5 w-1.5 rounded-full ${status.mode === "live" ? "bg-emerald-400" : status.mode === "pending" ? "bg-amber-400" : "bg-slate-500"}`} />
          <span className={status.mode === "live" ? "text-emerald-300/80" : status.mode === "pending" ? "text-amber-300/80" : "text-slate-500"}>{status.text}</span>
        </div>
      </div>
    </button>
  );
}

function BranchNode({ id, selected, hovered, counts, onSelect, onHover }: {
  id: NodeId;
  selected: NodeId;
  hovered: NodeId | null;
  counts: Partial<Record<BitgetMarketGroup, number>>;
  onSelect: (id: NodeId) => void;
  onHover: (id: NodeId | null) => void;
}) {
  const active = selected === id || hovered === id;
  const status = statusFor(id, counts);
  return (
    <div className="relative">
      <span className={`absolute -left-7 top-1/2 h-px w-7 transition ${active ? "bg-cyan-300/80 shadow-[0_0_7px_rgba(34,211,238,0.45)]" : "bg-white/[0.09]"}`} />
      <button
        type="button"
        onClick={() => onSelect(id)}
        onMouseEnter={() => onHover(id)}
        onMouseLeave={() => onHover(null)}
        className={`w-full px-3 py-3 text-left transition ${active ? "bg-cyan-400/[0.055]" : "hover:bg-white/[0.02]"}`}
      >
        <div className="flex items-start gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-mono text-[9px] ${active ? "border-cyan-300/35 bg-cyan-400/[0.07] text-cyan-200" : "border-white/[0.08] text-slate-500"}`}>{symbolFor(id)}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={active ? "text-cyan-300/80" : "text-slate-600"}>{glyph(id)}</span>
              <p className={`text-[12px] font-semibold ${active ? "text-white" : "text-slate-200"}`}>{DETAILS[id].title}</p>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{shortFor(id)}</p>
            <div className="mt-2 flex items-center gap-1.5 text-[8px]">
              <span className={`h-1.5 w-1.5 rounded-full ${status.mode === "live" ? "bg-emerald-400" : status.mode === "pending" ? "bg-amber-400" : "bg-slate-500"}`} />
              <span className={status.mode === "live" ? "text-emerald-300/75" : status.mode === "pending" ? "text-amber-300/75" : "text-slate-600"}>{status.text}</span>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

function WorldColumn({
  index,
  eyebrow,
  title,
  subtitle,
  root,
  children,
  selected,
  hovered,
  counts,
  note,
  onSelect,
  onHover,
}: {
  index: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  root: NodeId;
  children: NodeId[];
  selected: NodeId;
  hovered: NodeId | null;
  counts: Partial<Record<BitgetMarketGroup, number>>;
  note?: React.ReactNode;
  onSelect: (id: NodeId) => void;
  onHover: (id: NodeId | null) => void;
}) {
  const focus = hovered ?? selected;
  const activeWorld = routeIncludes(root, focus);
  return (
    <div className="min-w-0 px-4 py-6 first:pl-0 last:pr-0 lg:px-7 lg:first:pl-0 lg:last:pr-0">
      <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] pb-4">
        <div>
          <p className={`font-mono text-[9px] tracking-[0.18em] ${activeWorld ? "text-cyan-300/75" : "text-slate-600"}`}>{index} · {eyebrow}</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-50">{title}</h2>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{subtitle}</p>
        </div>
        <span className={`mt-1 h-2 w-2 rounded-full ${activeWorld ? "bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.65)]" : "bg-slate-800"}`} />
      </div>

      <div className="mt-5">
        <RootNode id={root} selected={selected} hovered={hovered} counts={counts} onSelect={onSelect} onHover={onHover} />
      </div>

      {note ? <div className="mt-4 border-l border-amber-300/20 bg-amber-300/[0.025] px-3 py-2.5 text-[9px] leading-relaxed text-slate-400">{note}</div> : null}

      <div className={`relative ml-6 mt-5 space-y-2 border-l transition ${activeWorld ? "border-cyan-300/25" : "border-white/[0.07]"}`}>
        <div className="space-y-1 pl-7">
          {children.map((id) => (
            <BranchNode key={id} id={id} selected={selected} hovered={hovered} counts={counts} onSelect={onSelect} onHover={onHover} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailPanel({ detail, screenerHref }: { detail: Detail; screenerHref: string | null }) {
  return (
    <section className="border-y border-white/[0.065] bg-slate-950/25 py-6">
      <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr]">
        <div className="px-1 lg:pr-8">
          <p className="text-[9px] tracking-[0.18em] text-cyan-300/65">{detail.section}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{detail.title}</h2>
          <p className="mt-2 text-[14px] font-medium leading-relaxed text-slate-300">{detail.plain}</p>
          <p className="mt-4 text-[10px] leading-relaxed text-slate-500">{detail.apiStatus}</p>
          {screenerHref ? (
            <Link href={screenerHref} className="mt-5 inline-flex items-center gap-2 border-b border-cyan-300/30 pb-1 text-[10px] font-medium text-cyan-200 hover:border-cyan-200">Показать в скринере <ArrowRight className="h-3 w-3" /></Link>
          ) : (
            <span className="mt-5 inline-flex items-center gap-2 text-[9px] text-amber-300/65"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Отдельный data-adapter ещё не подключён</span>
          )}

          <div className="mt-7 border-t border-white/[0.06] pt-4">
            <p className="text-[8px] tracking-[0.16em] text-slate-600">СХЕМА</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {detail.family.split(" → ").map((part, index, array) => (
                <React.Fragment key={`${part}-${index}`}>
                  <span className={`font-mono text-[9px] ${index === 0 ? "text-slate-300" : "text-cyan-200/75"}`}>{part}</span>
                  {index < array.length - 1 ? <ArrowRight className="h-3 w-3 text-slate-700" /> : null}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="grid gap-0 md:grid-cols-3">
            <div className="min-h-32 pr-5">
              <p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">Что это</p>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-200">{detail.definition}</p>
            </div>
            <div className="min-h-32 border-l border-white/[0.06] px-5">
              <p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">Механика</p>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-200">{detail.mechanics}</p>
            </div>
            <div className="min-h-32 border-l border-white/[0.06] pl-5">
              <p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">Источник движения</p>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-200">{detail.driver}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
            <div className="border-l-2 border-rose-300/45 bg-rose-400/[0.025] px-4 py-3">
              <div className="flex items-center gap-2"><ShieldAlert className="h-3.5 w-3.5 text-rose-300/80" /><p className="text-[9px] uppercase tracking-[0.13em] text-rose-200/65">Главный риск</p></div>
              <p className="mt-2 text-[10px] leading-relaxed text-rose-100/80">{detail.risk}</p>
            </div>
            <div className="border-l-2 border-cyan-300/45 bg-cyan-400/[0.025] px-4 py-3">
              <p className="text-[9px] uppercase tracking-[0.13em] text-cyan-200/65">Перед входом</p>
              <p className="mt-2 font-mono text-[10px] leading-relaxed text-slate-200">{detail.check}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function BitgetMarketMap() {
  const [data, setData] = React.useState<BitgetScreenerResponse | null>(null);
  const [selected, setSelected] = React.useState<NodeId>("CRYPTO_SPOT");
  const [hovered, setHovered] = React.useState<NodeId | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const node = params.get("node") as NodeId | null;
    if (node && node in DETAILS) setSelected(node);
    void fetch("/api/bitget/screener", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: BitgetScreenerResponse | null) => { if (payload) setData(payload); })
      .catch(() => undefined);
  }, []);

  const selectNode = React.useCallback((id: NodeId) => {
    setSelected(id);
    const url = new URL(window.location.href);
    url.searchParams.set("node", id);
    window.history.replaceState({}, "", url);
  }, []);

  const online = React.useMemo(
    () => (data?.rows ?? []).filter((row) => row.status.toLowerCase() === "online"),
    [data],
  );

  const counts = React.useMemo(() => {
    const result: Partial<Record<BitgetMarketGroup, number>> = {};
    for (const row of online) result[row.marketGroup] = (result[row.marketGroup] ?? 0) + 1;
    return result;
  }, [online]);

  const detail = DETAILS[selected];
  const screenerHref = detail.screenerGroup ? `/screener/bitget?group=${detail.screenerGroup}` : null;
  const representatives = React.useMemo(() => {
    if (!detail.group) return [] as BitgetScreenerRow[];
    return online
      .filter((row) => row.marketGroup === detail.group && row.turnover24h != null)
      .slice()
      .sort((a, b) => (b.turnover24h ?? 0) - (a.turnover24h ?? 0))
      .slice(0, 5);
  }, [detail.group, online]);

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-6 pb-12">
      <header className="border-b border-white/[0.06] pb-5">
        <Link href="/screener/bitget" className="text-[9px] text-cyan-300/70 hover:text-cyan-200">← Вернуться в скринер</Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[9px] tracking-[0.24em] text-cyan-300/55">BITGET · СТРУКТУРА РЫНКОВ</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">Рынки и инструменты Bitget</h1>
            <p className="mt-2 text-[11px] text-slate-400">Криптовалюты · акции и ETF · товары, валюты и индексы</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[8px] text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />данные есть в скринере</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />отдельный адаптер</span>
          </div>
        </div>
      </header>

      <section className="border-y border-white/[0.06] bg-[#050914]/35">
        <div className="grid lg:grid-cols-[0.9fr_1.25fr_0.9fr] lg:divide-x lg:divide-white/[0.06]">
          <WorldColumn
            index="01"
            eyebrow="КРИПТО"
            title="Криптовалюты"
            subtitle="Базовый актив, заёмный спот и производные контракты."
            root="CRYPTO_SPOT"
            children={["MARGIN", "CRYPTO_FUTURES"]}
            selected={selected}
            hovered={hovered}
            counts={counts}
            onSelect={selectNode}
            onHover={setHovered}
          />
          <WorldColumn
            index="02"
            eyebrow="АКЦИИ И ETF"
            title="Фондовые инструменты"
            subtitle="Один underlying — четыре разные торговые формы на Bitget."
            root="US_STOCK"
            children={["STOCK_PLUS", "RTOKEN_SPOT", "STOCK_PERPS", "OPTIONS"]}
            selected={selected}
            hovered={hovered}
            counts={counts}
            note={<><span className="font-semibold text-amber-100/80">ETF</span> — биржевой фонд. Он может отслеживать индекс, сектор, товар или корзину. Сам ETF относится к фондовым инструментам; сам индекс — к глобальным рынкам.</>}
            onSelect={selectNode}
            onHover={setHovered}
          />
          <WorldColumn
            index="03"
            eyebrow="ГЛОБАЛЬНЫЕ РЫНКИ"
            title="Товары, Forex, индексы"
            subtitle="Внешний базовый рынок и инструменты Bitget, которые его отслеживают."
            root="GLOBAL_MARKET"
            children={["COMMODITY_PERPS", "TRADFI"]}
            selected={selected}
            hovered={hovered}
            counts={counts}
            onSelect={selectNode}
            onHover={setHovered}
          />
        </div>
      </section>

      <DetailPanel detail={detail} screenerHref={screenerHref} />

      <section className="border-b border-white/[0.06] pb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[9px] tracking-[0.18em] text-slate-600">КРУПНЕЙШИЕ ИНСТРУМЕНТЫ СЕКЦИИ</p>
            <p className="mt-1 text-[10px] text-slate-500">Текущий 24-часовой оборот среди уже подключённых public-инструментов.</p>
          </div>
          <span className="font-mono text-[8px] text-slate-600">{detail.group ? `${counts[detail.group] ?? 0} online` : "data-adapter pending"}</span>
        </div>

        {representatives.length ? (
          <div className="mt-5 grid gap-0 sm:grid-cols-2 lg:grid-cols-5">
            {representatives.map((row, index) => (
              <Link key={row.id} href={`/screener/bitget?group=${row.marketGroup}`} className={`group px-4 py-2 ${index > 0 ? "border-l border-white/[0.06]" : ""}`}>
                <p className="font-mono text-[8px] text-slate-700">0{index + 1}</p>
                <div className="mt-2 flex items-center justify-between gap-2"><span className="font-mono text-[13px] font-semibold text-slate-100 group-hover:text-cyan-200">{row.baseCoin || row.symbol}</span><span className={`font-mono text-[10px] ${tone(row.change24hPct)}`}>{pct(row.change24hPct)}</span></div>
                <p className="mt-1 font-mono text-[10px] text-slate-400">{price(row.lastPrice)}</p>
                <p className="mt-2 text-[9px] text-slate-600">оборот {compact(row.turnover24h)}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 flex items-center gap-3 border-l-2 border-amber-300/30 bg-amber-300/[0.02] px-4 py-3 text-[10px] text-slate-400">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-300/65" />
            <span>Продукт представлен на Bitget, но его market-data adapter ещё не подключён к этой странице. Отсутствующие данные не заменяются нулями.</span>
          </div>
        )}
      </section>

      <footer className="flex flex-wrap items-start justify-between gap-4 px-1 text-[8px] leading-relaxed text-slate-700">
        <p className="max-w-5xl">Зелёный статус показывает группы, уже входящие в public-скринер. Stock+ и U.S. options существуют как отдельные продукты Bitget, но требуют отдельного data-adapter для этой страницы.</p>
        <p className="font-mono">рынок → инструмент → механика → риск</p>
      </footer>
    </div>
  );
}
