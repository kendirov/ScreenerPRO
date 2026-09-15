"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, Expand, Pause, Play, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MarketCandle } from "./market-chart";
import type { ExternalMarketResponse } from "@/lib/preparation/preparation-types";
import { buildFuturesFamilies } from "@/lib/domain/futures-family";
import {
  explainAnomaly,
  qualityFromTimestamp,
  type MarketQuality,
} from "@/lib/domain/preparation-market";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import { buildStockScreenerUniverse } from "@/lib/screener/stock-universe-filter";

const MarketChart = dynamic(
  () => import("./market-chart").then((m) => m.MarketChart),
  { ssr: false },
);
type TF = "1D" | "5D" | "1M";
type View = "cards" | "table";
type Sort = "anomaly" | "1d" | "5d" | "name";
type Q = {
  id: string;
  name: string;
  symbol: string;
  group: string;
  price: number | null;
  change: number | null;
  change5: number | null;
  range: number | null;
  source: string;
  asOf: string;
  quality: MarketQuality;
  points: number[];
  reasons: string[];
  priority: number;
  anchor: boolean;
  previousClose: number | null;
  high: number | null;
  low: number | null;
};

const GROUPS: Array<[string, string, string]> = [
  ["indices", "Мировые индексы", "INDEX"],
  ["fx", "Валюты", "FX"],
  ["energy", "Энергия", "COMMODITIES"],
  ["metals", "Металлы", "COMMODITIES"],
  ["soft", "Агро и сырьё", "COMMODITIES"],
  ["russia-fx", "Российские валюты", "RUSSIA"],
  ["russia-index", "Российские индексы", "RUSSIA"],
  ["stocks", "Акции в игре", "STOCKS"],
  ["futures", "Фьючерсы в игре", "FUTURES"],
];
const FILTERS = [
  ["ALL", "Все"],
  ["INDEX", "Мировые индексы"],
  ["FX", "Валюты"],
  ["COMMODITIES", "Товары"],
  ["RUSSIA", "Россия"],
  ["STOCKS", "Акции"],
  ["FUTURES", "Фьючерсы"],
] as const;
const nf = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const pct = (value: number | null) =>
  value == null
    ? "—"
    : `${value > 0 ? "+" : ""}${value.toFixed(2).replace(".", ",")}%`;
const searchText = (q: Q) => `${q.name} ${q.symbol}`.toLocaleLowerCase("ru");

async function get<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
function historyUrl(q: Q, tf: TF) {
  if (!q.id.includes(":"))
    return `/api/preparation/history?id=${encodeURIComponent(q.id)}&timeframe=${tf}`;
  if (q.id.startsWith("stock:"))
    return `/api/screener/stocks/candles?view=chart&secid=${q.symbol}&period=${tf.toLowerCase()}&interval=${tf === "1D" ? 5 : tf === "5D" ? 15 : 60}&limit=700`;
  if (q.id.startsWith("future:"))
    return `/api/trading/futures/candles?secid=${q.symbol}&interval=${tf === "1M" ? 24 : tf === "5D" ? 30 : 5}`;
  return "";
}
async function loadHistory(q: Q, tf: TF) {
  const url = historyUrl(q, tf);
  if (!url) return [];
  const body = await get<{
    candles?: MarketCandle[];
    series?: { candles: MarketCandle[] };
  }>(url);
  return body.candles ?? body.series?.candles ?? [];
}
function useHistory(q: Q | undefined, tf: TF) {
  return useQuery({
    queryKey: ["prep-history", q?.id, tf],
    enabled: !!q,
    staleTime: 120_000,
    retry: 1,
    queryFn: () => (q ? loadHistory(q, tf) : []),
  });
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2)
    return <span className="tp-spark tp-spark--empty">история недоступна</span>;
  const min = Math.min(...values),
    max = Math.max(...values),
    d = max - min || 1;
  const points = values
    .map(
      (x, i) =>
        `${(i / (values.length - 1)) * 100},${28 - ((x - min) / d) * 24}`,
    )
    .join(" ");
  return (
    <svg
      className="tp-spark"
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      aria-label="Динамика за 5 дней"
    >
      <polyline points={points} />
    </svg>
  );
}
function Status({ value }: { value: MarketQuality }) {
  const label: Record<MarketQuality, string> = {
    LIVE: "live",
    DELAYED: "задержка",
    CLOSED: "закрыт",
    STALE: "устарело",
    FALLBACK: "резерв",
    ERROR: "ошибка",
    PROXY: "proxy",
    UNKNOWN: "нет статуса",
  };
  return (
    <span
      className={`tp-quality tp-quality--${value.toLowerCase()}`}
      title={`Статус данных: ${label[value]}`}
    >
      {label[value]}
    </span>
  );
}
function Sessions({ status }: { status?: string | null }) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Moscow",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
  const market = (from: number, until: number) =>
    hour >= from && hour < until ? "●" : hour === from - 1 ? "скоро" : "○";
  return (
    <div className="tp-sessions" aria-label="Сессии по московскому времени">
      <span>
        АЗИЯ <b>{market(3, 12)}</b>
      </span>
      <span>
        ЕВРОПА <b>{market(10, 19)}</b>
      </span>
      <span>
        МОСКВА <b>{status?.toLowerCase() === "open" ? "●" : "○"}</b>
      </span>
      <span>
        США <b>{market(16, 24)}</b>
      </span>
      <i style={{ left: `${(hour / 24) * 100}%` }} />
    </div>
  );
}
function Controls({
  tf,
  setTf,
  mode,
  setMode,
}: {
  tf: TF;
  setTf: (v: TF) => void;
  mode: "line" | "candles";
  setMode: (v: "line" | "candles") => void;
}) {
  return (
    <div className="tp-chart-controls">
      <div>
        {(["1D", "5D", "1M"] as TF[]).map((item) => (
          <button
            className={tf === item ? "is-active" : undefined}
            onClick={() => setTf(item)}
            key={item}
          >
            {item}
          </button>
        ))}
      </div>
      <div>
        <button
          className={mode === "line" ? "is-active" : undefined}
          onClick={() => setMode("line")}
        >
          Линия
        </button>
        <button
          className={mode === "candles" ? "is-active" : undefined}
          onClick={() => setMode("candles")}
        >
          Свечи
        </button>
      </div>
    </div>
  );
}
function PulseQuote({ q, onOpen }: { q: Q; onOpen: () => void }) {
  return (
    <button
      className="tp-pulse-quote"
      onClick={onOpen}
      title={`Открыть ${q.name}`}
    >
      <div>
        <b>{q.symbol}</b>
        <span>{q.name}</span>
      </div>
      <Spark values={q.points} />
      <strong>{q.price == null ? "—" : nf.format(q.price)}</strong>
      <em className={(q.change ?? 0) >= 0 ? "is-up" : "is-down"}>
        {pct(q.change)}
      </em>
      <Status value={q.quality} />
    </button>
  );
}
function MiniPanel({ q, onOpen }: { q: Q; onOpen: () => void }) {
  const history = useHistory(q, "5D");
  return (
    <button
      className={`tp-mini-panel ${(q.change ?? 0) < -3 || (q.change ?? 0) > 3 ? "is-anomaly" : ""}`}
      onClick={onOpen}
    >
      <header>
        <span>
          <b>{q.symbol}</b>
          <small>{q.name}</small>
        </span>
        <em className={(q.change ?? 0) >= 0 ? "is-up" : "is-down"}>
          {pct(q.change)}
        </em>
      </header>
      <div className="tp-mini-panel__chart">
        <MarketChart
          candles={history.data ?? []}
          mode="line"
          reference={q.previousClose}
          loading={history.isLoading}
          status="История недоступна"
        />
      </div>
      <footer>
        <strong>{q.price == null ? "—" : nf.format(q.price)}</strong>
        <span>5Д {pct(q.change5)}</span>
        <Status value={q.quality} />
      </footer>
    </button>
  );
}
function FocusRow({ q, onOpen }: { q: Q; onOpen: () => void }) {
  return (
    <button className="tp-focus-row" onClick={onOpen}>
      <span>
        <b>{q.symbol}</b>
        <small>{q.name}</small>
      </span>
      <Spark values={q.points} />
      <em className={(q.change ?? 0) >= 0 ? "is-up" : "is-down"}>
        {pct(q.change)}
      </em>
      <i>{q.reasons[0] ?? "Движение требует внимания"}</i>
    </button>
  );
}
function ComparisonPanel({
  title,
  kicker,
  items,
  onOpen,
}: {
  title: string;
  kicker: string;
  items: Q[];
  onOpen: (q: Q) => void;
}) {
  const results = useQueries({
    queries: items.map((q) => ({
      queryKey: ["prep-history", q.id, "5D"],
      queryFn: () => loadHistory(q, "5D"),
      staleTime: 120_000,
      retry: 1,
    })),
  });
  const series = useMemo(
    () =>
      items.map((q, i) => ({
        label: q.symbol,
        candles: results[i]?.data ?? [],
        color: ["#d9a441", "#62bd86", "#8ca8d8", "#d97171"][i] ?? "#969a98",
      })),
    [items, results],
  );
  const primary = series[0];
  return (
    <section className="tp-comparison-panel">
      <header>
        <div>
          <span className="tr-label">{kicker}</span>
          <h2>{title}</h2>
        </div>
        <div className="tp-legend">
          {items.map((q, i) => (
            <button key={q.id} onClick={() => onOpen(q)}>
              <i style={{ background: series[i]?.color }} />
              {q.symbol}{" "}
              <b className={(q.change ?? 0) >= 0 ? "is-up" : "is-down"}>
                {pct(q.change)}
              </b>
            </button>
          ))}
        </div>
      </header>
      <div className="tp-comparison-chart">
        <MarketChart
          candles={primary?.candles ?? []}
          comparisons={series.slice(1)}
          mode="line"
          reference={null}
          loading={results.some((r) => r.isLoading)}
          status="История временно недоступна"
        />
      </div>
      <footer>Нормализовано от начала периода · 5Д</footer>
    </section>
  );
}

export function TradingPreparation() {
  const root = useRef<HTMLDivElement>(null);
  const explorerScrollRef = useRef<HTMLDivElement>(null);
  const market = useScreenerQuery("all");
  const external = useQuery({
    queryKey: ["preparation-external"],
    queryFn: () => get<ExternalMarketResponse>("/api/preparation/external"),
    staleTime: 240_000,
    refetchInterval: 300_000,
    retry: 1,
  });
  const [frozen, setFrozen] = useState(false),
    [snapshot, setSnapshot] = useState<Q[] | null>(null),
    [frozenAt, setFrozenAt] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("ALL"),
    [sort, setSort] = useState<Sort>("anomaly"),
    [view, setView] = useState<View>("cards"),
    [detailId, setDetailId] = useState<string>(),
    [tf, setTf] = useState<TF>("5D"),
    [mode, setMode] = useState<"line" | "candles">("candles"),
    [presenter, setPresenter] = useState(false),
    [slide, setSlide] = useState(0),
    [clock, setClock] = useState("");
  const live = useMemo(() => {
    const globals: Q[] = (external.data?.quotes ?? []).map((quote) => {
      const anomaly = explainAnomaly({
        change1dPct: quote.change1dPct,
        change5dPct: quote.change5dPct,
        volatility: quote.volatility5d,
        rangePct: quote.range5dPct,
      });
      return {
        id: quote.id,
        name: quote.name,
        symbol: quote.symbol,
        group: quote.group,
        price: quote.last,
        change: quote.change1dPct,
        change5: quote.change5dPct,
        range: quote.range5dPct,
        source: "Yahoo Finance",
        asOf: quote.updatedAt,
        quality: qualityFromTimestamp(quote.updatedAt, false),
        points: quote.series5d.map((point) => point.value),
        reasons: anomaly.reasons,
        priority: anomaly.priority,
        anchor: ["sp500", "nasdaq100", "dxy", "brent", "gold"].includes(
          quote.id,
        ),
        previousClose: quote.series5d.at(-2)?.value ?? null,
        high: quote.series5d.at(-1)?.high ?? null,
        low: quote.series5d.at(-1)?.low ?? null,
      };
    });
    const rows = market.data?.rows ?? [];
    const stocks = buildStockScreenerUniverse(rows)
      .stockRows.map((row) => {
        const anomaly = explainAnomaly({
          change1dPct: row.percentChange,
          rangePct: row.metrics.dayRangePct,
          relativeTurnover: row.metrics.volumeRatioNow,
          relativeTrades: row.metrics.tradesRatioNow,
        });
        return {
          id: `stock:${row.ticker}`,
          name: row.shortName,
          symbol: row.ticker,
          group: "stocks",
          price: row.lastPrice,
          change: row.percentChange,
          change5: null,
          range: row.metrics.dayRangePct,
          source: "MOEX ISS",
          asOf: row.sourceUpdatedAt ?? row.updatedAt,
          quality: market.data?.status.isDemo
            ? "FALLBACK"
            : qualityFromTimestamp(
                row.sourceUpdatedAt ?? row.updatedAt,
                row.tradingStatus === "open",
              ),
          points: [],
          reasons: anomaly.reasons,
          priority: anomaly.priority,
          anchor: false,
          previousClose: row.previousClose,
          high: row.high,
          low: row.low,
        } as Q;
      })
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 60);
    const indices = (market.data?.benchmarks ?? []).map((row) => {
      const anomaly = explainAnomaly({
        change1dPct: row.percentChange,
        rangePct: row.dayRangePct,
      });
      return {
        id: `index:${row.code}`,
        name: row.name,
        symbol: row.code,
        group: "russia-index",
        price: row.lastValue,
        change: row.percentChange,
        change5: null,
        range: row.dayRangePct,
        source: "MOEX ISS",
        asOf: row.sourceUpdatedAt ?? row.updatedAt,
        quality: qualityFromTimestamp(
          row.sourceUpdatedAt ?? row.updatedAt,
          market.data?.status.marketStatus === "open",
        ),
        points: [],
        reasons: anomaly.reasons,
        priority: anomaly.priority,
        anchor: /IMOEX2?|RTS/i.test(row.code),
        previousClose: null,
        high: null,
        low: null,
      } as Q;
    });
    const futures = buildFuturesFamilies(
      rows.filter((row) => row.assetClass === "future"),
    ).map((family) => {
      const contract = family.contracts.find(
          (item) => item.ticker === family.activeContractTicker,
        ),
        anomaly = explainAnomaly({
          change1dPct: family.activePercentChange,
          rangePct: family.activeRangePct,
          rollRatio: family.rollRatio,
          dte: contract?.dte,
        });
      return {
        id: `future:${family.familyKey}`,
        name: family.familyLabel,
        symbol: family.activeContractTicker,
        group: family.segment === "Валюта" ? "russia-fx" : "futures",
        price: family.activePrice,
        change: family.activePercentChange,
        change5: null,
        range: family.activeRangePct,
        source: "MOEX ISS",
        asOf:
          market.data?.status.sourceTimestamp ??
          market.data?.status.generatedAt ??
          new Date().toISOString(),
        quality: market.data?.status.isDemo
          ? "FALLBACK"
          : qualityFromTimestamp(
              market.data?.status.sourceTimestamp ?? "",
              market.data?.status.marketStatus === "open",
            ),
        points: [],
        reasons: anomaly.reasons,
        priority: anomaly.priority + (family.rollStatus === "Активный" ? 2 : 0),
        anchor: ["usd_rub", "cny_rub", "imoex", "brent"].includes(
          family.familyKey,
        ),
        previousClose: null,
        high: null,
        low: null,
      } as Q;
    });
    return [...globals, ...indices, ...futures, ...stocks];
  }, [external.data, market.data]);
  const shown = frozen && snapshot ? snapshot : live;
  const find = useCallback(
    (...ids: string[]) =>
      ids
        .map((id) => shown.find((item) => item.id === id))
        .filter(Boolean) as Q[],
    [shown],
  );
  const world = find("sp500", "nasdaq100", "dax", "nikkei225");
  const energy = find("brent", "wti", "natgas");
  const currencies = find("dxy", "eurusd", "usdjpy");
  const russian = [
    ...find("index:IMOEX2", "index:IMOEX"),
    ...shown
      .filter((item) => item.group === "russia-fx" && item.price != null)
      .slice(0, 2),
  ];
  const focus = shown
    .filter(
      (item) =>
        item.price != null &&
        item.points.length >= 5 &&
        item.quality !== "ERROR" &&
        item.reasons.length > 0 &&
        item.priority >= 2.5 &&
        ["indices", "energy", "metals", "fx", "stocks"].includes(item.group),
    )
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
  const pulse = [
    ...find("sp500", "nasdaq100", "dxy", "brent", "gold"),
    ...russian.slice(0, 2),
  ].slice(0, 8);
  const stocks = shown.filter((item) => item.group === "stocks");
  const rising = stocks.filter((item) => (item.change ?? 0) > 0).length,
    falling = stocks.filter((item) => (item.change ?? 0) < 0).length;
  const selected = shown.find((item) => item.id === detailId);
  const detailHistory = useHistory(selected, tf);
  const needle = query.toLocaleLowerCase("ru");
  const items = GROUPS.filter(
    ([, , group]) => filter === "ALL" || group === filter,
  )
    .flatMap(([id, title]) =>
      shown.filter((item) => item.group === id).map((q) => ({ q, title })),
    )
    .filter(({ q }) => !needle || searchText(q).includes(needle))
    .sort((a, b) =>
      sort === "name"
        ? a.q.name.localeCompare(b.q.name, "ru")
        : sort === "1d"
          ? Math.abs(b.q.change ?? 0) - Math.abs(a.q.change ?? 0)
          : sort === "5d"
            ? Math.abs(b.q.change5 ?? 0) - Math.abs(a.q.change5 ?? 0)
            : b.q.priority - a.q.priority,
    );
  const explorerVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => explorerScrollRef.current,
    estimateSize: () => 44,
    overscan: 10,
  });
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!presenter) return;
      if (event.key === "ArrowRight") setSlide((value) => Math.min(2, value + 1));
      if (event.key === "ArrowLeft") setSlide((value) => Math.max(0, value - 1));
      if (["1", "2", "3"].includes(event.key)) setSlide(Number(event.key) - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenter]);
  const freeze = useCallback(() => {
    if (frozen) {
      setFrozen(false);
      setSnapshot(null);
    } else {
      setSnapshot(live);
      setFrozenAt(
        new Date().toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      setFrozen(true);
    }
  }, [frozen, live]);
  const open = (q: Q) => {
    setDetailId(q.id);
    setTf("5D");
  };
  return (
    <div className={`tp-page ${presenter ? "tp-page--presenter" : ""}`} ref={root} data-testid="preparation-root">
      {presenter ? <section className="tp-presenter" data-testid="preparation-presenter">
        <header><span>PREPARATION PRESENTER · {String(slide + 1).padStart(2, "0")} / 03</span><button onClick={() => setPresenter(false)}>Выйти</button></header>
        <div className="tp-presenter__body">
          {slide === 0 ? <><ComparisonPanel title="Market Overview" kicker="GLOBAL CONTEXT · NORMALIZED 5D" items={world} onOpen={open}/><section className="tp-presenter__rail"><h2>What matters now</h2>{focus.slice(0,4).map((q)=><FocusRow key={q.id} q={q} onOpen={()=>open(q)}/>)}</section></> : null}
          {slide === 1 ? <><section className="tp-presenter__russia"><span className="tr-label">MOEX ISS · RUSSIA / MONEY</span><h1>{russian[0]?.symbol ?? "MOEX"}</h1><p>Ширина: ↑ {rising} / ↓ {falling}. Видимый оборот и активность — без утверждений о потоках капитала.</p><div className="tp-mini-grid">{russian.slice(0,4).map((q)=><MiniPanel key={q.id} q={q} onOpen={()=>open(q)}/>)}</div></section><section className="tp-presenter__rail"><h2>Где активность</h2>{stocks.slice(0,5).map((q)=><FocusRow key={q.id} q={q} onOpen={()=>open(q)}/>)}</section></> : null}
          {slide === 2 ? <><section className="tp-presenter__russia"><span className="tr-label">MOEX ISS · FUTURES / ROLL</span><h1>Futures & Roll</h1><p>Текущий контракт, DTE и наблюдаемая миграция OI/объёма — только когда доступны в payload.</p><div className="tp-mini-grid">{shown.filter((q)=>q.group === "futures").slice(0,4).map((q)=><MiniPanel key={q.id} q={q} onOpen={()=>open(q)}/>)}</div></section><section className="tp-presenter__rail"><h2>Фактические сигналы</h2>{shown.filter((q)=>q.group === "futures").slice(0,5).map((q)=><FocusRow key={q.id} q={q} onOpen={()=>open(q)}/>)}</section></> : null}
        </div><footer><button onClick={()=>setSlide(Math.max(0,slide-1))} aria-label="Предыдущий слайд"><ChevronLeft/></button><span>{[1,2,3].map((i)=><i key={i} className={slide === i-1 ? "is-active" : ""}/>)}</span><button onClick={()=>setSlide(Math.min(2,slide+1))} aria-label="Следующий слайд"><ChevronRight/></button></footer>
      </section> : <>
      <section className="tp-stage" data-testid="briefing-deck">
        <header className="tp-stage__head">
          <div>
            <span className="tr-label">GLOBAL MARKET COCKPIT</span>
            <h1>Подготовка к торгам</h1>
            <p>
              {external.data?.summary.line ?? "Собираем рыночный контекст…"}
            </p>
          </div>
          <div className="tp-actions">
            <span className="tp-provider-state" data-testid="provider-state">{frozen ? `FROZEN · ${frozenAt} МСК` : `MOEX ${market.data?.status.isDemo ? "FALLBACK" : market.data?.status.marketStatus === "open" ? "LIVE" : "CLOSED"} · GLOBAL ${external.isLoading ? "LOADING" : external.isError ? "UNAVAILABLE" : "DELAYED"}`}</span>
            <span>{frozen ? "снимок сохранён" : `${clock} МСК`}</span>
            <button onClick={freeze}>
              {frozen ? <Play size={14} /> : <Pause size={14} />}{" "}
              {frozen ? "Вернуть live" : "Зафиксировать"}
            </button>
            <button onClick={() => setPresenter(true)}>
              <Expand size={14} /> В эфир
            </button>
          </div>
        </header>
        <Sessions status={market.data?.status.marketStatus} />
        <div className="tp-pulse">
          <div className="tp-pulse__label">
            <b>Пульс рынка</b>
            <span>главные ориентиры</span>
          </div>
          {pulse.map((q) => (
            <PulseQuote key={q.id} q={q} onOpen={() => open(q)} />
          ))}
        </div>
        <div className="tp-cockpit-grid" data-testid="briefing-main">
          <ComparisonPanel
            title="Мировой рынок"
            kicker="США · ЕВРОПА · АЗИЯ"
            items={world}
            onOpen={open}
          />
          <ComparisonPanel
            title="Нефть, сырьё и FX"
            kicker="ЭНЕРГИЯ · ВАЛЮТЫ"
            items={[...energy, ...currencies]}
            onOpen={open}
          />
          <section className="tp-russia-panel">
            <header>
              <div>
                <span className="tr-label">MOEX ISS</span>
                <h2>Российский рынок</h2>
              </div>
              <span className="tp-breadth">
                <b className="is-up">↑ {rising}</b>
                <b className="is-down">↓ {falling}</b>
                <small>акций в игре</small>
              </span>
            </header>
            <div className="tp-mini-grid">
              {russian.slice(0, 4).map((q) => (
                <MiniPanel q={q} onOpen={() => open(q)} key={q.id} />
              ))}
            </div>
            <div className="tp-sector-strip">
              <span>Нефть и газ</span>
              <i />
              <span>Финансы</span>
              <i />
              <span>Металлы</span>
              <i />
              <span>IT</span>
              <i />
            </div>
          </section>
          <section className="tp-focus-panel">
            <header>
              <div>
                <span className="tr-label">ПОЧЕМУ СЕЙЧАС</span>
                <h2>Сегодня в фокусе</h2>
              </div>
              <small>
                {focus.length
                  ? "аномалии и активность"
                  : "ждём подтверждённые сигналы"}
              </small>
            </header>
            <div>
              {focus.length ? (
                focus.map((q) => (
                  <FocusRow q={q} onOpen={() => open(q)} key={q.id} />
                ))
              ) : (
                <p className="tp-empty">
                  Новых аномалий пока нет. Рынок остаётся на радаре.
                </p>
              )}
            </div>
          </section>
        </div>
        <footer className="tp-stage__footer" data-testid="briefing-footer">
          <span>
            <b>asOf / source</b> · MOEX ISS для России · Yahoo Finance для мировых рынков · частичный provider не маскируется
          </span>
        </footer>
      </section>
      <section className="tp-map" data-testid="market-explorer">
        <header>
          <div>
            <span className="tr-label">КАРТА РЫНКА</span>
            <h2>Исследование инструментов</h2>
          </div>
          <div className="tp-market-tools">
            <label>
              <Search size={15} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Найти инструмент…"
              />
            </label>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
              aria-label="Сортировка"
            >
              <option value="anomaly">По аномалии</option>
              <option value="1d">По движению за 1Д</option>
              <option value="5d">По движению за 5Д</option>
              <option value="name">По имени</option>
            </select>
            <div className="tp-view-switch">
              <button
                className={view === "cards" ? "is-active" : undefined}
                onClick={() => setView("cards")}
              >
                Карточки
              </button>
              <button
                className={view === "table" ? "is-active" : undefined}
                onClick={() => setView("table")}
              >
                Таблица
              </button>
            </div>
          </div>
        </header>
        <nav className="tp-filters">
          {FILTERS.map(([id, label]) => (
            <button
              className={filter === id ? "is-active" : undefined}
              onClick={() => setFilter(id)}
              key={id}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="tp-table-wrap" ref={explorerScrollRef} data-testid="market-explorer-viewport">
            <table className="tp-table">
              <thead>
                <tr>
                  <th>Инструмент</th>
                  <th>Цена</th>
                  <th>1Д</th>
                  <th>5Д</th>
                  <th>График</th>
                  <th>Почему в фокусе</th>
                </tr>
              </thead>
              <tbody style={{height: explorerVirtualizer.getTotalSize(), position:"relative", display:"block"}}>
                {explorerVirtualizer.getVirtualItems().map((virtualRow) => { const {q, title} = items[virtualRow.index]; return <tr
                    key={q.id}
                    style={{position:"absolute", transform:`translateY(${virtualRow.start}px)`, width:"100%", display:"table", tableLayout:"fixed"}}
                    tabIndex={0}
                    onClick={() => open(q)}
                    onKeyDown={(event) => event.key === "Enter" && open(q)}
                  >
                    <td>
                      <b>{q.symbol}</b>
                      <span>
                        {q.name} · {title}
                      </span>
                    </td>
                    <td>{q.price == null ? "—" : nf.format(q.price)}</td>
                    <td className={(q.change ?? 0) >= 0 ? "is-up" : "is-down"}>
                      {pct(q.change)}
                    </td>
                    <td>{pct(q.change5)}</td>
                    <td>
                      <Spark values={q.points} />
                    </td>
                    <td>{q.reasons[0] ?? "Без активного сигнала"}</td>
                  </tr>})}
              </tbody>
            </table>
          </div>
      </section>
      {selected ? (
        <div
          className="tp-drawer-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setDetailId(undefined)
          }
        >
          <aside
            className="tp-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`Инструмент ${selected.name}`}
          >
            <button
              className="tp-drawer__close"
              onClick={() => setDetailId(undefined)}
              aria-label="Закрыть"
            >
              <X />
            </button>
            <span className="tr-label">ИНСТРУМЕНТ · {selected.group}</span>
            <div className="tp-drawer__title">
              <div>
                <h2>{selected.name}</h2>
                <span>{selected.symbol}</span>
              </div>
              <div>
                <strong>
                  {selected.price == null ? "—" : nf.format(selected.price)}
                </strong>
                <em
                  className={(selected.change ?? 0) >= 0 ? "is-up" : "is-down"}
                >
                  {pct(selected.change)}
                </em>
              </div>
            </div>
            <Controls tf={tf} setTf={setTf} mode={mode} setMode={setMode} />
            <div className="tp-detail-chart">
              <MarketChart
                candles={detailHistory.data ?? []}
                mode={mode}
                reference={selected.previousClose}
                loading={detailHistory.isLoading}
                status="История недоступна"
              />
            </div>
            <div className="tp-detail-stats">
              <span>
                Максимум
                <b>{selected.high == null ? "—" : nf.format(selected.high)}</b>
              </span>
              <span>
                Минимум
                <b>{selected.low == null ? "—" : nf.format(selected.low)}</b>
              </span>
              <span>
                Диапазон<b>{pct(selected.range)}</b>
              </span>
              <span>
                5Д<b>{pct(selected.change5)}</b>
              </span>
            </div>
            <div className="tp-why">
              <b>Почему в фокусе</b>
              {selected.reasons.length ? (
                selected.reasons.map((reason) => (
                  <span key={reason}>{reason}</span>
                ))
              ) : (
                <span>Нет активного аномального сигнала</span>
              )}
            </div>
            <footer>
              <Status value={selected.quality} />
              <p>
                {selected.source} · обновлено{" "}
                {new Date(selected.asOf).toLocaleString("ru-RU", {
                  timeZone: "Europe/Moscow",
                })}{" "}
                МСК
              </p>
            </footer>
          </aside>
        </div>
      ) : null}</>}
    </div>
  );
}
