"use client";

import * as React from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Clipboard,
  Database,
  RefreshCw,
  Search,
  Star,
  X,
} from "lucide-react";
import type {
  BitgetMarketGroup,
  BitgetQuickFilter,
  BitgetScreenerResponse,
  BitgetScreenerRow,
} from "@/lib/bitget/types";

const GROUP_LABELS: Record<BitgetMarketGroup, string> = {
  CRYPTO_SPOT: "Крипто spot",
  CRYPTO_FUTURES: "Крипто futures",
  MARGIN: "Margin",
  RTOKEN_SPOT: "rToken",
  STOCK_PERPS: "Stock perps",
  COMMODITY_PERPS: "Товары",
};

const GROUP_ORDER: BitgetMarketGroup[] = [
  "CRYPTO_SPOT",
  "CRYPTO_FUTURES",
  "MARGIN",
  "RTOKEN_SPOT",
  "STOCK_PERPS",
  "COMMODITY_PERPS",
];

type SortKey = "attentionScore" | "change24hPct" | "range24hPct" | "turnover24h" | "spreadBps" | "fundingRatePct";
type SortDir = "asc" | "desc";

const QUICK_FILTERS: { id: BitgetQuickFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "inPlay", label: "В игре" },
  { id: "gainers", label: "Рост" },
  { id: "losers", label: "Падение" },
  { id: "wideRange", label: "Диапазон" },
  { id: "funding", label: "Funding" },
];

function compact(value: number | null, suffix = ""): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T${suffix}`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B${suffix}`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M${suffix}`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K${suffix}`;
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 4 })}${suffix}`;
}

function price(value: number | null): string {
  if (value == null) return "—";
  const digits = value >= 1000 ? 2 : value >= 1 ? 4 : 7;
  return value.toLocaleString("ru-RU", { maximumFractionDigits: digits });
}

function pct(value: number | null, digits = 2): string {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function tone(value: number | null): string {
  if (value == null || value === 0) return "text-slate-300";
  return value > 0 ? "text-emerald-300" : "text-rose-300";
}

function scoreTone(score: number): string {
  if (score >= 75) return "border-cyan-400/35 bg-cyan-400/10 text-cyan-200";
  if (score >= 58) return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  return "border-white/10 bg-white/[0.025] text-slate-400";
}

function sortNumber(row: BitgetScreenerRow, key: SortKey): number {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function buildBriefing(rows: BitgetScreenerRow[], response: BitgetScreenerResponse): string {
  const active = rows.filter((row) => row.inPlay).slice(0, 7);
  const gainers = rows
    .filter((row) => row.change24hPct != null)
    .slice()
    .sort((a, b) => (b.change24hPct ?? 0) - (a.change24hPct ?? 0))
    .slice(0, 4);
  const losers = rows
    .filter((row) => row.change24hPct != null)
    .slice()
    .sort((a, b) => (a.change24hPct ?? 0) - (b.change24hPct ?? 0))
    .slice(0, 4);
  const funding = rows
    .filter((row) => row.fundingRatePct != null)
    .slice()
    .sort((a, b) => Math.abs(b.fundingRatePct ?? 0) - Math.abs(a.fundingRatePct ?? 0))
    .slice(0, 4);

  const line = (row: BitgetScreenerRow) =>
    `${row.symbol} ${pct(row.change24hPct)} · диапазон ${pct(row.range24hPct)} · ${row.attentionReasons.join(", ") || "без явной аномалии"}`;

  return [
    `BITGET · рабочий брифинг · ${new Date(response.status.asOf).toLocaleString("ru-RU")}`,
    `Universe: ${response.summary.total} · online ${response.summary.online} · в игре ${response.summary.inPlay}`,
    "",
    "ЧТО ОТКРЫТЬ ПЕРВЫМ",
    ...(active.length ? active.map(line) : ["Явных лидеров по текущему фильтру нет."]),
    "",
    "СИЛЬНЕЕ РЫНКА",
    ...gainers.map(line),
    "",
    "СЛАБЕЕ РЫНКА",
    ...losers.map(line),
    "",
    "FUNDING / FUTURES",
    ...(funding.length
      ? funding.map((row) => `${row.symbol} funding ${pct(row.fundingRatePct, 4)} · OI ${compact(row.openInterest)}`)
      : ["Нет заметных funding-данных."]),
  ].join("\n");
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="min-w-[9rem] border-l border-white/[0.08] pl-3 first:border-l-0 first:pl-0">
      <p className="text-[9px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-100">{value}</p>
      <p className="mt-0.5 text-[10px] text-slate-500">{note}</p>
    </div>
  );
}

function ReasonChips({ row }: { row: BitgetScreenerRow }) {
  if (!row.attentionReasons.length) return <span className="text-[10px] text-slate-600">—</span>;
  return (
    <div className="flex max-w-[17rem] flex-wrap gap-1">
      {row.attentionReasons.map((reason) => (
        <span key={reason} className="rounded-sm border border-white/[0.07] bg-white/[0.025] px-1.5 py-0.5 text-[9px] text-slate-400">
          {reason}
        </span>
      ))}
    </div>
  );
}

function Inspector({ row, onClose }: { row: BitgetScreenerRow; onClose: () => void }) {
  const fields: [string, string][] = [
    ["Рынок", GROUP_LABELS[row.marketGroup]],
    ["Категория API", row.category],
    ["Тип", row.symbolType],
    ["Статус", row.status],
    ["24ч high / low", `${price(row.high24h)} / ${price(row.low24h)}`],
    ["Позиция в диапазоне", row.rangePositionPct == null ? "—" : `${row.rangePositionPct.toFixed(0)}%`],
    ["Bid / Ask", `${price(row.bid)} / ${price(row.ask)}`],
    ["Спред", row.spreadBps == null ? "—" : `${row.spreadBps.toFixed(1)} bps`],
    ["Оборот 24ч", compact(row.turnover24h)],
    ["Объём 24ч", compact(row.volume24h)],
    ["Funding", pct(row.fundingRatePct, 4)],
    ["Open interest", compact(row.openInterest)],
    ["Mark / Index", `${price(row.markPrice)} / ${price(row.indexPrice)}`],
    ["Макс. плечо", row.maxLeverage == null ? "—" : `${row.maxLeverage}x`],
    ["Мин. ордер", row.minOrderAmount == null ? "—" : compact(row.minOrderAmount, ` ${row.quoteCoin}`)],
  ];

  return (
    <aside className="sticky top-2 h-fit rounded-md border border-cyan-400/15 bg-slate-950/80 p-3 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-lg font-bold text-slate-100">{row.symbol}</h2>
            <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${scoreTone(row.attentionScore)}`}>
              {row.attentionScore}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">{row.baseCoin} / {row.quoteCoin} · {GROUP_LABELS[row.marketGroup]}</p>
        </div>
        <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-white/5 hover:text-slate-200" aria-label="Закрыть">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 border-b border-white/[0.07] py-3">
        <div><p className="text-[9px] text-slate-500">Цена</p><p className="mt-1 font-mono text-sm text-slate-100">{price(row.lastPrice)}</p></div>
        <div><p className="text-[9px] text-slate-500">24ч</p><p className={`mt-1 font-mono text-sm ${tone(row.change24hPct)}`}>{pct(row.change24hPct)}</p></div>
        <div><p className="text-[9px] text-slate-500">Range</p><p className="mt-1 font-mono text-sm text-slate-100">{pct(row.range24hPct)}</p></div>
      </div>

      <div className="py-3">
        <p className="text-[9px] uppercase tracking-[0.14em] text-slate-500">Почему в фокусе</p>
        <div className="mt-2"><ReasonChips row={row} /></div>
        {!row.inPlay ? <p className="mt-2 text-[10px] leading-relaxed text-slate-600">Сейчас не проходит порог «В игре». Score — приоритет внимания, не торговый сигнал.</p> : null}
      </div>

      <div className="space-y-1 border-t border-white/[0.07] pt-3">
        {fields.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-1 text-[10px]">
            <span className="text-slate-500">{label}</span>
            <span className="text-right font-mono tabular-nums text-slate-300">{value}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function BitgetGlobalScreener() {
  const [data, setData] = React.useState<BitgetScreenerResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [autoRefresh, setAutoRefresh] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [group, setGroup] = React.useState<BitgetMarketGroup | "ALL">("ALL");
  const [quick, setQuick] = React.useState<BitgetQuickFilter>("inPlay");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: SortDir }>({ key: "attentionScore", dir: "desc" });
  const [selected, setSelected] = React.useState<string | null>(null);
  const [watchlist, setWatchlist] = React.useState<Set<string>>(new Set());
  const [briefingOpen, setBriefingOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/bitget/screener", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as BitgetScreenerResponse;
      setData(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить рынок");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, load]);

  const counts = React.useMemo(() => {
    const result = new Map<BitgetMarketGroup, number>();
    for (const row of data?.rows ?? []) result.set(row.marketGroup, (result.get(row.marketGroup) ?? 0) + 1);
    return result;
  }, [data]);

  const visibleRows = React.useMemo(() => {
    let rows = (data?.rows ?? []).filter((row) => row.status.toLowerCase() === "online");
    if (group !== "ALL") rows = rows.filter((row) => row.marketGroup === group);
    const needle = query.trim().toUpperCase();
    if (needle) rows = rows.filter((row) => `${row.symbol} ${row.baseCoin} ${row.quoteCoin}`.toUpperCase().includes(needle));

    if (quick === "inPlay") rows = rows.filter((row) => row.inPlay);
    if (quick === "gainers") rows = rows.filter((row) => (row.change24hPct ?? 0) >= 3);
    if (quick === "losers") rows = rows.filter((row) => (row.change24hPct ?? 0) <= -3);
    if (quick === "wideRange") rows = rows.filter((row) => (row.range24hPct ?? 0) >= 5);
    if (quick === "funding") rows = rows.filter((row) => Math.abs(row.fundingRatePct ?? 0) >= 0.03);

    return rows.slice().sort((a, b) => {
      const left = sortNumber(a, sort.key);
      const right = sortNumber(b, sort.key);
      return sort.dir === "desc" ? right - left : left - right;
    });
  }, [data, group, query, quick, sort]);

  const selectedRow = React.useMemo(
    () => data?.rows.find((row) => row.id === selected) ?? null,
    [data, selected],
  );

  const briefing = React.useMemo(() => data ? buildBriefing(data.rows, data) : "", [data]);

  function toggleSort(key: SortKey) {
    setSort((current) => current.key === key ? { key, dir: current.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" });
  }

  function toggleWatch(id: string) {
    setWatchlist((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function copyBriefing() {
    await navigator.clipboard.writeText(briefing);
  }

  if (loading && !data) {
    return <div className="flex min-h-[55vh] items-center justify-center text-sm text-slate-500">Загрузка Bitget universe…</div>;
  }

  if (!data) {
    return (
      <div className="rounded-md border border-rose-400/20 bg-rose-400/5 p-5 text-sm text-rose-200">
        Bitget API сейчас недоступен: {error ?? "неизвестная ошибка"}. На локальной машине проверьте доступ к api.bitget.com.
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[14px] font-semibold text-slate-100">Рынок · Bitget</h1>
            <span className={`rounded border px-1.5 py-0.5 text-[9px] ${data.status.source === "bitget-v3" ? "border-emerald-400/20 text-emerald-300" : "border-amber-400/25 text-amber-200"}`}>
              {data.status.source === "bitget-v3" ? "LIVE" : "PARTIAL"}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-slate-500">Весь публичный universe · внимание → причина → инспектор</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span>{new Date(data.status.asOf).toLocaleTimeString("ru-RU")}</span>
          <span>{data.status.latencyMs} мс</span>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} /> 30с</label>
          <button onClick={() => void load()} className="rounded border border-white/10 p-1.5 hover:bg-white/5" title="Обновить"><RefreshCw className="h-3.5 w-3.5" /></button>
        </div>
      </header>

      {data.status.warnings.length ? (
        <div className="rounded border border-amber-400/20 bg-amber-400/[0.04] px-3 py-2 text-[10px] text-amber-100/80">
          Частичные данные: {data.status.warnings.join(" · ")}
        </div>
      ) : null}

      <section className="flex flex-wrap gap-x-6 gap-y-3 rounded-md border border-white/[0.06] bg-slate-950/45 px-4 py-3">
        <Kpi label="Universe" value={data.summary.total.toLocaleString("ru-RU")} note={`${data.summary.online} online`} />
        <Kpi label="В игре" value={data.summary.inPlay.toLocaleString("ru-RU")} note="аномалия + ликвидность" />
        <Kpi label="Futures" value={(data.summary.futures + data.summary.stockPerps + data.summary.commodityPerps).toLocaleString("ru-RU")} note="crypto · stocks · commodities" />
        <Kpi label="rToken" value={data.summary.reality.toLocaleString("ru-RU")} note="Reality spot" />
        <Kpi label="Breadth" value={`${data.summary.gainers}/${data.summary.losers}`} note="рост / падение" />
      </section>

      <section className="rounded-md border border-white/[0.06] bg-slate-950/35 p-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setGroup("ALL")} className={`rounded px-2 py-1 text-[10px] ${group === "ALL" ? "bg-cyan-400/12 text-cyan-200 ring-1 ring-cyan-400/25" : "text-slate-400 hover:bg-white/5"}`}>Все {data.summary.total}</button>
          {GROUP_ORDER.map((item) => (
            <button key={item} onClick={() => setGroup(item)} className={`rounded px-2 py-1 text-[10px] ${group === item ? "bg-cyan-400/12 text-cyan-200 ring-1 ring-cyan-400/25" : "text-slate-400 hover:bg-white/5"}`}>
              {GROUP_LABELS[item]} {counts.get(item) ?? 0}
            </button>
          ))}
          <div className="mx-1 h-4 w-px bg-white/[0.08]" />
          {QUICK_FILTERS.map((item) => (
            <button key={item.id} onClick={() => setQuick(item.id)} className={`rounded px-2 py-1 text-[10px] ${quick === item.id ? "bg-white/[0.08] text-slate-100" : "text-slate-500 hover:text-slate-300"}`}>
              {item.label}
            </button>
          ))}
          <div className="relative ml-auto min-w-[12rem]">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-600" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Тикер / актив" className="w-full rounded border border-white/[0.08] bg-black/20 py-1 pl-7 pr-2 font-mono text-[10px] text-slate-200 outline-none focus:border-cyan-400/30" />
          </div>
          <button onClick={() => setBriefingOpen((value) => !value)} className="rounded border border-white/[0.08] px-2 py-1 text-[10px] text-slate-300 hover:bg-white/5">Брифинг</button>
        </div>
      </section>

      {briefingOpen ? (
        <section className="rounded-md border border-cyan-400/15 bg-cyan-950/[0.09] p-3">
          <div className="mb-2 flex items-center justify-between">
            <div><p className="text-[10px] font-semibold text-cyan-100">Карта открытия терминала</p><p className="text-[9px] text-slate-500">Автосводка из текущих рыночных данных; не рекомендация.</p></div>
            <button onClick={() => void copyBriefing()} className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[9px] text-slate-400 hover:text-slate-100"><Clipboard className="h-3 w-3" /> Копировать</button>
          </div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap font-sans text-[10px] leading-relaxed text-slate-300">{briefing}</pre>
        </section>
      ) : null}

      <div className={`grid gap-2 ${selectedRow ? "xl:grid-cols-[minmax(0,1fr)_20rem]" : "grid-cols-1"}`}>
        <section className="min-w-0 overflow-hidden rounded-md border border-white/[0.06] bg-slate-950/35">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2 text-[9px] text-slate-500">
            <span>Показано {visibleRows.length} · score = приоритет внимания, не сигнал</span>
            <span className="flex items-center gap-1"><Database className="h-3 w-3" /> Bitget v3 public market</span>
          </div>
          <div className="max-h-[68vh] overflow-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
                <tr className="border-b border-white/[0.07] text-[9px] uppercase tracking-[0.08em] text-slate-600">
                  <th className="w-8 px-2 py-2"></th>
                  <th className="px-2 py-2">Инструмент</th>
                  <th className="px-2 py-2">Рынок</th>
                  <th className="px-2 py-2 text-right">Цена</th>
                  <th className="cursor-pointer px-2 py-2 text-right" onClick={() => toggleSort("change24hPct")}>24ч</th>
                  <th className="cursor-pointer px-2 py-2 text-right" onClick={() => toggleSort("range24hPct")}>Range</th>
                  <th className="cursor-pointer px-2 py-2 text-right" onClick={() => toggleSort("turnover24h")}>Оборот</th>
                  <th className="cursor-pointer px-2 py-2 text-right" onClick={() => toggleSort("spreadBps")}>Спред</th>
                  <th className="cursor-pointer px-2 py-2 text-right" onClick={() => toggleSort("fundingRatePct")}>Funding</th>
                  <th className="px-2 py-2">Почему</th>
                  <th className="cursor-pointer px-2 py-2 text-right" onClick={() => toggleSort("attentionScore")}>Score</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const isSelected = selected === row.id;
                  return (
                    <tr key={row.id} onClick={() => setSelected(isSelected ? null : row.id)} className={`cursor-pointer border-b border-white/[0.035] text-[10px] transition-colors hover:bg-white/[0.035] ${isSelected ? "bg-cyan-400/[0.055]" : ""}`}>
                      <td className="px-2 py-1.5"><button onClick={(event) => { event.stopPropagation(); toggleWatch(row.id); }} className={watchlist.has(row.id) ? "text-amber-300" : "text-slate-700 hover:text-slate-400"}><Star className="h-3 w-3" fill={watchlist.has(row.id) ? "currentColor" : "none"} /></button></td>
                      <td className="px-2 py-1.5"><div className="flex items-center gap-1.5"><span className="font-mono font-semibold text-slate-100">{row.symbol}</span>{row.inPlay ? <Activity className="h-3 w-3 text-cyan-300" /> : null}</div><span className="text-[8px] text-slate-600">{row.baseCoin}/{row.quoteCoin}</span></td>
                      <td className="px-2 py-1.5 text-slate-500">{GROUP_LABELS[row.marketGroup]}</td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-300">{price(row.lastPrice)}</td>
                      <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${tone(row.change24hPct)}`}>{row.change24hPct != null && row.change24hPct > 0 ? <ArrowUp className="mr-0.5 inline h-2.5 w-2.5" /> : row.change24hPct != null && row.change24hPct < 0 ? <ArrowDown className="mr-0.5 inline h-2.5 w-2.5" /> : null}{pct(row.change24hPct)}</td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-300">{pct(row.range24hPct)}</td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-400">{compact(row.turnover24h)}</td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-400">{row.spreadBps == null ? "—" : `${row.spreadBps.toFixed(1)} bps`}</td>
                      <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${tone(row.fundingRatePct)}`}>{pct(row.fundingRatePct, 4)}</td>
                      <td className="px-2 py-1.5"><ReasonChips row={row} /></td>
                      <td className="px-2 py-1.5 text-right"><span className={`inline-block min-w-8 rounded border px-1.5 py-0.5 text-center font-mono text-[9px] ${scoreTone(row.attentionScore)}`}>{row.attentionScore}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!visibleRows.length ? <div className="py-12 text-center text-xs text-slate-600">По этому фильтру инструментов нет.</div> : null}
          </div>
        </section>

        {selectedRow ? <Inspector row={selectedRow} onClose={() => setSelected(null)} /> : null}
      </div>

      <footer className="grid gap-2 md:grid-cols-3">
        <div className="rounded border border-white/[0.05] bg-white/[0.015] p-3"><p className="text-[9px] uppercase tracking-[0.12em] text-slate-600">Stock+ / Options</p><p className="mt-1 text-[10px] leading-relaxed text-slate-500">Архитектурно отдельный подписанный адаптер. Не выдаём отсутствие данных за ноль.</p></div>
        <div className="rounded border border-white/[0.05] bg-white/[0.015] p-3"><p className="text-[9px] uppercase tracking-[0.12em] text-slate-600">Следующий слой</p><p className="mt-1 text-[10px] leading-relaxed text-slate-500">RSI/ATR и относительная активность по истории свечей — фоновый расчёт с кэшем, а не 2 000 запросов на каждый рендер.</p></div>
        <div className="rounded border border-white/[0.05] bg-white/[0.015] p-3"><p className="text-[9px] uppercase tracking-[0.12em] text-slate-600">Watchlist</p><p className="mt-1 text-[10px] leading-relaxed text-slate-500">В этой итерации локальный в сессии: {watchlist.size}. Персистентное хранение добавим вместе с аккаунтным слоем.</p></div>
      </footer>
    </div>
  );
}
