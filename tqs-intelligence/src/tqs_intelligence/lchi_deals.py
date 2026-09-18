from __future__ import annotations

import asyncio
import csv
import hashlib
import io
import json
import re
import time
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from .http import JsonHttp

BASE_URL = "https://investor.finuslugi.ru/contest-api"
REQUEST_URL = BASE_URL + "/api/v1/snapshot/deals/request"


def _now_ms() -> int:
    return int(time.time() * 1000)


def _norm(value: Any) -> str:
    return re.sub(r"[^a-zа-я0-9]+", "", str(value or "").lower())


def _f(value: Any) -> float | None:
    if value in (None, ""):
        return None
    text = str(value).strip().replace("\xa0", "").replace(" ", "").replace(",", ".")
    text = re.sub(r"[^0-9+\-.]", "", text)
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _parse_ts(value: Any) -> int | None:
    if value in (None, ""):
        return None
    text = str(value).strip()
    if text.isdigit():
        raw = int(text)
        if raw > 1_000_000_000_000:
            return raw
        if raw > 1_000_000_000:
            return raw * 1000
    layouts = (
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S",
        "%d.%m.%Y %H:%M:%S",
        "%d.%m.%Y %H:%M",
        "%Y-%m-%d %H:%M",
    )
    for layout in layouts:
        try:
            dt = datetime.strptime(text.replace("Z", "+0000"), layout)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=ZoneInfo("Europe/Moscow"))
            return int(dt.astimezone(timezone.utc).timestamp() * 1000)
        except ValueError:
            pass
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=ZoneInfo("Europe/Moscow"))
        return int(dt.astimezone(timezone.utc).timestamp() * 1000)
    except ValueError:
        return None


ALIASES = {
    "timestamp": {
        "datetime", "date", "tradetime", "dealtime", "time", "timestamp",
        "датавремя", "датасделки", "времясделки", "датаивремя", "время",
    },
    "date": {"tradedate", "dealdate", "дата"},
    "clock": {"tradetime", "dealtime", "времясделки", "время"},
    "symbol": {
        "ticker", "symbol", "seccode", "security", "instrument", "code",
        "тикер", "кодбумаги", "кодинструмента", "инструмент", "бумага",
    },
    "side": {
        "side", "direction", "operation", "operationtype", "buysell", "type",
        "направление", "операция", "типоперации", "покупкапродажа",
    },
    "quantity": {
        "quantity", "qty", "volume", "amount", "lots", "contracts",
        "количество", "объем", "объём", "количествобумаг", "лоты",
    },
    "price": {"price", "dealprice", "tradeprice", "цена", "ценасделки"},
    "market": {"market", "markettype", "board", "рынок", "секциярынка"},
    "id": {"id", "dealid", "tradeid", "operationid", "номерсделки", "идсделки"},
}


def _field_map(headers: list[str]) -> dict[str, str]:
    normalized = {_norm(header): header for header in headers}
    out: dict[str, str] = {}
    for logical, aliases in ALIASES.items():
        for alias in aliases:
            if _norm(alias) in normalized:
                out[logical] = normalized[_norm(alias)]
                break
    return out


def _side(value: Any) -> str:
    text = str(value or "").strip().lower()
    if any(token in text for token in ("buy", "покуп", "long", "b")):
        return "buy"
    if any(token in text for token in ("sell", "прод", "short", "s")):
        return "sell"
    return text or "unknown"


def parse_deals_csv(user_id: str, text: str) -> dict[str, Any]:
    raw = text.lstrip("\ufeff").strip()
    if not raw:
        return {"rows": [], "unparsed": 0, "headers": []}
    sample = raw[:8192]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=";,\t")
    except csv.Error:
        dialect = csv.excel
        dialect.delimiter = ";"
    reader = csv.DictReader(io.StringIO(raw), dialect=dialect)
    headers = [str(x or "") for x in (reader.fieldnames or [])]
    fmap = _field_map(headers)
    parsed: list[dict[str, Any]] = []
    unparsed = 0
    for row in reader:
        if not isinstance(row, dict):
            continue
        symbol = str(row.get(fmap.get("symbol", ""), "") or "").strip().upper()
        if not symbol:
            unparsed += 1
            continue
        ts = None
        if "timestamp" in fmap:
            ts = _parse_ts(row.get(fmap["timestamp"]))
        if ts is None and "date" in fmap:
            date = str(row.get(fmap["date"], "") or "").strip()
            clock = str(row.get(fmap.get("clock", ""), "") or "").strip()
            ts = _parse_ts((date + " " + clock).strip())
        if ts is None:
            unparsed += 1
            continue
        side = _side(row.get(fmap.get("side", ""), ""))
        qty = _f(row.get(fmap.get("quantity", ""), None))
        price = _f(row.get(fmap.get("price", ""), None))
        provider_id = str(row.get(fmap.get("id", ""), "") or "").strip()
        key = provider_id or f"{user_id}|{ts}|{symbol}|{side}|{qty}|{price}"
        trade_id = hashlib.sha1(key.encode("utf-8")).hexdigest()
        parsed.append(
            {
                "trade_id": trade_id,
                "provider_trade_id": provider_id or None,
                "user_id": user_id,
                "ts_ms": ts,
                "symbol": symbol,
                "side": side,
                "quantity": qty,
                "price": price,
                "market": str(row.get(fmap.get("market", ""), "") or ""),
                "raw": row,
            }
        )
    return {"rows": parsed, "unparsed": unparsed, "headers": headers, "delimiter": dialect.delimiter}


class LchiDealsCollector:
    """Exact public LCHI trade-history collector.

    The contest UI exposes a public CSV snapshot generator. Unlike portfolio
    diffs, rows from this source can carry exact public trade timestamps. We
    keep both evidence classes distinct.
    """

    def __init__(self, store: Any, http: JsonHttp) -> None:
        self.store = store
        self.http = http
        self.last_action = "ЛЧИ сделки: ожидание"
        self.last_error: str | None = None
        self._ensure_schema()

    def _ensure_schema(self) -> None:
        with self.store._lock:
            self.store._con.executescript(
                """
                create table if not exists lchi_public_trades (
                    trade_id text primary key,
                    provider_trade_id text,
                    user_id text not null,
                    ts_ms integer not null,
                    seccode text not null,
                    side text,
                    quantity real,
                    price real,
                    market text,
                    source_url text not null,
                    raw_json text
                );
                create index if not exists idx_lchi_trades_symbol_time on lchi_public_trades(seccode, ts_ms);
                create index if not exists idx_lchi_trades_user_time on lchi_public_trades(user_id, ts_ms);
                """
            )
            self.store._con.commit()

    def _last_sync(self, user_id: str) -> int:
        try:
            return int(self.store.meta_get(f"deals_sync_ms:{user_id}", "0") or 0)
        except Exception:
            return 0

    def candidates(self, limit: int = 1, stale_ms: int = 6 * 3_600_000) -> list[dict[str, Any]]:
        rows = self.store.participants(limit=1000)
        now = _now_ms()
        rows.sort(key=lambda x: (self._last_sync(str(x.get("user_id") or "")), int(x.get("ranking") or 999999)))
        return [x for x in rows if now - self._last_sync(str(x.get("user_id") or "")) >= stale_ms][: max(0, int(limit))]

    def _persist(self, user_id: str, parsed: dict[str, Any]) -> dict[str, int]:
        source_url = f"https://investor.finuslugi.ru/profile/{user_id}"
        added = 0
        with self.store._lock:
            for row in parsed.get("rows") or []:
                cur = self.store._con.execute(
                    """insert or ignore into lchi_public_trades(
                         trade_id,provider_trade_id,user_id,ts_ms,seccode,side,quantity,price,market,source_url,raw_json
                       ) values(?,?,?,?,?,?,?,?,?,?,?)""",
                    [
                        row["trade_id"], row.get("provider_trade_id"), user_id, int(row["ts_ms"]),
                        row["symbol"], row.get("side"), row.get("quantity"), row.get("price"),
                        row.get("market"), source_url, json.dumps(row.get("raw") or {}, ensure_ascii=False, default=str),
                    ],
                )
                added += max(cur.rowcount, 0)
            self.store._con.commit()
        self.store.meta_set(f"deals_sync_ms:{user_id}", _now_ms())
        self.store.meta_set(f"deals_headers:{user_id}", json.dumps(parsed.get("headers") or [], ensure_ascii=False))
        return {"trades_seen": len(parsed.get("rows") or []), "trades_added": added, "unparsed": int(parsed.get("unparsed") or 0)}

    async def sync(self, user_id: str, market: str = "ALL") -> dict[str, Any]:
        uid = str(user_id).strip()
        if not uid:
            raise ValueError("LCHI user_id is empty")
        self.last_action = f"ЛЧИ сделки: запрашиваю snapshot {uid[:8]}…"
        request = await self.http.post_json(REQUEST_URL, {"userId": uid, "market": market}, timeout_s=20)
        request_id = str((request or {}).get("requestId") or "").strip()
        if not request_id:
            raise RuntimeError(f"LCHI deals request did not return requestId: {request}")
        status_url = f"{BASE_URL}/api/v1/snapshot/deals/{request_id}/status"
        download_url = f"{BASE_URL}/api/v1/snapshot/deals/{request_id}"
        status = ""
        for _ in range(30):
            payload = await self.http.get_json(status_url, timeout_s=15)
            status = str((payload or {}).get("status") or "").upper()
            if status in {"COMPLETED", "DONE", "READY"}:
                break
            if status in {"FAILED", "ERROR", "CANCELLED"}:
                raise RuntimeError(f"LCHI deals snapshot failed: {payload}")
            await asyncio.sleep(0.5)
        else:
            raise TimeoutError(f"LCHI deals snapshot {request_id} not ready; last status={status}")
        self.last_action = f"ЛЧИ сделки: скачиваю CSV {uid[:8]}…"
        csv_text = await self.http.post_text(download_url, {}, timeout_s=30)
        parsed = parse_deals_csv(uid, csv_text)
        result = self._persist(uid, parsed)
        self.last_error = None
        self.last_action = f"ЛЧИ сделки: {uid[:8]} · {result['trades_seen']:,} строк"
        return {"ok": True, "user_id": uid, "request_id": request_id, **result}

    async def sync_batch(self, limit: int = 1) -> dict[str, int]:
        done = failed = added = 0
        for item in self.candidates(limit):
            uid = str(item.get("user_id") or "")
            try:
                result = await self.sync(uid)
                done += 1
                added += int(result.get("trades_added") or 0)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                failed += 1
                self.last_error = f"{type(exc).__name__}: {exc}"
                self.store.meta_set(f"deals_error:{uid}", self.last_error[:500])
        return {"done": done, "failed": failed, "added": added}

    def trades(self, symbol: str = "", user_id: str = "", limit: int = 1000) -> list[dict[str, Any]]:
        where: list[str] = []
        params: list[Any] = []
        if symbol.strip():
            needle = symbol.upper().strip()
            root = needle.split("-")[0]
            where.append("(upper(t.seccode)=? or upper(t.seccode) like ?)")
            params.extend([needle, root + "-%"])
        if user_id.strip():
            where.append("t.user_id=?")
            params.append(user_id.strip())
        sql = """select t.*,u.login,u.broker_code,u.ranking,u.total_yield
                 from lchi_public_trades t left join lchi_participants u on u.user_id=t.user_id"""
        if where:
            sql += " where " + " and ".join(where)
        sql += " order by t.ts_ms desc limit ?"
        params.append(int(limit))
        with self.store._lock:
            rows = self.store._con.execute(sql, params).fetchall()
        return [dict(row) for row in rows]

    def stats(self) -> dict[str, Any]:
        with self.store._lock:
            count = int(self.store._con.execute("select count(*) from lchi_public_trades").fetchone()[0])
            users = int(self.store._con.execute("select count(distinct user_id) from lchi_public_trades").fetchone()[0])
            latest = self.store._con.execute("select max(ts_ms) from lchi_public_trades").fetchone()[0]
        return {
            "public_trades": count,
            "participants_with_trades": users,
            "last_public_trade_ts_ms": int(latest) if latest is not None else None,
            "last_deals_action": self.last_action,
            "last_deals_error": self.last_error,
            "evidence_time": "exact public CSV trade timestamp",
        }
