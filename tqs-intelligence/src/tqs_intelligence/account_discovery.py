from __future__ import annotations

import asyncio
import json
import math
import sqlite3
import time
from pathlib import Path
from threading import RLock
from typing import Any

from .account_intelligence import AccountIntelStore
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


def _window_map(row: dict[str, Any]) -> dict[str, dict[str, float | None]]:
    raw = row.get('windowPerformances') or row.get('window_performances') or []
    out: dict[str, dict[str, float | None]] = {}
    if isinstance(raw, dict):
        items = raw.items()
    else:
        items = raw
    for item in items:
        if not isinstance(item, (list, tuple)) or len(item) < 2:
            continue
        name, values = str(item[0]), item[1] or {}
        if not isinstance(values, dict):
            continue
        out[name] = {'pnl': _f(values.get('pnl')), 'roi': _f(values.get('roi')), 'vlm': _f(values.get('vlm'))}
    return out


def score_leaderboard_row(row: dict[str, Any]) -> tuple[float, list[str], dict[str, Any]]:
    windows = _window_map(row)
    equity = _f(row.get('accountValue') or row.get('account_value')) or 0.0
    day = windows.get('day', {})
    week = windows.get('week', {})
    month = windows.get('month', {})
    all_time = windows.get('allTime', windows.get('all_time', {}))
    score = 0.0
    reasons: list[str] = []
    positives = 0
    for _, data, weight in (('день', day, 5.0), ('неделя', week, 10.0), ('месяц', month, 15.0), ('вся история', all_time, 10.0)):
        pnl = data.get('pnl')
        if pnl is not None and pnl > 0:
            score += weight
            positives += 1
    if positives >= 3:
        score += 12
        reasons.append('положительный PnL в нескольких окнах')
    all_pnl = all_time.get('pnl') or 0.0
    if all_pnl > 0:
        score += min(18.0, max(0.0, math.log10(max(all_pnl, 1.0)) * 3.0))
        if all_pnl >= 1_000_000:
            reasons.append('крупный накопленный PnL')
    if 50_000 <= equity <= 20_000_000:
        score += 12
        reasons.append('размер счёта пригоден для исследования')
    elif equity >= 10_000:
        score += 5
    else:
        score -= 8
    month_roi = month.get('roi')
    week_roi = week.get('roi')
    if month_roi is not None and month_roi > 0 and abs(month_roi) < 20:
        score += 8
    if week_roi is not None and week_roi > 0 and abs(week_roi) < 20:
        score += 5
    all_vlm = all_time.get('vlm') or 0.0
    ratio = all_vlm / equity if equity > 0 else None
    if ratio is not None:
        if ratio <= 20_000:
            score += 8
        else:
            score -= 10
            reasons.append('очень высокий turnover/equity: возможен HFT/MM')
    recent_vlm = (week.get('vlm') or 0.0) + (month.get('vlm') or 0.0)
    if recent_vlm > 0:
        score += min(10.0, math.log10(max(recent_vlm, 1.0)))
        reasons.append('есть свежая торговая активность')
    if not reasons:
        reasons.append('публичный участник leaderboard; данных для сильного приоритета мало')
    metrics = {
        'equity': equity,
        'day_pnl': day.get('pnl'), 'day_roi': day.get('roi'), 'day_volume': day.get('vlm'),
        'week_pnl': week.get('pnl'), 'week_roi': week.get('roi'), 'week_volume': week.get('vlm'),
        'month_pnl': month.get('pnl'), 'month_roi': month.get('roi'), 'month_volume': month.get('vlm'),
        'all_time_pnl': all_time.get('pnl'), 'all_time_roi': all_time.get('roi'), 'all_time_volume': all_time.get('vlm'),
        'volume_equity_ratio': ratio,
    }
    return round(max(0.0, min(100.0, score)), 2), reasons, metrics


class AccountDiscoveryStore:
    def __init__(self, path: str) -> None:
        db = Path(path)
        db.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self._con = sqlite3.connect(str(db), check_same_thread=False)
        self._con.row_factory = sqlite3.Row
        with self._lock:
            self._con.executescript('''
                pragma journal_mode=WAL;
                create table if not exists discovered_accounts (
                    source text not null, account_id text not null, display_name text, discovery_score real not null,
                    equity real, day_pnl real, day_roi real, day_volume real,
                    week_pnl real, week_roi real, week_volume real,
                    month_pnl real, month_roi real, month_volume real,
                    all_time_pnl real, all_time_roi real, all_time_volume real, volume_equity_ratio real,
                    reasons_json text, raw_json text, first_seen_ms integer not null, last_seen_ms integer not null,
                    primary key(source, account_id)
                );
                create index if not exists idx_discovered_accounts_score on discovered_accounts(source, discovery_score desc);
                create table if not exists account_discovery_runs (
                    ts_ms integer not null, source text not null, status text not null,
                    discovered integer not null default 0, promoted integer not null default 0,
                    duration_ms integer, error text
                );
            ''')
            self._con.commit()

    def upsert_rows(self, source: str, rows: list[dict[str, Any]]) -> int:
        now = _now_ms(); payloads = []
        for row in rows:
            address = str(row.get('ethAddress') or row.get('address') or '').strip().lower()
            if len(address) != 42 or not address.startswith('0x'):
                continue
            score, reasons, m = score_leaderboard_row(row)
            payloads.append((source, address, str(row.get('displayName') or row.get('display_name') or '').strip(), score,
                m['equity'], m['day_pnl'], m['day_roi'], m['day_volume'], m['week_pnl'], m['week_roi'], m['week_volume'],
                m['month_pnl'], m['month_roi'], m['month_volume'], m['all_time_pnl'], m['all_time_roi'], m['all_time_volume'],
                m['volume_equity_ratio'], json.dumps(reasons, ensure_ascii=False), json.dumps(row, ensure_ascii=False, default=str), now, now))
        with self._lock:
            self._con.executemany('''insert into discovered_accounts values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                on conflict(source, account_id) do update set
                    display_name=excluded.display_name, discovery_score=excluded.discovery_score, equity=excluded.equity,
                    day_pnl=excluded.day_pnl, day_roi=excluded.day_roi, day_volume=excluded.day_volume,
                    week_pnl=excluded.week_pnl, week_roi=excluded.week_roi, week_volume=excluded.week_volume,
                    month_pnl=excluded.month_pnl, month_roi=excluded.month_roi, month_volume=excluded.month_volume,
                    all_time_pnl=excluded.all_time_pnl, all_time_roi=excluded.all_time_roi, all_time_volume=excluded.all_time_volume,
                    volume_equity_ratio=excluded.volume_equity_ratio, reasons_json=excluded.reasons_json,
                    raw_json=excluded.raw_json, last_seen_ms=excluded.last_seen_ms''', payloads)
            self._con.commit()
        return len(payloads)

    def list(self, limit: int = 200, q: str = '', min_score: float = 0.0) -> list[dict[str, Any]]:
        params: list[Any] = [float(min_score)]; where = ['discovery_score>=?']
        if q.strip():
            where.append('(lower(account_id) like ? or lower(display_name) like ?)')
            needle = f"%{q.strip().lower()}%"; params.extend([needle, needle])
        params.append(int(limit))
        with self._lock:
            rows = self._con.execute(f'''select * from discovered_accounts where {' and '.join(where)}
                order by discovery_score desc, abs(coalesce(month_pnl,0)) desc limit ?''', params).fetchall()
        out = []
        for r in rows:
            item = dict(r); item['reasons'] = json.loads(item.pop('reasons_json') or '[]'); item.pop('raw_json', None); out.append(item)
        return out

    def count(self) -> int:
        with self._lock: return int(self._con.execute('select count(*) from discovered_accounts').fetchone()[0])

    def log_run(self, source: str, status: str, discovered: int, promoted: int, duration_ms: int, error: str = '') -> None:
        with self._lock:
            self._con.execute('insert into account_discovery_runs values(?,?,?,?,?,?,?)', [_now_ms(), source, status, discovered, promoted, duration_ms, error[:4000]])
            self._con.commit()

    def last_run(self) -> dict[str, Any] | None:
        with self._lock: row = self._con.execute('select * from account_discovery_runs order by ts_ms desc limit 1').fetchone()
        return dict(row) if row else None


class HyperliquidLeaderboardDiscovery:
    URL = 'https://stats-data.hyperliquid.xyz/Mainnet/leaderboard'; source = 'hyperliquid-leaderboard'
    def __init__(self, http: JsonHttp) -> None: self.http = http
    async def fetch(self) -> list[dict[str, Any]]:
        payload = await self.http.get_json(self.URL)
        rows = (payload.get('leaderboardRows') or payload.get('rows') or payload.get('data') or []) if isinstance(payload, dict) else payload
        return [x for x in (rows or []) if isinstance(x, dict)]


class AccountDiscoveryService:
    def __init__(self, control: ControlCenter, account_store: AccountIntelStore, db_path: str, http: JsonHttp,
                 interval_seconds: int = 3600, light_promote: int = 20, max_promote: int = 60) -> None:
        self.control=control; self.account_store=account_store; self.store=AccountDiscoveryStore(db_path); self.adapter=HyperliquidLeaderboardDiscovery(http)
        self.interval_seconds=max(300,int(interval_seconds)); self.light_promote=max(5,int(light_promote)); self.max_promote=max(self.light_promote,int(max_promote))
        self._task: asyncio.Task|None=None; self._manual: asyncio.Task|None=None; self.running=False; self.refreshing=False
        self.last_action='Ожидание первой авторазведки'; self.last_error: str|None=None; self.discovery_count=0
    def _promotion_limit(self)->int: return self.max_promote if self.control.get().mode=='max' else self.light_promote
    async def discover(self)->dict[str,Any]:
        if self.refreshing: return {'ok':True,'accepted':False,'message':'Разведка уже выполняется'}
        self.refreshing=True; started=_now_ms(); self.last_action='Hyperliquid: загружаю полный публичный leaderboard'
        try:
            rows=await self.adapter.fetch(); discovered=self.store.upsert_rows(self.adapter.source,rows); candidates=self.store.list(limit=self._promotion_limit(),min_score=20); promoted=0
            for item in candidates:
                label=item.get('display_name') or f"AUTO {item['account_id'][:8]}"; self.account_store.track('hyperliquid',item['account_id'],str(label)); promoted+=1
            self.discovery_count+=1; self.last_error=None; self.last_action=f'Разведка: {discovered:,} публичных счетов; {promoted} в горячем наблюдении'
            self.store.log_run(self.adapter.source,'ok',discovered,promoted,_now_ms()-started); return {'ok':True,'accepted':True,'discovered':discovered,'promoted':promoted}
        except Exception as exc:
            self.last_error=str(exc); self.last_action='Разведка счетов: ошибка источника'; self.store.log_run(self.adapter.source,'error',0,0,_now_ms()-started,str(exc)); return {'ok':False,'accepted':True,'error':str(exc)}
        finally: self.refreshing=False
    def request_discovery(self)->bool:
        if self.refreshing or (self._manual and not self._manual.done()): return False
        self._manual=asyncio.create_task(self.discover(),name='tqs-account-discovery-manual'); return True
    async def _loop(self)->None:
        self.running=True
        try:
            await asyncio.sleep(3)
            while True:
                if not self.control.get().live_allowed:
                    self.last_action='Разведка счетов на паузе — STOP'; await asyncio.sleep(5); continue
                await self.discover(); await asyncio.sleep(self.interval_seconds)
        finally: self.running=False
    def start(self)->None:
        if self._task is None or self._task.done(): self._task=asyncio.create_task(self._loop(),name='tqs-account-discovery')
    async def stop(self)->None:
        for task in (self._manual,self._task):
            if task and not task.done():
                task.cancel()
                try: await task
                except asyncio.CancelledError: pass
    def status(self)->dict[str,Any]:
        return {'running':self.running,'refreshing':self.refreshing,'last_action':self.last_action,'last_error':self.last_error,
            'discovery_count':self.discovery_count,'discovered_accounts':self.store.count(),'tracked_accounts':len(self.account_store.list_tracked()),
            'promotion_limit':self._promotion_limit(),'interval_seconds':self.interval_seconds,'last_run':self.store.last_run(),'source':self.adapter.source,
            'source_note_ru':'Полный публичный leaderboard — дешёвый каталог; positions/fills часто опрашиваются только для автоматически отобранного hot set.'}
