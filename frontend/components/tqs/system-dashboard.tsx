"use client";
import * as React from "react";
import Link from "next/link";
import { Activity, Database, HardDrive, MemoryStick, Server, TimerReset } from "lucide-react";

type Health = any;
const fmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
export function SystemDashboard() {
  const [data,setData]=React.useState<Health|null>(null);
  React.useEffect(()=>{ let live=true; const load=()=>fetch("/api/tqs/health",{cache:"no-store"}).then(r=>r.json()).then(x=>live&&setData(x)).catch(()=>{}); load(); const t=setInterval(load,10000); return()=>{live=false;clearInterval(t)}},[]);
  const res=data?.resources; const rt=data?.runtime; const rr=data?.research_runtime; const sources=data?.sources??[];
  const cards=[
    ["CPU",res?fmt.format(res.cpu_percent)+"%":"—",Activity],
    ["RAM",res?fmt.format(res.memory_percent)+"%":"—",MemoryStick],
    ["Процесс",res?fmt.format(res.process_memory_mb/1024)+" GB":"—",Server],
    ["Диск свободно",res?fmt.format(res.data_disk_free_gb)+" GB":"—",HardDrive],
    ["Обновлений",rt?.refresh_count??"—",TimerReset],
    ["История",rr?.auto_history?`${rr.auto_history.done}/${rr.auto_history.target_total}`:"—",Database],
  ];
  return <div className="space-y-3">
    <div className="flex items-end justify-between"><div><h1 className="lab-type-display text-xl">Система и данные</h1><p className="text-xs text-lab-dim">TQS Intelligence · сбор, покрытие и ресурсы</p></div><span className={`rounded-full border px-2 py-1 text-[10px] ${data?.ok?"border-emerald-400/30 text-emerald-300":"border-rose-400/30 text-rose-300"}`}>{data?.ok?"LIVE":"OFFLINE"}</span></div>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">{cards.map(([label,value,Icon]:any)=><div key={label} className="rounded-xl border border-lab-border/50 bg-lab-surface-1/50 p-3"><Icon className="mb-3 h-4 w-4 text-lab-cyan"/><div className="font-mono text-lg text-lab-text">{value}</div><div className="text-[10px] uppercase tracking-wider text-lab-dim">{label}</div></div>)}</div>
    <div className="grid gap-3 lg:grid-cols-[1.25fr_.75fr]">
      <div className="rounded-xl border border-lab-border/50 bg-lab-surface-1/35 p-3"><div className="mb-3 text-xs uppercase tracking-wider text-lab-muted">Источники</div><div className="space-y-1">{sources.map((s:any)=><div key={s.provider} className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-lab-border/20 py-2 text-xs"><span>{s.name}</span><span className="font-mono text-lab-muted">{fmt.format(s.instruments)} инстр.</span><span className={s.status==="ok"?"text-emerald-300":"text-rose-300"}>{s.status} · {s.latency_ms} ms</span></div>)}</div></div>
      <div className="rounded-xl border border-lab-border/50 bg-lab-surface-1/35 p-3"><div className="text-xs uppercase tracking-wider text-lab-muted">Research runtime</div><div className="mt-3 space-y-2 text-xs text-lab-muted"><p>Режим <b className="text-lab-text">{rr?.mode??"—"}</b></p><p>History: <b className="font-mono text-lab-text">{rr?.auto_history?.done??0}/{rr?.auto_history?.target_total??0}</b></p><p>Metrics: <b className="font-mono text-lab-text">{rr?.auto_metrics?.done??0}/{rr?.auto_metrics?.target_total??0}</b></p><p>Refresh: <b className="font-mono text-lab-text">{rt?.last_refresh_duration_ms?fmt.format(rt.last_refresh_duration_ms/1000)+" s":"—"}</b></p><Link href="/anomalies" className="mt-4 inline-block text-lab-cyan hover:underline">Перейти к аномалиям →</Link></div></div>
    </div>
  </div>
}
