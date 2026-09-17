from __future__ import annotations

import json
import math
import statistics
import time
from pathlib import Path
from typing import Any

import polars as pl

from .lake import DataLake


def _interval_ms(interval: str) -> int:
    unit=interval[-1].lower(); value=int(interval[:-1])
    if unit=='m': return value*60_000
    if unit=='h': return value*3_600_000
    if unit=='d': return value*86_400_000
    raise ValueError(interval)


def _median(xs:list[float]) -> float|None: return statistics.median(xs) if xs else None


def _mean(xs:list[float]) -> float|None: return statistics.fmean(xs) if xs else None


def _summary(xs:list[float]) -> dict[str,Any]:
    if not xs: return {'n':0,'median':None,'mean':None,'p75':None,'p90':None}
    s=sorted(xs); return {'n':len(xs),'median':statistics.median(s),'mean':statistics.fmean(s),
                          'p75':s[min(len(s)-1,int(.75*(len(s)-1)))],'p90':s[min(len(s)-1,int(.90*(len(s)-1)))]}


class HistoricalReplayEngine:
    def __init__(self,lake:DataLake) -> None: self.lake=lake

    def run(self, canonical_id:str, interval:str, threshold:float=70.0, baseline_window:int=96) -> dict[str,Any]:
        frame=self.lake.read_candles(canonical_id,interval)
        if frame.is_empty() or len(frame)<baseline_window*3:
            return {'status':'inconclusive','canonical_id':canonical_id,'interval':interval,'reason':'Недостаточно истории','bars':len(frame)}
        cols=set(frame.columns); required={'ts_ms','open','high','low','close'}
        if not required.issubset(cols): raise ValueError(f'missing {sorted(required-cols)}')
        if 'volume' not in cols: frame=frame.with_columns(pl.lit(None).cast(pl.Float64).alias('volume'))
        if 'turnover' not in cols: frame=frame.with_columns(pl.lit(None).cast(pl.Float64).alias('turnover'))
        f=(frame.sort('ts_ms')
           .with_columns([
               (pl.col('close')/pl.col('close').shift(1)-1).alias('ret1'),
               (pl.col('close')/pl.col('close').shift(3)-1).alias('ret3'),
               ((pl.col('high')-pl.col('low'))/pl.col('close')).alias('range_pct'),
               pl.col('volume').fill_null(0).alias('vol0'),
           ])
           .with_columns([
               pl.col('ret1').shift(1).rolling_std(baseline_window).alias('ret_std'),
               pl.col('range_pct').shift(1).rolling_mean(baseline_window).alias('range_mean'),
               pl.col('range_pct').shift(1).rolling_std(baseline_window).alias('range_std'),
               pl.col('vol0').shift(1).rolling_mean(baseline_window).alias('vol_mean'),
               pl.col('vol0').shift(1).rolling_std(baseline_window).alias('vol_std'),
           ]))
        rows=f.to_dicts(); step=_interval_ms(interval); events=[]; last_event=-10_000
        horizons_ms={'15m':15*60_000,'1h':3_600_000,'4h':4*3_600_000,'24h':24*3_600_000}
        horizon_bars={k:max(1,round(v/step)) for k,v in horizons_ms.items()}
        max_h=max(horizon_bars.values())
        controls=[]
        for i in range(baseline_window,len(rows)-max_h-1):
            r=rows[i]; close=float(r['close']); rs=float(r.get('ret_std') or 0); rngs=float(r.get('range_std') or 0); vs=float(r.get('vol_std') or 0)
            move_z=abs(float(r.get('ret3') or 0))/(rs*math.sqrt(3)+1e-12) if rs>0 else 0
            range_z=max(0,(float(r.get('range_pct') or 0)-float(r.get('range_mean') or 0))/(rngs+1e-12)) if rngs>0 else 0
            volume_z=max(0,(float(r.get('vol0') or 0)-float(r.get('vol_mean') or 0))/(vs+1e-12)) if vs>0 else 0
            score=min(100.0,move_z*22+range_z*12+volume_z*9)
            forward={}
            for label,bars in horizon_bars.items():
                p=float(rows[i+bars]['close']); forward[label]=(p/close-1)*100
            abs4=abs(forward['4h']); controls.append((i,abs4,forward))
            if score<threshold or i-last_event<max(2,round(30*60_000/step)): continue
            signals=[]
            if move_z>=2: signals.append('price_move_z')
            if volume_z>=2: signals.append('volume_z')
            if range_z>=2: signals.append('range_expansion')
            direction='up' if float(r.get('ret3') or 0)>0 else 'down'
            future_slice=rows[i+1:i+max_h+1]; highs=[float(x['high']) for x in future_slice]; lows=[float(x['low']) for x in future_slice]
            mfe=(max(highs)/close-1)*100; mae=(min(lows)/close-1)*100
            events.append({'ts_ms':int(r['ts_ms']),'price':close,'score':score,'direction':direction,'signals':signals,
                           'move_z':move_z,'volume_z':volume_z,'range_z':range_z,'forward_pct':forward,
                           'future_abs_4h_pct':abs4,'mfe_24h_pct':mfe,'mae_24h_pct':mae})
            last_event=i
        event_indices={next((idx for idx,x in enumerate(rows) if int(x['ts_ms'])==ev['ts_ms']),-1) for ev in events}
        baseline=[x for i,x,_ in controls if i not in event_indices and i%7==0]
        split_n=len(events); a=int(split_n*.6); b=int(split_n*.8); splits={'exploration':events[:a],'validation':events[a:b],'holdout':events[b:]}
        def split_result(items:list[dict[str,Any]])->dict[str,Any]:
            vals=[x['future_abs_4h_pct'] for x in items]; return _summary(vals)
        split_stats={k:split_result(v) for k,v in splits.items()}; base_stats=_summary(baseline)
        for k,v in split_stats.items():
            v['vs_baseline_multiple']=(v['median']/base_stats['median']) if v['median'] is not None and base_stats['median'] not in (None,0) else None
        hold=split_stats['holdout']; val=split_stats['validation']; status='inconclusive'
        if len(events)>=100 and hold.get('vs_baseline_multiple') and val.get('vs_baseline_multiple'):
            if hold['vs_baseline_multiple']>=1.2 and val['vs_baseline_multiple']>=1.1: status='movement_candidate'
            elif hold['vs_baseline_multiple']<=1.0: status='rejected'
        patterns:dict[str,list[dict[str,Any]]]={}
        for ev in events:
            key='+'.join(ev['signals']) or 'composite'; patterns.setdefault(key,[]).append(ev)
        pattern_stats={k:{'n':len(v),'abs_move_4h':_summary([x['future_abs_4h_pct'] for x in v]),
                          'directional_4h':_summary([x['forward_pct']['4h'] for x in v])} for k,v in patterns.items()}
        outdir=self.lake.root/'derived'/'anomaly-replay'; outdir.mkdir(parents=True,exist_ok=True)
        safe=canonical_id.replace(':','_').replace('/','_'); parquet=outdir/f'{safe}__{interval}.parquet'; summary_path=outdir/f'{safe}__{interval}.summary.json'
        if events: pl.DataFrame(events).write_parquet(parquet,compression='zstd',statistics=True)
        result={'status':status,'canonical_id':canonical_id,'interval':interval,'bars':len(rows),'events':len(events),'threshold':threshold,
                'baseline_abs_move_4h':base_stats,'splits':split_stats,'patterns':pattern_stats,
                'parquet_path':str(parquet.resolve()) if events else None,'generated_at_ms':int(time.time()*1000),
                'interpretation_ru':'movement_candidate означает, что после аномалии абсолютное движение на holdout выше фонового. Это не направление BUY/SELL.'}
        summary_path.write_text(json.dumps(result,ensure_ascii=False,indent=2,default=str),encoding='utf-8')
        result['summary_path']=str(summary_path.resolve())
        return result
