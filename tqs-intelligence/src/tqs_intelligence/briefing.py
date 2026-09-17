from __future__ import annotations

import time
from typing import Any

from .models import Snapshot
from .storage import DuckStore


ANCHOR_HINTS = {
    'BTC': ('BTCUSDT','BTC-USDT','BTC'),
    'ETH': ('ETHUSDT','ETH-USDT','ETH'),
    'IMOEX': ('IMOEX','IMOEX2'),
    'RUB/CNY': ('CNYRUB','CNYRUB_TOM','CNY'),
    'USD/RUB': ('Si','USDRUB'),
    'MOEX FUT': ('MXI','MIX'),
}


def _quote_row(q) -> dict[str,Any]:
    return {'canonical_id':q.canonical_id,'provider':q.provider,'symbol':q.symbol,'name':q.display_symbol or q.symbol,
            'asset_class':q.asset_class.value,'market_type':q.market_type,'last':q.last,'change_24h_pct':q.change_24h_pct,
            'turnover_24h':q.turnover_24h,'open_interest':q.open_interest,'funding_rate':q.funding_rate,'spread_bps':q.spread_bps,
            'as_of_ms':q.ts_ms}


class BriefingBuilder:
    def __init__(self, store: DuckStore) -> None: self.store=store

    def build(self, snapshot: Snapshot | None) -> dict[str,Any]:
        if snapshot is None:
            return {'generated_at_ms':int(time.time()*1000),'initializing':True,'anchors':[],'stories':[],'news':[],'research':[]}
        anchors=[]
        for label,hints in ANCHOR_HINTS.items():
            candidate=None
            for q in snapshot.quotes:
                text=f'{q.symbol} {q.display_symbol or ""}'.upper()
                if any(h.upper() in text for h in hints):
                    candidate=q; break
            if candidate: anchors.append({'label':label,**_quote_row(candidate)})
        stories=[]; used=set()
        for a in snapshot.anomalies:
            family=(a.asset_class.value,a.provider)
            if family in used and len(stories)>=3: continue
            stories.append({'id':a.canonical_id,'title':a.quote.display_symbol or a.symbol,'score':a.score,'severity':a.severity,
                            'asset_class':a.asset_class.value,'market_type':a.market_type,'provider':a.provider,
                            'last':a.quote.last,'change_24h_pct':a.quote.change_24h_pct,'reasons':a.reasons[:4],
                            'signals':a.signals,'why_shown':' · '.join(a.reasons[:4])})
            used.add(family)
            if len(stories)>=6: break
        story_symbols={s['title'].upper() for s in stories}|{str(s['id']).split(':')[-1].upper() for s in stories}
        related=[]
        for n in snapshot.news:
            if not story_symbols or any(sym.upper() in story_symbols for sym in n.symbols):
                related.append(n.model_dump(mode='json'))
            if len(related)>=12: break
        findings=[x.model_dump(mode='json') for x in self.store.list_findings(limit=10)]
        return {'generated_at_ms':snapshot.generated_at_ms,'initializing':False,'anchors':anchors,'stories':stories,
                'news':related,'research':findings,'sessions_note_ru':'Сессионный слой расширяется; причины движения не выводятся из одного совпадения по времени.'}
