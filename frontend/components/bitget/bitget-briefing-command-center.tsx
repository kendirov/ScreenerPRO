"use client";

import * as React from "react";
import type { BitgetBriefingResponse, BriefingRow } from "@/lib/bitget/briefing-types";

function pct(value: number | null) { return value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`; }
function label(item: BriefingRow) { return item.row.baseCoin || item.row.symbol; }

function Card({ item }: { item: BriefingRow }) {
  return <button type="button" className="rounded-xl border border-white/[0.07] bg-slate-950/45 p-3 text-left transition hover:border-cyan-300/25 hover:bg-cyan-400/[0.035]" onClick={() => document.getElementById("bitget-instruments")?.scrollIntoView({ behavior: "smooth" })}>
    <div className="flex items-start justify-between gap-3"><span className="font-mono text-sm font-semibold text-slate-100">{label(item)}</span><span className="font-mono text-xs text-cyan-200">{item.attention}</span></div>
    <div className="mt-1 flex items-center justify-between text-[9px] text-slate-500"><span>{item.situation}</span><span className={item.row.change24hPct != null && item.row.change24hPct >= 0 ? "text-emerald-300" : "text-rose-300"}>{pct(item.row.change24hPct)}</span></div>
    <p className="mt-3 min-h-8 text-[10px] leading-relaxed text-slate-400">{item.reasons.join(" · ") || "Недостаточно подтверждений"}</p>
    <div className="mt-3 flex justify-between border-t border-white/[0.05] pt-2 text-[8px] text-slate-600"><span>исполнение {item.executionQuality}/100</span><span>{item.disposition === "IN_PLAY" ? "IN PLAY" : "WATCH"}</span></div>
  </button>;
}

export function BitgetBriefingCommandCenter() {
  const [data, setData] = React.useState<BitgetBriefingResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => { fetch("/api/bitget/briefing", { cache: "no-store" }).then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))).then(setData).catch((cause) => setError(cause instanceof Error ? cause.message : "Ошибка загрузки")); }, []);
  if (error) return <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.03] px-4 py-3 text-[10px] text-amber-200">Briefing недоступен: {error}</div>;
  if (!data) return <div className="rounded-2xl border border-white/[0.06] px-4 py-5 text-[10px] text-slate-500">Собираю briefing из Bitget…</div>;
  return <section className="space-y-3 rounded-[26px] border border-cyan-300/15 bg-[#050914]/70 p-4 shadow-[0_0_34px_rgba(34,211,238,0.04)]">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[9px] uppercase tracking-[0.18em] text-cyan-200/70">Bitget briefing command center</p><h2 className="mt-1 text-lg font-semibold text-slate-100">Что сейчас действительно в игре</h2><p className="mt-1 text-[10px] text-slate-500">Execution truth: Attention → Execution Quality → Situation. Максимум 10 кандидатов.</p></div><div className="text-right text-[9px] text-slate-600"><p>In Play <span className="font-mono text-cyan-200">{data.topInPlay.length}</span> · Watch <span className="font-mono text-amber-200">{data.watchOnly.length}</span></p><p className="mt-1">baseline: <span className="text-amber-300">не подключён</span></p></div></div>
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">{data.topInPlay.slice(0, 8).map((item) => <Card key={item.row.id} item={item} />)}</div>
    {!data.topInPlay.length ? <p className="rounded-xl border border-white/[0.05] px-3 py-4 text-center text-[10px] text-slate-600">Нет кандидатов с одновременно высокой активностью и приемлемым исполнением.</p> : null}
    <p className="text-[8px] leading-relaxed text-slate-700">Качество: {data.status.quality}. 24h proxy не заменяет baseline 4–8 недель; эти состояния предназначены для навигации, не для автоматической сделки.</p>
  </section>;
}
