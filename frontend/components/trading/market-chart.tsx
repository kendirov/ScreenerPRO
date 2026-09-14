"use client";

import { CandlestickSeries, ColorType, createChart, CrosshairMode, HistogramSeries, LineSeries, LineStyle, type CandlestickData, type Time } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";

export type MarketCandle = { time:string; open:number; high:number; low:number; close:number; volume:number|null };

const clock = new Intl.DateTimeFormat("ru-RU", { timeZone:"Europe/Moscow", day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
const asTime=(value:string)=>Math.floor(new Date(value).getTime()/1000) as Time;

export function MarketChart({candles,mode,reference,loading,status}:{candles:MarketCandle[];mode:"line"|"candles";reference:number|null;loading:boolean;status:string}){
 const el=useRef<HTMLDivElement>(null); const [hover,setHover]=useState<MarketCandle|null>(null);
 useEffect(()=>{if(!el.current||!candles.length)return;const node=el.current;const css=getComputedStyle(node);const positive=css.getPropertyValue("--sk-positive").trim()||"#62bd86",negative=css.getPropertyValue("--sk-negative").trim()||"#e06f68",muted=css.getPropertyValue("--sk-muted").trim()||"#969a98",line=css.getPropertyValue("--sk-line").trim()||"rgba(255,255,255,.1)",accent=css.getPropertyValue("--sk-warning").trim()||"#d9a441";
  const chart=createChart(node,{width:node.clientWidth,height:node.clientHeight,layout:{background:{type:ColorType.Solid,color:"transparent"},textColor:muted,fontFamily:"ui-monospace,SFMono-Regular,Menlo,monospace",fontSize:10},grid:{vertLines:{color:line},horzLines:{color:line}},rightPriceScale:{borderColor:line,scaleMargins:{top:.08,bottom:.2}},timeScale:{borderColor:line,timeVisible:true,secondsVisible:false,rightOffset:2},crosshair:{mode:CrosshairMode.Normal,vertLine:{color:accent,labelBackgroundColor:accent},horzLine:{color:accent,labelBackgroundColor:accent}},handleScroll:true,handleScale:true});
  const mapped=candles.map(c=>({time:asTime(c.time),open:c.open,high:c.high,low:c.low,close:c.close}));
  const priceSeries=mode==="candles"?chart.addSeries(CandlestickSeries,{upColor:positive,downColor:negative,borderVisible:false,wickUpColor:positive,wickDownColor:negative}):chart.addSeries(LineSeries,{color:accent,lineWidth:2,priceLineVisible:true});
  if(mode==="candles") priceSeries.setData(mapped as CandlestickData<Time>[]); else priceSeries.setData(mapped.map(c=>({time:c.time,value:c.close})));
  if(reference!=null){const ref=chart.addSeries(LineSeries,{color:muted,lineWidth:1,lineStyle:LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false});ref.setData([{time:mapped[0]!.time,value:reference},{time:mapped.at(-1)!.time,value:reference}]);}
  const volumes=candles.filter(c=>c.volume!=null).map(c=>({time:asTime(c.time),value:c.volume!,color:c.close>=c.open?`${positive}55`:`${negative}55`}));if(volumes.length){const volume=chart.addSeries(HistogramSeries,{priceFormat:{type:"volume"},priceScaleId:"volume"});chart.priceScale("volume").applyOptions({scaleMargins:{top:.84,bottom:0}});volume.setData(volumes);}
  chart.subscribeCrosshairMove(p=>{if(!p.time){setHover(null);return}const hit=candles.find(c=>asTime(c.time)===p.time);setHover(hit??null)});chart.timeScale().fitContent();const ro=new ResizeObserver(()=>chart.applyOptions({width:node.clientWidth,height:node.clientHeight}));ro.observe(node);return()=>{ro.disconnect();chart.remove()};
 },[candles,mode,reference]);
 if(loading)return <div className="tp-chart-state">Загрузка истории…</div>;
 if(!candles.length)return <div className="tp-chart-state">{status}</div>;
 const first=candles[0]?.close??0,current=hover??candles.at(-1)!;const change=first?((current.close-first)/first)*100:null;
 return <div className="tp-market-chart"><div ref={el}/><div className="tp-chart-tooltip"><b>{clock.format(new Date(current.time))} MSK</b>{mode==="candles"?<><span>O {current.open.toLocaleString("ru-RU")}</span><span>H {current.high.toLocaleString("ru-RU")}</span><span>L {current.low.toLocaleString("ru-RU")}</span><span>C {current.close.toLocaleString("ru-RU")}</span>{current.volume!=null?<span>V {current.volume.toLocaleString("ru-RU")}</span>:null}</>:<span>PRICE {current.close.toLocaleString("ru-RU")}</span>}<em className={Number(change)>=0?"is-up":"is-down"}>{change==null?"—":`${change>0?"+":""}${change.toFixed(2)}%`}</em></div></div>;
}
