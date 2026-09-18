from __future__ import annotations

import asyncio
import hashlib
import json
import sqlite3
import time
from pathlib import Path
from threading import RLock
from typing import Any

from .control import ControlCenter
from .http import JsonHttp

BASE_URL = "https://investor.finuslugi.ru/contest-api"
RESULTS_PATH = "/api/v1/results"
PAGE_SIZE = 20


def _now_ms() -> int:
    return int(time.time() * 1000)


def _f(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _i(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


class LchiPublicStore:
    """Local evidence store for public LCHI contest observations.

    This store intentionally keeps LCHI separate from MOEX FUTOI aggregate data
    and from user-authorized/private broker data. Rows are observations of a
    public contest surface, not inferred brokerage truth.
    """

    def __init__(self, path: str = "./data/tqs-lchi.sqlite3") -> None:
        db = Path(path)
        db.parent.mkdir(parents=True, exist_ok=True)
        self.path = db
        self._lock = RLock()
        self._con = sqlite3.connect(str(db), check_same_thread=False)
        self._con.row_factory = sqlite3.Row
        with self._lock:
            self._con.executescript(
                """
                pragma journal_mode=WAL;
                create table if not exists lchi_participants (
                    user_id text primary key,
                    login text,
                    broker_code text,
                    ranking integer,
                    total_profit real,
                    total_yield real,
                    total_start_assets real,
                    total_deals integer,
                    eq_yield real,
                    forts_yield real,
                    fx_yield real,
                    assets_json text,
                    first_seen_ms integer not null,
                    last_seen_ms integer not null,
                    last_portfolio_sync_ms integer,
                    source_url text not null,
                    raw_json text
                );
                create index if not exists idx_lchi_rank on lchi_participants(ranking, total_deals desc);
                create index if not exists idx_lchi_portfolio_sync on lchi_participants(last_portfolio_sync_ms, ranking);

                create table if not exists lchi_position_snapshots (
                    user_id text not null,
                    observed_at_ms integer not null,
                    market text,
                    seccode text not null,
                    base_contract_code text,
                    price real,
                    quantity real,
                    estimated_value real,
                    discount_estimated_value real,
                    balance real,
                    source_url text not null,
                    raw_json text,
                    primary key(user_id, observed_at_ms, seccode)
                );
                create index if not exists idx_lchi_pos_symbol_time on lchi_position_snapshots(seccode, observed_at_ms);
                create index if not exists idx_lchi_pos_user_time on lchi_position_snapshots(user_id, observed_at_ms);

                create table if not exists lchi_position_events (
                    event_id text primary key,
                    user_id text not null,
                    ts_ms integer not null,
                    seccode text not null,
                    market text,
                    event_type text not null,
                    previous_qty real,
                    current_qty real,
                    delta_qty real,
                    published_price real,
                    source_url text not null,
                    evidence_level text not null default 'public_account'
                );
                create index if not exists idx_lchi_events_symbol_time on lchi_position_events(seccode, ts_ms);

                create table if not exists lchi_meta (
                    key text primary key,
                    value text not null
                );
                """
            )
            self._con.commit()

    def meta_get(self, key: str, default: str = "") -> str:
        with self._lock:
            row = self._con.execute("select value from lchi_meta where key=?", [key]).fetchone()
        return str(row["value"]) if row else default

    def meta_set(self, key: str, value: Any) -> None:
        with self._lock:
            self._con.execute(
                "insert into lchi_meta(key,value) values(?,?) on conflict(key) do update set value=excluded.value",
                [key, str(value)],
            )
            self._con.commit()

    def upsert_participants(self, rows: list[dict[str, Any]], observed_at_ms: int) -> int:
        changed = 0
        with self._lock:
            for row in rows:
                uid = str(row.get("userId") or "").strip()
                if not uid:
                    continue
                assets = row.get("assets") or []
                source_url = f"https://investor.finuslugi.ru/profile/{uid}"
                cur = self._con.execute(
                    """
                    insert into lchi_participants(
                      user_id,login,broker_code,ranking,total_profit,total_yield,total_start_assets,total_deals,
                      eq_yield,forts_yield,fx_yield,assets_json,first_seen_ms,last_seen_ms,source_url,raw_json
                    ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    on conflict(user_id) do update set
                      login=excluded.login,broker_code=excluded.broker_code,ranking=excluded.ranking,
                      total_profit=excluded.total_profit,total_yield=excluded.total_yield,
                      total_start_assets=excluded.total_start_assets,total_deals=excluded.total_deals,
                      eq_yield=excluded.eq_yield,forts_yield=excluded.forts_yield,fx_yield=excluded.fx_yield,
                      assets_json=excluded.assets_json,last_seen_ms=excluded.last_seen_ms,
                      source_url=excluded.source_url,raw_json=excluded.raw_json
                    """,
                    [
                        uid,
                        row.get("login"),
                        row.get("brokerCode"),
                        _i(row.get("ranking")),
                        _f(row.get("totalProfit")),
                        _f(row.get("totalYield")),
                        _f(row.get("totalStartAssets")),
                        _i(row.get("totalDeals")),
                        _f(row.get("eqYield")),
                        _f(row.get("fortsYield")),
                        _f(row.get("fxYield")),
                        json.dumps(assets, ensure_ascii=False, default=str),
                        observed_at_ms,
                        observed_at_ms,
                        source_url,
                        json.dumps(row, ensure_ascii=False, default=str),
                    ],
                )
                changed += max(cur.rowcount, 0)
            self._con.commit()
        return changed

    def _previous_positions(self, user_id: str) -> dict[str, dict[str, Any]]:
        with self._lock:
            row = self._con.execute(
                "select max(observed_at_ms) mx from lchi_position_snapshots where user_id=?", [user_id]
            ).fetchone()
            if not row or row["mx"] is None:
                return {}
            rows = self._con.execute(
                "select * from lchi_position_snapshots where user_id=? and observed_at_ms=?",
                [user_id, int(row["mx"])],
            ).fetchall()
        return {str(r["seccode"]).upper(): dict(r) for r in rows}

    def save_portfolio(self, user_id: str, payload: dict[str, Any], observed_at_ms: int) -> dict[str, int]:
        previous = self._previous_positions(user_id)
        current: dict[str, dict[str, Any]] = {}
        source_url = f"https://investor.finuslugi.ru/profile/{user_id}"
        raw_positions = [x for x in (payload.get("positions") or []) if isinstance(x, dict)]
        with self._lock:
            for row in raw_positions:
                symbol = str(row.get("seccode") or "").upper().strip()
                if not symbol:
                    continue
                item = {
                    "market": str(row.get("market") or ""),
                    "seccode": symbol,
                    "base_contract_code": str(row.get("baseContractCode") or ""),
                    "price": _f(row.get("price")),
                    "quantity": _f(row.get("quantity")) or 0.0,
                    "estimated_value": _f(row.get("estimatedValue")),
                    "discount_estimated_value": _f(row.get("discountEstimatedValue")),
                    "balance": _f(row.get("balance")),
                    "raw": row,
                }
                current[symbol] = item
                self._con.execute(
                    """
                    insert or replace into lchi_position_snapshots(
                      user_id,observed_at_ms,market,seccode,base_contract_code,price,quantity,
                      estimated_value,discount_estimated_value,balance,source_url,raw_json
                    ) values(?,?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    [
                        user_id,
                        observed_at_ms,
                        item["market"],
                        symbol,
                        item["base_contract_code"],
                        item["price"],
                        item["quantity"],
                        item["estimated_value"],
                        item["discount_estimated_value"],
                        item["balance"],
                        source_url,
                        json.dumps(row, ensure_ascii=False, default=str),
                    ],
                )

            event_count = 0
            all_symbols = set(previous) | set(current)
            for symbol in all_symbols:
                prev = previous.get(symbol)
                cur = current.get(symbol)
                prev_qty = float(prev.get("quantity") or 0.0) if prev else 0.0
                cur_qty = float(cur.get("quantity") or 0.0) if cur else 0.0
                if abs(cur_qty - prev_qty) < 1e-12:
                    continue
                if prev_qty == 0 and cur_qty != 0:
                    kind = "opened"
                elif prev_qty != 0 and cur_qty == 0:
                    kind = "closed"
                elif prev_qty * cur_qty < 0:
                    kind = "flipped"
                elif abs(cur_qty) > abs(prev_qty):
                    kind = "increased"
                else:
                    kind = "reduced"
                market = str((cur or prev or {}).get("market") or "")
                price = _f((cur or {}).get("price")) if cur else _f((prev or {}).get("price"))
                raw_id = f"{user_id}|{observed_at_ms}|{symbol}|{prev_qty}|{cur_qty}|{kind}"
                event_id = hashlib.sha1(raw_id.encode("utf-8")).hexdigest()
                self._con.execute(
                    """
                    insert or ignore into lchi_position_events(
                      event_id,user_id,ts_ms,seccode,market,event_type,previous_qty,current_qty,delta_qty,
                      published_price,source_url,evidence_level
                    ) values(?,?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    [
                        event_id,
                        user_id,
                        observed_at_ms,
                        symbol,
                        market,
                        kind,
                        prev_qty,
                        cur_qty,
                        cur_qty - prev_qty,
                        price,
                        source_url,
                        "public_account",
                    ],
                )
                event_count += 1

            self._con.execute(
                "update lchi_participants set last_portfolio_sync_ms=? where user_id=?",
                [observed_at_ms, user_id],
            )
            self._con.commit()
        return {"positions": len(current), "events": event_count}

    def portfolio_candidates(self, limit: int, stale_after_ms: int = 6 * 3600_000) -> list[dict[str, Any]]:
        cutoff = _now_ms() - stale_after_ms
        with self._lock:
            rows = self._con.execute(
                """
                select * from lchi_participants
                where last_portfolio_sync_ms is null or last_portfolio_sync_ms<?
                order by
                  case when last_portfolio_sync_ms is null then 0 else 1 end,
                  coalesce(ranking,999999) asc,
                  coalesce(total_deals,0) desc,
                  coalesce(last_portfolio_sync_ms,0) asc
                limit ?
                """,
                [cutoff, int(limit)],
            ).fetchall()
        return [dict(r) for r in rows]

    def participants(self, limit: int = 200, q: str = "") -> list[dict[str, Any]]:
        params: list[Any] = []
        where = ""
        if q.strip():
            where = "where lower(login) like ? or lower(user_id) like ?"
            needle = f"%{q.lower().strip()}%"
            params += [needle, needle]
        params.append(int(limit))
        with self._lock:
            rows = self._con.execute(
                f"select * from lchi_participants {where} order by coalesce(ranking,999999), coalesce(total_deals,0) desc limit ?",
                params,
            ).fetchall()
        out = []
        for r in rows:
            item = dict(r)
            item["assets"] = json.loads(item.pop("assets_json") or "[]")
            item.pop("raw_json", None)
            out.append(item)
        return out

    def current_positions(self, symbol: str = "", limit: int = 500) -> list[dict[str, Any]]:
        params: list[Any] = []
        symbol_filter = ""
        if symbol.strip():
            needle = symbol.upper().strip()
            root = needle.split("-")[0]
            symbol_filter = "and (upper(p.seccode)=? or upper(p.base_contract_code)=? or upper(p.seccode) like ?)"
            params.extend([needle, root, root + "-%"])
        params.append(int(limit))
        with self._lock:
            rows = self._con.execute(
                f"""
                select p.*, u.login, u.broker_code, u.ranking, u.total_yield, u.total_deals
                from lchi_position_snapshots p
                join (
                  select user_id,max(observed_at_ms) mx
                  from lchi_position_snapshots group by user_id
                ) latest on p.user_id=latest.user_id and p.observed_at_ms=latest.mx
                left join lchi_participants u on u.user_id=p.user_id
                where abs(coalesce(p.quantity,0))>0 {symbol_filter}
                order by abs(coalesce(p.estimated_value,0)) desc, abs(coalesce(p.quantity,0)) desc
                limit ?
                """,
                params,
            ).fetchall()
        return [dict(r) | {"evidence_level": "public_account"} for r in rows]

    def events(self, symbol: str = "", limit: int = 500) -> list[dict[str, Any]]:
        params: list[Any] = []
        where = ""
        if symbol.strip():
            needle = symbol.upper().strip()
            root = needle.split("-")[0]
            where = "where (upper(e.seccode)=? or upper(e.seccode) like ?)"
            params.extend([needle, root + "-%"])
        params.append(int(limit))
        with self._lock:
            rows = self._con.execute(
                f"""
                select e.*, u.login, u.broker_code, u.ranking, u.total_yield
                from lchi_position_events e
                left join lchi_participants u on u.user_id=e.user_id
                {where}
                order by e.ts_ms desc limit ?
                """,
                params,
            ).fetchall()
        return [dict(r) for r in rows]

    def account(self, user_id: str) -> dict[str, Any] | None:
        with self._lock:
            user = self._con.execute("select * from lchi_participants where user_id=?", [user_id]).fetchone()
            if user is None:
                return None
            mx = self._con.execute(
                "select max(observed_at_ms) from lchi_position_snapshots where user_id=?", [user_id]
            ).fetchone()[0]
            positions = []
            if mx is not None:
                positions = [
                    dict(r) | {"evidence_level": "public_account"}
                    for r in self._con.execute(
                        "select * from lchi_position_snapshots where user_id=? and observed_at_ms=? order by abs(coalesce(estimated_value,0)) desc",
                        [user_id, int(mx)],
                    ).fetchall()
                ]
            events = [
                dict(r)
                for r in self._con.execute(
                    "select * from lchi_position_events where user_id=? order by ts_ms desc limit 500", [user_id]
                ).fetchall()
            ]
        participant = dict(user)
        participant["assets"] = json.loads(participant.pop("assets_json") or "[]")
        participant.pop("raw_json", None)
        return {"participant": participant, "positions": positions, "events": events}

    def stats(self) -> dict[str, Any]:
        with self._lock:
            participants = int(self._con.execute("select count(*) from lchi_participants").fetchone()[0])
            synced = int(self._con.execute("select count(*) from lchi_participants where last_portfolio_sync_ms is not null").fetchone()[0])
            snapshots = int(self._con.execute("select count(*) from lchi_position_snapshots").fetchone()[0])
            events = int(self._con.execute("select count(*) from lchi_position_events").fetchone()[0])
            latest = self._con.execute("select max(observed_at_ms) from lchi_position_snapshots").fetchone()[0]
        return {
            "participants_discovered": participants,
            "participants_with_portfolio": synced,
            "position_snapshots": snapshots,
            "position_events": events,
            "last_position_observed_at_ms": int(latest) if latest is not None else None,
        }


class LchiPublicService:
    """Rate-limited automatic collector for the public LCHI 2026 surface."""

    def __init__(self, control: ControlCenter, store: LchiPublicStore, http: JsonHttp, deals_collector: Any | None = None) -> None:
        self.control = control
        self.store = store
        self.http = http
        self.deals_collector = deals_collector
        self._task: asyncio.Task | None = None
        self.running = False
        self.last_action = "ЛЧИ: ожидание"
        self.last_error: str | None = None
        self.catalog_pages_total = int(store.meta_get("catalog_pages_total", "0") or 0)
        self.catalog_page = int(store.meta_get("catalog_page", "0") or 0)
        self.catalog_cycles = 0
        self.portfolio_cycles = 0
        self._stats_cache = store.stats()

    @property
    def results_url(self) -> str:
        return BASE_URL + RESULTS_PATH

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._loop(), name="tqs-lchi-public")

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _catalog_batch(self, pages: int) -> None:
        for _ in range(max(1, pages)):
            page = self.catalog_page
            self.last_action = f"ЛЧИ: каталог участников · страница {page + 1}"
            payload = await self.http.get_json(
                self.results_url,
                {"page": page, "size": PAGE_SIZE, "sort": "ranking,asc"},
                timeout_s=15,
            )
            rows = [x for x in (payload.get("participants") or []) if isinstance(x, dict)]
            observed = _now_ms()
            self.store.upsert_participants(rows, observed)
            total_pages = int(payload.get("totalPages") or 0)
            if total_pages:
                self.catalog_pages_total = total_pages
                self.store.meta_set("catalog_pages_total", total_pages)
            self.catalog_page += 1
            if self.catalog_pages_total and self.catalog_page >= self.catalog_pages_total:
                self.catalog_page = 0
                self.store.meta_set("catalog_completed_at_ms", observed)
            self.store.meta_set("catalog_page", self.catalog_page)
            self.catalog_cycles += 1
            await asyncio.sleep(0.25)

    async def _portfolio_batch(self, limit: int) -> None:
        candidates = self.store.portfolio_candidates(max(1, limit))
        for item in candidates:
            uid = str(item["user_id"])
            self.last_action = f"ЛЧИ: позиции {item.get('login') or uid[:8]} · {uid[:8]}…"
            try:
                payload = await self.http.get_json(
                    f"{BASE_URL}/api/v1/participants/{uid}/profile/portfolio",
                    timeout_s=15,
                )
                self.store.save_portfolio(uid, payload if isinstance(payload, dict) else {}, _now_ms())
                self.last_error = None
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                # Record a short cooldown so one broken/publicly-hidden profile
                # does not monopolize every cycle.
                self.last_error = f"{type(exc).__name__}: {exc}"
                self.store.meta_set(f"portfolio_error:{uid}", self.last_error[:500])
            self.portfolio_cycles += 1
            await asyncio.sleep(0.35)

    async def _loop(self) -> None:
        self.running = True
        try:
            while True:
                state = self.control.get()
                if not state.live_allowed:
                    self.last_action = "ЛЧИ: пауза — режим СТОП"
                    await asyncio.sleep(3)
                    continue
                try:
                    # LIGHT keeps a low-cost discovery pulse alive; MAX builds
                    # the public evidence layer materially faster.
                    catalog_pages = 5 if state.mode == "max" else 1
                    portfolio_limit = 10 if state.mode == "max" else 2
                    await self._catalog_batch(catalog_pages)
                    await self._portfolio_batch(portfolio_limit)
                    if state.mode == "max" and self.deals_collector is not None:
                        await self.deals_collector.sync_batch(1)
                    self._stats_cache = self.store.stats()
                    self.last_action = (
                        f"ЛЧИ: найдено {self._stats_cache['participants_discovered']:,} участников · "
                        f"портфели {self._stats_cache['participants_with_portfolio']:,}"
                    )
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    self.last_error = f"{type(exc).__name__}: {exc}"
                    self.last_action = f"ЛЧИ: ошибка источника — {str(exc)[:120]}"
                await asyncio.sleep(20 if state.mode == "max" else 60)
        finally:
            self.running = False

    def quick_status(self) -> dict[str, Any]:
        total = self.catalog_pages_total * PAGE_SIZE if self.catalog_pages_total else None
        deals = self.deals_collector.stats() if self.deals_collector is not None else {}
        return {
            "running": self.running,
            "last_action": self.last_action,
            "last_error": self.last_error,
            "catalog_page": self.catalog_page,
            "catalog_pages_total": self.catalog_pages_total,
            "catalog_target_approx": total,
            "catalog_cycles": self.catalog_cycles,
            "portfolio_cycles": self.portfolio_cycles,
            **self._stats_cache,
            "evidence_level": "public_account",
            "source": "LCHI 2026 / Finuslugi public contest API",
            "rate_policy": "LIGHT 1 page + 2 portfolios/cycle; MAX 5 pages + 10 portfolios/cycle + 1 public deals snapshot",
            **deals,
        }

    def status(self) -> dict[str, Any]:
        self._stats_cache = self.store.stats()
        return self.quick_status()
