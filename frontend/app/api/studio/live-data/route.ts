import { NextResponse } from "next/server";
import { fetchMoexFortsContractCandidates, resolveFuturesContractWithCandles } from "@/lib/server/services/futures-contract-resolver";
import type { FuturesContractBase } from "@/lib/domain/futures-contract-resolver";
import type { DataSpec, LiveDataResponse, LiveSession, LiveSessionPoint } from "@/lib/studio-v5/types";

function groupSessions(points:Array<{timestamp:string;close:number;volume?:number|null}>):LiveSession[]{
  const groups=new Map<string,Array<{timestamp:string;close:number;volume:number}>>();
  for(const p of points){
    const date=p.timestamp.slice(0,10); const a=groups.get(date)||[];
    a.push({timestamp:p.timestamp,close:Number(p.close),volume:Number(p.volume||0)});groups.set(date,a);
  }
  return [...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,rows])=>{
    rows.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));let cum=0;
    const start=rows[0]?new Date(rows[0].timestamp).getTime():0;
    const out:LiveSessionPoint[]=rows.map((p,i)=>{cum+=p.volume;const t=new Date(p.timestamp).getTime();return{timestamp:p.timestamp,price:p.close,volume:p.volume,cumVolume:cum,minute:Number.isFinite(t)&&start?Math.max(0,Math.round((t-start)/60000)):i}});
    return{date,totalVolume:cum,points:out};
  });
}
export async function GET(request:Request){
  const u=new URL(request.url); const family=(u.searchParams.get("family")||"SI").toUpperCase() as FuturesContractBase;
  const requestedSessions=Math.max(1,Math.min(5,Number(u.searchParams.get("sessions")||2)));
  const interval=Math.max(1,Math.min(60,Number(u.searchParams.get("interval")||1)));
  const fixedDate=u.searchParams.get("date")?.slice(0,10);
  if(!["SI","EU","CN"].includes(family)) return NextResponse.json({ok:false,error:"Unsupported family"},{status:400});
  try{
    const candidates=await fetchMoexFortsContractCandidates();
    const resolved=await resolveFuturesContractWithCandles(family,candidates,{days:12,interval,dateRange:fixedDate?{from:fixedDate,till:fixedDate}:undefined,historyMode:"sessions"});
    const raw=(resolved.intraday?.points||[]).map(p=>({timestamp:p.timestamp,close:p.close,volume:p.volume}));
    const sessions=groupSessions(raw).slice(-requestedSessions);
    const asOf=sessions.at(-1)?.points.at(-1)?.timestamp||null;
    const spec:DataSpec={provider:"MOEX_ISS",instrument:{family,secid:resolved.contract.secid,resolver:"front_active_contract"},metric:"ohlcv_session",relativeRange:fixedDate?null:{tradingSessions:requestedSessions},fixedRange:fixedDate?{from:fixedDate,till:fixedDate}:null,transforms:["group_by_session","cumulative_volume"],display:{renderer:"studio_market_chart",crosshair:true,periodControl:true},updatePolicy:fixedDate?"AS_OF":"LIVE",asOf};
    const body:LiveDataResponse={ok:true,dataSpec:spec,instrument:{family,secid:resolved.contract.secid,expiryDate:resolved.contract.expiryDate,shortName:resolved.contract.shortName},sessions,source:{provider:"MOEX ISS",url:resolved.intraday?.debug?.candlesUrl,asOf,interval:resolved.intraday?.usedInterval||interval,diagnostics:resolved.contract.diagnostics||[]}};
    return NextResponse.json(body,{headers:{"Cache-Control":fixedDate?"public, max-age=300":"public, max-age=30, stale-while-revalidate=60"}});
  }catch(error){const message=error instanceof Error?error.message:String(error);return NextResponse.json({ok:false,error:message},{status:502,headers:{"Cache-Control":"no-store"}})}
}