"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Bitcoin,
  ChartCandlestick,
  Clipboard,
  ExternalLink,
  Gem,
  Gauge,
  Landmark,
  Map as MapIcon,
  RefreshCw,
  Scale,
  Search,
  Star,
  TrendingDown,
  TrendingUp,
  Waves,
} from "lucide-react";
import { TradingViewChart } from "@/components/bitget/tradingview-chart";
import type { BitgetMarketGroup, BitgetScreenerResponse, BitgetScreenerRow } from "@/lib/bitget/types";

const MARKET_ORDER: BitgetMarketGroup[] = [
  "CRYPTO_SPOT",
  "CRYPTO_FUTURES",
  "MARGIN",
  "RTOKEN_SPOT",
  "STOCK_PERPS",
  "COMMODITY_PERPS",
];

const MARKET_META: Record<BitgetMarketGroup, { title: string; short: string; caption: string; symbol: string }> = {
  CRYPTO_SPOT: { title: "Крипто-спот", short: "Крипто · спот", caption: "сам токен", symbol: "₿" },
  CRYPTO_FUTURES: { title: "Крипто-фьючерсы", short: "Крипто · фьючерс", caption: "long / short · плечо", symbol: "∞" },
  MARGIN: { title: "Маржинальный спот", short: "Крипто · маржа", caption: "спот + заём", symbol: "M" },
  RTOKEN_SPOT: { title: "rToken", short: "Акции / ETF · токен", caption: "токенизированный фондовый рынок", symbol: "R" },
  STOCK_PERPS: { title: "Фьючерсы на акции", short: "Акции / ETF · фьючерс", caption: "бессрочный дериватив", symbol: "US" },
  COMMODITY_PERPS: { title: "Товарные фьючерсы", short: "Товары · фьючерс", caption: "золото · нефть · газ", symbol: "Au" },
};

type SortKey = "activityScore" | "change24hPct" | "range24hPct" | "turnover24h" | "spreadBps" | "fundingRatePct";
type SortDir = "asc" | "desc";
type RadarMode = "activity" | "strong" | "weak" | "funding";
type RankedRow = BitgetScreenerRow & {
  activityScore: number;
  turnoverRank: number;
  moveAbsRank: number;
  moveRank: number;
  rangeRank: number;
  fundingRank: number | null;
};

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

function assetClass(row: BitgetScreenerRow) {
  const type = row.symbolType.toLowerCase();
  if (type.includes("etf")) return "ETF";
  if (row.marketGroup === "RTOKEN_SPOT") return "АКЦИЯ / ETF";
  if (row.marketGroup === "STOCK_PERPS") return type.includes("stock") ? "АКЦИЯ" : "АКЦИЯ / ETF";
  if (row.marketGroup === "COMMODITY_PERPS") return "ТОВАР";
  return "КРИПТО";
}

function classTone(row: BitgetScreenerRow) {
  if (row.marketGroup === "RTOKEN_SPOT" || row.marketGroup === "STOCK_PERPS") return "border-violet-400/20 bg-violet-400/[0.055] text-violet-200/80";
  if (row.marketGroup === "COMMODITY_PERPS") return "border-amber-400/20 bg-amber-400/[0.05] text-amber-200/80";
  return "border-cyan-400/18 bg-cyan-400/[0.045] text-cyan-200/75";
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

function rankMap(rows: BitgetScreenerRow[], accessor: (row: BitgetScreenerRow) => number | null) {
  const values = rows
    .map((row) => ({ row, value: accessor(row) }))
    .filter((item): item is { row: BitgetScreenerRow; value: number } => item.value != null && Number.isFinite(item.value))
    .sort((a, b) => a.value - b.value);
  const result = new Map<string, number>();
  if (!values.length) return result;
  if (values.length === 1) {
    result.set(values[0].row.id, 0.5);
    return result;
  }
  values.forEach((item, index) => result.set(item.row.id, index / (values.length - 1)));
  return result;
}

function rankRows(rows: BitgetScreenerRow[]): RankedRow[] {
  const byGroup = new Map<BitgetMarketGroup, BitgetScreenerRow[]>();
  rows.forEach((row) => byGroup.set(row.marketGroup, [...(byGroup.get(row.marketGroup) ?? []), row]));
  const output: RankedRow[] = [];

  for (const groupRows of byGroup.values()) {
    const turnoverRanks = rankMap(groupRows, (row) => row.turnover24h);
    const moveAbsRanks = rankMap(groupRows, (row) => row.change24hPct == null ? null : Math.abs(row.change24hPct));
    const moveRanks = rankMap(groupRows, (row) => row.change24hPct);
    const rangeRanks = rankMap(groupRows, (row) => row.range24hPct);
    const spreadRanks = rankMap(groupRows, (row) => row.spreadBps);
    const fundingRanks = rankMap(groupRows, (row) => row.fundingRatePct == null ? null : Math.abs(row.fundingRatePct));

    for (const row of groupRows) {
      const turnoverRank = turnoverRanks.get(row.id) ?? 0;
      const moveAbsRank = moveAbsRanks.get(row.id) ?? 0;
      const moveRank = moveRanks.get(row.id) ?? 0.5;
      const rangeRank = rangeRanks.get(row.id) ?? 0;
      const spreadQuality = row.spreadBps == null ? 0.5 : 1 - (spreadRanks.get(row.id) ?? 0.5);
      const activityScore = Math.round(100 * (turnoverRank * 0.35 + moveAbsRank * 0.3 + rangeRank * 0.3 + spreadQuality * 0.05));
      output.push({
        ...row,
        activityScore,
        turnoverRank,
        moveAbsRank,
        moveRank,
        rangeRank,
        fundingRank: fundingRanks.get(row.id) ?? null,
      });
    }
  }
  return output;
}

function metric(row: RankedRow, key: SortKey): number | null {
  if (key === "activityScore") return row.activityScore;
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function compareRows(a: RankedRow, b: RankedRow, key: SortKey, dir: SortDir) {
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

function MarketGlyph({ group }: { group: BitgetMarketGroup }) {
  const cls = "h-4 w-4";
  if (group === "CRYPTO_SPOT") return <Bitcoin className={cls} />;
  if (group === "CRYPTO_FUTURES") return <ChartCandlestick className={cls} />;
  if (group === "MARGIN") return <Scale className={cls} />;
  if (group === "RTOKEN_SPOT") return <Gem className={cls} />;
  if (group === "STOCK_PERPS") return <Landmark className={cls} />;
  return <Waves className={cls} />;
}

function MarketBadge({ row }: { row: BitgetScreenerRow }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`rounded-full border px-1.5 py-0.5 text-[8px] tracking-[0.08em] ${classTone(row)}`}>{assetClass(row)}</span>
      <span className="text-[9px] text-slate-600">{MARKET_META[row.marketGroup].short}</span>
    </div>
  );
}

function relativeLabel(row: RankedRow, mode: RadarMode) {
  if (mode === "activity") return `активность ${row.activityScore}/100`;
  if (mode === "funding") return row.fundingRatePct == null ? "нет фандинга" : `|фандинг| ${Math.abs(row.fundingRatePct).toFixed(4)}%`;
  if (mode === "strong") return `сильнее ${Math.round(row.moveRank * 100)}% своей секции`;
  return `слабее ${Math.round((1 - row.moveRank) * 100)}% своей секции`;
}

function radarMetric(row: RankedRow, mode: RadarMode) {
  if (mode === "activity") return `${row.activityScore}`;
  if (mode === "funding") return pct(row.fundingRatePct, 4);
  return pct(row.change24hPct);
}

function radarTone(row: RankedRow, mode: RadarMode) {
  if (mode === "activity") return row.activityScore >= 80 ? "text-cyan-200" : "text-slate-200";
  if (mode === "funding") return tone(row.fundingRatePct);
  return tone(row.change24hPct);
}

function pickRadarRows(rows: RankedRow[], mode: RadarMode) {
  const max = 14;
  if (mode === "activity") {
    const sorted = rows.slice().sort((a, b) => b.activityScore - a.activityScore);
    const selected = sorted.filter((row) => row.activityScore >= 72).slice(0, max);
    return selected.length >= 7 ? selected : sorted.slice(0, Math.min(7, sorted.length));
  }
  if (mode === "strong") {
    const sorted = rows.filter((row) => row.change24hPct != null && row.change24hPct > 0).slice().sort((a, b) => b.moveRank - a.moveRank || (b.change24hPct ?? 0) - (a.change24hPct ?? 0));
    const selected = sorted.filter((row) => row.moveRank >= 0.88).slice(0, max);
    return selected.length >= 6 ? selected : sorted.slice(0, Math.min(6, sorted.length));
  }
  if (mode === "weak") {
    const sorted = rows.filter((row) => row.change24hPct != null && row.change24hPct < 0).slice().sort((a, b) => a.moveRank - b.moveRank || (a.change24hPct ?? 0) - (b.change24hPct ?? 0));
    const selected = sorted.filter((row) => row.moveRank <= 0.12).slice(0, max);
    return selected.length >= 6 ? selected : sorted.slice(0, Math.min(6, sorted.length));
  }
  const sorted = rows
    .filter((row) => row.fundingRatePct != null)
    .slice()
    .sort((a, b) => Math.abs(b.fundingRatePct ?? 0) - Math.abs(a.fundingRatePct ?? 0));
  const selected = sorted.filter((row) => (row.fundingRank ?? 0) >= 0.88).slice(0, max);
  return selected.length >= 6 ? selected : sorted.slice(0, Math.min(6, sorted.length));
}

function ExpandedRow({ row, week, favorite, note, onFavorite, onNote, onCopy }: { row: RankedRow; week: number | null | undefined; favorite: boolean; note: string; onFavorite: () => void; onNote: (value: string) => void; onCopy: () => void }) {
  const symbol = tvWidget(row);
  const tvUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
  const details = [
    ["Биржевой символ", row.symbol],
    ["Bid / Ask", `${price(row.bid)} / ${price(row.ask)}`],
    ["Максимум / минимум 24ч", `${price(row.high24h)} / ${price(row.low24h)}`],
    ["Спред", row.spreadBps == null ? "—" : `${spread(row)} · ${row.spreadBps.toFixed(1)} б.п.`],
    ["Открытый интерес", compact(row.openInterest)],
    ["Фандинг", pct(row.fundingRatePct, 4)],
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

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {[
          ["Цена", price(row.lastPrice), "text-slate-100"], ["24 часа", pct(row.change24hPct), tone(row.change24hPct)], ["7 дней", pct(week ?? null), tone(week ?? null)],
          ["Ход 24ч", pct(row.range24hPct), "text-slate-200"], ["Оборот", turnover(row), "text-slate-200"], ["Спред", spread(row), "text-slate-200"], ["Фандинг", pct(row.fundingRatePct, 4), row.fundingRatePct == null ? "text-slate-700" : tone(row.fundingRatePct)], ["Активность", `${row.activityScore}/100`, "text-cyan-200"],
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
  const [radarMode, setRadarMode] = React.useState<RadarMode>("activity");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: SortDir }>({ key: "activityScore", dir: "desc" });
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
      if (urlGroup && MARKET_ORDER.includes(urlGroup)) setGroup(urlGroup);
    } catch { /* local workspace is optional */ }
    void load();
  }, [load]);

  React.useEffect(() => { window.localStorage.setItem("screenerpro.bitget.v3", JSON.stringify({ favorites, notes })); }, [favorites, notes]);
  React.useEffect(() => { if (!autoRefresh) return; const timer = window.setInterval(() => void load(), 30_000); return () => window.clearInterval(timer); }, [autoRefresh, load]);
  React.useEffect(() => { setLimit(120); }, [group, query]);

  const online = React.useMemo(() => (data?.rows ?? []).filter((row) => row.status.toLowerCase() === "online"), [data]);
  const ranked = React.useMemo(() => rankRows(online), [online]);
  const counts = React.useMemo(() => {
    const result: Record<string, number> = {};
    ranked.forEach((row) => { result[row.marketGroup] = (result[row.marketGroup] ?? 0) + 1; });
    return result;
  }, [ranked]);
  const activeCounts = React.useMemo(() => {
    const result: Record<string, number> = {};
    ranked.filter((row) => row.activityScore >= 72).forEach((row) => { result[row.marketGroup] = (result[row.marketGroup] ?? 0) + 1; });
    return result;
  }, [ranked]);

  const scopeRows = React.useMemo(() => group === "ALL" ? ranked : ranked.filter((row) => row.marketGroup === group), [ranked, group]);
  const radarRows = React.useMemo(() => pickRadarRows(scopeRows, radarMode), [scopeRows, radarMode]);

  const filtered = React.useMemo(() => {
    let rows = scopeRows;
    const needle = query.trim().toUpperCase();
    if (needle) rows = rows.filter((row) => `${row.symbol} ${row.baseCoin} ${displayTicker(row)}`.toUpperCase().includes(needle));
    return rows.slice().sort((a, b) => compareRows(a, b, sort.key, sort.dir));
  }, [scopeRows, query, sort]);

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

  const changeSort = (key: SortKey) => setSort((current) => current.key === key ? { key, dir: current.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" });
  const toggleFavorite = (id: string) => setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); } catch { /* clipboard may be blocked */ } };

  const selectGroup = React.useCallback((next: BitgetMarketGroup | "ALL") => {
    setGroup(next);
    setQuery("");
    setExpanded(null);
    const url = new URL(window.location.href);
    if (next === "ALL") url.searchParams.delete("group"); else url.searchParams.set("group", next);
    window.history.replaceState({}, "", url);
  }, []);

  const openInstrument = React.useCallback((row: RankedRow) => {
    setGroup(row.marketGroup);
    setQuery(displayTicker(row));
    setExpanded(row.id);
    window.setTimeout(() => document.getElementById("bitget-instruments")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  }, []);

  const copyContext = (row: RankedRow) => copy([
    `${displayTicker(row)} · ${MARKET_META[row.marketGroup].short}`, `Bitget: ${row.symbol}`, `Цена ${price(row.lastPrice)}`, `24ч ${pct(row.change24hPct)} · 7д ${pct(weeks[row.id] ?? null)}`,
    `Ход ${pct(row.range24hPct)} · оборот ${turnover(row)} · спред ${spread(row)} · активность ${row.activityScore}/100`, row.fundingRatePct == null ? "" : `Фандинг ${pct(row.fundingRatePct, 4)} · OI ${compact(row.openInterest)}`, notes[row.id] ? `Заметка: ${notes[row.id]}` : "",
  ].filter(Boolean).join("\n"));

  if (!data && !error) return <div className="py-24 text-center text-sm text-slate-500">Загружаю Bitget…</div>;
  if (!data) return <div className="rounded border border-rose-400/20 p-5 text-sm text-rose-200">Не удалось загрузить рынок: {error}</div>;

  const radarCopy: Record<RadarMode, { title: string; text: string; icon: React.ReactNode }> = {
    activity: { title: "Самые активные", text: "Оборот + движение цены + ширина хода. Балл нормализован внутри каждой секции рынка.", icon: <Activity className="h-4 w-4" /> },
    strong: { title: "Сильнее своей секции", text: "Не голый процент, а относительная сила внутри того же типа рынка.", icon: <TrendingUp className="h-4 w-4" /> },
    weak: { title: "Слабее своей секции", text: "Относительная слабость: фондовые и крипто-инструменты сравниваются со своими соседями.", icon: <TrendingDown className="h-4 w-4" /> },
    funding: { title: "Перекос фандинга", text: "Только деривативы. Показываем крайние значения отдельно от движения цены.", icon: <Gauge className="h-4 w-4" /> },
  };

  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-4 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] py-2">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-[14px] font-semibold text-slate-100">Bitget · обзор рынка</h1><Link href="/screener/bitget/map" className="inline-flex items-center gap-1 rounded-full border border-cyan-400/15 bg-cyan-400/[0.035] px-2.5 py-1 text-[9px] text-cyan-200"><MapIcon className="h-3 w-3" /> Карта рынков</Link></div>
          <p className="mt-1 text-[10px] text-slate-600">Секции рынка → радар активности → полный список инструментов</p>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-slate-600"><span>{data.summary.online} инструментов</span><label className="inline-flex items-center gap-1"><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} className="h-3 w-3" />30с</label><button type="button" onClick={() => void load()} className="rounded border border-white/[0.07] p-1.5"><RefreshCw className="h-3 w-3" /></button></div>
      </header>

      <section>
        <div className="mb-2 flex items-end justify-between gap-3">
          <div><p className="text-[9px] uppercase tracking-[0.18em] text-slate-600">Рынки</p><p className="mt-1 text-[10px] text-slate-500">Сначала выберите тип инструмента. Клик меняет весь обзор ниже.</p></div>
          <button type="button" onClick={() => selectGroup("ALL")} className={`rounded-full border px-3 py-1 text-[9px] ${group === "ALL" ? "border-cyan-300/25 bg-cyan-400/[0.07] text-cyan-100" : "border-white/[0.07] text-slate-500"}`}>Все рынки · {ranked.length}</button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {MARKET_ORDER.map((item) => {
            const meta = MARKET_META[item];
            const active = group === item;
            return (
              <button key={item} type="button" onClick={() => selectGroup(item)} className={`group relative min-h-[118px] overflow-hidden rounded-[24px] border p-3 text-left transition ${active ? "border-cyan-300/30 bg-cyan-400/[0.065] shadow-[0_0_28px_rgba(34,211,238,0.06)]" : "border-white/[0.06] bg-slate-950/35 hover:border-white/[0.13] hover:bg-white/[0.025]"}`}>
                <span className="absolute -right-2 -top-5 font-mono text-[62px] font-semibold text-white/[0.025]">{meta.symbol}</span>
                <div className="relative flex h-full flex-col justify-between gap-4">
                  <div className="flex items-start justify-between gap-2"><span className={`flex h-8 w-8 items-center justify-center rounded-full border ${active ? "border-cyan-300/30 bg-cyan-400/[0.08] text-cyan-200" : "border-white/[0.07] bg-white/[0.02] text-slate-500"}`}><MarketGlyph group={item} /></span><span className="font-mono text-[9px] text-slate-600">{counts[item] ?? 0}</span></div>
                  <div><p className={`text-[11px] font-semibold ${active ? "text-white" : "text-slate-200"}`}>{meta.title}</p><p className="mt-1 text-[9px] text-slate-600">{meta.caption}</p><p className="mt-2 text-[8px] text-emerald-300/65">{activeCounts[item] ?? 0} сейчас активны</p></div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-white/[0.065] bg-[#050914]/58">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.055] px-4 py-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-cyan-200/75">{radarCopy[radarMode].icon}<p className="text-[9px] uppercase tracking-[0.18em]">Радар рынка</p></div>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">{radarCopy[radarMode].title}</h2>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{radarCopy[radarMode].text}</p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-full border border-white/[0.06] bg-black/20 p-1">
            {(["activity", "strong", "weak", "funding"] as RadarMode[]).map((mode) => <button key={mode} type="button" onClick={() => setRadarMode(mode)} className={`rounded-full px-3 py-1.5 text-[9px] transition ${radarMode === mode ? "bg-white/[0.09] text-slate-100" : "text-slate-600 hover:text-slate-300"}`}>{mode === "activity" ? "Активные" : mode === "strong" ? "Сильные" : mode === "weak" ? "Слабые" : "Фандинг"}</button>)}
          </div>
        </div>

        {radarRows.length ? (
          <div className="grid gap-px bg-white/[0.045] md:grid-cols-2 xl:grid-cols-3">
            {radarRows.map((row, index) => (
              <button key={row.id} type="button" onClick={() => openInstrument(row)} className="group bg-[#060b18] px-4 py-3 text-left transition hover:bg-white/[0.035]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="font-mono text-[8px] text-slate-700">{String(index + 1).padStart(2, "0")}</span><span className="font-mono text-[12px] font-semibold text-slate-100 group-hover:text-cyan-100">{displayTicker(row)}</span><span className={`rounded-full border px-1.5 py-0.5 text-[7px] tracking-[0.08em] ${classTone(row)}`}>{assetClass(row)}</span></div>
                    <p className="mt-1 text-[8px] text-slate-600">{MARKET_META[row.marketGroup].short} · {relativeLabel(row, radarMode)}</p>
                  </div>
                  <span className={`font-mono text-[13px] font-semibold tabular-nums ${radarTone(row, radarMode)}`}>{radarMetric(row, radarMode)}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 border-t border-white/[0.045] pt-2 text-[8px]">
                  <div><p className="text-slate-700">24ч</p><p className={`mt-0.5 font-mono ${tone(row.change24hPct)}`}>{pct(row.change24hPct)}</p></div>
                  <div><p className="text-slate-700">Ход</p><p className="mt-0.5 font-mono text-slate-400">{pct(row.range24hPct)}</p></div>
                  <div><p className="text-slate-700">Оборот</p><p className="mt-0.5 truncate font-mono text-slate-400">{turnover(row)}</p></div>
                </div>
              </button>
            ))}
          </div>
        ) : <div className="px-4 py-8 text-center text-[10px] text-slate-600">В этой секции сейчас нет достаточного количества данных для выбранного режима.</div>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] px-4 py-2 text-[8px] text-slate-700"><span>Количество строк определяется состоянием рынка, а не фиксированным «топ-3».</span><span>Сравнение силы и активности идёт внутри своей секции.</span></div>
      </section>

      <section id="bitget-instruments" className="scroll-mt-3 overflow-hidden rounded-[22px] border border-white/[0.06] bg-slate-950/30">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.05] px-3 py-3">
          <div><p className="text-[10px] font-semibold text-slate-200">Все инструменты {group === "ALL" ? "" : `· ${MARKET_META[group].title}`}</p><p className="mt-0.5 text-[8px] text-slate-600">Полный список без дополнительных режимов. Сортируйте нужный показатель прямо в таблице.</p></div>
          <div className="flex items-center gap-2">
            {query ? <button type="button" onClick={() => { setQuery(""); setExpanded(null); }} className="text-[8px] text-slate-600 hover:text-slate-300">Сбросить поиск</button> : null}
            <div className="flex items-center gap-1 rounded-full border border-white/[0.07] bg-black/20 px-3 py-1.5"><Search className="h-3 w-3 text-slate-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Тикер / актив" className="w-32 bg-transparent text-[10px] text-slate-300 outline-none placeholder:text-slate-700" /></div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-left">
            <thead className="sticky top-0 z-20 bg-[#070c1b]/95 backdrop-blur"><tr className="border-b border-white/[0.06] text-[9px] uppercase tracking-[0.09em] text-slate-600">
              <th className="px-2 py-2">Инструмент</th><th className="px-2 py-2">Класс / рынок</th><th className="px-2 py-2 text-right">Цена</th>
              <th className="px-2 py-2 text-right"><SortHead label="24ч" column="change24hPct" sort={sort} onSort={changeSort} /></th><th className="px-2 py-2 text-right" title="Подгружается из дневных свечей">7 дней</th>
              <th className="px-2 py-2 text-right"><SortHead label="Ход 24ч" column="range24hPct" sort={sort} onSort={changeSort} /></th><th className="px-2 py-2 text-right"><SortHead label="Оборот 24ч" column="turnover24h" sort={sort} onSort={changeSort} /></th>
              <th className="px-2 py-2 text-right"><SortHead label="Спред" column="spreadBps" sort={sort} onSort={changeSort} /></th><th className="px-2 py-2 text-right"><SortHead label="Фандинг" column="fundingRatePct" sort={sort} onSort={changeSort} /></th><th className="px-2 py-2 text-right"><SortHead label="Активность" column="activityScore" sort={sort} onSort={changeSort} title="Нормализованный балл внутри своей рыночной секции" /></th>
            </tr></thead>
            <tbody>{shown.map((row) => {
              const open = expanded === row.id; const favorite = favorites.includes(row.id);
              return <React.Fragment key={row.id}><tr onClick={() => setExpanded(open ? null : row.id)} className={`cursor-pointer border-b border-white/[0.045] text-[10px] hover:bg-white/[0.025] ${open ? "bg-cyan-400/[0.03]" : ""}`}>
                <td className="px-2 py-2"><div className="flex items-center gap-1.5"><button type="button" onClick={(event) => { event.stopPropagation(); void copy(tvCopy(row)); }} title="Копировать тикер для TradingView" className="group flex items-center gap-1.5">{row.isReality ? <span className="rounded border border-violet-400/20 bg-violet-400/[0.06] px-1 text-[8px] text-violet-300">R</span> : null}<span className="font-mono font-semibold text-slate-200 group-hover:text-cyan-200">{displayTicker(row)}</span><Clipboard className="h-2.5 w-2.5 text-slate-700 opacity-0 group-hover:opacity-100" /></button><button type="button" onClick={(event) => { event.stopPropagation(); toggleFavorite(row.id); }} className={favorite ? "text-amber-300" : "text-slate-800"}><Star className={`h-3 w-3 ${favorite ? "fill-current" : ""}`} /></button></div><p className="mt-0.5 font-mono text-[8px] text-slate-700">{row.symbol}</p></td>
                <td className="px-2 py-2"><MarketBadge row={row} /></td><td className="px-2 py-2 text-right font-mono text-slate-300">{price(row.lastPrice)}</td><td className={`px-2 py-2 text-right font-mono ${tone(row.change24hPct)}`}>{pct(row.change24hPct)}</td><td className={`px-2 py-2 text-right font-mono ${tone(weeks[row.id] ?? null)}`}>{pct(weeks[row.id] ?? null)}</td><td className="px-2 py-2 text-right font-mono text-slate-300">{pct(row.range24hPct)}</td><td className="px-2 py-2 text-right font-mono text-slate-300">{turnover(row)}</td><td className="px-2 py-2 text-right font-mono text-slate-400" title={row.spreadBps == null ? undefined : `${row.spreadBps.toFixed(1)} базисных пункта`}>{spread(row)}</td><td className={`px-2 py-2 text-right font-mono ${row.fundingRatePct == null ? "text-slate-700" : tone(row.fundingRatePct)}`}>{pct(row.fundingRatePct, 4)}</td><td className="px-2 py-2 text-right"><div className="ml-auto flex w-24 items-center justify-end gap-2"><div className="h-1 w-12 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-cyan-300/45" style={{ width: `${Math.max(5, row.activityScore)}%` }} /></div><span className="w-6 font-mono text-[9px] text-slate-400">{row.activityScore}</span></div></td>
              </tr>{open ? <tr><td colSpan={10} className="p-0"><ExpandedRow row={row} week={weeks[row.id]} favorite={favorite} note={notes[row.id] ?? ""} onFavorite={() => toggleFavorite(row.id)} onNote={(value) => setNotes((current) => ({ ...current, [row.id]: value }))} onCopy={() => void copyContext(row)} /></td></tr> : null}</React.Fragment>;
            })}</tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-white/[0.05] px-3 py-2 text-[9px] text-slate-600"><span>Показано {shown.length} из {filtered.length}.</span>{shown.length < filtered.length ? <button type="button" onClick={() => setLimit((current) => current + 120)} className="rounded-full border border-white/[0.07] px-3 py-1 text-slate-400">Показать ещё 120</button> : null}</div>
      </section>
    </div>
  );
}
