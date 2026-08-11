"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Clipboard,
  ExternalLink,
  Map,
  RefreshCw,
  Search,
  Star,
} from "lucide-react";
import { TradingViewChart } from "@/components/bitget/tradingview-chart";
import type {
  BitgetMarketGroup,
  BitgetQuickFilter,
  BitgetScreenerResponse,
  BitgetScreenerRow,
} from "@/lib/bitget/types";

const STORAGE_KEY = "screenerpro.bitget.terminal.v2";

const GROUP_LABELS: Record<BitgetMarketGroup, string> = {
  CRYPTO_SPOT: "Крипто · спот",
  CRYPTO_FUTURES: "Крипто · фьючерс",
  MARGIN: "Маржинальный спот",
  RTOKEN_SPOT: "Акции · rToken",
  STOCK_PERPS: "Акции · перпетуал",
  COMMODITY_PERPS: "Товары · перпетуал",
};

const GROUP_SHORT: Record<BitgetMarketGroup, string> = {
  CRYPTO_SPOT: "Спот",
  CRYPTO_FUTURES: "Крипто futures",
  MARGIN: "Margin",
  RTOKEN_SPOT: "rToken",
  STOCK_PERPS: "Stock perps",
  COMMODITY_PERPS: "Товары",
};

const GROUPS: BitgetMarketGroup[] = [
  "CRYPTO_SPOT",
  "CRYPTO_FUTURES",
  "MARGIN",
  "RTOKEN_SPOT",
  "STOCK_PERPS",
  "COMMODITY_PERPS",
];

const QUICK_FILTERS: { id: BitgetQuickFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "inPlay", label: "В фокусе" },
  { id: "gainers", label: "Рост" },
  { id: "losers", label: "Падение" },
  { id: "wideRange", label: "Широкий ход" },
  { id: "funding", label: "Funding" },
];

type SortKey = "attentionScore" | "change24hPct" | "range24hPct" | "turnover24h" | "spreadBps" | "fundingRatePct";
type SortDir = "asc" | "desc";
type WeeklyMetric = { change7dPct: number | null; range7dPct: number | null };

type PersistedState = {
  group?: BitgetMarketGroup | "ALL";
  quick?: BitgetQuickFilter;
  watchlist?: string[];
  notes?: Record<string, string>;
};

function price(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const digits = value >= 1000 ? 2 : value >= 1 ? 4 : 7;
  return value.toLocaleString("ru-RU", { maximumFractionDigits: digits });
}

function pct(value: number | null, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function compactRu(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)} трлн`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)} млрд`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)} млн`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)} тыс.`;
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function turnover(row: BitgetScreenerRow): string {
  if (row.turnover24h == null) return "—";
  const quote = row.quoteCoin.toUpperCase();
  if (quote === "USDT" || quote === "USDC" || quote === "USD") return `$${compactRu(row.turnover24h)}`;
  return `${compactRu(row.turnover24h)} ${quote}`;
}

function spread(row: BitgetScreenerRow): string {
  if (row.spreadBps == null) return "—";
  return `${(row.spreadBps / 100).toFixed(row.spreadBps < 10 ? 3 : 2)}%`;
}

function tone(value: number | null): string {
  if (value == null || value === 0) return "text-slate-400";
  return value > 0 ? "text-emerald-300" : "text-rose-300";
}

function underlyingTicker(row: BitgetScreenerRow): string {
  const base = (row.baseCoin || row.symbol).toUpperCase();
  if (row.isReality && base.startsWith("R") && base.length > 1) return base.slice(1);
  return base;
}

function copyTicker(row: BitgetScreenerRow): string {
  if (row.marketGroup === "RTOKEN_SPOT" || row.marketGroup === "STOCK_PERPS") return underlyingTicker(row);
  if (row.marketGroup === "CRYPTO_FUTURES" || row.marketGroup === "COMMODITY_PERPS") return `${row.symbol}.P`;
  return row.symbol;
}

function tradingViewSymbol(row: BitgetScreenerRow): string {
  if (row.marketGroup === "RTOKEN_SPOT" || row.marketGroup === "STOCK_PERPS") return underlyingTicker(row);
  if (row.marketGroup === "CRYPTO_FUTURES" || row.marketGroup === "COMMODITY_PERPS") return `BITGET:${row.symbol}.P`;
  return `BITGET:${row.symbol}`;
}

function numeric(row: BitgetScreenerRow, key: SortKey): number | null {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function compareNullable(a: number | null, b: number | null, dir: SortDir): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return dir === "desc" ? b - a : a - b;
}

function formatTime(value: string | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function buildSnapshot(rows: BitgetScreenerRow[], data: BitgetScreenerResponse) {
  const online = rows.filter((row) => row.status.toLowerCase() === "online");
  const gainers = online.filter((row) => row.change24hPct != null).slice().sort((a, b) => (b.change24hPct ?? 0) - (a.change24hPct ?? 0)).slice(0, 7);
  const losers = online.filter((row) => row.change24hPct != null).slice().sort((a, b) => (a.change24hPct ?? 0) - (b.change24hPct ?? 0)).slice(0, 7);
  const liquid = online.filter((row) => row.turnover24h != null).slice().sort((a, b) => (b.turnover24h ?? 0) - (a.turnover24h ?? 0)).slice(0, 7);
  const funding = online.filter((row) => row.fundingRatePct != null).slice().sort((a, b) => Math.abs(b.fundingRatePct ?? 0) - Math.abs(a.fundingRatePct ?? 0)).slice(0, 7);
  const line = (row: BitgetScreenerRow) => `${underlyingTicker(row)} · ${GROUP_LABELS[row.marketGroup]} · 24ч ${pct(row.change24hPct)} · ход ${pct(row.range24hPct)} · оборот ${turnover(row)}${row.fundingRatePct != null ? ` · funding ${pct(row.fundingRatePct, 4)}` : ""}`;

  return [
    `BITGET · снимок рынка · ${new Date(data.status.asOf).toLocaleString("ru-RU")}`,
    `Universe ${data.summary.online} · в фокусе ${data.summary.inPlay} · рост ${data.summary.gainers} · падение ${data.summary.losers}`,
    "",
    "ЛИДЕРЫ РОСТА",
    ...gainers.map(line),
    "",
    "ЛИДЕРЫ ПАДЕНИЯ",
    ...losers.map(line),
    "",
    "МАКСИМАЛЬНЫЙ ОБОРОТ",
    ...liquid.map(line),
    "",
    "ЭКСТРЕМАЛЬНЫЙ FUNDING",
    ...(funding.length ? funding.map(line) : ["Нет funding-данных"]),
  ].join("\n");
}

function SortButton({ label, sortKey, sort, onChange, title }: { label: string; sortKey: SortKey; sort: { key: SortKey; dir: SortDir }; onChange: (key: SortKey) => void; title?: string }) {
  const active = sort.key === sortKey;
  return (
    <button type="button" onClick={() => onChange(sortKey)} title={title} className={`inline-flex items-center gap-1 whitespace-nowrap ${active ? "text-slate-200" : "text-slate-500 hover:text-slate-300"}`}>
      {label}
      {active ? (sort.dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : null}
    </button>
  );
}

function MarketBadge({ row }: { row: BitgetScreenerRow }) {
  const classes = row.marketGroup === "RTOKEN_SPOT"
    ? "border-violet-400/15 bg-violet-400/[0.04] text-violet-300/85"
    : row.marketGroup === "STOCK_PERPS"
      ? "border-sky-400/15 bg-sky-400/[0.04] text-sky-300/85"
      : row.marketGroup === "COMMODITY_PERPS"
        ? "border-amber-400/15 bg-amber-400/[0.04] text-amber-300/85"
        : "border-white/[0.07] bg-white/[0.02] text-slate-400";
  return <span className={`rounded-sm border px-1.5 py-0.5 text-[9px] ${classes}`}>{GROUP_LABELS[row.marketGroup]}</span>;
}

function LeaderBlock({ title, rows, metric, onSelect }: { title: string; rows: BitgetScreenerRow[]; metric: (row: BitgetScreenerRow) => string; onSelect: (id: string) => void }) {
  return (
    <div className="min-w-0 border-l border-white/[0.06] pl-3 first:border-l-0 first:pl-0">
      <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">{title}</p>
      <div className="mt-2 space-y-1.5">
        {rows.slice(0, 3).map((row) => (
          <button key={row.id} type="button" onClick={() => onSelect(row.id)} className="grid w-full grid-cols-[1fr_auto] gap-2 text-left text-[10px] hover:text-slate-100">
            <span className="truncate font-mono text-slate-300">{underlyingTicker(row)}</span>
            <span className={`font-mono tabular-nums ${row.change24hPct != null ? tone(row.change24hPct) : "text-slate-500"}`}>{metric(row)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function InstrumentWorkspace({
  row,
  weekly,
  favorite,
  note,
  onToggleFavorite,
  onNote,
  onCopyContext,
}: {
  row: BitgetScreenerRow;
  weekly?: WeeklyMetric;
  favorite: boolean;
  note: string;
  onToggleFavorite: () => void;
  onNote: (value: string) => void;
  onCopyContext: () => void;
}) {
  const tvSymbol = tradingViewSymbol(row);
  const tvUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`;
  const details: [string, string][] = [
    ["Биржевой символ", row.symbol],
    ["Категория", row.category],
    ["Bid / Ask", `${price(row.bid)} / ${price(row.ask)}`],
    ["Спред", row.spreadBps == null ? "—" : `${spread(row)} · ${row.spreadBps.toFixed(1)} б.п.`],
    ["High / Low 24ч", `${price(row.high24h)} / ${price(row.low24h)}`],
    ["Позиция в ходе", row.rangePositionPct == null ? "—" : `${row.rangePositionPct.toFixed(0)}%`],
    ["Объём 24ч", compactRu(row.volume24h)],
    ["Open Interest", compactRu(row.openInterest)],
    ["Funding", pct(row.fundingRatePct, 4)],
    ["Mark / Index", `${price(row.markPrice)} / ${price(row.indexPrice)}`],
    ["Макс. плечо", row.maxLeverage == null ? "—" : `${row.maxLeverage}×`],
    ["Мин. ордер", row.minOrderAmount == null ? "—" : `${compactRu(row.minOrderAmount)} ${row.quoteCoin}`],
  ];

  return (
    <div className="border-y border-cyan-400/15 bg-[#050a18]/80 px-3 py-4 shadow-inner shadow-black/20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {row.isReality ? <span className="rounded border border-violet-400/20 bg-violet-400/[0.06] px-1.5 py-0.5 text-[9px] font-semibold text-violet-300">R</span> : null}
            <h3 className="font-mono text-lg font-semibold text-slate-100">{underlyingTicker(row)}</h3>
            <MarketBadge row={row} />
          </div>
          <p className="mt-1 text-[10px] text-slate-600">{row.symbol} · TradingView: {tvSymbol}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onToggleFavorite} className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] ${favorite ? "border-amber-400/25 bg-amber-400/[0.06] text-amber-200" : "border-white/[0.08] text-slate-400 hover:text-slate-200"}`}>
            <Star className={`h-3 w-3 ${favorite ? "fill-current" : ""}`} /> Избранное
          </button>
          <button type="button" onClick={onCopyContext} className="inline-flex items-center gap-1 rounded border border-white/[0.08] px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200">
            <Clipboard className="h-3 w-3" /> Копировать контекст
          </button>
          <a href={tvUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded border border-cyan-400/20 bg-cyan-400/[0.04] px-2 py-1 text-[10px] text-cyan-200 hover:bg-cyan-400/[0.08]">
            <ExternalLink className="h-3 w-3" /> Открыть TradingView
          </a>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {[
          ["Цена", price(row.lastPrice), "text-slate-100"],
          ["24 часа", pct(row.change24hPct), tone(row.change24hPct)],
          ["7 дней", pct(weekly?.change7dPct ?? null), tone(weekly?.change7dPct ?? null)],
          ["Ход 24ч", pct(row.range24hPct), "text-slate-200"],
          ["Оборот", turnover(row), "text-slate-200"],
          ["Спред", spread(row), "text-slate-200"],
          ["Funding", pct(row.fundingRatePct, 4), row.fundingRatePct == null ? "text-slate-600" : tone(row.fundingRatePct)],
        ].map(([label, value, cls]) => (
          <div key={label} className="rounded border border-white/[0.06] bg-white/[0.018] px-2.5 py-2">
            <p className="text-[8px] uppercase tracking-[0.13em] text-slate-600">{label}</p>
            <p className={`mt-1 font-mono text-[11px] font-medium tabular-nums ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.7fr)]">
        <TradingViewChart symbol={tvSymbol} />
        <div className="space-y-3">
          <div className="rounded-md border border-white/[0.07] bg-white/[0.015] p-3">
            <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">Параметры инструмента</p>
            <div className="mt-2 divide-y divide-white/[0.05]">
              {details.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 py-1.5 text-[10px]">
                  <span className="text-slate-600">{label}</span>
                  <span className="text-right font-mono tabular-nums text-slate-300">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-white/[0.07] bg-white/[0.015] p-3">
            <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">Наблюдение для брифинга</p>
            <textarea
              value={note}
              onChange={(event) => onNote(event.target.value)}
              placeholder="Например: рост объёма, реакция на уровень, проверить новость, сравнить со SPY..."
              className="mt-2 min-h-24 w-full resize-y rounded border border-white/[0.07] bg-slate-950/60 p-2 text-[11px] leading-relaxed text-slate-300 outline-none placeholder:text-slate-700 focus:border-cyan-400/20"
            />
            <p className="mt-1.5 text-[9px] text-slate-700">Заметка сохраняется в этом браузере вместе с watchlist.</p>
          </div>

          {row.attentionReasons.length ? (
            <div className="rounded-md border border-white/[0.07] bg-white/[0.015] p-3">
              <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">Рыночные аномалии</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {row.attentionReasons.map((reason) => <span key={reason} className="rounded border border-white/[0.07] px-1.5 py-0.5 text-[9px] text-slate-400">{reason}</span>)}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function BitgetTerminalV2() {
  const [data, setData] = React.useState<BitgetScreenerResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [autoRefresh, setAutoRefresh] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [group, setGroup] = React.useState<BitgetMarketGroup | "ALL">("ALL");
  const [quick, setQuick] = React.useState<BitgetQuickFilter>("inPlay");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: SortDir }>({ key: "turnover24h", dir: "desc" });
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [watchlist, setWatchlist] = React.useState<Set<string>>(new Set());
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [briefingOpen, setBriefingOpen] = React.useState(true);
  const [displayLimit, setDisplayLimit] = React.useState(120);
  const [weekly, setWeekly] = React.useState<Record<string, WeeklyMetric>>({});
  const [hydrated, setHydrated] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const weeklyRequested = React.useRef(new Set<string>());

  const showToast = React.useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 1400);
  }, []);

  const load = React.useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/bitget/screener", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setData((await response.json()) as BitgetScreenerResponse);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось обновить рынок");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as PersistedState;
      const groupFromUrl = new URLSearchParams(window.location.search).get("group") as BitgetMarketGroup | null;
      if (groupFromUrl && GROUPS.includes(groupFromUrl)) setGroup(groupFromUrl);
      else if (saved.group && (saved.group === "ALL" || GROUPS.includes(saved.group))) setGroup(saved.group);
      if (saved.quick && QUICK_FILTERS.some((item) => item.id === saved.quick)) setQuick(saved.quick);
      setWatchlist(new Set(saved.watchlist ?? []));
      setNotes(saved.notes ?? {});
    } catch {
      // Local workspace is optional; broken local data must never break the market screen.
    } finally {
      setHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    const payload: PersistedState = { group, quick, watchlist: Array.from(watchlist), notes };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [hydrated, group, quick, watchlist, notes]);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, load]);

  React.useEffect(() => { setDisplayLimit(120); }, [group, quick, query]);

  const onlineRows = React.useMemo(() => (data?.rows ?? []).filter((row) => row.status.toLowerCase() === "online"), [data]);
  const counts = React.useMemo(() => {
    const map = new Map<BitgetMarketGroup, number>();
    onlineRows.forEach((row) => map.set(row.marketGroup, (map.get(row.marketGroup) ?? 0) + 1));
    return map;
  }, [onlineRows]);

  const filteredRows = React.useMemo(() => {
    let rows = onlineRows;
    if (group !== "ALL") rows = rows.filter((row) => row.marketGroup === group);
    const needle = query.trim().toUpperCase();
    if (needle) rows = rows.filter((row) => `${row.symbol} ${row.baseCoin} ${underlyingTicker(row)}`.toUpperCase().includes(needle));
    if (quick === "inPlay") rows = rows.filter((row) => row.inPlay);
    if (quick === "gainers") rows = rows.filter((row) => row.change24hPct != null && row.change24hPct >= 3);
    if (quick === "losers") rows = rows.filter((row) => row.change24hPct != null && row.change24hPct <= -3);
    if (quick === "wideRange") rows = rows.filter((row) => row.range24hPct != null && row.range24hPct >= 5);
    if (quick === "funding") rows = rows.filter((row) => row.fundingRatePct != null && Math.abs(row.fundingRatePct) >= 0.03);
    return rows.slice().sort((a, b) => compareNullable(numeric(a, sort.key), numeric(b, sort.key), sort.dir));
  }, [onlineRows, group, query, quick, sort]);

  const renderedRows = filteredRows.slice(0, displayLimit);

  React.useEffect(() => {
    const candidates = renderedRows
      .slice(0, 60)
      .filter((row) => !weekly[row.id] && !weeklyRequested.current.has(row.id));
    if (!candidates.length) return;
    candidates.forEach((row) => weeklyRequested.current.add(row.id));
    const items = candidates.map((row) => `${row.category}:${row.symbol}`).join(",");
    fetch(`/api/bitget/weekly?items=${encodeURIComponent(items)}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(String(response.status))))
      .then((payload: { metrics?: Array<{ id: string; change7dPct: number | null; range7dPct: number | null }> }) => {
        const next: Record<string, WeeklyMetric> = {};
        for (const metric of payload.metrics ?? []) next[metric.id] = { change7dPct: metric.change7dPct, range7dPct: metric.range7dPct };
        setWeekly((current) => ({ ...current, ...next }));
      })
      .catch(() => candidates.forEach((row) => weeklyRequested.current.delete(row.id)));
  }, [renderedRows, weekly]);

  const leaders = React.useMemo(() => ({
    gainers: onlineRows.filter((row) => row.change24hPct != null).slice().sort((a, b) => (b.change24hPct ?? 0) - (a.change24hPct ?? 0)).slice(0, 3),
    losers: onlineRows.filter((row) => row.change24hPct != null).slice().sort((a, b) => (a.change24hPct ?? 0) - (b.change24hPct ?? 0)).slice(0, 3),
    liquid: onlineRows.filter((row) => row.turnover24h != null).slice().sort((a, b) => (b.turnover24h ?? 0) - (a.turnover24h ?? 0)).slice(0, 3),
    funding: onlineRows.filter((row) => row.fundingRatePct != null).slice().sort((a, b) => Math.abs(b.fundingRatePct ?? 0) - Math.abs(a.fundingRatePct ?? 0)).slice(0, 3),
  }), [onlineRows]);

  const handleSort = (key: SortKey) => setSort((current) => current.key === key ? { key, dir: current.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" });

  const copyText = React.useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(label);
    } catch {
      showToast("Не удалось скопировать");
    }
  }, [showToast]);

  const scrollToRow = React.useCallback((id: string) => {
    setQuick("all");
    setGroup("ALL");
    setExpandedId(id);
    window.setTimeout(() => document.getElementById(`bitget-row-${CSS.escape(id)}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  }, []);

  function toggleFavorite(id: string) {
    setWatchlist((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function copyContext(row: BitgetScreenerRow) {
    const text = [
      `${underlyingTicker(row)} · ${GROUP_LABELS[row.marketGroup]}`,
      `Bitget symbol: ${row.symbol}`,
      `Цена: ${price(row.lastPrice)}`,
      `24ч: ${pct(row.change24hPct)} · 7д: ${pct(weekly[row.id]?.change7dPct ?? null)}`,
      `Ход 24ч: ${pct(row.range24hPct)} · оборот: ${turnover(row)} · спред: ${spread(row)}`,
      row.fundingRatePct != null ? `Funding: ${pct(row.fundingRatePct, 4)} · OI: ${compactRu(row.openInterest)}` : "",
      notes[row.id] ? `Моя заметка: ${notes[row.id]}` : "",
    ].filter(Boolean).join("\n");
    await copyText(text, "Контекст инструмента скопирован");
  }

  if (loading && !data) return <div className="py-24 text-center text-sm text-slate-500">Загружаю рынок Bitget…</div>;
  if (error && !data) return <div className="rounded border border-rose-400/20 bg-rose-400/[0.04] p-5 text-sm text-rose-200">Не удалось загрузить рынок: {error}</div>;

  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-2 pb-12">
      {toast ? <div className="fixed right-5 top-5 z-[100] rounded border border-cyan-400/20 bg-slate-950/95 px-3 py-2 text-[10px] text-cyan-200 shadow-xl">{toast}</div> : null}

      <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] py-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[14px] font-semibold text-slate-100">Рынок · Bitget</h1>
            <Link href="/screener/bitget/map" className="inline-flex items-center gap-1 rounded border border-cyan-400/15 bg-cyan-400/[0.035] px-2 py-0.5 text-[9px] text-cyan-200 hover:bg-cyan-400/[0.07]">
              <Map className="h-3 w-3" /> Карта рынков
            </Link>
          </div>
          <p className="mt-1 text-[10px] text-slate-600">Все инструменты → отбор → график → заметка → брифинг</p>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-slate-600">
          <span>{formatTime(data?.status.asOf)}</span>
          <span>·</span>
          <span>{data?.summary.online ?? 0} инструментов</span>
          <label className="inline-flex cursor-pointer items-center gap-1">
            <input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} className="h-3 w-3" /> 30с
          </label>
          <button type="button" onClick={() => void load()} className="rounded border border-white/[0.07] p-1 text-slate-500 hover:text-slate-200" aria-label="Обновить"><RefreshCw className="h-3 w-3" /></button>
        </div>
      </header>

      <section className="grid gap-0 rounded-md border border-white/[0.06] bg-slate-950/30 px-3 py-3 md:grid-cols-4">
        <LeaderBlock title="Сильнее всего" rows={leaders.gainers} metric={(row) => pct(row.change24hPct)} onSelect={scrollToRow} />
        <LeaderBlock title="Слабее всего" rows={leaders.losers} metric={(row) => pct(row.change24hPct)} onSelect={scrollToRow} />
        <LeaderBlock title="Самый большой оборот" rows={leaders.liquid} metric={(row) => turnover(row)} onSelect={scrollToRow} />
        <LeaderBlock title="Funding экстремум" rows={leaders.funding} metric={(row) => pct(row.fundingRatePct, 4)} onSelect={scrollToRow} />
      </section>

      <section className="rounded-md border border-white/[0.06] bg-slate-950/30">
        <div className="flex flex-wrap items-center gap-1 border-b border-white/[0.05] px-2 py-2">
          <button type="button" onClick={() => setGroup("ALL")} className={`rounded px-2 py-1 text-[9px] ${group === "ALL" ? "bg-cyan-400/[0.09] text-cyan-200" : "text-slate-500 hover:text-slate-300"}`}>Все {onlineRows.length}</button>
          {GROUPS.map((item) => <button key={item} type="button" onClick={() => setGroup(item)} className={`rounded px-2 py-1 text-[9px] ${group === item ? "bg-cyan-400/[0.09] text-cyan-200" : "text-slate-500 hover:text-slate-300"}`}>{GROUP_SHORT[item]} {counts.get(item) ?? 0}</button>)}
          <span className="mx-1 h-4 w-px bg-white/[0.06]" />
          {QUICK_FILTERS.map((item) => <button key={item.id} type="button" onClick={() => setQuick(item.id)} className={`rounded px-2 py-1 text-[9px] ${quick === item.id ? "bg-white/[0.07] text-slate-200" : "text-slate-600 hover:text-slate-300"}`}>{item.label}</button>)}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1 rounded border border-white/[0.07] bg-black/15 px-2 py-1">
              <Search className="h-3 w-3 text-slate-600" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Тикер / актив" className="w-28 bg-transparent text-[10px] text-slate-300 outline-none placeholder:text-slate-700" />
            </div>
            <button type="button" onClick={() => setBriefingOpen((value) => !value)} className="rounded border border-white/[0.07] px-2 py-1 text-[9px] text-slate-400 hover:text-slate-200">Брифинг</button>
          </div>
        </div>

        {briefingOpen && data ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.05] bg-white/[0.012] px-3 py-2">
            <div className="text-[10px] text-slate-500">
              Сейчас: <span className="text-slate-300">{data.summary.inPlay} в фокусе</span> · {data.summary.gainers} растут · {data.summary.losers} падают · watchlist {watchlist.size}
            </div>
            <button type="button" onClick={() => void copyText(buildSnapshot(onlineRows, data), "Снимок рынка скопирован")} className="inline-flex items-center gap-1 rounded border border-cyan-400/15 bg-cyan-400/[0.03] px-2 py-1 text-[9px] text-cyan-200 hover:bg-cyan-400/[0.07]">
              <Clipboard className="h-3 w-3" /> Копировать снимок рынка
            </button>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-left">
            <thead className="sticky top-0 z-20 bg-[#070c1b]/95 backdrop-blur">
              <tr className="border-b border-white/[0.06] text-[9px] uppercase tracking-[0.1em] text-slate-600">
                <th className="px-2 py-2 font-medium">Инструмент</th>
                <th className="px-2 py-2 font-medium">Рынок</th>
                <th className="px-2 py-2 text-right font-medium">Цена</th>
                <th className="px-2 py-2 text-right font-medium"><SortButton label="24ч" sortKey="change24hPct" sort={sort} onChange={handleSort} /></th>
                <th className="px-2 py-2 text-right font-medium" title="Подгружается из дневных свечей для текущего списка и кэшируется">7 дней</th>
                <th className="px-2 py-2 text-right font-medium"><SortButton label="Ход 24ч" sortKey="range24hPct" sort={sort} onChange={handleSort} title="High–Low за последние 24 часа" /></th>
                <th className="px-2 py-2 text-right font-medium"><SortButton label="Оборот 24ч" sortKey="turnover24h" sort={sort} onChange={handleSort} /></th>
                <th className="px-2 py-2 text-right font-medium"><SortButton label="Спред" sortKey="spreadBps" sort={sort} onChange={handleSort} title="Разница между лучшим bid и ask. В таблице показана в процентах." /></th>
                <th className="px-2 py-2 text-right font-medium"><SortButton label="Funding" sortKey="fundingRatePct" sort={sort} onChange={handleSort} title="Только для perpetual futures. Пустые значения всегда остаются внизу." /></th>
                <th className="px-2 py-2 text-right font-medium"><SortButton label="Фокус" sortKey="attentionScore" sort={sort} onChange={handleSort} title="Служебный приоритет внимания, не торговый сигнал" /></th>
              </tr>
            </thead>
            <tbody>
              {renderedRows.map((row) => {
                const isExpanded = expandedId === row.id;
                const favorite = watchlist.has(row.id);
                const weeklyMetric = weekly[row.id];
                return (
                  <React.Fragment key={row.id}>
                    <tr id={`bitget-row-${row.id}`} onClick={() => setExpandedId(isExpanded ? null : row.id)} className={`cursor-pointer border-b border-white/[0.045] text-[10px] transition hover:bg-white/[0.025] ${isExpanded ? "bg-cyan-400/[0.035]" : ""}`}>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={(event) => { event.stopPropagation(); void copyText(copyTicker(row), `${copyTicker(row)} скопирован`); }} title="Копировать тикер для TradingView" className="group flex min-w-0 items-center gap-1.5 text-left">
                            {row.isReality ? <span className="rounded border border-violet-400/20 bg-violet-400/[0.06] px-1 py-0.5 text-[8px] font-semibold text-violet-300">R</span> : null}
                            <span className="font-mono font-semibold text-slate-200 group-hover:text-cyan-200">{underlyingTicker(row)}</span>
                            <Clipboard className="h-2.5 w-2.5 text-slate-700 opacity-0 transition group-hover:opacity-100" />
                          </button>
                          <button type="button" onClick={(event) => { event.stopPropagation(); toggleFavorite(row.id); }} title="Избранное" className={`ml-1 ${favorite ? "text-amber-300" : "text-slate-800 hover:text-slate-500"}`}><Star className={`h-3 w-3 ${favorite ? "fill-current" : ""}`} /></button>
                        </div>
                        <p className="mt-0.5 font-mono text-[8px] text-slate-700">{row.symbol}</p>
                      </td>
                      <td className="px-2 py-2"><MarketBadge row={row} /></td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-300">{price(row.lastPrice)}</td>
                      <td className={`px-2 py-2 text-right font-mono tabular-nums ${tone(row.change24hPct)}`}>{pct(row.change24hPct)}</td>
                      <td className={`px-2 py-2 text-right font-mono tabular-nums ${tone(weeklyMetric?.change7dPct ?? null)}`}>{pct(weeklyMetric?.change7dPct ?? null)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-300">{pct(row.range24hPct)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-300">{turnover(row)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-400" title={row.spreadBps == null ? undefined : `${row.spreadBps.toFixed(1)} базисных пункта`}>{spread(row)}</td>
                      <td className={`px-2 py-2 text-right font-mono tabular-nums ${row.fundingRatePct == null ? "text-slate-700" : tone(row.fundingRatePct)}`}>{pct(row.fundingRatePct, 4)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-500">{row.attentionScore}</td>
                    </tr>
                    {isExpanded ? (
                      <tr>
                        <td colSpan={10} className="p-0">
                          <InstrumentWorkspace
                            row={row}
                            weekly={weeklyMetric}
                            favorite={favorite}
                            note={notes[row.id] ?? ""}
                            onToggleFavorite={() => toggleFavorite(row.id)}
                            onNote={(value) => setNotes((current) => ({ ...current, [row.id]: value }))}
                            onCopyContext={() => void copyContext(row)}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] px-3 py-2 text-[9px] text-slate-600">
          <span>Показано {renderedRows.length} из {filteredRows.length}. Один вертикальный скролл — скролл страницы.</span>
          {renderedRows.length < filteredRows.length ? <button type="button" onClick={() => setDisplayLimit((value) => value + 120)} className="rounded border border-white/[0.07] px-2 py-1 text-slate-400 hover:text-slate-200">Показать ещё 120</button> : null}
        </div>
      </section>

      {data?.status.warnings.length ? <div className="rounded border border-amber-400/15 bg-amber-400/[0.03] px-3 py-2 text-[9px] text-amber-200/70">Часть рынка обновилась не полностью. Экран показывает только реально полученные данные; отсутствующие значения остаются «—».</div> : null}
    </div>
  );
}
