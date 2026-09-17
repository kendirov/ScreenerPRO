from __future__ import annotations

import asyncio
import hashlib
import json
import sqlite3
import statistics
import time
from pathlib import Path
from threading import RLock
from typing import Any, Literal

from pydantic import BaseModel, Field

from .control import ControlCenter
from .http import JsonHttp


def _now_ms() -> int:
    return int(time.time() * 1000)


def _f(value: Any) -> float | None:
    try:
        if value in (None, ''):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


class AccountFill(BaseModel):
    source: str
    account_id: str
    trade_id: str
    ts_ms: int
    symbol: str
    side: Literal['buy', 'sell']
    qty: float
    price: float
    direction: str = ''
    closed_pnl: float | None = None
    fee: float | None = None
    taker: bool | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class PositionSnapshot(BaseModel):
    source: str
    account_id: str
    observed_at_ms: int
    symbol: str
    side: Literal['long', 'short', 'flat']
    size: float
    entry_price: float | None = None
    mark_price: float | None = None
    notional: float | None = None
    unrealized_pnl: float | None = None
    leverage: float | None = None
    liquidation_price: float | None = None
    margin_used: float | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class TrackedAccount(BaseModel):
    source: str
    account_id: str
    label: str = ''
    enabled: bool = True
    created_at_ms: int


class AccountIntelStore:
    def __init__(self, path: str = './data/tqs-accounts.sqlite3') -> None:
        db = Path(path)
        db.parent.mkdir(parents=True, exist_ok=True)
        self.path = db
        self._lock = RLock()
        self._con = sqlite3.connect(str(db), check_same_thread=False)
        self._con.row_factory = sqlite3.Row
        with self._lock:
            self._con.executescript('''
                pragma journal_mode=WAL;
                create table if not exists tracked_accounts (
                    source text not null, account_id text not null, label text, enabled integer not null,
                    created_at_ms integer not null, primary key(source, account_id)
                );
                create table if not exists account_fills (
                    source text not null, account_id text not null, trade_id text not null,
                    ts_ms integer not null, symbol text not null, side text not null,
                    qty real not null, price real not null, direction text,
                    closed_pnl real, fee real, taker integer, raw_json text,
                    primary key(source, account_id, trade_id)
                );
                create index if not exists idx_account_fills_time on account_fills(source, account_id, ts_ms);
                create table if not exists position_snapshots (
                    source text not null, account_id text not null, observed_at_ms integer not null,
                    symbol text not null, side text not null, size real not null,
                    entry_price real, mark_price real, notional real, unrealized_pnl real,
                    leverage real, liquidation_price real, margin_used real, raw_json text,
                    primary key(source, account_id, observed_at_ms, symbol)
                );
                create index if not exists idx_position_snapshots_time on position_snapshots(source, account_id, observed_at_ms);
                create table if not exists account_sync_log (
                    source text not null, account_id text not null, ts_ms integer not null,
                    status text not null, fills_added integer not null default 0,
                    positions integer not null default 0, error text
                );
            ''')
            self._con.commit()

    def track(self, source: str, account_id: str, label: str = '') -> TrackedAccount:
        source = source.strip().lower(); account_id = account_id.strip().lower()
        if not source or not account_id: raise ValueError('source/account_id required')
        now = _now_ms()
        with self._lock:
            self._con.execute('''insert into tracked_accounts(source,account_id,label,enabled,created_at_ms)
                values(?,?,?,?,?) on conflict(source,account_id) do update set
                label=case when excluded.label<>'' then excluded.label else tracked_accounts.label end, enabled=1''',
                [source, account_id, label.strip(), 1, now])
            self._con.commit()
            row = self._con.execute('select * from tracked_accounts where source=? and account_id=?',[source,account_id]).fetchone()
        return TrackedAccount(source=row['source'],account_id=row['account_id'],label=row['label'] or '',enabled=bool(row['enabled']),created_at_ms=int(row['created_at_ms']))

    def list_tracked(self) -> list[TrackedAccount]:
        with self._lock: rows=self._con.execute('select * from tracked_accounts where enabled=1 order by created_at_ms').fetchall()
        return [TrackedAccount(source=r['source'],account_id=r['account_id'],label=r['label'] or '',enabled=bool(r['enabled']),created_at_ms=int(r['created_at_ms'])) for r in rows]

    def last_fill_ts(self, source: str, account_id: str) -> int | None:
        with self._lock: row=self._con.execute('select max(ts_ms) from account_fills where source=? and account_id=?',[source,account_id]).fetchone()
        return int(row[0]) if row and row[0] is not None else None

    def upsert_fills(self, fills: list[AccountFill]) -> int:
        added=0
        with self._lock:
            for x in fills:
                cur=self._con.execute('insert or ignore into account_fills values(?,?,?,?,?,?,?,?,?,?,?,?,?)',[
                    x.source,x.account_id,x.trade_id,x.ts_ms,x.symbol,x.side,x.qty,x.price,x.direction,x.closed_pnl,x.fee,
                    None if x.taker is None else int(x.taker),json.dumps(x.raw,ensure_ascii=False,default=str)])
                added+=max(cur.rowcount,0)
            self._con.commit()
        return added

    def save_positions(self, rows: list[PositionSnapshot]) -> int:
        if not rows: return 0
        with self._lock:
            for x in rows:
                self._con.execute('insert or replace into position_snapshots values(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[
                    x.source,x.account_id,x.observed_at_ms,x.symbol,x.side,x.size,x.entry_price,x.mark_price,x.notional,
                    x.unrealized_pnl,x.leverage,x.liquidation_price,x.margin_used,json.dumps(x.raw,ensure_ascii=False,default=str)])
            self._con.commit()
        return len(rows)

    def log_sync(self, source: str, account_id: str, status: str, fills_added: int=0, positions: int=0, error: str='') -> None:
        with self._lock:
            self._con.execute('insert into account_sync_log values(?,?,?,?,?,?,?)',[source,account_id,_now_ms(),status,fills_added,positions,error[:4000]])
            self._con.commit()

    def current_positions(self, source: str='', account_id: str='', limit: int=1000) -> list[dict[str,Any]]:
        where=[]; params:list[Any]=[]
        if source: where.append('p.source=?'); params.append(source)
        if account_id: where.append('p.account_id=?'); params.append(account_id)
        filt=('where '+' and '.join(where)) if where else ''
        sql=f'''select p.* from position_snapshots p
            join (select source,account_id,max(observed_at_ms) mx from position_snapshots group by source,account_id) m
            on p.source=m.source and p.account_id=m.account_id and p.observed_at_ms=m.mx
            {filt} order by abs(coalesce(p.notional,0)) desc limit ?'''
        params.append(limit)
        with self._lock: rows=self._con.execute(sql,params).fetchall()
        return [dict(r)|{'raw':json.loads(r['raw_json'] or '{}')} for r in rows]

    def recent_fills(self, source: str, account_id: str, limit: int=2000) -> list[dict[str,Any]]:
        with self._lock: rows=self._con.execute('select * from account_fills where source=? and account_id=? order by ts_ms desc limit ?',[source,account_id,limit]).fetchall()
        return [dict(r)|{'taker':None if r['taker'] is None else bool(r['taker']),'raw':json.loads(r['raw_json'] or '{}')} for r in rows]

    def _profile(self, tracked: TrackedAccount) -> dict[str,Any]:
        fills=self.recent_fills(tracked.source,tracked.account_id,5000); positions=self.current_positions(tracked.source,tracked.account_id,500)
        opening=[x for x in fills if str(x.get('direction') or '').lower().startswith('open')]
        long_opens=[x for x in opening if 'long' in str(x.get('direction') or '').lower()]; short_opens=[x for x in opening if 'short' in str(x.get('direction') or '').lower()]
        realized=[float(x['closed_pnl']) for x in fills if x.get('closed_pnl') not in (None,0)]
        notionals=[abs(float(x['qty'])*float(x['price'])) for x in fills if x.get('qty') is not None and x.get('price') is not None]
        by_symbol:dict[str,float]={}
        for x in fills: by_symbol[x['symbol']]=by_symbol.get(x['symbol'],0.0)+abs(float(x['qty'])*float(x['price']))
        total=sum(by_symbol.values()); top=sorted(by_symbol.items(),key=lambda z:z[1],reverse=True)[:8]
        taker=[x for x in fills if x.get('taker') is not None]
        open_long=sum(abs(float(x.get('notional') or 0)) for x in positions if x.get('side')=='long')
        open_short=sum(abs(float(x.get('notional') or 0)) for x in positions if x.get('side')=='short')
        signatures=[]
        if opening:
            share=len(long_opens)/len(opening)
            if share>=.7: signatures.append('выраженный уклон в LONG')
            elif share<=.3: signatures.append('выраженный уклон в SHORT')
        if total and top and top[0][1]/total>=.45: signatures.append(f'высокая концентрация на {top[0][0]}')
        if taker and sum(1 for x in taker if x['taker'])/len(taker)>=.75: signatures.append('часто исполняется агрессивно (taker)')
        asc=sorted(opening,key=lambda x:x['ts_ms']); scale_hits=sum(1 for a,b in zip(asc,asc[1:]) if a['symbol']==b['symbol'] and a['side']==b['side'] and b['ts_ms']-a['ts_ms']<=30*60_000)
        if scale_hits>=5: signatures.append('часто добирает позицию сериями')
        return {'source':tracked.source,'account_id':tracked.account_id,'label':tracked.label,'fills':len(fills),'open_positions':len(positions),'symbols':len(by_symbol),
            'open_long_notional':open_long,'open_short_notional':open_short,'realized_samples':len(realized),'realized_pnl_sum':sum(realized) if realized else None,
            'realized_win_rate':sum(1 for x in realized if x>0)/len(realized) if realized else None,'median_fill_notional':statistics.median(notionals) if notionals else None,
            'taker_share':sum(1 for x in taker if x['taker'])/len(taker) if taker else None,'long_open_share':len(long_opens)/len(opening) if opening else None,
            'top_instruments':[{'symbol':s,'turnover':v,'share':v/total if total else None} for s,v in top],'signatures':signatures,
            'limits_ru':['Профиль описательный: он не доказывает мотив трейдера.','Входы/стопы/паттерны подтверждаются только после синхронизации fills с MarketContext.']}

    def profiles(self) -> list[dict[str,Any]]: return [self._profile(x) for x in self.list_tracked()]
    def profile(self, source: str, account_id: str) -> dict[str,Any]|None:
        tracked=next((x for x in self.list_tracked() if x.source==source and x.account_id==account_id.lower()),None)
        return self._profile(tracked) if tracked else None
    def stats(self)->dict[str,int]:
        with self._lock:
            tracked=self._con.execute('select count(*) from tracked_accounts where enabled=1').fetchone()[0]
            fills=self._con.execute('select count(*) from account_fills').fetchone()[0]
            snapshots=self._con.execute('select count(*) from position_snapshots').fetchone()[0]
        return {'tracked_accounts':tracked,'fills':fills,'position_snapshots':snapshots,'open_positions':len(self.current_positions())}


class HyperliquidPublicAdapter:
    BASE='https://api.hyperliquid.xyz/info'; source='hyperliquid'
    def __init__(self,http:JsonHttp)->None: self.http=http
    async def positions(self,account_id:str)->list[PositionSnapshot]:
        payload=await self.http.post_json(self.BASE,{'type':'clearinghouseState','user':account_id}); observed=_now_ms(); out=[]
        for item in payload.get('assetPositions') or []:
            pos=item.get('position') or item; symbol=str(pos.get('coin') or ''); szi=_f(pos.get('szi')) or 0.0
            if not symbol or szi==0: continue
            leverage=pos.get('leverage') or {}; lev=_f(leverage.get('value') if isinstance(leverage,dict) else leverage); value=_f(pos.get('positionValue'))
            out.append(PositionSnapshot(source=self.source,account_id=account_id,observed_at_ms=observed,symbol=symbol,side='long' if szi>0 else 'short',size=abs(szi),
                entry_price=_f(pos.get('entryPx')),mark_price=None,notional=abs(value) if value is not None else None,unrealized_pnl=_f(pos.get('unrealizedPnl')),
                leverage=lev,liquidation_price=_f(pos.get('liquidationPx')),margin_used=_f(pos.get('marginUsed')),raw=pos))
        return out
    async def fills(self,account_id:str,start_ms:int)->list[AccountFill]:
        payload=await self.http.post_json(self.BASE,{'type':'userFillsByTime','user':account_id,'startTime':int(start_ms),'aggregateByTime':True}); out=[]
        for row in payload or []:
            symbol=str(row.get('coin') or ''); ts=int(row.get('time') or row.get('timestamp') or 0); px=_f(row.get('px')); qty=_f(row.get('sz'))
            if not symbol or not ts or px is None or qty is None: continue
            raw_id='|'.join(str(row.get(k) or '') for k in ('hash','oid','tid','time','coin','side','px','sz')); trade_id=hashlib.sha1(raw_id.encode('utf-8')).hexdigest()
            out.append(AccountFill(source=self.source,account_id=account_id,trade_id=trade_id,ts_ms=ts,symbol=symbol,side='buy' if str(row.get('side') or '').upper()=='B' else 'sell',
                qty=abs(qty),price=px,direction=str(row.get('dir') or ''),closed_pnl=_f(row.get('closedPnl')),fee=_f(row.get('fee')),
                taker=bool(row.get('crossed')) if row.get('crossed') is not None else None,raw=row))
        return out


class AccountIntelligenceService:
    def __init__(self,control:ControlCenter,store:AccountIntelStore,http:JsonHttp,refresh_seconds:int=60,history_days:int=30)->None:
        self.control=control; self.store=store; self.adapter=HyperliquidPublicAdapter(http); self.refresh_seconds=max(15,int(refresh_seconds)); self.history_days=max(1,min(int(history_days),365))
        from .account_discovery import AccountDiscoveryService
        self.discovery=AccountDiscoveryService(control,store,str(store.path),http)
        self._task:asyncio.Task|None=None; self.running=False; self.last_action='Ожидание'; self.last_error:str|None=None; self.sync_count=0
    def start(self)->None:
        self.discovery.start()
        if self._task is None or self._task.done(): self._task=asyncio.create_task(self._loop(),name='tqs-account-intelligence')
    async def stop(self)->None:
        await self.discovery.stop()
        if self._task and not self._task.done():
            self._task.cancel()
            try: await self._task
            except asyncio.CancelledError: pass
    async def sync_account(self,source:str,account_id:str)->dict[str,Any]:
        source=source.lower(); account_id=account_id.lower()
        if source!='hyperliquid': raise ValueError(f'unsupported account source: {source}')
        self.last_action=f'Счёт {account_id[:10]}…: позиции/fills'; last=self.store.last_fill_ts(source,account_id); start=(last+1) if last else _now_ms()-self.history_days*86_400_000
        try:
            positions,fills=await asyncio.gather(self.adapter.positions(account_id),self.adapter.fills(account_id,start)); added=self.store.upsert_fills(fills); npos=self.store.save_positions(positions)
            self.store.log_sync(source,account_id,'ok',added,npos,''); self.sync_count+=1; self.last_error=None
            return {'ok':True,'source':source,'account_id':account_id,'fills_added':added,'positions':npos}
        except Exception as exc:
            self.last_error=str(exc); self.store.log_sync(source,account_id,'error',0,0,str(exc)); raise
    async def _loop(self)->None:
        self.running=True
        try:
            while True:
                if not self.control.get().live_allowed:
                    self.last_action='Счета/позиции на паузе — STOP'; await asyncio.sleep(2); continue
                accounts=self.store.list_tracked()
                if not accounts:
                    self.last_action='Авторазведка формирует первый hot-set публичных счетов'; await asyncio.sleep(5); continue
                for item in accounts:
                    try: await self.sync_account(item.source,item.account_id)
                    except asyncio.CancelledError: raise
                    except Exception: pass
                self.last_action=f'Hot-set: позиции/fills обновлены ({len(accounts)} счетов)'; await asyncio.sleep(self.refresh_seconds)
        finally: self.running=False
    def status(self)->dict[str,Any]:
        return {'running':self.running,'last_action':self.last_action,'last_error':self.last_error,'sync_count':self.sync_count,'discovery':self.discovery.status(),**self.store.stats()}
