"use client";
import {useEffect,useMemo,useState} from "react";
import type {DataSpec,LiveDataResponse} from "@/lib/studio-v5/types";
import {StudioMarketChart} from "./MarketChart";

export function StudioMarketReplay({dataSpec}:{dataSpec?:DataSpec|null}){
 const [data,setData]=useState<LiveDataResponse|null>(null),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[cursor,setCursor]=useState(0);
 const points=data?.sessions.at(-1)?.points||[]; const max=Math.max(0,points.length-1);
 useEffect(()=>{if(!playing||max<=0)return;const targetSeconds=30/speed;const stepMs=Math.max(18,(targetSeconds*1000)/Math.max(1,max));const id=window.setInterval(()=>setCursor(c=>{if(c>=max){setPlaying(false);return max}return c+1}),stepMs);return()=>window.clearInterval(id)},[playing,max,speed]);
 useEffect(()=>{if(cursor>max)setCursor(max)},[max,cursor]);
 const stamp=points[cursor]?.timestamp;
 return <div className="studio-replay" data-testid="market-replay">
  <div className="studio-replay-head"><strong>Market Replay · {data?.instrument.secid||dataSpec?.instrument.family||"Si"}</strong><span>{stamp?new Date(stamp).toLocaleString("ru-RU"):"загрузка…"}</span></div>
  <StudioMarketChart dataSpec={dataSpec} embedded={data} cursorIndex={cursor} onData={x=>{setData(x);setCursor(0)}}/>
  <div className="studio-replay-controls"><button onClick={()=>setPlaying(v=>!v)} disabled={!points.length}>{playing?"Пауза":"Старт"}</button>{[.5,1,2,4].map(v=><button key={v} className={speed===v?"active":""} onClick={()=>setSpeed(v)}>{v}×</button>)}<input aria-label="Временной курсор" type="range" min={0} max={max} value={Math.min(cursor,max)} onChange={e=>{setPlaying(false);setCursor(Number(e.target.value))}}/><span>{max?Math.round(cursor/max*100):0}%</span></div>
 </div>
}