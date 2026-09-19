
import asyncio
import hashlib
import html
import json
import re
import sqlite3
import time
from html.parser import HTMLParser
from pathlib import Path
from threading import RLock
from typing import Any

from .control import ControlCenter
from .http import JsonHttp


def _now_ms() -> int:
    return int(time.time() * 1000)


def _f(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _ts_ms(value: Any) -> int | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        raw = int(value)
        return raw if raw > 1_000_000_000_000 else raw * 1000 if raw > 1_000_000_000 else None
    text = str(value).strip()
    if text.isdigit():
        return _ts_ms(int(text))
    try:
        from datetime import datetime, timezone
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return int(parsed.timestamp() * 1000)
    except Exception:
        return None


class _JsonScriptParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.capture = False
        self.parts: list[str] = []
        self.scripts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "script":
            return
        values = {str(k).lower(): str(v or "") for k, v in attrs}
        self.capture = values.get("type", "").startswith("application/json")
        self.parts = []

    def handle_data(self, data: str) -> None:
        if self.capture:
            self.parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "script" and self.capture:
            raw = "".join(self.parts).strip()
            if raw:
                self.scripts.append(html.unescape(raw))
            self.capture = False
            self.parts = []


def embedded_json(html_text: str) -> list[Any]:
    parser = _JsonScriptParser()
    parser.feed(html_text)
    out: list[Any] = []
    for raw in parser.scripts:
        try:
            out.append(json.loads(raw))
        except Exception:
            continue
    return out


def _walk(value: Any):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from _walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk(child)


def _pick(obj: dict[str, Any], names: tuple[str, ...]) -> Any:
    for name in names:
        if name in obj and obj[name] not in (None, ""):
            return obj[name]
    return None


def parse_pulse_html(handle: str, html_text: str) -> dict[str, Any]:
    roots = embedded_json(html_text)
    objects = [obj for root in roots for obj in _walk(root)]

    profile: dict[str, Any] = {}
    profile_score = -1
    for obj in objects:
        keys = {str(k).lower() for k in obj}
        score = 0
        if any(k in keys for k in ("followers", "followerscount", "subscribers", "subscriberscount")):
            score += 3
        if any(k in keys for k in ("postscount", "publicationscount", "posts")):
            score += 2
        if any(k in keys for k in ("nickname", "username", "handle", "login")):
            score += 1
        if score > profile_score:
            profile, profile_score = obj, score

    events: list[dict[str, Any]] = []
    seen: set[str] = set()
    for obj in objects:
        raw_side = _pick(obj, ("side", "operationType", "operation_type", "action", "direction", "type"))
        raw_symbol = _pick(obj, ("ticker", "symbol", "instrumentTicker", "instrument_ticker", "securityCode", "figi"))
        raw_price = _pick(obj, ("price", "operationPrice", "operation_price", "averagePrice"))
        raw_time = _pick(obj, ("operationDate", "operation_date", "createdAt", "created_at", "date", "time", "timestamp"))
        if raw_side is None or raw_symbol is None or raw_time is None:
            continue
        side_text = str(raw_side).lower()
        if not any(token in side_text for token in ("buy", "sell", "покуп", "прод", "long", "short")):
            continue
        ts = _ts_ms(raw_time)
        if ts is None:
            continue
        symbol = re.sub(r"[^A-Za-zА-Яа-я0-9._-]+", "", str(raw_symbol).upper())[:64]
        if not symbol:
            continue
        side = "buy" if any(token in side_text for token in ("buy", "покуп", "long")) else "sell"
        price = _f(raw_price)
        raw_id = f"{handle}|{ts}|{symbol}|{side}|{price}"
        event_id = hashlib.sha1(raw_id.encode("utf-8")).hexdigest()
        if event_id in seen:
            continue
        seen.add(event_id)
        events.append(
            {
                "event_id": event_id,
                "handle": handle,
                "ts_ms": ts,
                "symbol": symbol,
                "side": side,
                "price": price,
                "size_known": False,
                "quantity": None,
                "raw": obj,
            }
        )

    def profile_value(*names: str) -> Any:
        return _pick(profile, tuple(names))

    return {
        "profile": {
            "handle": handle,
            "followers": profile_value("followers", "followersCount", "subscribers", "subscribersCount"),
            "posts_count": profile_value("postsCount", "publicationsCount"),
            "display_name": profile_value("nickname", "username", "login", "name"),
            "raw": profile,
        },
        "events": sorted(events, key=lambda x: int(x["ts_ms"]), reverse=True),
    }


class PulsePublicStore:
    def __init__(self, path: str = "./data/tqs-pulse.sqlite3") -> None:
        db = Path(path)
        db.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self._con = sqlite3.connect(str(db), check_same_thread=False)
        self._con.row_factory = sqlite3.Row
        with self._lock:
            self._con.executescript(
                """
                pragma journal_mode=WAL;
                create table if not exists pulse_profiles (
                    handle text primary key,
                    display_name text,
                    followers integer,
                    posts_count integer,
                    tracked_at_ms integer not null,
                    last_sync_ms integer,
                    last_error text,
                    source_url text not null,
                    raw_json text
                );
                create table if not exists pulse_events (
                    event_id text primary key,
                    handle text not null,
                    ts_ms integer not null,
                    symbol text not null,
                    side text not null,
                    price real,
                    quantity real,
                    size_known integer not null default 0,
                    source_url text not null,
                    raw_json text
                );
                create index if not exists idx_pulse_symbol_time on pulse_events(symbol, ts_ms);
                """
            )
            self._con.commit()

    def track(self, handle: str) -> dict[str, Any]:
        handle = handle.strip().lstrip("@")
        if not handle:
            raise ValueError("Pulse handle is empty")
        url = f"https://www.tbank.ru/invest/social/profile/{handle}/?author=profile"
        now = _now_ms()
        with self._lock:
            self._con.execute(
                """insert into pulse_profiles(handle,tracked_at_ms,source_url)
                   values(?,?,?) on conflict(handle) do nothing""",
                [handle, now, url],
            )
            self._con.commit()
        return {"handle": handle, "source_url": url}

    def tracked(self, limit: int = 1000) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._con.execute(
                "select * from pulse_profiles order by coalesce(last_sync_ms,0), tracked_at_ms limit ?", [int(limit)]
            ).fetchall()
        return [dict(row) for row in rows]

    def save(self, handle: str, parsed: dict[str, Any], observed_at_ms: int) -> dict[str, int]:
        profile = parsed.get("profile") or {}
        source_url = f"https://www.tbank.ru/invest/social/profile/{handle}/?author=profile"
        events = [x for x in (parsed.get("events") or []) if isinstance(x, dict)]
        with self._lock:
            self._con.execute(
                """insert into pulse_profiles(handle,display_name,followers,posts_count,tracked_at_ms,last_sync_ms,last_error,source_url,raw_json)
                   values(?,?,?,?,?,?,?,?,?)
                   on conflict(handle) do update set
                     display_name=excluded.display_name,followers=excluded.followers,posts_count=excluded.posts_count,
                     last_sync_ms=excluded.last_sync_ms,last_error=null,source_url=excluded.source_url,raw_json=excluded.raw_json""",
                [
                    handle,
                    profile.get("display_name"),
                    profile.get("followers"),
                    profile.get("posts_count"),
                    observed_at_ms,
                    observed_at_ms,
                    None,
                    source_url,
                    json.dumps(profile.get("raw") or {}, ensure_ascii=False, default=str),
                ],
            )
            added = 0
            for event in events:
                cur = self._con.execute(
                    """insert or ignore into pulse_events(
                         event_id,handle,ts_ms,symbol,side,price,quantity,size_known,source_url,raw_json
                       ) values(?,?,?,?,?,?,?,?,?,?)""",
                    [
                        event["event_id"],
                        handle,
                        int(event["ts_ms"]),
                        event["symbol"],
                        event["side"],
                        event.get("price"),
                        None,
                        0,
                        source_url,
                        json.dumps(event.get("raw") or {}, ensure_ascii=False, default=str),
                    ],
                )
                added += max(cur.rowcount, 0)
            self._con.commit()
        return {"events_seen": len(events), "events_added": added}

    def error(self, handle: str, message: str) -> None:
        with self._lock:
            self._con.execute("update pulse_profiles set last_error=? where handle=?", [message[:500], handle])
            self._con.commit()

    def profiles(self, limit: int = 200) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._con.execute(
                "select handle,display_name,followers,posts_count,last_sync_ms,last_error,source_url from pulse_profiles order by coalesce(followers,0) desc limit ?",
                [int(limit)],
            ).fetchall()
        return [dict(row) for row in rows]

    def events(self, symbol: str = "", limit: int = 500) -> list[dict[str, Any]]:
        params: list[Any] = []
        where = ""
        if symbol.strip():
            where = "where upper(symbol)=?"
            params.append(symbol.upper().strip())
        params.append(int(limit))
        with self._lock:
            rows = self._con.execute(
                f"""select e.*,p.display_name,p.followers from pulse_events e
                    left join pulse_profiles p on p.handle=e.handle
                    {where} order by e.ts_ms desc limit ?""",
                params,
            ).fetchall()
        return [dict(row) for row in rows]

    def stats(self) -> dict[str, Any]:
        with self._lock:
            profiles = int(self._con.execute("select count(*) from pulse_profiles").fetchone()[0])
            synced = int(self._con.execute("select count(*) from pulse_profiles where last_sync_ms is not null").fetchone()[0])
            events = int(self._con.execute("select count(*) from pulse_events").fetchone()[0])
            latest = self._con.execute("select max(last_sync_ms) from pulse_profiles").fetchone()[0]
        return {"profiles_tracked": profiles, "profiles_synced": synced, "events": events, "last_sync_ms": latest}


class PulsePublicService:
    """Best-effort public Pulse observer.

    Exact operation quantity is deliberately never inferred. If T-Bank keeps
    recent operations behind authenticated/client-side APIs, this collector
    still stores the public profile snapshot and reports zero trade events.
    """

    def __init__(
        self,
        control: ControlCenter,
        store: PulsePublicStore,
        http: JsonHttp,
        handles: list[str] | None = None,
        refresh_seconds: int = 300,
    ) -> None:
        self.control = control
        self.store = store
        self.http = http
        self.refresh_seconds = max(120, int(refresh_seconds))
        self._task: asyncio.Task | None = None
        self.running = False
        self.last_action = "Пульс: ожидание"
        self.last_error: str | None = None
        for handle in handles or []:
            if handle.strip():
                self.store.track(handle)

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._loop(), name="tqs-pulse-public")

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def sync(self, handle: str) -> dict[str, Any]:
        tracked = self.store.track(handle)
        url = tracked["source_url"]
        self.last_action = f"Пульс: публичный профиль @{handle}"
        try:
            text = await self.http.get_text(
                url,
                timeout_s=25,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.7",
                },
            )
            parsed = parse_pulse_html(handle, text)
            result = self.store.save(handle, parsed, _now_ms())
            self.last_error = None
            return {"ok": True, "handle": handle, **result}
        except Exception as exc:
            message = f"{type(exc).__name__}: {exc}"
            self.store.error(handle, message)
            self.last_error = message
            return {"ok": False, "handle": handle, "error": message}

    async def _loop(self) -> None:
        self.running = True
        try:
            while True:
                state = self.control.get()
                if not state.live_allowed:
                    self.last_action = "Пульс: пауза — режим СТОП"
                    await asyncio.sleep(3)
                    continue
                rows = self.store.tracked(limit=20 if state.mode == "max" else 5)
                if not rows:
                    self.last_action = "Пульс: нет отслеживаемых публичных профилей"
                for row in rows:
                    await self.sync(str(row["handle"]))
                    await asyncio.sleep(0.5)
                await asyncio.sleep(120 if state.mode == "max" else self.refresh_seconds)
        finally:
            self.running = False

    def quick_status(self) -> dict[str, Any]:
        return {
            "running": self.running,
            "last_action": self.last_action,
            "last_error": self.last_error,
            "evidence_level": "public_profile",
            "size_policy": "operation quantity is unknown unless a public source explicitly exposes it; TQS never estimates it",
            "source": "T-Bank Pulse public profile SSR / best effort",
        }

    def status(self) -> dict[str, Any]:
        return {
            **self.quick_status(),
            **self.store.stats(),
        }

[executed on device: Kendirov (dbeba00d-0e72-4d4e-b51c-17d1d4fb9e1f)]