"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ChevronDown, RefreshCw, Search, Star, X } from "lucide-react";

type Row = {
  symbol: string;
  market: string;
  baseCoin: string;
  quoteCoin: string;
  status: string;
  contractType: string | null;
  maxLeverage: number | null;
  launchTime: number | null;
  minOrder: number | null;
  last: number | null;
  change24h: number | null;
  high24h: number | null;
  low24h: number | null;
  range24h: number | null;
  baseVolume: number | null;
  quoteVolume: number | null;
  bid: number | null;
  ask: number | null;
  spreadBps: number | null;
  openInterest: number | null;
  fundingRate: number | null;
  activityScore: number;
};

type Payload = {
  rows: Row[];
  meta: {
    total: number;
    fetchedAt: string;
    durationMs: number;
    markets: Array<{ market: string; count: number; source: string | null; error: string | null }>;
  };
};

type SortKey = "activityScore" | "quoteVolume" | "change24h" | "range24h" | "openInterest" | "fundingRate" | "spreadBps" | "symbol";

const MARKETS = ["ALL", "SPOT", "USDT-FUTURES", "USDC-FUTURES", "COIN-FUTURES"];

function compact(value: number | null, currency = false) {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) < 1 ? 4 : 2,
    ...(currency ? { style: "currency", currency: "USD" } : {}),
  }).format(value);
}

function price(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 1000 ? 2 : value >= 1 ? 4 : 8,
  }).format(value);
}

function signed(value: number | null, suffix = "%") {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}${suffix}`;
}

function marketLabel(market: string) {
  return market === "USDT-FUTURES" ? "USDT Perp" : market === "USDC-FUTURES" ? "USDC Perp" : market === "COIN-FUTURES" ? "Coin-M" : market;
}

function Score({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full bg-[#00e5a8]" style={{ width: `${value}%` }} />
      </div>
      <span className="w-6 text-right font-mono text-xs text-white/80">{value}</span>
    </div>
  );
}

export function BitgetScreener() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [market, setMarket] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("activityScore");
  const [descending, setDescending] = useState(true);
  const [minVolume, setMinVolume] = useState(0);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Row | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/bitget/instruments", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const next = (await response.json()) as Payload;
      setPayload(next);
      setError(null);
      setSelected((current) => current ? next.rows.find((row) => row.symbol === current.symbol && row.market === current.market) ?? current : null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить Bitget API");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const stored = window.localStorage.getItem("bitget-favorites");
    if (stored) setFavorites(new Set(JSON.parse(stored) as string[]));
    void load();
    const interval = window.setInterval(() => void load(true), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toUpperCase();
    const filtered = (payload?.rows ?? []).filter((row) => {
      const key = `${row.market}:${row.symbol}`;
      return (market === "ALL" || row.market === market) &&
        (!normalizedQuery || row.symbol.includes(normalizedQuery) || row.baseCoin.includes(normalizedQuery)) &&
        (row.quoteVolume ?? 0) >= minVolume &&
        (!favoritesOnly || favorites.has(key));
    });
    return filtered.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const comparison = typeof av === "string" || typeof bv === "string"
        ? String(av ?? "").localeCompare(String(bv ?? ""))
        : Number(av ?? Number.NEGATIVE_INFINITY) - Number(bv ?? Number.NEGATIVE_INFINITY);
      return descending ? -comparison : comparison;
    });
  }, [payload, market, query, minVolume, favoritesOnly, favorites, sortKey, descending]);

  const top = useMemo(() => {
    const all = payload?.rows ?? [];
    const futures = all.filter((row) => row.market !== "SPOT");
    return {
      volume: all.reduce((sum, row) => sum + (row.quoteVolume ?? 0), 0),
      positive: all.filter((row) => (row.change24h ?? 0) > 0).length,
      avgFunding: futures.length ? futures.reduce((sum, row) => sum + (row.fundingRate ?? 0), 0) / futures.length : 0,
    };
  }, [payload]);

  function toggleFavorite(row: Row) {
    const key = `${row.market}:${row.symbol}`;
    const next = new Set(favorites);
    if (next.has(key)) next.delete(key); else next.add(key);
    setFavorites(next);
    window.localStorage.setItem("bitget-favorites", JSON.stringify([...next]));
  }

  function sort(key: SortKey) {
    if (sortKey === key) setDescending((value) => !value);
    else { setSortKey(key); setDescending(true); }
  }

  const updated = payload?.meta.fetchedAt ? new Date(payload.meta.fetchedAt).toLocaleTimeString("ru-RU") : "—";

  return (
    <div className="min-h-screen bg-[#07090d] text-[#f5f7fb]">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#07090d]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-4 py-3 lg:px-7">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#00f0b5] text-sm font-black text-[#04110d]">B</div>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">BITGET MARKET SCREENER <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-white/45">MVP</span></div>
              <div className="text-[11px] text-white/38">Все инструменты • публичный API • без торговых ключей</div>
            </div>
          </div>
          <button onClick={() => void load()} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/65 hover:border-white/20 hover:text-white">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {updated}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1800px] px-4 py-5 lg:px-7">
        <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Инструменты", payload?.meta.total ?? 0, "Все доступные рынки"],
            ["Оборот 24ч", compact(top.volume, true), "Сумма по загруженным тикерам"],
            ["Растут", `${top.positive} / ${payload?.meta.total ?? 0}`, "Положительная динамика 24ч"],
            ["Средний funding", signed(top.avgFunding * 100), "По фьючерсным рынкам"],
            ["В выборке", rows.length, `Ответ API ${payload?.meta.durationMs ?? 0} мс`],
          ].map(([label, value, hint]) => (
            <div key={String(label)} className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-white/38">{label}</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
              <div className="mt-1 text-[11px] text-white/30">{hint}</div>
            </div>
          ))}
        </section>

        <section className="mb-3 flex flex-col gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3 xl:flex-row xl:items-center">
          <div className="relative min-w-[260px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="BTC, ETH, SOL..." className="h-10 w-full rounded-lg border border-white/8 bg-black/25 pl-9 pr-3 text-sm outline-none placeholder:text-white/25 focus:border-[#00e5a8]/50" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MARKETS.map((item) => <button key={item} onClick={() => setMarket(item)} className={`rounded-lg px-3 py-2 text-xs ${market === item ? "bg-[#00e5a8] font-semibold text-[#04110d]" : "bg-white/5 text-white/55 hover:bg-white/8"}`}>{item === "ALL" ? "Все" : marketLabel(item)}</button>)}
          </div>
          <select value={minVolume} onChange={(event) => setMinVolume(Number(event.target.value))} className="h-10 rounded-lg border border-white/8 bg-[#0c0f14] px-3 text-xs text-white/65 outline-none">
            <option value={0}>Любой оборот</option><option value={100000}>Оборот &gt; $100K</option><option value={1000000}>Оборот &gt; $1M</option><option value={10000000}>Оборот &gt; $10M</option><option value={100000000}>Оборот &gt; $100M</option>
          </select>
          <button onClick={() => setFavoritesOnly((value) => !value)} className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-xs ${favoritesOnly ? "border-amber-300/40 bg-amber-300/10 text-amber-200" : "border-white/8 text-white/55"}`}><Star size={14} fill={favoritesOnly ? "currentColor" : "none"} /> Избранное</button>
        </section>

        {error && <div className="mb-3 rounded-lg border border-red-400/20 bg-red-400/8 px-4 py-3 text-sm text-red-200">Bitget API: {error}</div>}

        <div className="overflow-hidden rounded-xl border border-white/8 bg-[#0a0d12]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px] border-collapse text-left">
              <thead className="bg-white/[0.035] text-[10px] uppercase tracking-[0.1em] text-white/35">
                <tr>
                  <th className="w-9 px-3 py-3"></th>
                  {[["symbol", "Инструмент"], ["activityScore", "Активность"], ["last", "Цена"], ["change24h", "24ч"], ["range24h", "Range"], ["quoteVolume", "Оборот"], ["spreadBps", "Спред"], ["openInterest", "OI"], ["fundingRate", "Funding"], ["market", "Рынок"]].map(([key, label]) => (
                    <th key={key} className="cursor-pointer whitespace-nowrap px-3 py-3 hover:text-white/70" onClick={() => ["symbol", "activityScore", "change24h", "range24h", "quoteVolume", "spreadBps", "openInterest", "fundingRate"].includes(key) && sort(key as SortKey)}>{label}{sortKey === key ? <ChevronDown size={11} className={`ml-1 inline ${descending ? "" : "rotate-180"}`} /> : null}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.055]">
                {rows.map((row) => {
                  const favorite = favorites.has(`${row.market}:${row.symbol}`);
                  return (
                    <tr key={`${row.market}:${row.symbol}`} onClick={() => setSelected(row)} className="cursor-pointer text-sm hover:bg-white/[0.035]">
                      <td className="px-3 py-3"><button onClick={(event) => { event.stopPropagation(); toggleFavorite(row); }} className={favorite ? "text-amber-300" : "text-white/18 hover:text-white/55"}><Star size={14} fill={favorite ? "currentColor" : "none"} /></button></td>
                      <td className="px-3 py-3"><div className="font-semibold tracking-tight">{row.symbol}</div><div className="text-[10px] text-white/28">{row.baseCoin} / {row.quoteCoin}</div></td>
                      <td className="px-3 py-3"><Score value={row.activityScore} /></td>
                      <td className="px-3 py-3 font-mono text-xs">{price(row.last)}</td>
                      <td className={`px-3 py-3 font-mono text-xs ${(row.change24h ?? 0) > 0 ? "text-[#42e8ad]" : (row.change24h ?? 0) < 0 ? "text-[#ff6b7a]" : "text-white/45"}`}>{signed(row.change24h)}</td>
                      <td className="px-3 py-3 font-mono text-xs text-white/65">{signed(row.range24h)}</td>
                      <td className="px-3 py-3 font-mono text-xs text-white/70">{compact(row.quoteVolume, true)}</td>
                      <td className="px-3 py-3 font-mono text-xs text-white/55">{row.spreadBps === null ? "—" : `${row.spreadBps.toFixed(2)} bp`}</td>
                      <td className="px-3 py-3 font-mono text-xs text-white/55">{compact(row.openInterest)}</td>
                      <td className={`px-3 py-3 font-mono text-xs ${(row.fundingRate ?? 0) > 0 ? "text-amber-200" : "text-cyan-200"}`}>{row.fundingRate === null ? "—" : signed(row.fundingRate * 100)}</td>
                      <td className="px-3 py-3"><span className="rounded-md border border-white/8 bg-white/4 px-2 py-1 text-[10px] text-white/45">{marketLabel(row.market)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loading && rows.length === 0 && <div className="grid h-48 place-items-center text-sm text-white/35">Инструменты не найдены</div>}
          {loading && !payload && <div className="grid h-64 place-items-center"><RefreshCw className="animate-spin text-[#00e5a8]" /></div>}
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-white/28">
          {payload?.meta.markets.map((item) => <span key={item.market} className="rounded border border-white/6 px-2 py-1">{marketLabel(item.market)}: {item.count} · {item.source ?? "error"}{item.error ? ` · ${item.error}` : ""}</span>)}
        </div>
      </main>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <aside className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#0b0e13] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div><div className="text-2xl font-semibold">{selected.symbol}</div><div className="mt-1 text-xs text-white/38">{marketLabel(selected.market)} · {selected.status}</div></div>
              <button onClick={() => setSelected(null)} className="rounded-lg border border-white/8 p-2 text-white/45 hover:text-white"><X size={16} /></button>
            </div>
            <div className="mt-6 rounded-xl border border-[#00e5a8]/15 bg-[#00e5a8]/5 p-4"><div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-[#6df2c7]"><Activity size={14} /> Activity Score</div><div className="mt-2 text-4xl font-semibold">{selected.activityScore}<span className="text-base text-white/25">/100</span></div></div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ["Последняя цена", price(selected.last)], ["Изменение 24ч", signed(selected.change24h)], ["High / Low", `${price(selected.high24h)} / ${price(selected.low24h)}`], ["Диапазон", signed(selected.range24h)], ["Оборот", compact(selected.quoteVolume, true)], ["Объём", compact(selected.baseVolume)], ["Bid / Ask", `${price(selected.bid)} / ${price(selected.ask)}`], ["Спред", selected.spreadBps === null ? "—" : `${selected.spreadBps.toFixed(2)} bp`], ["Open Interest", compact(selected.openInterest)], ["Funding", selected.fundingRate === null ? "—" : signed(selected.fundingRate * 100)], ["Макс. плечо", selected.maxLeverage ? `${selected.maxLeverage}x` : "—"], ["Мин. ордер", compact(selected.minOrder)],
              ].map(([label, value]) => <div key={label} className="rounded-lg border border-white/7 bg-white/[0.025] p-3"><div className="text-[10px] uppercase tracking-[0.1em] text-white/30">{label}</div><div className="mt-1 font-mono text-sm text-white/80">{value}</div></div>)}
            </div>
            <div className="mt-4 rounded-lg border border-white/7 p-3 text-xs leading-5 text-white/38">Activity Score — первичный рейтинг внимания. Он учитывает оборот, абсолютное движение, диапазон и спред. Это не торговый сигнал.</div>
          </aside>
        </div>
      )}
    </div>
  );
}
