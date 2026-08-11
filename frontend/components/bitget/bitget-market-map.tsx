"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  BookOpen,
  CandlestickChart,
  ChartCandlestick,
  CircleDollarSign,
  Landmark,
  Layers,
  Percent,
  TrendingUp,
} from "lucide-react";
import type { BitgetMarketGroup, BitgetScreenerResponse, BitgetScreenerRow } from "@/lib/bitget/types";

type NodeId = BitgetMarketGroup | "STOCK_PLUS" | "OPTIONS" | "TRADFI";

type MarketNode = {
  id: NodeId;
  zone: "Крипто" | "Акции и RWA" | "Деривативы TradFi";
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
  icon: React.ComponentType<{ className?: string }>;
};

const NODES: MarketNode[] = [
  {
    id: "CRYPTO_SPOT",
    zone: "Крипто",
    title: "Крипто · Спот",
    short: "Покупка и продажа самого токена.",
    what: "Вы обмениваете один актив на другой: например BTC на USDT. Позиция существует в самом активе, а не в производном контракте.",
    mechanics: "Цена формируется в спотовом стакане. Нет funding. При обычной спот-сделке без займа нет принудительной ликвидации из-за плеча.",
    leverage: "Нет по умолчанию",
    cashflow: "Комиссия сделки",
    risk: "Рыночное движение самого актива",
    traderUse: "База рынка, направление, ликвидность и цена, с которой сравниваются деривативы.",
    liveGroup: "CRYPTO_SPOT",
    status: "live",
    icon: CircleDollarSign,
  },
  {
    id: "MARGIN",
    zone: "Крипто",
    title: "Маржинальный спот",
    short: "Тот же спот, но с заёмными средствами.",
    what: "Вы торгуете спотовым активом, но часть позиции может финансироваться займом. Это отличается от фьючерса: предмет сделки остаётся спотовым активом.",
    mechanics: "Есть долг и процент за заём. Рост плеча увеличивает чувствительность капитала к движению цены и создаёт риск ликвидации.",
    leverage: "Есть, зависит от пары",
    cashflow: "Комиссия + процент по займу",
    risk: "Цена + стоимость займа + ликвидация",
    traderUse: "Когда нужен спотовый актив, но требуется увеличить размер позиции или открыть заёмную короткую позицию.",
    liveGroup: "MARGIN",
    status: "live",
    icon: Percent,
  },
  {
    id: "CRYPTO_FUTURES",
    zone: "Крипто",
    title: "Крипто · Фьючерсы",
    short: "Контракт на цену криптоактива, long или short.",
    what: "Вы торгуете производным контрактом, а не покупаете сам токен. В Bitget общий контур включает USDT-, USDC- и Coin-margined futures.",
    mechanics: "Для бессрочных контрактов используется funding, чтобы цена контракта не уходила далеко от спота. Доступно плечо и маржинальная ликвидация.",
    leverage: "Да",
    cashflow: "Комиссия + funding для perpetual",
    risk: "Плечо, ликвидация, basis и funding",
    traderUse: "Интрадей, short, хедж и торговля направлением без покупки базового токена.",
    liveGroup: "CRYPTO_FUTURES",
    status: "live",
    icon: ChartCandlestick,
  },
  {
    id: "RTOKEN_SPOT",
    zone: "Акции и RWA",
    title: "Акции · rToken",
    short: "Токенизированная экспозиция на акцию или ETF.",
    what: "Reality-issued rToken связан с ценой американской акции или ETF и торгуется внутри криптовалютной инфраструктуры Bitget.",
    mechanics: "В нашем интерфейсе префикс r отделяется от обычного биржевого тикера: rSPY показывается как R · SPY. Это помогает не путать токен с самой акцией.",
    leverage: "Спот; отдельные режимы могут использовать обеспечение",
    cashflow: "Спотовая комиссия; без perpetual funding",
    risk: "Риск базовой акции + особенности токенизированного продукта",
    traderUse: "Связать движение американских акций и ETF с крипто-средой и 24/7-наблюдением, где продукт доступен.",
    liveGroup: "RTOKEN_SPOT",
    status: "live",
    icon: Landmark,
  },
  {
    id: "STOCK_PERPS",
    zone: "Акции и RWA",
    title: "Акции · Перпетуалы",
    short: "Бессрочный дериватив на цену акции/индекса.",
    what: "Это не владение акцией. Трейдер держит perpetual-контракт, который следует за ценой связанного фондового актива.",
    mechanics: "Есть long/short, плечо и funding. Поэтому акция SPY, rSPY и SPY-perpetual — три разных инструмента с разной механикой риска.",
    leverage: "Да",
    cashflow: "Комиссия + funding",
    risk: "Плечо, ликвидация, отклонение дериватива от базового рынка",
    traderUse: "Торговля американским фондовым движением в деривативном контуре Bitget.",
    liveGroup: "STOCK_PERPS",
    status: "live",
    icon: TrendingUp,
  },
  {
    id: "STOCK_PLUS",
    zone: "Акции и RWA",
    title: "Stock+ · Акции и ETF",
    short: "Брокерский контур американских акций и ETF.",
    what: "Stock+ — отдельный фондовый продукт Bitget через securities partners. Это другой контур, чем rToken и stock perpetuals.",
    mechanics: "Отдельные market-data и account API. Мы подключим этот слой отдельным адаптером, чтобы не выдавать rToken за реальную акцию.",
    leverage: "Зависит от продукта и региона",
    cashflow: "Правила фондового продукта",
    risk: "Рыночный риск акции/ETF и правила доступа региона",
    traderUse: "Фундаментальный фондовый universe, ETF и сопоставление с rToken/perpetual на тот же underlying.",
    status: "separate",
    icon: CandlestickChart,
  },
  {
    id: "OPTIONS",
    zone: "Акции и RWA",
    title: "Опционы США",
    short: "Call/put по страйкам и экспирациям.",
    what: "Опцион — отдельный контракт с underlying, датой экспирации, страйком и типом call/put. Его нельзя сводить к одной строке акции.",
    mechanics: "Карта будет строиться как underlying → экспирация → страйк → call/put, а не как плоский список тикеров.",
    leverage: "Нелинейный риск",
    cashflow: "Премия опциона",
    risk: "Время, волатильность, греческие параметры и ликвидность серии",
    traderUse: "События, хедж, направленные и волатильностные конструкции.",
    status: "separate",
    icon: Layers,
  },
  {
    id: "COMMODITY_PERPS",
    zone: "Деривативы TradFi",
    title: "Товары · Перпетуалы",
    short: "Золото, металлы и товарные контракты в futures-контуре.",
    what: "Bitget помечает часть futures-инструментов как metal или commodity. В скринере мы отделяем их от крипто-фьючерсов.",
    mechanics: "По структуре это дериватив: цена, плечо, funding/OI где они доступны, а не владение физическим товаром.",
    leverage: "Да",
    cashflow: "Комиссия + funding для perpetual",
    risk: "Плечо, ликвидность и разница торговых режимов базового рынка",
    traderUse: "Связь крипто-терминала с золотом, нефтью и макро-движениями.",
    liveGroup: "COMMODITY_PERPS",
    status: "live",
    icon: ArrowLeftRight,
  },
  {
    id: "TRADFI",
    zone: "Деривативы TradFi",
    title: "Forex / индексы / CFD",
    short: "Отдельный TradFi-контур Bitget.",
    what: "FX, индексы и иные TradFi-продукты не входят в универсальные категории текущего публичного v3 market endpoint, поэтому их нельзя честно дорисовать как будто они уже в этой выборке.",
    mechanics: "Подключается отдельным источником с собственными торговыми часами, символами и правилами.",
    leverage: "Зависит от продукта",
    cashflow: "Зависит от контракта",
    risk: "Режим торгов, плечо и спецификация контракта",
    traderUse: "Макро-контекст и межрыночные связки для брифинга.",
    status: "separate",
    icon: BookOpen,
  },
];

const ZONES = ["Крипто", "Акции и RWA", "Деривативы TradFi"] as const;

function compact(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)} млрд`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)} млн`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)} тыс.`;
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function displayTicker(row: BitgetScreenerRow) {
  if (row.isReality) {
    const base = row.baseCoin.toUpperCase();
    return base.startsWith("R") && base.length > 1 ? base.slice(1) : base;
  }
  return row.baseCoin || row.symbol;
}

export function BitgetMarketMap() {
  const [data, setData] = React.useState<BitgetScreenerResponse | null>(null);
  const [selectedId, setSelectedId] = React.useState<NodeId>("CRYPTO_SPOT");

  React.useEffect(() => {
    fetch("/api/bitget/screener", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(String(response.status))))
      .then((payload: BitgetScreenerResponse) => setData(payload))
      .catch(() => setData(null));
  }, []);

  const selected = NODES.find((node) => node.id === selectedId) ?? NODES[0];
  const rows = React.useMemo(() => {
    if (!selected.liveGroup) return [];
    return (data?.rows ?? [])
      .filter((row) => row.marketGroup === selected.liveGroup && row.status.toLowerCase() === "online")
      .slice()
      .sort((a, b) => (b.turnover24h ?? 0) - (a.turnover24h ?? 0));
  }, [data, selected]);

  const count = selected.liveGroup
    ? (data?.rows ?? []).filter((row) => row.marketGroup === selected.liveGroup).length
    : null;
  const Icon = selected.icon;

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div>
          <Link href="/screener/bitget" className="text-[10px] text-cyan-300/80 hover:text-cyan-200">← Вернуться в скринер</Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-100">Карта рынков Bitget</h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
            Не список меню биржи, а схема того, что именно торгуется: сам актив, актив с займом, токенизированная экспозиция или производный контракт.
          </p>
        </div>
        <div className="rounded border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[10px] text-slate-500">
          Голубой маркер — уже подключено к live-скринеру · серый — отдельный API-контур
        </div>
      </header>

      <section className="relative overflow-hidden rounded-lg border border-white/[0.08] bg-slate-950/45 p-4">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.025)_1px,transparent_1px)] bg-[size:28px_28px]" />
        <div className="relative mb-4 flex items-center justify-center">
          <div className="rounded-full border border-cyan-400/25 bg-cyan-400/[0.06] px-5 py-2 text-center shadow-[0_0_60px_rgba(34,211,238,0.08)]">
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
                  const NodeIcon = node.icon;
                  const active = node.id === selectedId;
                  const nodeCount = node.liveGroup
                    ? (data?.rows ?? []).filter((row) => row.marketGroup === node.liveGroup).length
                    : null;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setSelectedId(node.id)}
                      className={`w-full rounded-md border p-3 text-left transition ${active ? "border-cyan-400/35 bg-cyan-400/[0.07]" : "border-white/[0.06] bg-white/[0.018] hover:border-white/[0.12] hover:bg-white/[0.03]"}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 rounded border p-1.5 ${node.status === "live" ? "border-cyan-400/20 text-cyan-300" : "border-white/10 text-slate-500"}`}>
                          <NodeIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[12px] font-medium text-slate-200">{node.title}</span>
                            <span className={`font-mono text-[9px] ${node.status === "live" ? "text-cyan-300/80" : "text-slate-600"}`}>
                              {nodeCount != null ? nodeCount : "отдельно"}
                            </span>
                          </div>
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
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-md border border-cyan-400/20 bg-cyan-400/[0.05] p-2 text-cyan-300"><Icon className="h-5 w-5" /></div>
              <div>
                <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">выбранная секция</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-100">{selected.title}</h2>
                <p className="mt-1 text-xs text-slate-500">{selected.short}</p>
              </div>
            </div>
            {count != null ? <span className="font-mono text-xl text-slate-200">{count}</span> : null}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded border border-white/[0.06] bg-white/[0.015] p-3 md:col-span-2">
              <p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">Что это</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-slate-300">{selected.what}</p>
            </div>
            {[
              ["Механика", selected.mechanics],
              ["Плечо", selected.leverage],
              ["Денежный поток", selected.cashflow],
              ["Главный риск", selected.risk],
            ].map(([label, value]) => (
              <div key={label} className="rounded border border-white/[0.06] bg-white/[0.015] p-3">
                <p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">{label}</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">{value}</p>
              </div>
            ))}
            <div className="rounded border border-cyan-400/10 bg-cyan-400/[0.025] p-3 md:col-span-2">
              <p className="text-[9px] uppercase tracking-[0.14em] text-cyan-300/60">Зачем трейдеру</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-slate-300">{selected.traderUse}</p>
            </div>
          </div>

          {selected.liveGroup ? (
            <Link href={`/screener/bitget?group=${selected.liveGroup}`} className="mt-4 inline-flex rounded border border-cyan-400/20 bg-cyan-400/[0.05] px-3 py-1.5 text-[10px] text-cyan-200 hover:bg-cyan-400/[0.09]">
              Открыть эту секцию в скринере →
            </Link>
          ) : (
            <p className="mt-4 text-[10px] text-slate-600">Этот контур будет подключён отдельным адаптером. Он намеренно не смешан с текущим v3 universe.</p>
          )}
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-slate-950/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">живой срез</p>
              <h3 className="mt-1 text-sm font-semibold text-slate-200">Самые ликвидные в секции</h3>
            </div>
            {selected.status === "live" ? <span className="text-[9px] text-cyan-300/70">LIVE</span> : <span className="text-[9px] text-slate-600">ОТДЕЛЬНЫЙ КОНТУР</span>}
          </div>

          <div className="mt-3 divide-y divide-white/[0.05]">
            {rows.length ? rows.slice(0, 10).map((row, index) => (
              <div key={row.id} className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-2 py-2 text-[10px]">
                <span className="font-mono text-slate-700">{String(index + 1).padStart(2, "0")}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {row.isReality ? <span className="rounded border border-violet-400/20 bg-violet-400/[0.06] px-1 text-[8px] text-violet-300">R</span> : null}
                    <span className="truncate font-mono font-semibold text-slate-200">{displayTicker(row)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[9px] text-slate-600">{row.symbol}</p>
                </div>
                <span className="font-mono tabular-nums text-slate-400">{row.change24hPct == null ? "—" : `${row.change24hPct > 0 ? "+" : ""}${row.change24hPct.toFixed(2)}%`}</span>
                <span className="min-w-[5.5rem] text-right font-mono tabular-nums text-slate-500">${compact(row.turnover24h)}</span>
              </div>
            )) : (
              <div className="py-10 text-center text-[11px] leading-relaxed text-slate-600">
                {selected.status === "live" ? "Ждём live-данные этой секции." : "Здесь появится отдельный каталог после подключения Stock+/Options/TradFi API."}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
