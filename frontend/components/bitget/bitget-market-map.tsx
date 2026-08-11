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

type WorldId = "CRYPTO" | "STOCKS" | "GLOBAL";

type Detail = {
  eyebrow: string;
  title: string;
  plain: string;
  thesis: string;
  ownership: string;
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
    eyebrow: "КРИПТО · БАЗОВЫЙ РЫНОК",
    title: "Крипто-спот",
    plain: "Вы торгуете сам токен.",
    thesis: "Это базовый крипторынок. Именно с ним логично сравнивать margin и крипто-фьючерсы.",
    ownership: "Сам криптоактив",
    mechanics: "Покупка и продажа за собственные средства. Обязательного займа и perpetual funding здесь нет.",
    driver: "Спрос и предложение в токене, общий режим крипторынка, новости, ликвидность и сектор.",
    risk: "Цена самого актива и ликвидность конкретной пары.",
    check: "Оборот → спред → локальный ход → BTC/ETH → сектор.",
    family: "Спот → Margin или Futures",
    group: "CRYPTO_SPOT",
    screenerGroup: "CRYPTO_SPOT",
    apiStatus: "Живые инструменты уже подключены к скринеру через public UTA v3.",
  },
  MARGIN: {
    eyebrow: "КРИПТО · СПОТ С ЗАЙМОМ",
    title: "Маржинальная крипта",
    plain: "Токен тот же, но в позиции появляется долг.",
    thesis: "Margin не превращает токен во фьючерс: предмет сделки остаётся спотовым, но меняется риск позиции.",
    ownership: "Спотовая позиция + заём",
    mechanics: "Собственные средства и заём. Возможны увеличенный long и заёмный short; начисляется стоимость займа.",
    driver: "Тот же spot-рынок, но результат позиции дополнительно зависит от плеча и стоимости займа.",
    risk: "Ликвидация, проценты за заём и ускоренный убыток из-за плеча.",
    check: "Сначала spot → доступный заём → плечо → цена ликвидации.",
    family: "Спот + заём = Margin",
    group: "MARGIN",
    screenerGroup: "MARGIN",
    apiStatus: "Список margin-инструментов уже подключён к скринеру.",
  },
  CRYPTO_FUTURES: {
    eyebrow: "КРИПТО · ПРОИЗВОДНЫЙ КОНТРАКТ",
    title: "Крипто-фьючерсы",
    plain: "Вы торгуете контракт на движение цены, а не сам токен.",
    thesis: "Здесь появляются long/short, маржа и open interest. Для perpetual добавляется funding; у delivery-контрактов есть дата расчёта.",
    ownership: "Фьючерсный контракт",
    mechanics: "Long/short + маржа + плечо. Perpetual без обычной экспирации использует funding; delivery имеет дату расчёта.",
    driver: "Spot + позиционирование во фьючерсах + OI + ликвидации + basis.",
    risk: "Ликвидация, funding у perpetual и расхождение контракта с базовым рынком.",
    check: "Spot → basis → OI → funding → спред → ликвидации.",
    family: "Токен → Futures → OI / Funding / Expiry",
    group: "CRYPTO_FUTURES",
    screenerGroup: "CRYPTO_FUTURES",
    apiStatus: "USDT/USDC/COIN futures уже входят в рабочий universe скринера.",
  },
  US_STOCK: {
    eyebrow: "АКЦИИ / ETF · БАЗОВЫЙ UNDERLYING",
    title: "Акция или ETF США",
    plain: "Один тикер может существовать на Bitget в нескольких совершенно разных формах.",
    thesis: "SPY, NVDA или AAPL сначала нужно определить как underlying, а уже потом понять: Stock+, rToken, perpetual или option.",
    ownership: "Базовый фондовый актив",
    mechanics: "Underlying задаёт экономический смысл, но каждая торговая оболочка имеет свои права, риск и режим торговли.",
    driver: "Компания/ETF, американская сессия, отчёты, новости, сектор и индекс.",
    risk: "Перепутать торговые оболочки и применить к ним одинаковую механику.",
    check: "Underlying → конкретный продукт → торговые часы → ликвидность → риск продукта.",
    family: "US Stock / ETF → Stock+ · rToken · Perpetual · Options",
    apiStatus: "Это смысловой центр фондовой ветви. Данные разных оболочек приходят из разных API-контуров.",
  },
  RTOKEN_SPOT: {
    eyebrow: "АКЦИИ / ETF · ТОКЕНИЗИРОВАННАЯ ЭКСПОЗИЦИЯ",
    title: "rToken",
    plain: "Это токенизированная фондовая экспозиция, а не брокерская акция Stock+.",
    thesis: "rToken выпускается Reality и связан с американским stock/ETF underlying. В интерфейсе мы показываем R отдельно: R · SPY.",
    ownership: "Токенизированный продукт",
    mechanics: "Торгуется ближе к spot-логике Bitget. Отражает фондовый underlying, но не является тем же продуктом, что Stock+.",
    driver: "Базовая акция/ETF + состояние rToken-рынка + его собственная ликвидность.",
    risk: "Underlying + ликвидность токена + особенности режима и прав токенизированного продукта.",
    check: "Underlying → время рынка США → оборот rToken → спред → отклонение цены.",
    family: "US Stock / ETF → R · rToken",
    group: "RTOKEN_SPOT",
    screenerGroup: "RTOKEN_SPOT",
    apiStatus: "rToken уже распознаются и сканируются в public universe.",
  },
  STOCK_PLUS: {
    eyebrow: "АКЦИИ / ETF · БРОКЕРСКИЙ КОНТУР",
    title: "Stock+",
    plain: "Это доступ к реальным акциям и ETF через securities-партнёров Bitget.",
    thesis: "Stock+ использует обычные фондовые тикеры и предназначен для broker-style владения, а не для токенизированной spot-оболочки.",
    ownership: "Реальная акция / ETF через Stock+",
    mechanics: "Отдельный securities-контур Bitget с fractional shares, собственными market-data и account API.",
    driver: "Основной рынок США, эмитент, отчёты, сектор и индекс.",
    risk: "Рыночный риск underlying, режим торгов и региональная доступность продукта.",
    check: "Сессия → котировка → ликвидность → корпоративные события → доступность аккаунту.",
    family: "US Stock / ETF → Stock+",
    apiStatus: "Продукт доступен на Bitget; наш Stock+ data-adapter ещё не подключён к скринеру.",
  },
  STOCK_PERPS: {
    eyebrow: "АКЦИИ / ETF · PERPETUAL",
    title: "Фьючерсы на акции",
    plain: "Это бессрочный производный контракт: акцией вы не владеете.",
    thesis: "Stock perpetual позволяет long/short и плечо. Он следует за фондовым underlying, но живёт как дериватив Bitget.",
    ownership: "Бессрочный производный контракт",
    mechanics: "Long/short + маржа + плечо + funding. У контракта нет обычной экспирации.",
    driver: "Underlying + деривативное позиционирование + index/mark price + OI.",
    risk: "Ликвидация, funding и отклонение perpetual от основного фондового рынка.",
    check: "Underlying → сессия → basis → funding → OI → спред.",
    family: "US Stock / ETF → Perpetual → Funding / OI",
    group: "STOCK_PERPS",
    screenerGroup: "STOCK_PERPS",
    apiStatus: "Stock-type perpetuals уже выделяются из public UTA и работают в скринере.",
  },
  OPTIONS: {
    eyebrow: "АКЦИИ / ETF · ОПЦИОНЫ",
    title: "Опционы США",
    plain: "Это не один тикер, а целое дерево контрактов на один underlying.",
    thesis: "Каждый контракт определяется underlying, экспирацией, страйком и типом call/put. Направления цены уже недостаточно.",
    ownership: "Опционный контракт",
    mechanics: "Underlying → expiry → strike → call/put. Цена зависит от underlying, времени и implied volatility.",
    driver: "Underlying + IV + срок до экспирации + структура конкретной серии.",
    risk: "Theta, волатильность, Greeks и ликвидность выбранного страйка.",
    check: "Событие → expiry → IV → strike → bid/ask → OI/ликвидность серии.",
    family: "US Stock / ETF → Expiry → Strike → Call / Put",
    apiStatus: "Bitget уже предлагает U.S. stock options; наш option-chain adapter ещё не подключён к скринеру.",
  },
  GLOBAL_MARKET: {
    eyebrow: "ГЛОБАЛЬНЫЕ РЫНКИ · ИСТОЧНИК ЦЕНЫ",
    title: "Товары, FX и индексы",
    plain: "Цена рождается не только в локальном стакане Bitget.",
    thesis: "Золото, нефть, валюты и индексы имеют собственные основные рынки. Bitget-инструмент нужно читать вместе с внешним underlying.",
    ownership: "Внешний базовый рынок",
    mechanics: "Локальный инструмент Bitget отражает или отслеживает внешний market/index source.",
    driver: "Макро, ставки, товарные потоки, мировые сессии и основной рынок underlying.",
    risk: "Локальный стакан может выглядеть сильным, когда внешний рынок уже движется против него.",
    check: "Внешний рынок → сессия → локальный инструмент → спред/funding → реакция.",
    family: "Global underlying → Bitget derivative / CFD",
    apiStatus: "Это смысловой центр для commodity perpetuals и отдельного TradFi-контура.",
  },
  COMMODITY_PERPS: {
    eyebrow: "ГЛОБАЛЬНЫЕ РЫНКИ · ТОВАРНЫЕ PERPETUALS",
    title: "Товарные perpetuals",
    plain: "Золото, серебро, нефть или газ торгуются как дериватив Bitget.",
    thesis: "Это USDT-M perpetuals без физической поставки. Основной внешний рынок остаётся важным источником движения.",
    ownership: "Производный контракт",
    mechanics: "USDT-M perpetual + маржа + плечо + funding; без обычной даты экспирации.",
    driver: "Глобальный commodity market + макро + локальное позиционирование Bitget.",
    risk: "Ликвидация, funding и расхождение локального контракта с внешней ценой.",
    check: "Underlying → мировая сессия → оборот → спред → funding/OI.",
    family: "Gold / Oil / Gas → Perpetual",
    group: "COMMODITY_PERPS",
    screenerGroup: "COMMODITY_PERPS",
    apiStatus: "Metal/commodity futures уже выделены в текущем public screener.",
  },
  TRADFI: {
    eyebrow: "ГЛОБАЛЬНЫЕ РЫНКИ · TRADFI",
    title: "Forex / индексы / CFD",
    plain: "Это отдельный TradFi-контур, а не часть текущего crypto UTA universe.",
    thesis: "FX, индексы и CFD имеют собственные символы, часы и спецификации. Их нельзя подмешивать в crypto/futures таблицу без отдельного адаптера.",
    ownership: "Контракт / CFD на внешний рынок",
    mechanics: "Отдельные спецификации, trading hours и правила маржи в зависимости от продукта.",
    driver: "Основной FX/index market + макро + мировые сессии.",
    risk: "Плечо, гэпы между режимами и неверная интерпретация локальной котировки без внешнего контекста.",
    check: "Underlying → trading hours → спецификация → ликвидность → локальный спред.",
    family: "FX / Index → TradFi / CFD",
    apiStatus: "Раздел есть у Bitget; наш TradFi adapter будет подключён отдельным слоем.",
  },
};

const WORLD_LABELS: Record<WorldId, { title: string; subtitle: string }> = {
  CRYPTO: { title: "КРИПТО", subtitle: "сам токен → заём → дериватив" },
  STOCKS: { title: "АКЦИИ / ETF", subtitle: "один underlying → четыре торговые оболочки" },
  GLOBAL: { title: "ГЛОБАЛЬНЫЕ РЫНКИ", subtitle: "товары · FX · индексы" },
};

function worldOf(id: NodeId): WorldId {
  if (["CRYPTO_SPOT", "MARGIN", "CRYPTO_FUTURES"].includes(id)) return "CRYPTO";
  if (["US_STOCK", "RTOKEN_SPOT", "STOCK_PLUS", "STOCK_PERPS", "OPTIONS"].includes(id)) return "STOCKS";
  return "GLOBAL";
}

function nodeInRoute(node: NodeId, focus: NodeId): boolean {
  if (node === focus) return true;
  if ((focus === "MARGIN" || focus === "CRYPTO_FUTURES") && node === "CRYPTO_SPOT") return true;
  if (["RTOKEN_SPOT", "STOCK_PLUS", "STOCK_PERPS", "OPTIONS"].includes(focus) && node === "US_STOCK") return true;
  if ((focus === "COMMODITY_PERPS" || focus === "TRADFI") && node === "GLOBAL_MARKET") return true;
  return false;
}

function Glyph({ id }: { id: NodeId }) {
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

function nodeSymbol(id: NodeId): string {
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

function nodeShort(id: NodeId): string {
  switch (id) {
    case "CRYPTO_SPOT": return "сам токен";
    case "MARGIN": return "spot + заём";
    case "CRYPTO_FUTURES": return "long/short · OI · funding";
    case "US_STOCK": return "базовая акция / ETF";
    case "RTOKEN_SPOT": return "токенизированная экспозиция";
    case "STOCK_PLUS": return "реальная акция / ETF";
    case "STOCK_PERPS": return "бессрочный дериватив";
    case "OPTIONS": return "expiry · strike · call/put";
    case "GLOBAL_MARKET": return "внешний источник цены";
    case "COMMODITY_PERPS": return "золото · нефть · газ";
    case "TRADFI": return "FX · индексы · CFD";
  }
}

function compact(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)} трлн`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)} млрд`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)} млн`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)} тыс.`;
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function price(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const digits = value >= 1000 ? 2 : value >= 1 ? 4 : 7;
  return value.toLocaleString("ru-RU", { maximumFractionDigits: digits });
}

function pct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function tone(value: number | null): string {
  if (value == null || value === 0) return "text-slate-500";
  return value > 0 ? "text-emerald-300" : "text-rose-300";
}

function statusFor(id: NodeId, counts: Partial<Record<BitgetMarketGroup, number>>): { text: string; mode: "live" | "pending" | "context" } {
  const group = DETAILS[id].group;
  if (group) return { text: `${counts[group] ?? 0} в скринере`, mode: "live" };
  if (id === "STOCK_PLUS") return { text: "10 000+ на Bitget · адаптер скоро", mode: "pending" };
  if (id === "OPTIONS") return { text: "2 800+ опционов · адаптер скоро", mode: "pending" };
  if (id === "TRADFI") return { text: "отдельный контур · адаптер скоро", mode: "pending" };
  return { text: id === "US_STOCK" ? "базовый underlying" : "источник внешней цены", mode: "context" };
}

function RoutePath({ d, active }: { d: string; active: boolean }) {
  return (
    <path
      d={d}
      fill="none"
      strokeWidth={active ? 1.9 : 1.1}
      strokeLinecap="round"
      className={`transition-all duration-300 ${active ? "stroke-cyan-300/75 [filter:drop-shadow(0_0_7px_rgba(34,211,238,0.55))]" : "stroke-slate-700/45"}`}
    />
  );
}

function ProductNode({
  id,
  x,
  y,
  width,
  selected,
  hovered,
  counts,
  onSelect,
  onHover,
}: {
  id: NodeId;
  x: number;
  y: number;
  width: number;
  selected: NodeId;
  hovered: NodeId | null;
  counts: Partial<Record<BitgetMarketGroup, number>>;
  onSelect: (id: NodeId) => void;
  onHover: (id: NodeId | null) => void;
}) {
  const focus = hovered ?? selected;
  const active = nodeInRoute(id, focus);
  const ownSelected = selected === id;
  const status = statusFor(id, counts);
  const hoverWorld = hovered ? worldOf(hovered) : null;
  const dim = hoverWorld != null && hoverWorld !== worldOf(id);

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      style={{ left: `${x}%`, top: `${y}%`, width }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 text-left transition-all duration-300 ${dim ? "opacity-30" : "opacity-100"}`}
    >
      <div className={`group relative rounded-[26px] px-3 py-3 transition-all duration-300 ${ownSelected ? "bg-cyan-400/[0.085] ring-1 ring-cyan-300/35 shadow-[0_0_36px_rgba(34,211,238,0.10)]" : active ? "bg-white/[0.035] ring-1 ring-white/[0.10]" : "bg-slate-950/40 ring-1 ring-white/[0.055] hover:bg-white/[0.035] hover:ring-white/[0.13]"}`}>
        <div className="flex items-start gap-2.5">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] ${ownSelected ? "border-cyan-300/40 bg-cyan-400/[0.11] text-cyan-100" : active ? "border-cyan-400/20 bg-cyan-400/[0.045] text-cyan-300" : "border-white/[0.08] bg-white/[0.02] text-slate-500"}`}>
            {nodeSymbol(id)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`shrink-0 ${active ? "text-cyan-300/80" : "text-slate-700"}`}><Glyph id={id} /></span>
              <p className={`truncate text-[11px] font-semibold ${ownSelected ? "text-white" : "text-slate-200"}`}>{DETAILS[id].title}</p>
            </div>
            <p className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-slate-500">{nodeShort(id)}</p>
            <div className="mt-2 flex items-center gap-1.5 text-[8px]">
              <span className={`h-1.5 w-1.5 rounded-full ${status.mode === "live" ? "bg-emerald-400" : status.mode === "pending" ? "bg-amber-400" : "bg-slate-600"}`} />
              <span className={status.mode === "live" ? "text-emerald-300/70" : status.mode === "pending" ? "text-amber-300/65" : "text-slate-600"}>{status.text}</span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

function WorldStage({
  world,
  selected,
  hovered,
  counts,
  onSelect,
  onHover,
}: {
  world: WorldId;
  selected: NodeId;
  hovered: NodeId | null;
  counts: Partial<Record<BitgetMarketGroup, number>>;
  onSelect: (id: NodeId) => void;
  onHover: (id: NodeId | null) => void;
}) {
  const focus = hovered ?? selected;
  const hoverWorld = hovered ? worldOf(hovered) : null;
  const dim = hoverWorld != null && hoverWorld !== world;

  return (
    <div className={`relative min-h-[390px] transition-opacity duration-300 ${dim ? "opacity-35" : "opacity-100"}`}>
      <div className="mb-1 text-center">
        <p className="text-[9px] font-semibold tracking-[0.22em] text-slate-300">{WORLD_LABELS[world].title}</p>
        <p className="mt-1 text-[9px] text-slate-600">{WORLD_LABELS[world].subtitle}</p>
      </div>
      <div className="relative mx-auto h-[350px] max-w-[430px]">
        <svg viewBox="0 0 400 330" className="absolute inset-0 h-full w-full" aria-hidden="true">
          {world === "CRYPTO" ? (
            <>
              <RoutePath d="M200 72 C200 115 200 135 200 158" active={worldOf(focus) === "CRYPTO"} />
              <RoutePath d="M200 172 C168 201 137 224 92 260" active={focus === "MARGIN"} />
              <RoutePath d="M200 172 C232 201 263 224 308 260" active={focus === "CRYPTO_FUTURES"} />
            </>
          ) : null}
          {world === "STOCKS" ? (
            <>
              <RoutePath d="M200 78 C161 115 122 142 84 182" active={focus === "RTOKEN_SPOT" || focus === "US_STOCK"} />
              <RoutePath d="M200 78 C239 115 278 142 316 182" active={focus === "STOCK_PLUS" || focus === "US_STOCK"} />
              <RoutePath d="M200 78 C158 162 122 215 86 276" active={focus === "STOCK_PERPS" || focus === "US_STOCK"} />
              <RoutePath d="M200 78 C242 162 278 215 314 276" active={focus === "OPTIONS" || focus === "US_STOCK"} />
            </>
          ) : null}
          {world === "GLOBAL" ? (
            <>
              <RoutePath d="M200 80 C170 136 138 194 108 252" active={focus === "COMMODITY_PERPS" || focus === "GLOBAL_MARKET"} />
              <RoutePath d="M200 80 C230 136 262 194 292 252" active={focus === "TRADFI" || focus === "GLOBAL_MARKET"} />
            </>
          ) : null}
        </svg>

        {world === "CRYPTO" ? (
          <>
            <ProductNode id="CRYPTO_SPOT" x={50} y={28} width={220} selected={selected} hovered={hovered} counts={counts} onSelect={onSelect} onHover={onHover} />
            <ProductNode id="MARGIN" x={24} y={77} width={170} selected={selected} hovered={hovered} counts={counts} onSelect={onSelect} onHover={onHover} />
            <ProductNode id="CRYPTO_FUTURES" x={76} y={77} width={180} selected={selected} hovered={hovered} counts={counts} onSelect={onSelect} onHover={onHover} />
          </>
        ) : null}

        {world === "STOCKS" ? (
          <>
            <ProductNode id="US_STOCK" x={50} y={27} width={230} selected={selected} hovered={hovered} counts={counts} onSelect={onSelect} onHover={onHover} />
            <ProductNode id="RTOKEN_SPOT" x={22} y={55} width={172} selected={selected} hovered={hovered} counts={counts} onSelect={onSelect} onHover={onHover} />
            <ProductNode id="STOCK_PLUS" x={78} y={55} width={176} selected={selected} hovered={hovered} counts={counts} onSelect={onSelect} onHover={onHover} />
            <ProductNode id="STOCK_PERPS" x={22} y={83} width={176} selected={selected} hovered={hovered} counts={counts} onSelect={onSelect} onHover={onHover} />
            <ProductNode id="OPTIONS" x={78} y={83} width={176} selected={selected} hovered={hovered} counts={counts} onSelect={onSelect} onHover={onHover} />
          </>
        ) : null}

        {world === "GLOBAL" ? (
          <>
            <ProductNode id="GLOBAL_MARKET" x={50} y={29} width={230} selected={selected} hovered={hovered} counts={counts} onSelect={onSelect} onHover={onHover} />
            <ProductNode id="COMMODITY_PERPS" x={27} y={75} width={180} selected={selected} hovered={hovered} counts={counts} onSelect={onSelect} onHover={onHover} />
            <ProductNode id="TRADFI" x={73} y={75} width={180} selected={selected} hovered={hovered} counts={counts} onSelect={onSelect} onHover={onHover} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function StockFamilyRail({ selected, onSelect }: { selected: NodeId; onSelect: (id: NodeId) => void }) {
  const items: Array<{ id: NodeId; symbol: string; title: string; line: string; status: string }> = [
    { id: "STOCK_PLUS", symbol: "+", title: "Stock+", line: "реальная акция / ETF", status: "владение" },
    { id: "RTOKEN_SPOT", symbol: "R", title: "rToken", line: "токенизированная экспозиция", status: "spot-like" },
    { id: "STOCK_PERPS", symbol: "∞", title: "Stock Perp", line: "бессрочный дериватив", status: "funding + плечо" },
    { id: "OPTIONS", symbol: "C/P", title: "Options", line: "expiry + strike + call/put", status: "нелинейный риск" },
  ];

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-white/[0.055] bg-slate-950/35 px-5 py-5">
      <div className="absolute left-1/2 top-0 h-32 w-96 -translate-x-1/2 rounded-full bg-violet-500/[0.06] blur-3xl" />
      <div className="relative">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[9px] tracking-[0.2em] text-violet-300/60">СЕМЕЙСТВО ОДНОГО ТИКЕРА</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">SPY / NVDA / AAPL — сначала выберите торговую оболочку</h2>
            <p className="mt-1 max-w-3xl text-[10px] leading-relaxed text-slate-500">Одинаковый underlying не означает одинаковую сделку. Владение, funding, экспирация и права меняются вместе с продуктом.</p>
          </div>
          <button type="button" onClick={() => onSelect("US_STOCK")} className="text-[9px] text-cyan-300/70 hover:text-cyan-200">Показать базовый underlying →</button>
        </div>

        <div className="relative mt-7 hidden lg:block">
          <div className="absolute left-[12.5%] right-[12.5%] top-7 h-px bg-gradient-to-r from-transparent via-violet-400/25 to-transparent" />
          <div className="grid grid-cols-4 gap-4">
            {items.map((item) => {
              const active = selected === item.id;
              return (
                <button key={item.id} type="button" onClick={() => onSelect(item.id)} className="group relative text-center">
                  <div className={`relative mx-auto flex h-14 w-14 items-center justify-center rounded-full border font-mono text-[11px] transition ${active ? "border-cyan-300/45 bg-cyan-400/[0.10] text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.12)]" : "border-violet-300/15 bg-slate-950 text-violet-200/70 group-hover:border-violet-300/30"}`}>{item.symbol}</div>
                  <p className="mt-3 text-[11px] font-semibold text-slate-200">{item.title}</p>
                  <p className="mt-1 text-[9px] text-slate-500">{item.line}</p>
                  <p className="mt-1 font-mono text-[8px] text-slate-700">{item.status}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:hidden">
          {items.map((item) => (
            <button key={item.id} type="button" onClick={() => onSelect(item.id)} className={`rounded-2xl border px-3 py-3 text-left ${selected === item.id ? "border-cyan-300/30 bg-cyan-400/[0.06]" : "border-white/[0.06] bg-white/[0.015]"}`}>
              <div className="flex items-center gap-2"><span className="font-mono text-cyan-300">{item.symbol}</span><span className="text-[11px] font-semibold text-slate-200">{item.title}</span></div>
              <p className="mt-1 text-[9px] text-slate-500">{item.line}</p>
            </button>
          ))}
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
  const representatives = React.useMemo(() => {
    if (!detail.group) return [] as BitgetScreenerRow[];
    return online
      .filter((row) => row.marketGroup === detail.group && row.turnover24h != null)
      .slice()
      .sort((a, b) => (b.turnover24h ?? 0) - (a.turnover24h ?? 0))
      .slice(0, 5);
  }, [detail.group, online]);

  const screenerHref = detail.screenerGroup ? `/screener/bitget?group=${detail.screenerGroup}` : null;
  const stockRelated = worldOf(selected) === "STOCKS";

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-5 pb-12">
      <header className="border-b border-white/[0.055] pb-5">
        <Link href="/screener/bitget" className="text-[9px] text-cyan-300/70 hover:text-cyan-200">← Вернуться в скринер</Link>
        <p className="mt-4 text-[9px] tracking-[0.24em] text-cyan-300/50">BITGET · КАРТА МЕХАНИКИ</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="max-w-5xl text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">Сначала определите, что именно вы торгуете</h1>
            <p className="mt-2 max-w-4xl text-[11px] leading-relaxed text-slate-500">Один аккаунт Bitget объединяет разные рынки. На карте мы идём от базового актива к конкретной торговой механике — и только потом к скринеру.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[8px] text-slate-600">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> уже в скринере</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> продукт есть, адаптер следующий</span>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-[38px] border border-white/[0.055] bg-[#050914]/65 px-3 py-7 md:px-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_5%,rgba(34,211,238,0.08),transparent_29%),radial-gradient(circle_at_50%_80%,rgba(139,92,246,0.045),transparent_35%)]" />
        <div className="relative">
          <div className="mx-auto max-w-xl text-center">
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/[0.05] shadow-[0_0_55px_rgba(34,211,238,0.10)]">
              <div className="absolute inset-2 rounded-full border border-cyan-300/[0.08]" />
              <Sparkles className="h-4 w-4 text-cyan-300/65" />
            </div>
            <p className="mt-3 text-[9px] tracking-[0.28em] text-cyan-300/45">BITGET</p>
            <p className="mt-1 text-[13px] font-semibold text-slate-200">один аккаунт · разные механики сделки</p>
          </div>

          <div className="relative mx-auto mt-3 hidden h-16 max-w-[1220px] lg:block" aria-hidden="true">
            <div className="absolute left-1/2 top-0 h-7 w-px -translate-x-1/2 bg-gradient-to-b from-cyan-300/45 to-cyan-300/15" />
            <div className="absolute left-[16.67%] right-[16.67%] top-7 h-px bg-gradient-to-r from-cyan-300/10 via-cyan-300/35 to-cyan-300/10" />
            {[16.67, 50, 83.33].map((left) => <div key={left} style={{ left: `${left}%` }} className="absolute top-7 h-9 w-px bg-gradient-to-b from-cyan-300/30 to-transparent" />)}
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <WorldStage world="CRYPTO" selected={selected} hovered={hovered} counts={counts} onSelect={selectNode} onHover={setHovered} />
            <WorldStage world="STOCKS" selected={selected} hovered={hovered} counts={counts} onSelect={selectNode} onHover={setHovered} />
            <WorldStage world="GLOBAL" selected={selected} hovered={hovered} counts={counts} onSelect={selectNode} onHover={setHovered} />
          </div>

          <div className="mt-2 text-center text-[9px] text-slate-700">Наведение подсвечивает маршрут. Клик фиксирует продукт и раскрывает его механику ниже.</div>
        </div>
      </section>

      {stockRelated ? <StockFamilyRail selected={selected} onSelect={selectNode} /> : null}

      <section className="relative overflow-hidden rounded-[32px] border border-white/[0.06] bg-slate-950/38 px-4 py-5 md:px-6">
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-cyan-300/55 via-cyan-300/10 to-transparent" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <p className="text-[9px] tracking-[0.18em] text-cyan-300/55">{detail.eyebrow}</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-50">{detail.title} <span className="font-normal text-slate-500">— {detail.plain}</span></h2>
            <p className="mt-2 max-w-4xl text-[11px] leading-relaxed text-slate-400">{detail.thesis}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8px] ${detail.group ? "border-emerald-400/20 bg-emerald-400/[0.04] text-emerald-300/70" : "border-amber-400/20 bg-amber-400/[0.04] text-amber-300/70"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${detail.group ? "bg-emerald-400" : "bg-amber-400"}`} />{detail.apiStatus}
            </span>
            {screenerHref ? (
              <Link href={screenerHref} className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-400/[0.045] px-3 py-1.5 text-[9px] text-cyan-200 hover:bg-cyan-400/[0.08]">Показать эти инструменты в скринере <ArrowRight className="h-3 w-3" /></Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] px-3 py-1.5 text-[9px] text-slate-600">Скринер этого раздела подключаем следующим адаптером</span>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-y border-white/[0.05] py-3">
          <span className="text-[8px] tracking-[0.16em] text-slate-700">МЕХАНИКА</span>
          {detail.family.split(" → ").map((part, index, array) => (
            <React.Fragment key={`${part}-${index}`}>
              <span className={`rounded-full border px-2.5 py-1 font-mono text-[9px] ${index === 0 ? "border-white/[0.09] text-slate-300" : "border-cyan-300/15 bg-cyan-400/[0.025] text-cyan-200/75"}`}>{part}</span>
              {index < array.length - 1 ? <ArrowRight className="h-3 w-3 text-slate-700" /> : null}
            </React.Fragment>
          ))}
        </div>

        <div className="mt-5 grid gap-0 md:grid-cols-5">
          {[
            ["01", "Что торгуете", detail.ownership, false],
            ["02", "Как устроено", detail.mechanics, false],
            ["03", "Где рождается движение", detail.driver, false],
            ["04", "Главный риск", detail.risk, true],
            ["05", "Перед входом", detail.check, false],
          ].map(([num, label, value, danger], index) => (
            <div key={String(num)} className={`min-h-32 px-3 py-2 ${index > 0 ? "border-l border-white/[0.055]" : ""}`}>
              <div className="flex items-center gap-2"><span className="font-mono text-[8px] text-cyan-300/55">{String(num)}</span><span className="text-[8px] uppercase tracking-[0.11em] text-slate-600">{String(label)}</span></div>
              <p className={`mt-3 text-[10px] leading-relaxed ${danger ? "text-rose-200/75" : "text-slate-300"}`}>{String(value)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-white/[0.055] py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[9px] tracking-[0.18em] text-slate-600">ЖИВЫЕ ПРЕДСТАВИТЕЛИ СЕКЦИИ</p>
            <p className="mt-1 text-[10px] text-slate-500">Не рекомендации. Самые крупные по текущему 24ч обороту среди уже подключённых public-инструментов.</p>
          </div>
          <span className="font-mono text-[8px] text-slate-700">{detail.group ? `${counts[detail.group] ?? 0} online` : "data-adapter pending"}</span>
        </div>

        {representatives.length ? (
          <div className="mt-5 grid gap-0 sm:grid-cols-2 lg:grid-cols-5">
            {representatives.map((row, index) => (
              <Link key={row.id} href={`/screener/bitget?group=${row.marketGroup}`} className={`group px-3 py-2 ${index > 0 ? "border-l border-white/[0.05]" : ""}`}>
                <p className="font-mono text-[8px] text-slate-700">0{index + 1}</p>
                <div className="mt-1 flex items-center justify-between gap-2"><span className="font-mono text-[11px] font-semibold text-slate-200 group-hover:text-cyan-200">{row.baseCoin || row.symbol}</span><span className={`font-mono text-[9px] ${tone(row.change24hPct)}`}>{pct(row.change24hPct)}</span></div>
                <p className="mt-1 font-mono text-[9px] text-slate-500">{price(row.lastPrice)}</p>
                <p className="mt-1 text-[8px] text-slate-700">оборот {compact(row.turnover24h)}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-dashed border-amber-400/12 px-4 py-4 text-[10px] text-slate-500">
            <ShieldAlert className="h-4 w-4 text-amber-300/55" />
            <span>Продукт существует в экосистеме Bitget, но его market-data adapter ещё не подключён к этой странице. Мы не подменяем отсутствие данных нулями.</span>
          </div>
        )}
      </section>

      <footer className="flex flex-wrap items-start justify-between gap-4 px-1 text-[8px] leading-relaxed text-slate-700">
        <p className="max-w-4xl">Карта объясняет устройство продукта, а не выдаёт торговый сигнал. Live-count берётся из текущего Bitget public UTA. Статические ориентиры: Stock+ — 10 000+ U.S. stocks/ETFs по материалам Bitget от 03.07.2026; U.S. stock options — 2 800+ по запуску Bitget от 17.07.2026.</p>
        <p className="font-mono">object → mechanics → driver → risk → action</p>
      </footer>
    </div>
  );
}
