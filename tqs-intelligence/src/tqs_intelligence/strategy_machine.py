from __future__ import annotations

import math
import statistics
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
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
    entry_ts_ms: int = 0
    exit_ts_ms: int = 0
    exit_reason: str = "time"
    exit_policy: str = "hold"
    context: dict[str, Any] | None = None


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


def _context(row: dict[str, Any], prev_close: float | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key in ('volume','turnover','open','high','low','close'):
        value = row.get(key)
        if value is not None:
            try: out[key] = float(value)
            except (TypeError, ValueError): pass
    if out.get('low') not in (None, 0) and out.get('high') is not None:
        out['range_pct'] = (out['high']/out['low']-1)*100
    if prev_close not in (None, 0) and out.get('close') is not None:
        out['move_pct'] = (out['close']/prev_close-1)*100
    return out


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
        entry_row = rows[i+1]
        entry = float(entry_row['open'])
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
        events.append(Event(
            ts_ms=int(bar['ts_ms']), kind='round' if offset_fraction == 0 else f'control_{offset_fraction:g}',
            spacing=spacing, buffer_bps=buffer_bps, side=side, entry=entry, exit=exit_price,
            gross_pct=gross, net_pct=gross-cost_pct, mfe_pct=mfe, mae_pct=mae,
            entry_ts_ms=int(entry_row['ts_ms']), exit_ts_ms=int(future[-1]['ts_ms']),
            exit_reason='time', exit_policy='hold', context=_context(bar, prev),
        ))
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


def _event_payload(event: Event, split: str, control: bool = False) -> dict[str, Any]:
    return {
        'signal_ts_ms': event.ts_ms,
        'entry_ts_ms': event.entry_ts_ms or event.ts_ms,
        'exit_ts_ms': event.exit_ts_ms,
        'kind': event.kind,
        'side': event.side,
        'entry_price': event.entry,
        'exit_price': event.exit,
        'gross_return_pct': event.gross_pct,
        'net_return_pct': event.net_pct,
        'mfe_pct': event.mfe_pct,
        'mae_pct': event.mae_pct,
        'split': split,
        'exit_reason': event.exit_reason,
        'exit_policy': event.exit_policy,
        'spacing': event.spacing,
        'buffer_bps': event.buffer_bps,
        'is_control': control,
        'context': event.context or {},
    }


def _trace(splits: dict[str, list[Event]], control: bool = False) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for split in ('exploration','validation','holdout'):
        out.extend(_event_payload(event, split, control) for event in splits.get(split, []))
    return out


def _scheduled_indices(rows: list[dict[str, Any]], spec: StrategySpec, offset_minutes: int = 0) -> list[int]:
    cfg = spec.event
    hours = {int(x) for x in cfg.get('hours_msk', [])}
    weekdays_raw = cfg.get('weekdays', [])
    weekdays = {int(x) for x in weekdays_raw if isinstance(x, (int, float)) or str(x).isdigit()}
    target_minute = (int(cfg.get('minute_msk', 0)) + int(offset_minutes)) % 60
    out: list[int] = []
    horizon = int(spec.exit.get('horizon_bars', 6))
    for i in range(0, max(0, len(rows)-horizon)):
        ts_ms = int(rows[i]['ts_ms'])
        dt = datetime.fromtimestamp(ts_ms/1000, tz=timezone.utc) + timedelta(hours=3)
        if dt.minute != target_minute:
            continue
        if hours and dt.hour not in hours:
            continue
        if weekdays and dt.weekday() not in weekdays:
            continue
        out.append(i)
    return out


def _scheduled_events(rows: list[dict[str, Any]], spec: StrategySpec, policy: str, control_offset_minutes: int = 0) -> list[Event]:
    horizon = max(1, int(spec.exit.get('horizon_bars', 6)))
    cost_bps = float(spec.costs.get('round_trip_bps', 8.0))
    side = str(spec.entry.get('side', 'long')).lower()
    direction = -1 if side == 'short' else 1
    indices = _scheduled_indices(rows, spec, control_offset_minutes)
    events: list[Event] = []
    for i in indices:
        if i + horizon >= len(rows):
            continue
        bar = rows[i]
        entry = float(bar['open'])
        if entry <= 0:
            continue
        future = rows[i:i+horizon]
        if policy == 'scale_out_25_25_50':
            points = [max(0,min(horizon-1,0)), max(0,min(horizon-1,horizon//2)), horizon-1]
            weights = [0.25,0.25,0.50]
        else:
            points = [horizon-1]
            weights = [1.0]
        gross = 0.0
        exit_price = 0.0
        for point, weight in zip(points, weights):
            price = float(future[point]['close'])
            gross += weight * direction * (price/entry - 1) * 100
            exit_price += weight * price
        highs = [float(x['high']) for x in future]; lows = [float(x['low']) for x in future]
        if direction > 0:
            mfe=(max(highs)/entry-1)*100; mae=(min(lows)/entry-1)*100
        else:
            mfe=(entry/min(lows)-1)*100; mae=(entry/max(highs)-1)*100
        prev = float(rows[i-1]['close']) if i > 0 else entry
        events.append(Event(
            ts_ms=int(bar['ts_ms']), kind='scheduled_entry' if not control_offset_minutes else 'scheduled_control',
            spacing=0.0, buffer_bps=0.0, side='short' if direction < 0 else 'long',
            entry=entry, exit=exit_price, gross_pct=gross, net_pct=gross-cost_bps/100,
            mfe_pct=mfe, mae_pct=mae, entry_ts_ms=int(bar['ts_ms']), exit_ts_ms=int(future[-1]['ts_ms']),
            exit_reason='time_scale' if policy.startswith('scale_out') else 'time',
            exit_policy=policy, context=_context(bar, prev),
        ))
    return events


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
            splits=split_metrics,robustness={'walk_forward':wf,'parameter_grid':robust},
            diagnostics={'trace_schema':'tqs.strategy-trace/1','selected_on':'exploration'},
            trade_trace=_trace(chosen['rsplit']), control_trace=_trace(chosen['csplit'],True), warnings=warnings)

    def run_scheduled_entry(self, spec: StrategySpec, canonical_id: str, frame: pl.DataFrame) -> StrategyRunResult:
        generated=int(time.time()*1000)
        if frame.is_empty() or len(frame) < 100:
            return StrategyRunResult(run_id=f'R-{uuid4().hex[:10].upper()}',strategy_id=spec.id,canonical_id=canonical_id,
                interval=spec.interval,generated_at_ms=generated,status='inconclusive',events=0,
                warnings=['Недостаточно исторических свечей (<100).'])
        required={'ts_ms','open','high','low','close'}
        if not required.issubset(set(frame.columns)):
            raise ValueError(f'missing columns: {sorted(required-set(frame.columns))}')
        rows=frame.sort('ts_ms').select([c for c in ['ts_ms','open','high','low','close','volume','turnover'] if c in frame.columns]).to_dicts()
        fractions=(float(spec.validation.get('exploration_fraction',.6)),float(spec.validation.get('validation_fraction',.2)),float(spec.validation.get('holdout_fraction',.2)))
        policies=[str(x) for x in spec.exit.get('policy_candidates',['hold','scale_out_25_25_50'])]
        control_offset=int(spec.event.get('control_offset_minutes',30))
        candidates=[]
        for policy in policies:
            events=_scheduled_events(rows,spec,policy,0)
            controls=_scheduled_events(rows,spec,policy,control_offset)
            es=_split(events,fractions); cs=_split(controls,fractions)
            em=_metric(es['exploration']); cm=_metric(cs['exploration'])
            excess=(em['median_net_pct']-cm['median_net_pct']) if em['median_net_pct'] is not None and cm['median_net_pct'] is not None else -999
            candidates.append({'policy':policy,'events':events,'controls':controls,'es':es,'cs':cs,'train_excess':excess})
        chosen=max(candidates,key=lambda x:(x['train_excess'],len(x['events'])))
        split_metrics={}
        for name in ('exploration','validation','holdout'):
            em=_metric(chosen['es'][name]); cm=_metric(chosen['cs'][name])
            excess=(em['median_net_pct']-cm['median_net_pct']) if em['median_net_pct'] is not None and cm['median_net_pct'] is not None else None
            split_metrics[name]={'event':em,'control':cm,'median_excess_pct':excess}
        min_events=int(spec.validation.get('min_events',40)); status='inconclusive'; warnings=[]
        hold=split_metrics['holdout']; val=split_metrics['validation']
        if len(chosen['events']) < min_events:
            warnings.append(f"Событий {len(chosen['events'])}, требуется минимум {min_events}.")
        else:
            h=hold['event'].get('median_net_pct'); hx=hold.get('median_excess_pct'); v=val['event'].get('median_net_pct'); vx=val.get('median_excess_pct')
            if None not in (h,hx,v,vx) and h>0 and hx>0 and v>0 and vx>0: status='candidate'
            elif None not in (h,hx) and (h<=0 or hx<=0): status='rejected'
        wf=_walk_forward(chosen['events'],int(spec.validation.get('walk_forward_folds',4)))
        if status=='candidate' and not wf.get('stable_sign'):
            status='inconclusive'; warnings.append('Эффект не сохраняет положительный знак во всех walk-forward блоках.')
        sensitivity=[]
        for item in candidates:
            sensitivity.append({'exit_policy':item['policy'],'events':len(item['events']),
                                'controls':len(item['controls']),'exploration_excess_pct':item['train_excess'],
                                'all_event':_metric(item['events']),'all_control':_metric(item['controls'])})
        return StrategyRunResult(
            run_id=f'R-{uuid4().hex[:10].upper()}',strategy_id=spec.id,canonical_id=canonical_id,
            interval=spec.interval,generated_at_ms=generated,status=status,
            events=len(chosen['events'])+len(chosen['controls']),round_events=len(chosen['events']),control_events=len(chosen['controls']),
            metrics={'selected_exit_policy':chosen['policy'],'event_all':_metric(chosen['events']),'control_all':_metric(chosen['controls'])},
            splits=split_metrics,robustness={'walk_forward':wf,'exit_policy_sensitivity':sensitivity},
            diagnostics={'trace_schema':'tqs.strategy-trace/1','selected_on':'exploration','control_offset_minutes':control_offset},
            trade_trace=_trace(chosen['es']),control_trace=_trace(chosen['cs'],True),warnings=warnings,
        )

    def run(self, spec: StrategySpec, canonical_id: str, frame: pl.DataFrame) -> StrategyRunResult:
        event_type=str(spec.event.get('type','round_buffer_bounce'))
        if event_type=='round_buffer_bounce': return self.run_round_buffer(spec,canonical_id,frame)
        if event_type=='scheduled_entry': return self.run_scheduled_entry(spec,canonical_id,frame)
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


def default_scheduled_entry_spec() -> StrategySpec:
    return StrategySpec(
        id='TQS-STRAT-SCHEDULED-ENTRY-001',
        name_ru='Вход по расписанию / начало часа',
        status='exploratory',
        idea='Проверить, есть ли устойчивый edge у входа в начале часа и какой способ выхода лучше после costs и matched time controls.',
        universe=['MOEX stocks'],
        interval='10m',
        event={'type':'scheduled_entry','minute_msk':0,'control_offset_minutes':30},
        entry={'type':'bar_open','side':'long'},
        exit={'type':'time','horizon_bars':6,'policy_candidates':['hold','scale_out_25_25_50']},
        costs={'round_trip_bps':8.0},
        notes=['Exit policy выбирается только на exploration и затем замораживается для validation/holdout.',
               'Контроль — тот же инструмент и час с временным сдвигом на 30 минут.'],
    )
