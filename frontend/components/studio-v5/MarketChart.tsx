"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import * as echarts from "echarts";
import type {DataSpec,LiveDataResponse} from "@/lib/studio-v5/types";

export function StudioMarketChart({dataSpec,embedded,cursorIndex,onData}:{dataSpec?:DataSpec|null;embedded?:LiveDataResponse|null;cursorIndex?:number;onData?:(d:LiveDataResponse)=>void}){
 const el=useRef<HTMLDivElement>(null); const onDataRef=useRef(onData); const [period,setPeriod]=useState(2); const [series,setSeries]=useState<"PRICE"|"VOLUME"|"BOTH">("BOTH");
 const [data,setData]=useState<LiveDataResponse|null>(embedded||null); const [error,setError]=useState(""); const [loading,setLoading]=useState(!embedded);
 const family=dataSpec?.instrument?.family||embedded?.instrument.family||"SI";
 useEffect(()=>{onDataRef.current=onData},[onData]);
 useEffect(()=>{if(embedded){setData(embedded);setLoading(false);return}let alive=true;setLoading(true);setError("");
   const q=new URLSearchParams({family,sessions:String(period),interval:"1"});const fixedFrom=dataSpec?.fixedRange?.from;const fixedTill=dataSpec?.fixedRange?.till;if(fixedFrom&&fixedFrom===fixedTill)q.set("date",fixedFrom);
   fetch("/api/studio/live-data?"+q.toString()).then(async r=>{const x=await r.json();if(!r.ok||!x.ok)throw new Error(x.error||"Live data error");return x as LiveDataResponse}).then(x=>{if(alive){setData(x);onDataRef.current?.(x)}}).catch(e=>alive&&setError(e.message)).finally(()=>alive&&setLoading(false));return()=>{alive=false}
 },[embedded,family,period,dataSpec?.fixedRange?.from,dataSpec?.fixedRange?.till]);
 const shown=useMemo(()=>{if(!data)return null;if(cursorIndex==null)return data;const s=data.sessions.at(-1);if(!s)return data;return {...data,sessions:[{...s,points:s.points.slice(0,Math.max(1,cursorIndex+1)),totalVolume:s.points[Math.max(0,Math.min(cursorIndex,s.points.length-1))]?.cumVolume||0}]} as LiveDataResponse},[data,cursorIndex]);
 useEffect(()=>{if(!el.current||!shown?.sessions.length)return;const c=echarts.init(el.current);const sessions=shown.sessions;const price=series!=="VOLUME";const volume=series!=="PRICE";const names=sessions.map(s=>s.date);
   c.setOption({animation:false,grid:{left:42,right:46,top:22,bottom:28},legend:{show:sessions.length>1,data:names,textStyle:{color:"#928d83",fontSize:9}},tooltip:{trigger:"axis",axisPointer:{type:"cross"}},xAxis:{type:"value",name:"мин",axisLabel:{color:"#8c877e"},splitLine:{show:false}},yAxis:[{type:"value",scale:true,axisLabel:{color:"#8c877e"},splitLine:{lineStyle:{color:"rgba(140,135,126,.13)"}}},{type:"value",axisLabel:{color:"#8c877e"},splitLine:{show:false}}],
   series:[
    ...(price?sessions.map((s,i)=>({name:s.date,type:"line",yAxisIndex:0,showSymbol:false,smooth:false,data:s.points.map(p=>[p.minute,p.price]),lineStyle:{width:i===sessions.length-1?2:1,opacity:i===sessions.length-1?1:.5}})):[]),
    ...(volume?sessions.map((s,i)=>({name:s.date+" volume",type:"line",yAxisIndex:1,showSymbol:false,data:s.points.map(p=>[p.minute,p.cumVolume]),lineStyle:{width:1,type:i===sessions.length-1?"solid":"dashed",opacity:.55},areaStyle:i===sessions.length-1?{opacity:.04}:undefined})):[])
   ]});const ro=new ResizeObserver(()=>c.resize());ro.observe(el.current);return()=>{ro.disconnect();c.dispose()}},[shown,series]);
 if(loading)return <div className="studio-market-state">Загрузка MOEX ISS…</div>;if(error)return <div className="studio-market-state">Данные недоступны: {error}</div>;if(!shown?.sessions.length)return <div className="studio-market-state">MOEX ISS не вернул свечи за выбранный период.</div>;
 return <div className="studio-market-block" data-testid="studio-market-chart">
   {!embedded&&<div className="studio-market-controls"><div>{[1,2,3].map(n=><button key={n} className={period===n?"active":""} onClick={()=>setPeriod(n)}>{n} сесс.</button>)}</div><div>{(["PRICE","VOLUME","BOTH"] as const).map(s=><button key={s} className={series===s?"active":""} onClick={()=>setSeries(s)}>{s==="PRICE"?"Цена":s==="VOLUME"?"Объём":"Оба"}</button>)}</div></div>}
   <div ref={el} className="studio-market-stage"/>
   <div className="studio-market-source"><span>{shown.instrument.family} · {shown.instrument.secid}</span><span>Источник: {shown.source.provider}</span><span>{shown.dataSpec.updatePolicy}</span><span>as of {shown.source.asOf?new Date(shown.source.asOf).toLocaleString("ru-RU"):"—"}</span></div>
 </div>
}