"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Clipboard, ExternalLink, Map as MapIcon, RefreshCw, Search, Star } from "lucide-react";
import { TradingViewChart } from "@/components/bitget/tradingview-chart";
import type { BitgetMarketGroup, BitgetScreenerResponse, BitgetScreenerRow } from "@/lib/bitget/types";

const LABELS: Record<BitgetMarketGroup, string> = {
  CRYPTO_SPOT: "Крипто · спот",
  CRYPTO_FUTURES: "Крипто · фьючерс",
  MARGIN: "Маржинальный спот",
  RTOKEN_SPOT: "Акции · rToken",
  STOCK_PERPS: "Акции · перпетуал",
  COMMODITY_PERPS: "Товары · перпетуал",
};

const GROUPS: Array<{ id: BitgetMarketGroup | "ALL"; label: string }> = [
  { id: "ALL", label: "Все" },
  { id: "CRYPTO_SPOT", label: "Крипто spot" },
  { id: "CRYPTO_FUTURES", label: "Крипто futures" },
  { id: "MARGIN", label: "Margin" },
  { id: "RTOKEN_SPOT", label: "rToken" },
  { id: "STOCK_PERPS", label: "Stock perps" },
  { id: "COMMODITY_PERPS", label: "Товары" },
];

const QUICK = [
  ["all", "Все"],
  ["focus", "В фокусе"],
  ["gainers", "Рост"],
  ["losers", "Падение"],
  ["range", "Широкий ход"],
  ["funding", "Funding"],
] as const;

type SortKey = "attentionScore" | "change24hPct" | "range24hPct" | "turnover24h" | "spreadBps" | "fundingRatePct";
type SortDir = "asc" | "desc";

function price(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const digits = value >= 1000 ? 2 : value >= 1 ? 4 : 7;
  return value.toLocaleString("ru-RU", { maximumFractionDigits: digits });
}

function pct(value: number | null, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function compact(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(2)} трлн`;
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)} млрд`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)} млн`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)} тыс.`;
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function turnover(row: BitgetScreenerRow) {
  if (row.turnover24h == null) return "—";
  const quote = row.quoteCoin.toUpperCase();
  return ["USD", "USDT", "USDC"].includes(quote) ? `$${compact(row.turnover24h)}` : `${compact(row.turnover24h)} ${quote}`;
}

function spread(row: BitgetScreenerRow) {
  return row.spreadBps == null ? "—" : `${(row.spreadBps / 100).toFixed(row.spreadBps < 10 ? 3 : 2)}%`;
}

function tone(value: number | null) {
  if (value == null || value === 0) return "text-slate-500";
  return value > 0 ? "text-emerald-300" : "text-rose-300";
}

function displayTicker(row: BitgetScreenerRow) {
  const base = (row.baseCoin || row.symbol).toUpperCase();
  return row.isReality && base.startsWith("R") && base.length > 1 ? base.slice(1) : base;
}

function tvCopy(row: BitgetScreenerRow) {
  if (row.marketGroup === "RTOKEN_SPOT" || row.marketGroup === "STOCK_PERPS") return displayTicker(row);
  if (row.marketGroup === "CRYPTO_FUTURES" || row.marketGroup === "COMMODITY_PERPS") return `${row.symbol}.P`;
  return row.symbol;
}

function tvWidget(row: BitgetScreenerRow) {
  if (row.marketGroup === "RTOKEN_SPOT" || row.marketGroup === "STOCK_PERPS") return displayTicker(row);
  if (row.marketGroup === "CRYPTO_FUTURES" || row.marketGroup === "COMMODITY_PERPS") return `BITGET:${row.symbol}.P`;
  return `BITGET:${row.symbol}`;
}

function metric(row: BitgetScreenerRow, key: SortKey): number | null {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function compareRows(a: BitgetScreenerRow, b: BitgetScreenerRow, key: SortKey, dir: SortDir) {
  const av = metric(a, key);
  const bv = metric(b, key);
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  return dir === "desc" ? bv - av : av - bv;
}

function SortHead({ label, column, sort, onSort, title }: { label: string; column: SortKey; sort: { key: SortKey; dir: SortDir }; onSort: (key: SortKey) => void; title?: string }) {
  const active = sort.key === column;
  return (
    <button type="button" onClick={() => onSort(column)} title={title} className={`inline-flex items-center gap-1 ${active ? "text-slate-200" : "text-slate-600 hover:text-slate-300"}`}>
      {label}{active ? (sort.dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : null}
    </button>
  );
}

function MarketBadge({ row }: { row: BitgetScreenerRow }) {
  return <span className="rounded border border-white/[0.07] bg-white/[0.02] px-1.5 py-0.5 text-[9px] text-slate-400">{LABELS[row.marketGroup]}</span>;
}

function ExpandedRow({ row, week, favorite, note, onFavorite, onNote, onCopy }: { row: BitgetScreenerRow; week: number | null | undefined; favorite: boolean; note: string; onFavorite: () => void; onNote: (value: string) => void; onCopy: () => void }) {
  const symbol = tvWidget(row);
  const tvUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
  const details = [
    ["Биржевой символ", row.symbol],
    ["Bid / Ask", `${price(row.bid)} / ${price(row.ask)}`],
    ["High / Low 24ч", `${price(row.high24h)} / ${price(row.low24h)}`],
    ["Спред", row.spreadBps == null ? "—" : `${spread(row)} · ${row.spreadBps.toFixed(1)} б.п.`],
    ["Open Interest", compact(row.openInterest)],
    ["Funding", pct(row.fundingRatePct, 4)],
    ["Mark / Index", `${price(row.markPrice)} / ${price(row.indexPrice)}`],
    ["Макс. плечо", row.maxLeverage == null ? "—" : `${row.maxLeverage}×`],
  ];

  return (
    <div className="border-y border-cyan-400/15 bg-[#050a18]/85 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">{row.isReality ? <span className="rounded border border-violet-400/20 bg-violet-400/[0.06] px-1.5 py-0.5 text-[9px] text-violet-300">R</span> : null}<span className="font-mono text-lg font-semibold text-slate-100">{displayTicker(row)}</span><MarketBadge row={row} /></div>
        <div className="flex gap-2">
          <button type="button" onClick={onFavorite} className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[9px] ${favorite ? "border-amber-400/25 text-amber-200" : "border-white/[0.08] text-slate-400"}`}><Star className={`h-3 w-3 ${favorite ? "fill-current" : ""}`} /> Избранное</button>
          <button type="button" onClick={onCopy} className="inline-flex items-center gap-1 rounded border border-white/[0.08] px-2 py-1 text-[9px] text-slate-400"><Clipboard className="h-3 w-3" /> Контекст</button>
          <a href={tvUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded border border-cyan-400/20 bg-cyan-400/[0.04] px-2 py-1 text-[9px] text-cyan-200"><ExternalLink className="h-3 w-3" /> TradingView</a>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {[
          ["Цена", price(row.lastPrice), "text-slate-100"], ["24 часа", pct(row.change24hPct), tone(row.change24hPct)], ["7 дней", pct(week ?? null), tone(week ?? null)],
          ["Ход 24ч", pct(row.range24hPct), "text-slate-200"], ["Оборот", turnover(row), "text-slate-200"], ["Спред", spread(row), "text-slate-200"], ["Funding", pct(row.fundingRatePct, 4), row.fundingRatePct == null ? "text-slate-700" : tone(row.fundingRatePct)],
        ].map(([label, value, cls]) => <div key={label} className="rounded border border-white/[0.06] bg-white/[0.018] px-2 py-2"><p className="text-[8px] uppercase tracking-[0.12em] text-slate-600">{label}</p><p className={`mt-1 font-mono text-[10px] tabular-nums ${cls}`}>{value}</p></div>)}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(290px,0.65fr)]">
        <TradingViewChart symbol={symbol} />
        <div className="space-y-3">
          <div className="rounded border border-white/[0.07] bg-white/[0.015] p-3"><p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">Параметры</p><div className="mt-2 divide-y divide-white/[0.05]">{details.map(([label, value]) => <div key={label} className="flex justify-between gap-3 py-1.5 text-[10px]"><span className="text-slate-600">{label}</span><span className="text-right font-mono text-slate-300">{value}</span></div>)}</div></div>
          <div className="rounded border border-white/[0.07] bg-white/[0.015] p-3"><p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">Заметка для брифинга</p><textarea value={note} onChange={(event) => onNote(event.target.value)} placeholder="Уровень, новость, наблюдение, что проверить..." className="mt-2 min-h-24 w-full resize-y rounded border border-white/[0.07] bg-slate-950/60 p-2 text-[11px] text-slate-300 outline-none placeholder:text-slate-700" /><p className="mt-1 text-[9px] text-slate-700">Сохраняется в этом браузере.</p></div>
        </div>
      </div>
    </div>
  );
}

export function BitgetTerminalV3() {
  const [data, setData] = React.useState<BitgetScreenerResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [group, setGroup] = React.useState<BitgetMarketGroup | "ALL">("ALL");
  const [quick, setQuick] = React.useState("focus");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: SortDir }>({ key: "turnover24h", dir: "desc" });
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [favorites, setFavorites] = React.useState<string[]>([]);
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [weeks, setWeeks] = React.useState<Record<string, number | null>>({});
  const [limit, setLimit] = React.useState(120);
  const [autoRefresh, setAutoRefresh] = React.useState(true);
  const requested = React.useRef(new Set<string>());

  const load = React.useCallback(async () => {
    try {
      const response = await fetch("/api/bitget/screener", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setData((await response.json()) as BitgetScreenerResponse);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка загрузки");
    }
  }, []);

  React.useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("screenerpro.bitget.v3") ?? "{}") as { favorites?: string[]; notes?: Record<string, string> };
      setFavorites(saved.favorites ?? []);
      setNotes(saved.notes ?? {});
      const urlGroup = new URLSearchParams(window.location.search).get("group") as BitgetMarketGroup | null;
      if (urlGroup && GROUPS.some((item) => item.id === urlGroup)) setGroup(urlGroup);
    } catch { /* local workspace is optional */ }
    void load();
  }, [load]);

  React.useEffect(() => { window.localStorage.setItem("screenerpro.bitget.v3", JSON.stringify({ favorites, notes })); }, [favorites, notes]);
  React.useEffect(() => { if (!autoRefresh) return; const timer = window.setInterval(() => void load(), 30_000); return () => window.clearInterval(timer); }, [autoRefresh, load]);
  React.useEffect(() => { setLimit(120); }, [group, quick, query]);

  const online = React.useMemo(() => (data?.rows ?? []).filter((row) => row.status.toLowerCase() === "online"), [data]);
  const counts = React.useMemo(() => {
    const result: Record<string, number> = {};
    online.forEach((row) => { result[row.marketGroup] = (result[row.marketGroup] ?? 0) + 1; });
    return result;
  }, [online]);

  const filtered = React.useMemo(() => {
    let rows = online;
    if (group !== "ALL") rows = rows.filter((row) => row.marketGroup === group);
    const needle = query.trim().toUpperCase();
    if (needle) rows = rows.filter((row) => `${row.symbol} ${row.baseCoin} ${displayTicker(row)}`.toUpperCase().includes(needle));
    if (quick === "focus") rows = rows.filter((row) => row.inPlay);
    if (quick === "gainers") rows = rows.filter((row) => row.change24hPct != null && row.change24hPct >= 3);
    if (quick === "losers") rows = rows.filter((row) => row.change24hPct != null && row.change24hPct <= -3);
    if (quick === "range") rows = rows.filter((row) => row.range24hPct != null && row.range24hPct >= 5);
    if (quick === "funding") rows = rows.filter((row) => row.fundingRatePct != null && Math.abs(row.fundingRatePct) >= 0.03);
    return rows.slice().sort((a, b) => compareRows(a, b, sort.key, sort.dir));
  }, [online, group, quick, query, sort]);

  const shown = filtered.slice(0, limit);

  React.useEffect(() => {
    const batch = shown.slice(0, 60).filter((row) => !(row.id in weeks) && !requested.current.has(row.id));
    if (!batch.length) return;
    batch.forEach((row) => requested.current.add(row.id));
    const items = batch.map((row) => `${row.category}:${row.symbol}`).join(",");
    void fetch(`/api/bitget/weekly?items=${encodeURIComponent(items)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { metrics?: Array<{ id: string; change7dPct: number | null }> } | null) => {
        if (!payload) return;
        const next: Record<string, number | null> = {};
        (payload.metrics ?? []).forEach((item) => { next[item.id] = item.change7dPct; });
        setWeeks((current) => ({ ...current, ...next }));
      })
      .catch(() => batch.forEach((row) => requested.current.delete(row.id)));
  }, [shown, weeks]);

  const leaders = React.useMemo(() => ({
    up: online.filter((row) => row.change24hPct != null).slice().sort((a, b) => (b.change24hPct ?? 0) - (a.change24hPct ?? 0)).slice(0, 3),
    down: online.filter((row) => row.change24hPct != null).slice().sort((a, b) => (a.change24hPct ?? 0) - (b.change24hPct ?? 0)).slice(0, 3),
    liquid: online.filter((row) => row.turnover24h != null).slice().sort((a, b) => (b.turnover24h ?? 0) - (a.turnover24h ?? 0)).slice(0, 3),
    funding: online.filter((row) => row.fundingRatePct != null).slice().sort((a, b) => Math.abs(b.fundingRatePct ?? 0) - Math.abs(a.fundingRatePct ?? 0)).slice(0, 3),
  }), [online]);

  const changeSort = (key: SortKey) => setSort((current) => current.key === key ? { key, dir: current.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" });
  const toggleFavorite = (id: string) => setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); } catch { /* clipboard may be blocked */ } };

  const copyContext = (row: BitgetScreenerRow) => copy([
    `${displayTicker(row)} · ${LABELS[row.marketGroup]}`, `Bitget: ${row.symbol}`, `Цена ${price(row.lastPrice)}`, `24ч ${pct(row.change24hPct)} · 7д ${pct(weeks[row.id] ?? null)}`,
    `Ход ${pct(row.range24hPct)} · оборот ${turnover(row)} · спред ${spread(row)}`, row.fundingRatePct == null ? "" : `Funding ${pct(row.fundingRatePct, 4)} · OI ${compact(row.openInterest)}`, notes[row.id] ? `Заметка: ${notes[row.id]}` : "",
  ].filter(Boolean).join("\n"));

  if (!data && !error) return <div className="py-24 text-center text-sm text-slate-500">Загружаю Bitget…</div>;
  if (!data) return <div className="rounded border border-rose-400/20 p-5 text-sm text-rose-200">Не удалось загрузить рынок: {error}</div>;

  const leaderGroups = [
    ["Сильнее всего", leaders.up, (row: BitgetScreenerRow) => pct(row.change24hPct)],
    ["Слабее всего", leaders.down, (row: BitgetScreenerRow) => pct(row.change24hPct)],
    ["Самый большой оборот", leaders.liquid, (row: BitgetScreenerRow) => turnover(row)],
    ["Funding экстремум", leaders.funding, (row: BitgetScreenerRow) => pct(row.fundingRatePct, 4)],
  ] as const;

  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-2 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] py-2">
        <div><div className="flex items-center gap-2"><h1 className="text-[14px] font-semibold text-slate-100">Рынок · Bitget</h1><Link href="/screener/bitget/map" className="inline-flex items-center gap-1 rounded border border-cyan-400/15 bg-cyan-400/[0.035] px-2 py-0.5 text-[9px] text-cyan-200"><MapIcon className="h-3 w-3" /> Карта рынков</Link></div><p className="mt-1 text-[10px] text-slate-600">Все инструменты → отбор → график → заметка → брифинг</p></div>
        <div className="flex items-center gap-2 text-[9px] text-slate-600"><span>{data.summary.online} инструментов</span><label className="inline-flex items-center gap-1"><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} className="h-3 w-3" />30с</label><button type="button" onClick={() => void load()} className="rounded border border-white/[0.07] p-1"><RefreshCw className="h-3 w-3" /></button></div>
      </header>

      <section className="grid gap-0 rounded-md border border-white/[0.06] bg-slate-950/30 px-3 py-3 md:grid-cols-4">
        {leaderGroups.map(([title, rows, value]) => <div key={title} className="border-l border-white/[0.06] pl-3 first:border-l-0 first:pl-0"><p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">{title}</p><div className="mt-2 space-y-1.5">{rows.map((row) => <button key={row.id} type="button" onClick={() => { setGroup("ALL"); setQuick("all"); setExpanded(row.id); }} className="grid w-full grid-cols-[1fr_auto] gap-2 text-left text-[10px]"><span className="truncate font-mono text-slate-300">{displayTicker(row)}</span><span className={`font-mono ${tone(row.change24hPct)}`}>{value(row)}</span></button>)}</div></div>)}
      </section>

      <section className="rounded-md border border-white/[0.06] bg-slate-950/30">
        <div className="flex flex-wrap items-center gap-1 border-b border-white/[0.05] px-2 py-2">
          {GROUPS.map((item) => <button key={item.id} type="button" onClick={() => setGroup(item.id)} className={`rounded px-2 py-1 text-[9px] ${group === item.id ? "bg-cyan-400/[0.09] text-cyan-200" : "text-slate-500"}`}>{item.label} {item.id === "ALL" ? online.length : (counts[item.id] ?? 0)}</button>)}
          <span className="mx-1 h-4 w-px bg-white/[0.06]" />
          {QUICK.map(([id, label]) => <button key={id} type="button" onClick={() => setQuick(id)} className={`rounded px-2 py-1 text-[9px] ${quick === id ? "bg-white/[0.07] text-slate-200" : "text-slate-600"}`}>{label}</button>)}
          <div className="ml-auto flex items-center gap-1 rounded border border-white/[0.07] px-2 py-1"><Search className="h-3 w-3 text-slate-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Тикер / актив" className="w-28 bg-transparent text-[10px] text-slate-300 outline-none placeholder:text-slate-700" /></div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-left">
            <thead className="sticky top-0 z-20 bg-[#070c1b]/95 backdrop-blur"><tr className="border-b border-white/[0.06] text-[9px] uppercase tracking-[0.09em] text-slate-600">
              <th className="px-2 py-2">Инструмент</th><th className="px-2 py-2">Рынок</th><th className="px-2 py-2 text-right">Цена</th>
              <th className="px-2 py-2 text-right"><SortHead label="24ч" column="change24hPct" sort={sort} onSort={changeSort} /></th><th className="px-2 py-2 text-right" title="Лениво подгружается из дневных свечей">7 дней</th>
              <th className="px-2 py-2 text-right"><SortHead label="Ход 24ч" column="range24hPct" sort={sort} onSort={changeSort} /></th><th className="px-2 py-2 text-right"><SortHead label="Оборот 24ч" column="turnover24h" sort={sort} onSort={changeSort} /></th>
              <th className="px-2 py-2 text-right"><SortHead label="Спред" column="spreadBps" sort={sort} onSort={changeSort} title="Показан в процентах; точные базисные пункты — в раскрытии" /></th><th className="px-2 py-2 text-right"><SortHead label="Funding" column="fundingRatePct" sort={sort} onSort={changeSort} /></th><th className="px-2 py-2 text-right"><SortHead label="Фокус" column="attentionScore" sort={sort} onSort={changeSort} /></th>
            </tr></thead>
            <tbody>{shown.map((row) => {
              const open = expanded === row.id; const favorite = favorites.includes(row.id);
              return <React.Fragment key={row.id}><tr onClick={() => setExpanded(open ? null : row.id)} className={`cursor-pointer border-b border-white/[0.045] text-[10px] hover:bg-white/[0.025] ${open ? "bg-cyan-400/[0.03]" : ""}`}>
                <td className="px-2 py-2"><div className="flex items-center gap-1.5"><button type="button" onClick={(event) => { event.stopPropagation(); void copy(tvCopy(row)); }} title="Копировать тикер для TradingView" className="group flex items-center gap-1.5">{row.isReality ? <span className="rounded border border-violet-400/20 bg-violet-400/[0.06] px-1 text-[8px] text-violet-300">R</span> : null}<span className="font-mono font-semibold text-slate-200 group-hover:text-cyan-200">{displayTicker(row)}</span><Clipboard className="h-2.5 w-2.5 text-slate-700 opacity-0 group-hover:opacity-100" /></button><button type="button" onClick={(event) => { event.stopPropagation(); toggleFavorite(row.id); }} className={favorite ? "text-amber-300" : "text-slate-800"}><Star className={`h-3 w-3 ${favorite ? "fill-current" : ""}`} /></button></div><p className="mt-0.5 font-mono text-[8px] text-slate-700">{row.symbol}</p></td>
                <td className="px-2 py-2"><MarketBadge row={row} /></td><td className="px-2 py-2 text-right font-mono text-slate-300">{price(row.lastPrice)}</td><td className={`px-2 py-2 text-right font-mono ${tone(row.change24hPct)}`}>{pct(row.change24hPct)}</td><td className={`px-2 py-2 text-right font-mono ${tone(weeks[row.id] ?? null)}`}>{pct(weeks[row.id] ?? null)}</td><td className="px-2 py-2 text-right font-mono text-slate-300">{pct(row.range24hPct)}</td><td className="px-2 py-2 text-right font-mono text-slate-300">{turnover(row)}</td><td className="px-2 py-2 text-right font-mono text-slate-400" title={row.spreadBps == null ? undefined : `${row.spreadBps.toFixed(1)} базисных пункта`}>{spread(row)}</td><td className={`px-2 py-2 text-right font-mono ${row.fundingRatePct == null ? "text-slate-700" : tone(row.fundingRatePct)}`}>{pct(row.fundingRatePct, 4)}</td><td className="px-2 py-2 text-right font-mono text-slate-500">{row.attentionScore}</td>
              </tr>{open ? <tr><td colSpan={10} className="p-0"><ExpandedRow row={row} week={weeks[row.id]} favorite={favorite} note={notes[row.id] ?? ""} onFavorite={() => toggleFavorite(row.id)} onNote={(value) => setNotes((current) => ({ ...current, [row.id]: value }))} onCopy={() => void copyContext(row)} /></td></tr> : null}</React.Fragment>;
            })}</tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-white/[0.05] px-3 py-2 text-[9px] text-slate-600"><span>Показано {shown.length} из {filtered.length}. Вертикальный скролл один — у всей страницы.</span>{shown.length < filtered.length ? <button type="button" onClick={() => setLimit((current) => current + 120)} className="rounded border border-white/[0.07] px-2 py-1 text-slate-400">Показать ещё 120</button> : null}</div>
      </section>
    </div>
  );
}
