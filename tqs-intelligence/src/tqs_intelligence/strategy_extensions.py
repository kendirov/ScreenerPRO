from __future__ import annotations

import statistics
import time
from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

import polars as pl

from .strategy_models import StrategyRunResult, StrategySpec


@dataclass
class DipEvent:
    ts_ms: int
    entry: float
    exit: float
    net_pct: float
    gross_pct: float
    mfe_pct: float
    mae_pct: float
    context: dict[str, Any] = field(default_factory=dict)


def _metric(events: list[DipEvent]) -> dict[str, Any]:
    if not events:
        return {'n':0,'mean_net_pct':None,'median_net_pct':None,'win_rate':None,'profit_factor':None,'sum_net_pct':None,'best_net_pct':None,'worst_net_pct':None}
    vals=[x.net_pct for x in events];wins=[x for x in vals if x>0];losses=[x for x in vals if x<0]
    pf=(sum(wins)/abs(sum(losses))) if losses and wins else (999.0 if wins else None)
    return {'n':len(events),'mean_net_pct':statistics.fmean(vals),'median_net_pct':statistics.median(vals),
            'win_rate':len(wins)/len(events),'profit_factor':pf,'sum_net_pct':sum(vals),
            'best_net_pct':max(vals),'worst_net_pct':min(vals),
            'median_mfe_pct':statistics.median([x.mfe_pct for x in events]),
            'median_mae_pct':statistics.median([x.mae_pct for x in events])}


def _split(events:list[DipEvent],fractions:tuple[float,float,float])->dict[str,list[DipEvent]]:
    rows=sorted(events,key=lambda x:x.ts_ms);n=len(rows);a=int(n*fractions[0]);b=int(n*(fractions[0]+fractions[1]))
    return {'exploration':rows[:a],'validation':rows[a:b],'holdout':rows[b:]}


def _walk_forward(events:list[DipEvent],folds:int)->dict[str,Any]:
    rows=sorted(events,key=lambda x:x.ts_ms);folds=max(2,min(int(folds),10));n=len(rows)
    if n<folds*10:return {'folds':[],'stable_sign':False,'positive_folds':0}
    out=[]
    for k in range(folds):
        lo=int(n*k/folds);hi=int(n*(k+1)/folds);out.append({'fold':k+1,**_metric(rows[lo:hi])})
    med=[x['median_net_pct'] for x in out if x.get('median_net_pct') is not None]
    return {'folds':out,'stable_sign':bool(med) and all(x>0 for x in med),'positive_folds':sum(1 for x in med if x>0)}


def _context(rows:list[dict[str,Any]],i:int,lookback:int,reference:float)->dict[str,Any]:
    pre=rows[max(0,i-lookback):i];closes=[float(x['close']) for x in pre]
    rets=[(b/a-1)*100 for a,b in zip(closes,closes[1:]) if a>0]
    vol=statistics.pstdev(rets) if len(rets)>=2 else 0.0
    ret=(closes[-1]/closes[0]-1)*100 if len(closes)>=2 and closes[0]>0 else 0.0
    return {'pre_vol_pct':vol,'pre_return_pct':ret,'reference_price':reference,'hour_utc':(int(rows[i]['ts_ms'])//3_600_000)%24,
            'trend':'up' if ret>.2 else 'down' if ret<-.2 else 'flat'}


def _simulate(rows:list[dict[str,Any]],entry_i:int,target:float,stop:float,max_hold:int,cost_bps:float,ctx:dict[str,Any])->DipEvent|None:
    if entry_i>=len(rows)-1:return None
    entry=float(rows[entry_i]['open']);
    if entry<=0:return None
    exit_price=float(rows[min(len(rows)-1,entry_i+max_hold-1)]['close']);reason='time';future=[]
    for bar in rows[entry_i:min(len(rows),entry_i+max_hold)]:
        future.append(bar);lo=float(bar['low']);hi=float(bar['high'])
        if lo<=stop and hi>=target:exit_price=stop;reason='stop_same_bar';break
        if lo<=stop:exit_price=stop;reason='stop';break
        if hi>=target:exit_price=target;reason='target';break
    if not future:return None
    gross=(exit_price/entry-1)*100;highs=[float(x['high']) for x in future];lows=[float(x['low']) for x in future]
    context=dict(ctx);context['exit_reason']=reason
    return DipEvent(ts_ms=int(rows[entry_i]['ts_ms']),entry=entry,exit=exit_price,gross_pct=gross,net_pct=gross-cost_bps/100,
                    mfe_pct=(max(highs)/entry-1)*100,mae_pct=(min(lows)/entry-1)*100,context=context)


def detect_dips(rows:list[dict[str,Any]],drop_pct:float,target:float,stop:float,max_hold:int,cost_bps:float,
                lookback:int,reset_bars:int,mode:str)->list[DipEvent]:
    out=[];last=-10000
    for i in range(max(2,lookback),len(rows)-max_hold-1):
        if i-last<reset_bars:continue
        prior=rows[i-lookback:i];reference=max(float(x['high']) for x in prior);trigger=reference*(1-drop_pct/100)
        prev=float(rows[i-1]['close']);bar=rows[i]
        if prev<=trigger or float(bar['low'])>trigger:continue
        entry_i=i+1;entry=float(rows[entry_i]['open'])
        target_px=entry+target if mode=='points' else entry*(1+target/10000)
        stop_px=max(1e-12,entry-stop) if mode=='points' else entry*(1-stop/10000)
        ctx=_context(rows,i,lookback,reference);ctx.update({'drop_pct':drop_pct,'target':target,'stop':stop,'mode':mode,
            'trigger_price':trigger,'actual_intrabar_drop_pct':(float(bar['low'])/reference-1)*100})
        ev=_simulate(rows,entry_i,target_px,stop_px,max_hold,cost_bps,ctx)
        if ev:out.append(ev);last=i
    return out


def _background(rows:list[dict[str,Any]],count:int,target:float,stop:float,max_hold:int,cost_bps:float,lookback:int,mode:str)->list[DipEvent]:
    if count<=0:return []
    usable=max(1,len(rows)-lookback-max_hold-2);step=max(1,usable//count);out=[];i=lookback
    while len(out)<count and i<len(rows)-max_hold-1:
        entry=float(rows[i]['open']);target_px=entry+target if mode=='points' else entry*(1+target/10000)
        stop_px=max(1e-12,entry-stop) if mode=='points' else entry*(1-stop/10000)
        ctx=_context(rows,i,lookback,max(float(x['high']) for x in rows[i-lookback:i]));ctx['control']='periodic_background'
        ev=_simulate(rows,i,target_px,stop_px,max_hold,cost_bps,ctx)
        if ev:out.append(ev)
        i+=step
    return out


def _diagnostics(events:list[DipEvent])->dict[str,Any]:
    if not events:return {}
    med_vol=statistics.median([float(x.context.get('pre_vol_pct') or 0) for x in events]);groups:dict[str,list[DipEvent]]={}
    for x in events:
        labels=[f"trend:{x.context.get('trend','unknown')}",f"vol:{'high' if float(x.context.get('pre_vol_pct') or 0)>=med_vol else 'low'}",f"exit:{x.context.get('exit_reason','unknown')}"]
        for label in labels:groups.setdefault(label,[]).append(x)
    cells=[{'cell':k,**_metric(v)} for k,v in groups.items() if len(v)>=3]
    cells.sort(key=lambda x:(x.get('median_net_pct') is not None,x.get('median_net_pct') or -999),reverse=True)
    sample=lambda x:{'ts_ms':x.ts_ms,'net_pct':x.net_pct,'mfe_pct':x.mfe_pct,'mae_pct':x.mae_pct,'context':x.context}
    return {'regime_cells':cells,'best_cell':cells[0] if cells else None,'worst_cell':cells[-1] if cells else None,
            'top_wins':[sample(x) for x in sorted(events,key=lambda x:x.net_pct,reverse=True)[:5]],
            'top_losses':[sample(x) for x in sorted(events,key=lambda x:x.net_pct)[:5]],
            'interpretation_ru':'Показывает, где прибыль/убыток концентрируется. Новые фильтры после этого требуют нового OOS-прогона.'}


def run_buy_dip_grid(spec:StrategySpec,canonical_id:str,frame:pl.DataFrame)->StrategyRunResult:
    generated=int(time.time()*1000)
    empty=lambda warning:StrategyRunResult(run_id=f'R-{uuid4().hex[:10].upper()}',strategy_id=spec.id,canonical_id=canonical_id,
        interval=spec.interval,generated_at_ms=generated,status='inconclusive',events=0,warnings=[warning])
    if frame.is_empty() or len(frame)<250:return empty('Недостаточно исторических свечей (<250).')
    required={'ts_ms','open','high','low','close'}
    if not required.issubset(set(frame.columns)):raise ValueError(f'missing columns: {sorted(required-set(frame.columns))}')
    rows=frame.sort('ts_ms').select([c for c in ['ts_ms','open','high','low','close','volume','turnover'] if c in frame.columns]).to_dicts()
    cfg=spec.event;ex=spec.exit;mode=str(ex.get('target_mode','bps'));drops=[float(x) for x in cfg.get('drop_pct_candidates',[.25,.5,1,2])]
    lookback=int(cfg.get('lookback_bars',12));reset=int(cfg.get('reset_bars',3));targets=[float(x) for x in ex.get('target_points_candidates' if mode=='points' else 'target_bps_candidates',[10,20,50,100])]
    stops=[float(x) for x in ex.get('stop_points_candidates' if mode=='points' else 'stop_bps_candidates',[20,50,100,200])];holds=[int(x) for x in ex.get('max_hold_bars_candidates',[3,6,12,24])]
    cost=float(spec.costs.get('round_trip_bps',8));fractions=(float(spec.validation.get('exploration_fraction',.6)),float(spec.validation.get('validation_fraction',.2)),float(spec.validation.get('holdout_fraction',.2)))
    candidates=[]
    for drop in drops:
        for target in targets:
            for stop in stops:
                for hold in holds:
                    ev=detect_dips(rows,drop,target,stop,hold,cost,lookback,reset,mode);ctl=_background(rows,len(ev),target,stop,hold,cost,lookback,mode)
                    es=_split(ev,fractions);cs=_split(ctl,fractions);em=_metric(es['exploration']);cm=_metric(cs['exploration'])
                    excess=(em['median_net_pct']-cm['median_net_pct']) if em['median_net_pct'] is not None and cm['median_net_pct'] is not None else -999
                    candidates.append({'drop_pct':drop,'target':target,'stop':stop,'hold':hold,'events':ev,'controls':ctl,'es':es,'cs':cs,'train_excess':excess,'train_n':em['n']})
    min_events=int(spec.validation.get('min_events',40));eligible=[x for x in candidates if x['train_n']>=max(10,int(min_events*.6))]
    chosen=max(eligible or candidates,key=lambda x:(x['train_excess'],x['train_n']));split_metrics={}
    for name in ('exploration','validation','holdout'):
        em=_metric(chosen['es'][name]);cm=_metric(chosen['cs'][name]);excess=(em['median_net_pct']-cm['median_net_pct']) if em['median_net_pct'] is not None and cm['median_net_pct'] is not None else None
        split_metrics[name]={'strategy':em,'background_control':cm,'median_excess_pct':excess}
    total=len(chosen['events']);status='inconclusive';warnings=[]
    if total<min_events:warnings.append(f'Событий {total}, требуется минимум {min_events}.')
    else:
        v=split_metrics['validation'];h=split_metrics['holdout'];vals=[v['strategy'].get('median_net_pct'),v.get('median_excess_pct'),h['strategy'].get('median_net_pct'),h.get('median_excess_pct')]
        if None not in vals and all(float(x)>0 for x in vals):status='candidate'
        elif h['strategy'].get('median_net_pct') is not None and (h['strategy']['median_net_pct']<=0 or (h.get('median_excess_pct') or -999)<=0):status='rejected'
    wf=_walk_forward(chosen['events'],int(spec.validation.get('walk_forward_folds',4)))
    if status=='candidate' and not wf.get('stable_sign'):status='inconclusive';warnings.append('Положительный результат нестабилен по walk-forward блокам.')
    grid=[{'drop_pct':x['drop_pct'],'target':x['target'],'stop':x['stop'],'max_hold_bars':x['hold'],'mode':mode,'n':len(x['events']),
           'exploration_excess_pct':x['train_excess'],'all_strategy':_metric(x['events']),'all_control':_metric(x['controls'])} for x in candidates]
    grid.sort(key=lambda x:(x['exploration_excess_pct'],x['n']),reverse=True)
    return StrategyRunResult(run_id=f'R-{uuid4().hex[:10].upper()}',strategy_id=spec.id,canonical_id=canonical_id,interval=spec.interval,
        generated_at_ms=generated,status=status,events=total+len(chosen['controls']),round_events=total,control_events=len(chosen['controls']),
        metrics={'selected':{'drop_pct':chosen['drop_pct'],'target':chosen['target'],'stop':chosen['stop'],'max_hold_bars':chosen['hold'],'mode':mode},
                 'strategy_all':_metric(chosen['events']),'background_control_all':_metric(chosen['controls'])},
        splits=split_metrics,robustness={'walk_forward':wf,'parameter_grid':grid},diagnostics=_diagnostics(chosen['events']),warnings=warnings)


def default_buy_dip_bps_spec()->StrategySpec:
    return StrategySpec(id='TQS-STRAT-BUY-DIP-BPS-001',name_ru='Покупать каждое падение — сетка %/bps',status='exploratory',
        idea='Проверить покупку каждого заданного падения от локального максимума и перебрать тейк, стоп и время удержания.',
        universe=['MOEX stocks','crypto perpetuals','liquid global instruments'],interval='10m',
        event={'type':'buy_dip_grid','drop_pct_candidates':[.25,.5,1,2,3],'lookback_bars':12,'reset_bars':3},
        entry={'type':'next_bar_open_after_first_touch','side':'long'},
        exit={'target_mode':'bps','target_bps_candidates':[10,20,50,100,200],'stop_bps_candidates':[20,50,100,200,400],'max_hold_bars_candidates':[3,6,12,24]},
        filters={'diagnostics':['pre-trend','pre-volatility','session','exit-reason']},costs={'round_trip_bps':8.0},
        notes=['Параметры выбираются только на exploration.','Контроль — периодические фоновые LONG-входы с тем же TP/SL/hold.','Диагностика показывает, где прибыль/убыток концентрируется; новый фильтр требует нового OOS.'])


def default_buy_dip_points_spec()->StrategySpec:
    spec=default_buy_dip_bps_spec().model_copy(deep=True);spec.id='TQS-STRAT-BUY-DIP-POINTS-001';spec.name_ru='Покупать падение — тейки/стопы в пунктах';spec.universe=['MOEX futures','price-point instruments']
    spec.exit={'target_mode':'points','target_points_candidates':[10,20,50,100],'stop_points_candidates':[10,20,50,100,200],'max_hold_bars_candidates':[3,6,12,24]}
    spec.notes=list(spec.notes)+['Версия для инструментов, где смысл имеют абсолютные пункты цены. Не применять механически ко всем акциям.']
    return spec
