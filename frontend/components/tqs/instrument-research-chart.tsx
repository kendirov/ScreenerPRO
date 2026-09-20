"use client";
import * as React from "react";
import {
  CandlestickSeries, ColorType, createChart, CrosshairMode, HistogramSeries,
  createSeriesMarkers, type Time
} from "lightweight-charts";
import { cn } from "@/lib/utils/cn";
import type { StockExpandedChartInterval, StockExpandedChartSeries } from "@/lib/domain/stock-expanded-chart";

type Spike={time:Time; ratio:number; volume:number};
function t(v:string, source:StockExpandedChartSeries["source"]):Time {
  return source==="daily"&&!v.includes("T") ? v as Time : Math.floor(new Date(v).getTime()/1000) as Time;
}
function detect(series:StockExpandedChartSeries|null):Spike[]{
  if(!series?.candles?.length) return [];
  const out:Spike[]=[]; const vols:number[]=[];
  series.candles.forEach(c=>{ if(c.volume==null||!Number.isFinite(c.volume))return; const base=vols.slice(-20); const avg=base.length>=5?base.reduce((a,b)=>a+b,0)/base.length:0; if(avg>0&&c.volume/avg>=2)out.push({time:t(c.time,series.source),ratio:c.volume/avg,volume:c.volume}); vols.push(c.volume);});
  return out;
}
export function InstrumentResearchChart({ticker}:{ticker:string}){
 const [interval,setInterval]=React.useState<StockExpandedChartInterval>(10); const [series,setSeries]=React.useState<StockExpandedChartSeries|null>(null); const [loading,setLoading]=React.useState(true); const [showSpikes,setShowSpikes]=React.useState(true); const ref=React.useRef<HTMLDivElement>(null);
 React.useEffect(()=>{setLoading(true);fetch(`/api/screener/stocks/candles?view=chart&secid=${encodeURIComponent(ticker)}&interval=${interval}`,{cache:"no-store"}).then(r=>r.json()).then(x=>setSeries(x.series??null)).finally(()=>setLoading(false))},[ticker,interval]);
 const spikes=React.useMemo(()=>detect(series),[series]);
 React.useEffect(()=>{if(!ref.current||series?.status!=="ok")return; const chart=createChart(ref.current,{layout:{background:{type:ColorType.Solid,color:"transparent"},textColor:"#94a3b8"},grid:{vertLines:{color:"rgba(148,163,184,.05)"},horzLines:{color:"rgba(148,163,184,.05)"}},rightPriceScale:{borderColor:"rgba(148,163,184,.12)",scaleMargins:{top:.08,bottom:.22}},timeScale:{borderColor:"rgba(148,163,184,.12)",timeVisible:true},crosshair:{mode:CrosshairMode.Normal}}); const c=chart.addSeries(CandlestickSeries,{upColor:"#34d399",downColor:"#fb7185",borderUpColor:"#34d399",borderDownColor:"#fb7185",wickUpColor:"#34d399",wickDownColor:"#fb7185"}); c.setData(series.candles.map(x=>({time:t(x.time,series.source),open:x.open,high:x.high,low:x.low,close:x.close}))); const v=chart.addSeries(HistogramSeries,{priceFormat:{type:"volume"},priceScaleId:"vol"}); chart.priceScale("vol").applyOptions({scaleMargins:{top:.82,bottom:0}}); v.setData(series.candles.filter(x=>x.volume!=null).map(x=>({time:t(x.time,series.source),value:x.volume!}))); if(showSpikes&&spikes.length)createSeriesMarkers(c,spikes.map(s=>({time:s.time,position:"aboveBar" as const,shape:"circle" as const,color:"#f59e0b",text:`VOL ${s.ratio.toFixed(1)}x`}))); chart.timeScale().fitContent(); const ro=new ResizeObserver(()=>chart.applyOptions({width:ref.current?.clientWidth??800,height:ref.current?.clientHeight??480}));ro.observe(ref.current);return()=>{ro.disconnect();chart.remove()}},[series,showSpikes,spikes]);
 return <div className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex gap-1">{([5,10,30,24] as StockExpandedChartInterval[]).map(i=><button key={i} onClick={()=>setInterval(i)} className={cn("rounded border px-2 py-1 text-[10px]",i===interval?"border-lab-cyan bg-lab-cyan/10 text-lab-cyan":"border-lab-border text-lab-dim")}>{i===24?"1Д":i+"м"}</button>)}</div><button onClick={()=>setShowSpikes(x=>!x)} className={cn("rounded border px-2 py-1 text-[10px]",showSpikes?"border-amber-400/50 text-amber-300":"border-lab-border text-lab-dim")}>● Всплески объёма {spikes.length}</button></div><div className="relative h-[520px] overflow-hidden rounded-xl border border-lab-border/50 bg-black/25">{loading?<div className="absolute inset-0 z-10 grid place-items-center text-xs text-lab-dim">Загрузка свечей…</div>:null}{series?.status!=="ok"&&!loading?<div className="grid h-full place-items-center text-sm text-lab-dim">Нет свечей</div>:<div ref={ref} className="absolute inset-0"/>}</div><div className="flex flex-wrap gap-1">{spikes.slice(-12).reverse().map((s,i)=><span key={i} className="rounded-md border border-amber-400/20 bg-amber-400/5 px-2 py-1 font-mono text-[9px] text-amber-200">volume {s.ratio.toFixed(1)}x</span>)}</div></div>
}
