const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const clamp = (v, a=0, b=100) => Math.max(a, Math.min(b, v));
const round = (v, d=2) => v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d));
const median = (xs) => { const a = xs.filter(Number.isFinite).sort((x,y)=>x-y); if (!a.length) return null; const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; };
const mean = (xs) => { const a=xs.filter(Number.isFinite); return a.length?a.reduce((x,y)=>x+y,0)/a.length:null; };

async function get(url, timeout=15000) {
  const r = await fetch(url, {headers:{accept:'application/json','user-agent':'ScreenerPRO/2.0'}, signal:AbortSignal.timeout(timeout)});
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}
async function firstWorking(name, urls) {
  const errors=[];
  for (const url of urls) {
    try { return {ok:true,name,url,data:await get(url)}; } catch(e) { errors.push(`${url}: ${e instanceof Error?e.message:String(e)}`); }
  }
  return {ok:false,name,error:errors.join(' | ')};
}
function sp(bid,ask){ if(!(bid>0)||!(ask>=bid))return null; const mid=(bid+ask)/2; return (ask-bid)/mid*10000; }
function ensure(map,base){ if(!map.has(base))map.set(base,{base}); return map.get(base); }

const bulk = await Promise.all([
  firstWorking('binance24h',[
    'https://fapi.binance.com/fapi/v1/ticker/24hr','https://fapi1.binance.com/fapi/v1/ticker/24hr','https://fapi2.binance.com/fapi/v1/ticker/24hr','https://fapi3.binance.com/fapi/v1/ticker/24hr'
  ]),
  firstWorking('binancePremium',[
    'https://fapi.binance.com/fapi/v1/premiumIndex','https://fapi1.binance.com/fapi/v1/premiumIndex','https://fapi2.binance.com/fapi/v1/premiumIndex','https://fapi3.binance.com/fapi/v1/premiumIndex'
  ]),
  firstWorking('bybit',[
    'https://api.bybit.com/v5/market/tickers?category=linear','https://api.bytick.com/v5/market/tickers?category=linear','https://api.bybit.nl/v5/market/tickers?category=linear','https://api.bybit.kz/v5/market/tickers?category=linear','https://api.bybit.ae/v5/market/tickers?category=linear'
  ]),
  firstWorking('okx',['https://www.okx.com/api/v5/market/tickers?instType=SWAP']),
  firstWorking('bitget',['https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES']),
]);
const by=Object.fromEntries(bulk.map(x=>[x.name,x]));
const u=new Map();

const prem=new Map();
if(by.binancePremium?.ok && Array.isArray(by.binancePremium.data)) for(const x of by.binancePremium.data) prem.set(x.symbol,x);
if(by.binance24h?.ok && Array.isArray(by.binance24h.data)) for(const x of by.binance24h.data){
  const s=String(x.symbol??''); if(!/^[A-Z0-9]+USDT$/.test(s))continue; const base=s.slice(0,-4); const p=prem.get(s)||{}; ensure(u,base).binance={symbol:s,last:num(x.lastPrice),chg:num(x.priceChangePercent),vol:num(x.quoteVolume),fund:num(p.lastFundingRate)};
}
if(by.bybit?.ok) for(const x of by.bybit.data?.result?.list??[]){
  const s=String(x.symbol??''); if(!/^[A-Z0-9]+USDT$/.test(s))continue; const base=s.slice(0,-4); ensure(u,base).bybit={symbol:s,last:num(x.lastPrice),chg:num(x.price24hPcnt)*100,vol:num(x.turnover24h),fund:num(x.fundingRate),oiUsd:num(x.openInterestValue),spread:sp(num(x.bid1Price),num(x.ask1Price))};
}
if(by.okx?.ok) for(const x of by.okx.data?.data??[]){
  const m=String(x.instId??'').match(/^([A-Z0-9]+)-USDT-SWAP$/); if(!m)continue; const base=m[1],last=num(x.last),op=num(x.open24h); ensure(u,base).okx={symbol:x.instId,last,chg:last!=null&&op>0?(last/op-1)*100:null,spread:sp(num(x.bidPx),num(x.askPx))};
}
if(by.bitget?.ok) for(const x of by.bitget.data?.data??[]){
  const s=String(x.symbol??''); if(!/^[A-Z0-9]+USDT$/.test(s))continue; const base=s.slice(0,-4),last=num(x.lastPr),op=num(x.open24h); ensure(u,base).bitget={symbol:s,last,chg:last!=null&&op>0?(last/op-1)*100:num(x.change24h)*100,vol:num(x.usdtVolume)??num(x.quoteVolume),fund:num(x.fundingRate),oiCoin:num(x.holdingAmount),spread:sp(num(x.bidPr),num(x.askPr))};
}

function baseStats(r){
  const radar=[r.binance,r.bybit,r.okx].filter(Boolean); const ch=radar.map(x=>x.chg).filter(Number.isFinite); const med=median(ch); const agree=ch.length&&med!=null?ch.filter(v=>Math.sign(v)===Math.sign(med)).length/ch.length:0;
  const vol=median([r.binance?.vol,r.bybit?.vol,r.bitget?.vol].filter(v=>v>0)); const fund=median([r.binance?.fund,r.bybit?.fund,r.bitget?.fund]);
  const liq=vol>0?clamp(25*Math.log10(vol/1e6+1)):0; const spread=r.bitget?.spread??null; const ex=radar.length;
  return {chg:med,agree,vol,fund,liq,spread,radarCount:ex};
}
function prelim(r){ const b=baseStats(r); return clamp(Math.abs(b.chg??0)/10*35)+b.liq*.35+clamp(Math.abs(b.fund??0)/.001*100)*.15+b.agree*15; }

function normC(raw,type){
  let a=[];
  if(type==='okx') a=(raw?.data??[]).map(x=>({t:num(x[0]),o:num(x[1]),h:num(x[2]),l:num(x[3]),c:num(x[4]),v:num(x[7])??num(x[5])}));
  if(type==='bitget') a=(raw?.data??raw??[]).map(x=>({t:num(x[0]),o:num(x[1]),h:num(x[2]),l:num(x[3]),c:num(x[4]),v:num(x[6])??num(x[5])}));
  if(type==='bybit') a=(raw?.result?.list??[]).map(x=>({t:num(x[0]),o:num(x[1]),h:num(x[2]),l:num(x[3]),c:num(x[4]),v:num(x[6])}));
  if(type==='binance'&&Array.isArray(raw)) a=raw.map(x=>({t:num(x[0]),o:num(x[1]),h:num(x[2]),l:num(x[3]),c:num(x[4]),v:num(x[7])}));
  return a.filter(x=>x.t&&x.c>0&&x.h>0&&x.l>0).sort((x,y)=>x.t-y.t);
}
function cs(a){
  if(a.length<16)return null; const last=a.at(-1), at=n=>a.at(-1-n)?.c; const ret=n=>at(n)?(last.c/at(n)-1)*100:null; const rv=mean(a.slice(-3).map(x=>x.v).filter(v=>v>0)), pv=mean(a.slice(-15,-3).map(x=>x.v).filter(v=>v>0));
  const w=a.slice(-27,-3),hi=Math.max(...w.map(x=>x.h)),lo=Math.min(...w.map(x=>x.l)); const rr=x=>(x.h-x.l)/x.c*100, recent=mean(a.slice(-6).map(rr)), old=mean(a.slice(-24,-6).map(rr));
  return {r15:ret(3),r60:ret(12),va:rv!=null&&pv>0?rv/pv:null,cr:recent!=null&&old>0?recent/old:null,pos:hi>lo?(last.c-lo)/(hi-lo):.5,dh:(hi-last.c)/last.c*100,dl:(last.c-lo)/last.c*100,bo:last.c>hi?1:last.c<lo?-1:0};
}
async function detail(r){
  const tasks=[];
  if(r.okx) tasks.push(firstWorking('okxC',[`https://www.okx.com/api/v5/market/candles?instId=${encodeURIComponent(r.okx.symbol)}&bar=5m&limit=48`]));
  if(r.bitget) tasks.push(firstWorking('bitgetC',[`https://api.bitget.com/api/v2/mix/market/candles?symbol=${encodeURIComponent(r.bitget.symbol)}&productType=USDT-FUTURES&granularity=5m&limit=48`]));
  if(r.bybit){ const s=r.bybit.symbol; const hosts=['https://api.bytick.com','https://api.bybit.nl','https://api.bybit.kz','https://api.bybit.ae','https://api.bybit.com']; tasks.push(firstWorking('bybitC',hosts.map(h=>`${h}/v5/market/kline?category=linear&symbol=${encodeURIComponent(s)}&interval=5&limit=48`))); tasks.push(firstWorking('bybitOi',hosts.map(h=>`${h}/v5/market/open-interest?category=linear&symbol=${encodeURIComponent(s)}&intervalTime=5min&limit=12`))); }
  if(r.binance){ const s=r.binance.symbol; const hs=['https://fapi1.binance.com','https://fapi2.binance.com','https://fapi3.binance.com','https://fapi.binance.com']; tasks.push(firstWorking('binC',hs.map(h=>`${h}/fapi/v1/klines?symbol=${encodeURIComponent(s)}&interval=5m&limit=48`))); tasks.push(firstWorking('binOi',hs.map(h=>`${h}/futures/data/openInterestHist?symbol=${encodeURIComponent(s)}&period=5m&limit=12`))); }
  const z=Object.fromEntries((await Promise.all(tasks)).map(x=>[x.name,x])); const stats=[z.okxC?.ok?cs(normC(z.okxC.data,'okx')):null,z.bitgetC?.ok?cs(normC(z.bitgetC.data,'bitget')):null,z.bybitC?.ok?cs(normC(z.bybitC.data,'bybit')):null,z.binC?.ok?cs(normC(z.binC.data,'binance')):null].filter(Boolean);
  const oi=[]; if(z.bybitOi?.ok){ const a=(z.bybitOi.data?.result?.list??[]).map(x=>({t:num(x.timestamp),v:num(x.openInterest)})).filter(x=>x.t&&x.v>0).sort((a,b)=>a.t-b.t); if(a.length>1)oi.push((a.at(-1).v/a[0].v-1)*100); } if(z.binOi?.ok&&Array.isArray(z.binOi.data)){ const a=z.binOi.data.map(x=>num(x.sumOpenInterestValue)??num(x.sumOpenInterest)).filter(v=>v>0); if(a.length>1)oi.push((a.at(-1)/a[0]-1)*100); }
  return {r15:median(stats.map(x=>x.r15)),r60:median(stats.map(x=>x.r60)),va:median(stats.map(x=>x.va)),cr:median(stats.map(x=>x.cr)),pos:median(stats.map(x=>x.pos)),dh:median(stats.map(x=>x.dh)),dl:median(stats.map(x=>x.dl)),bo:Math.sign(mean(stats.map(x=>x.bo))??0),oi:median(oi),detailSources:stats.length};
}
async function poolMap(a,limit,fn){const out=new Array(a.length);let i=0;async function w(){while(i<a.length){const j=i++;out[j]=await fn(a[j]);}}await Promise.all(Array.from({length:Math.min(limit,a.length)},w));return out;}
function score(r,d){
  const b=baseStats(r), vp=d.va==null?20:clamp((d.va-1)/3*100), m15=d.r15==null?0:clamp(Math.abs(d.r15)/3*100), m60=d.r60==null?0:clamp(Math.abs(d.r60)/8*100), comp=d.cr==null?30:clamp((1-d.cr)/.5*100), near=Math.min(Math.abs(d.dh??99),Math.abs(d.dl??99)), prox=d.bo?100:clamp((2-near)/2*100), oiAbs=d.oi==null?15:clamp(Math.abs(d.oi)/10*100), oiUp=d.oi==null?10:clamp(d.oi/8*100), f=clamp(Math.abs(b.fund??0)/.001*100);
  const momentum=clamp(m60*.32+vp*.24+oiAbs*.12+b.agree*12+b.liq*.20), ignition=clamp(vp*.28+m15*.22+prox*.22+oiAbs*.10+comp*.10+b.agree*8), pre=clamp(comp*.30+prox*.30+vp*.18+oiUp*.10+b.liq*.12);
  let sqDir=null,res=20;if((b.fund??0)>=.0003){sqDir='SHORT';res=clamp((.75-(d.r15??0))/1.5*100);}else if((b.fund??0)<=-.0003){sqDir='LONG';res=clamp(((d.r15??0)+.75)/1.5*100);} const squeeze=clamp(f*.42+oiUp*.18+res*.18+b.liq*.22);
  const trend=(median([d.r15,d.r60,b.chg])??0)>=0?'LONG':'SHORT'; let pd=trend;if((d.pos??.5)>.67)pd='LONG';if((d.pos??.5)<.33)pd='SHORT'; const cats=[['IGNITION',ignition,trend],['PRE-BREAKOUT',pre,pd],['MOMENTUM',momentum,trend],['SQUEEZE',squeeze,sqDir??trend]].sort((a,c)=>c[1]-a[1]); const p=cats[0]; const spreadScore=b.spread==null?50:clamp(100-b.spread*4), overall=clamp(p[1]*(.65+.35*spreadScore/100));
  const reasons=[];if((d.va??0)>=1.8)reasons.push(`volume x${round(d.va,1)}`);if(Math.abs(d.oi??0)>=2)reasons.push(`OI ${d.oi>0?'+':''}${round(d.oi,1)}%/≈1h`);if(Math.abs(b.fund??0)>=.0003)reasons.push(`funding ${round((b.fund??0)*100,3)}%`);if(d.bo)reasons.push(d.bo>0?'5m breakout up':'5m breakout down');else if(near<=1)reasons.push(`до границы ≈${round(near,2)}%`);if((d.cr??1)<=.7)reasons.push('сжатие диапазона');if(b.agree>=.66)reasons.push('cross-exchange consensus');if((b.spread??99)<=8)reasons.push('узкий Bitget spread');
  return {symbol:`${r.base}USDT`,type:p[0],direction:p[2],overall:round(overall,1),scores:{ignition:round(ignition,1),prebreakout:round(pre,1),momentum:round(momentum,1),squeeze:round(squeeze,1),liquidity:round(b.liq,1)},metrics:{change24hPct:round(b.chg,2),ret15Pct:round(d.r15,2),ret60Pct:round(d.r60,2),volumeAcceleration:round(d.va,2),oiChangeApprox1hPct:round(d.oi,2),fundingPct:round((b.fund??0)*100,4),turnover24hUsd:round(b.vol,0),bitgetSpreadBps:round(b.spread,2),radarCount:b.radarCount,consensus24:round(b.agree,2),detailSources:d.detailSources,compressionRatio:round(d.cr,2),rangePosition:round(d.pos,2)},exchanges:{binance:!!r.binance,bybit:!!r.bybit,okx:!!r.okx,bitget:!!r.bitget},reasons:reasons.slice(0,5)};
}
function top(sc,key,n=8){return sc.slice().sort((a,b)=>(b.scores[key]??0)-(a.scores[key]??0)).slice(0,n);}

const eligible=[...u.values()].filter(r=>r.bitget).filter(r=>[r.binance,r.bybit,r.okx].filter(Boolean).length>=1).filter(r=>(baseStats(r).vol??0)>=1_000_000).sort((a,b)=>prelim(b)-prelim(a));
const candidates=eligible.slice(0,32); const ds=await poolMap(candidates,4,async r=>({r,d:await detail(r)})); const scored=ds.map(x=>score(x.r,x.d)).filter(x=>x.metrics.bitgetSpreadBps==null||x.metrics.bitgetSpreadBps<=60).sort((a,b)=>b.overall-a.overall);
const report={asOf:new Date().toISOString(),methodologyVersion:'explosion-score-v0.2-resilient',sources:{binance:by.binance24h?.ok?by.binance24h.url:null,bybit:by.bybit?.ok?by.bybit.url:null,okx:by.okx?.ok?by.okx.url:null,bitget:by.bitget?.ok?by.bitget.url:null},errors:bulk.filter(x=>!x.ok).map(x=>`${x.name}: ${x.error}`),status:{universe:u.size,eligible:eligible.length,detailed:candidates.length},topOverall:scored.slice(0,12),topIgnition:top(scored,'ignition'),topPreBreakout:top(scored,'prebreakout'),topSqueeze:top(scored,'squeeze'),topMomentum:top(scored,'momentum'),topLiquidity:top(scored,'liquidity'),notes:['Radar uses every accessible public exchange endpoint; Bitget presence and spread are mandatory execution filters.','If Binance/Bybit are region-blocked from the runner, OKX+Bitget still produce the short-term scan; missing sources are shown explicitly.','Score is attention ranking, not a trade signal. Entry requires trigger and invalidation.']};
process.stdout.write(JSON.stringify(report,null,2)+'\n');
