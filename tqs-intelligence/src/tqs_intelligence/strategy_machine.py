from __future__ import annotations

import math
import statistics
import time
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

import polars as pl

from .strategy_models import StrategyRunResult, StrategySpec


@dataclass
class Event:
    ts_ms: int
    kind: str
    spacing: float
    buffer_bps: float
    side: str
    entry: float
    exit: float
    gross_pct: float
    net_pct: float
    mfe_pct: float
    mae_pct: float


def _metric(events: list[Event]) -> dict[str, Any]:
    if not events:
        return {'n':0,'mean_net_pct':None,'median_net_pct':None,'win_rate':None,'profit_factor':None,'median_mfe_pct':None,'median_mae_pct':None}
    vals = [x.net_pct for x in events]
    wins = [x for x in vals if x > 0]; losses = [x for x in vals if x < 0]
    pf = (sum(wins) / abs(sum(losses))) if losses and sum(wins) > 0 else (None if not wins else 999.0)
    return {
        'n': len(events), 'mean_net_pct': statistics.fmean(vals), 'median_net_pct': statistics.median(vals),
        'win_rate': len(wins)/len(events), 'profit_factor': pf,
        'median_mfe_pct': statistics.median([x.mfe_pct for x in events]),
        'median_mae_pct': statistics.median([x.mae_pct for x in events]),
        'p25_net_pct': sorted(vals)[max(0, int(len(vals)*0.25)-1)],
        'p75_net_pct': sorted(vals)[min(len(vals)-1, int(len(vals)*0.75))],
    }


def _candidate_spacings(price: float) -> list[float]:
    if price <= 0: return []
    base = 10 ** (math.floor(math.log10(price)) - 1)
    return sorted({round(base*x, 12) for x in (0.5, 1.0, 2.0, 5.0) if base*x > 0})


def _detect(rows: list[dict[str, Any]], spacing: float, buffer_bps: float, horizon_bars: int,
            cost_bps: float, offset_fraction: float = 0.0, reset_bars: int = 6) -> list[Event]:
    if spacing <= 0 or horizon_bars < 1: return []
    events: list[Event] = []; last_event_i = -10_000
    for i in range(1, len(rows)-horizon_bars-1):
        if i-last_event_i < reset_bars: continue
        prev = float(rows[i-1]['close']); bar = rows[i]
        if prev <= 0: continue
        anchor = round((prev/spacing) - offset_fraction) * spacing + offset_fraction*spacing
        candidates = (anchor-spacing, anchor, anchor+spacing)
        touched = None; side = None
        for level in candidates:
            if level <= 0: continue
            width = level * buffer_bps / 10_000
            lo, hi = level-width, level+width
            if prev < lo and float(bar['high']) >= lo:
                touched = level; side = 'from_below'; break
            if prev > hi and float(bar['low']) <= hi:
                touched = level; side = 'from_above'; break
        if touched is None or side is None: continue
        entry = float(rows[i+1]['open'])
        if entry <= 0: continue
        direction = -1 if side == 'from_below' else 1
        future = rows[i+1:i+1+horizon_bars]
        exit_price = float(future[-1]['close'])
        gross = direction * (exit_price/entry - 1) * 100
        cost_pct = cost_bps / 100
        highs = [float(x['high']) for x in future]; lows = [float(x['low']) for x in future]
        if direction > 0:
            mfe = (max(highs)/entry - 1)*100; mae = (min(lows)/entry - 1)*100
        else:
            mfe = (entry/min(lows) - 1)*100; mae = (entry/max(highs) - 1)*100
        events.append(Event(ts_ms=int(bar['ts_ms']), kind='round' if offset_fraction == 0 else f'control_{offset_fraction:g}',
                            spacing=spacing, buffer_bps=buffer_bps, side=side, entry=entry, exit=exit_price,
                            gross_pct=gross, net_pct=gross-cost_pct, mfe_pct=mfe, mae_pct=mae))
        last_event_i = i
    return events


def _split(events: list[Event], fractions: tuple[float,float,float]) -> dict[str,list[Event]]:
    rows = sorted(events, key=lambda x:x.ts_ms); n=len(rows)
    a=int(n*fractions[0]); b=int(n*(fractions[0]+fractions[1]))
    return {'exploration':rows[:a], 'validation':rows[a:b], 'holdout':rows[b:]}


def _walk_forward(events: list[Event], folds: int) -> dict[str,Any]:
    rows=sorted(events,key=lambda x:x.ts_ms); folds=max(2,min(int(folds),10)); n=len(rows)
    if n < folds*10: return {'folds':[], 'stable_sign':False}
    out=[]
    for k in range(folds):
        lo=int(n*k/folds); hi=int(n*(k+1)/folds); m=_metric(rows[lo:hi]); out.append({'fold':k+1,**m})
    medians=[x['median_net_pct'] for x in out if x.get('median_net_pct') is not None]
    return {'folds':out, 'stable_sign': bool(medians) and all(x>0 for x in medians), 'positive_folds':sum(1 for x in medians if x>0)}


class StrategyMachine:
    def run_round_buffer(self, spec: StrategySpec, canonical_id: str, frame: pl.DataFrame) -> StrategyRunResult:
        generated=int(time.time()*1000)
        if frame.is_empty() or len(frame) < 200:
            return StrategyRunResult(run_id=f'R-{uuid4().hex[:10].upper()}',strategy_id=spec.id,canonical_id=canonical_id,
                interval=spec.interval,generated_at_ms=generated,status='inconclusive',events=0,round_events=0,control_events=0,
                metrics={},splits={},robustness={},warnings=['Недостаточно исторических свечей (<200).'])
        required={'ts_ms','open','high','low','close'}
        if not required.issubset(set(frame.columns)):
            raise ValueError(f'missing columns: {sorted(required-set(frame.columns))}')
        rows=frame.sort('ts_ms').select([c for c in ['ts_ms','open','high','low','close','volume','turnover'] if c in frame.columns]).to_dicts()
        closes=[float(x['close']) for x in rows if x.get('close') is not None and float(x['close'])>0]
        price=statistics.median(closes)
        cfg=spec.event; spacings=[float(x) for x in cfg.get('spacings',[]) if float(x)>0] or _candidate_spacings(price)
        buffers=[float(x) for x in cfg.get('buffer_bps_candidates',[5,10,20,40])]
        horizon=int(spec.exit.get('horizon_bars',6)); reset=int(cfg.get('reset_bars',6)); cost=float(spec.costs.get('round_trip_bps',8.0))
        fractions=(float(spec.validation.get('exploration_fraction',.6)),float(spec.validation.get('validation_fraction',.2)),float(spec.validation.get('holdout_fraction',.2)))
        candidates=[]
        for spacing in spacings:
            for buffer_bps in buffers:
                round_events=_detect(rows,spacing,buffer_bps,horizon,cost,0.0,reset)
                controls=[]
                for shift in (0.25,0.50,0.75): controls.extend(_detect(rows,spacing,buffer_bps,horizon,cost,shift,reset))
                rsplit=_split(round_events,fractions); csplit=_split(controls,fractions)
                rtrain=_metric(rsplit['exploration']); ctrain=_metric(csplit['exploration'])
                excess=(rtrain['median_net_pct']-ctrain['median_net_pct']) if rtrain['median_net_pct'] is not None and ctrain['median_net_pct'] is not None else -999
                candidates.append({'spacing':spacing,'buffer_bps':buffer_bps,'round':round_events,'controls':controls,'rsplit':rsplit,'csplit':csplit,'train_excess':excess,'train_n':rtrain['n']})
        min_events=int(spec.validation.get('min_events',40))
        eligible=[x for x in candidates if x['train_n']>=max(10,int(min_events*.6))]
        chosen=max(eligible or candidates,key=lambda x:(x['train_excess'],x['train_n']))
        split_metrics={}
        for name in ('exploration','validation','holdout'):
            rm=_metric(chosen['rsplit'][name]); cm=_metric(chosen['csplit'][name])
            excess=(rm['median_net_pct']-cm['median_net_pct']) if rm['median_net_pct'] is not None and cm['median_net_pct'] is not None else None
            split_metrics[name]={'round':rm,'control':cm,'median_excess_pct':excess}
        hold=split_metrics['holdout']; val=split_metrics['validation']; total_round=len(chosen['round']); total_control=len(chosen['controls'])
        status='inconclusive'; warnings=[]
        if total_round < min_events: warnings.append(f'Событий {total_round}, требуется минимум {min_events}.')
        else:
            h=hold['round'].get('median_net_pct'); hx=hold.get('median_excess_pct'); v=val['round'].get('median_net_pct'); vx=val.get('median_excess_pct')
            if None not in (h,hx,v,vx) and h>0 and hx>0 and v>0 and vx>0: status='candidate'
            elif None not in (h,hx) and (h<=0 or hx<=0): status='rejected'
        wf=_walk_forward(chosen['round'],int(spec.validation.get('walk_forward_folds',4)))
        if status=='candidate' and not wf.get('stable_sign'):
            status='inconclusive'; warnings.append('Эффект не сохраняет положительный знак во всех walk-forward блоках.')
        robust=[]
        for item in candidates:
            robust.append({'spacing':item['spacing'],'buffer_bps':item['buffer_bps'],'round_n':len(item['round']),
                           'control_n':len(item['controls']),'exploration_excess_pct':item['train_excess'],
                           'all_round':_metric(item['round']),'all_control':_metric(item['controls'])})
        return StrategyRunResult(run_id=f'R-{uuid4().hex[:10].upper()}',strategy_id=spec.id,canonical_id=canonical_id,
            interval=spec.interval,generated_at_ms=generated,status=status,events=total_round+total_control,
            round_events=total_round,control_events=total_control,
            metrics={'selected_spacing':chosen['spacing'],'selected_buffer_bps':chosen['buffer_bps'],'round_all':_metric(chosen['round']),'control_all':_metric(chosen['controls'])},
            splits=split_metrics,robustness={'walk_forward':wf,'parameter_grid':robust},warnings=warnings)

    def run(self, spec: StrategySpec, canonical_id: str, frame: pl.DataFrame) -> StrategyRunResult:
        event_type=str(spec.event.get('type','round_buffer_bounce'))
        if event_type=='round_buffer_bounce': return self.run_round_buffer(spec,canonical_id,frame)
        raise ValueError(f'unsupported strategy event type: {event_type}')


def default_round_buffer_spec() -> StrategySpec:
    return StrategySpec(
        id='TQS-STRAT-ROUND-BUFFER-001', name_ru='Отскок от круглых / буферных зон', status='exploratory',
        idea='Проверить, существует ли торгуемый избыток отскока от круглых уровней относительно смещённых контрольных уровней.',
        universe=['MOEX stocks','MOEX futures','crypto perpetuals'], interval='10m',
        event={'type':'round_buffer_bounce','buffer_bps_candidates':[5,10,20,40],'reset_bars':6},
        entry={'type':'next_bar_open_after_first_touch','direction':'rejection'},
        exit={'type':'time','horizon_bars':6},
        filters={'future':'liquidity, trend, volatility, session, news, OI/participants'},
        costs={'round_trip_bps':8.0},
        notes=['Параметр выбирается только на exploration; validation/holdout остаются нетронутыми.',
               'Контроли: уровни +0.25S/+0.50S/+0.75S.',
               'Candidate не равен торговому сигналу; validated требует репликации и более строгого cost/execution слоя.'],
    )
