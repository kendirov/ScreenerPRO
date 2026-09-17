from __future__ import annotations

import statistics
from typing import Any

from .models import Quote, Snapshot
from .storage import DuckStore


def _pct(value: float | None) -> float | None:
    return None if value is None else round(float(value), 4)


def _safe_div(a: float | None, b: float | None) -> float | None:
    if a is None or b in (None, 0): return None
    return a / b


def participant_features(payload: dict[str, Any]) -> dict[str, Any]:
    fl=float(payload.get('individual_long') or 0); fs=float(payload.get('individual_short') or 0)
    jl=float(payload.get('legal_long') or 0); js=float(payload.get('legal_short') or 0)
    total=fl+fs+jl+js
    return {
        'individual_net': fl-fs,
        'legal_net': jl-js,
        'individual_long_share': fl/total if total else None,
        'legal_long_share': jl/total if total else None,
        'participant_divergence': ((fl-fs)-(jl-js))/total if total else None,
        'total_position_sides': total,
    }


class MoexLab:
    def __init__(self, store: DuckStore) -> None: self.store=store

    def enrich_quote(self, q: Quote) -> dict[str,Any]:
        day_range_pct=((q.high_24h/q.low_24h-1)*100) if q.high_24h and q.low_24h and q.low_24h>0 else None
        range_position=((q.last-q.low_24h)/(q.high_24h-q.low_24h)) if q.last is not None and q.high_24h is not None and q.low_24h is not None and q.high_24h!=q.low_24h else None
        return {
            'canonical_id':q.canonical_id,'symbol':q.symbol,'name':q.display_symbol or q.symbol,'asset_class':q.asset_class.value,
            'market_type':q.market_type,'price':q.last,'change_pct':q.change_24h_pct,'turnover':q.turnover_24h,
            'volume':q.volume_24h,'open_interest':q.open_interest,'spread_bps':q.spread_bps,
            'day_range_pct':_pct(day_range_pct),'range_position':_pct(range_position),'board':q.meta.get('board'),
            'trading_status':q.meta.get('trading_status'),'engine':q.meta.get('engine'),'market':q.meta.get('market'),
            'num_trades':q.meta.get('num_trades'),'settle_price':q.meta.get('settle_price'),'expiry':q.meta.get('expiry'),
            'quality':'basic-live-or-delayed','premium_participants':None,
        }

    def instrument_history_stats(self, canonical_id: str, limit: int = 2000) -> dict[str,Any]:
        with self.store._lock:
            rows=self.store._con.execute(
                '''select observed_at_ms,last,turnover_24h,open_interest,change_24h_pct,payload_json
                   from quote_snapshots where canonical_id=? order by observed_at_ms desc limit ?''',[canonical_id,limit]).fetchall()
        if not rows: return {'samples':0}
        prices=[float(r[1]) for r in rows if r[1] is not None]; turnovers=[float(r[2]) for r in rows if r[2] is not None]
        oi=[float(r[3]) for r in rows if r[3] is not None]; changes=[float(r[4]) for r in rows if r[4] is not None]
        def stats(xs:list[float])->dict[str,float|None]:
            if not xs: return {'median':None,'mean':None,'min':None,'max':None}
            return {'median':statistics.median(xs),'mean':statistics.fmean(xs),'min':min(xs),'max':max(xs)}
        return {'samples':len(rows),'price':stats(prices),'turnover':stats(turnovers),'open_interest':stats(oi),'change_pct':stats(changes),
                'first_ts_ms':int(rows[-1][0]),'last_ts_ms':int(rows[0][0])}

    def overview(self, snapshot: Snapshot | None) -> dict[str,Any]:
        rows=[self.enrich_quote(q) for q in (snapshot.quotes if snapshot else []) if q.provider=='moex']
        groups:dict[str,int]={}
        for row in rows: groups[row['asset_class']]=groups.get(row['asset_class'],0)+1
        futures=sorted([r for r in rows if r['asset_class']=='future'],key=lambda r:(r['turnover'] or 0),reverse=True)
        stocks=sorted([r for r in rows if r['asset_class']=='stock'],key=lambda r:(r['turnover'] or 0),reverse=True)
        return {
            'count':len(rows),'segments':groups,'top_stocks':stocks[:50],'top_futures':futures[:50],
            'premium_contract':{
                'status':'ready_for_credentials','fields':['individual_long','individual_short','legal_long','legal_short','participant_counts','delta_positions','5m updates'],
                'derived':['individual_net','legal_net','participant_divergence','participant_acceleration','price/OI/participant divergence']
            }
        }
