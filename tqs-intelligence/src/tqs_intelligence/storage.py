from __future__ import annotations

import json
import threading
from pathlib import Path
from uuid import uuid4

import duckdb

from .models import Anomaly, Hypothesis, HypothesisCreate, NewsItem, Quote, RuntimeLog


class DuckStore:
    def __init__(self, path: str) -> None:
        db = Path(path)
        db.parent.mkdir(parents=True, exist_ok=True)
        self._con = duckdb.connect(str(db))
        self._lock = threading.Lock()
        self._con.execute("""
            create table if not exists quote_snapshots (
                observed_at_ms bigint, canonical_id varchar, provider varchar, asset_class varchar,
                market_type varchar, symbol varchar, last double, change_24h_pct double,
                volume_24h double, turnover_24h double, open_interest double, funding_rate double,
                payload_json varchar
            );
            create table if not exists anomaly_snapshots (
                observed_at_ms bigint, canonical_id varchar, score double, severity varchar, payload_json varchar
            );
            create table if not exists news_items (
                url varchar primary key, published_at_ms bigint, source varchar, title varchar, payload_json varchar
            );
            create table if not exists hypotheses (
                id varchar primary key, created_at_ms bigint, title varchar, idea varchar, universe varchar,
                horizon varchar, status varchar, payload_json varchar
            );
            create table if not exists runtime_logs (
                ts_ms bigint, level varchar, component varchar, message varchar, details_json varchar
            );
        """)

    def persist_snapshot(self, quotes: list[Quote], anomalies: list[Anomaly], news: list[NewsItem]) -> None:
        with self._lock:
            if quotes:
                self._con.executemany(
                    "insert into quote_snapshots values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [(q.observed_at_ms, q.canonical_id, q.provider, q.asset_class.value, q.market_type, q.symbol,
                      q.last, q.change_24h_pct, q.volume_24h, q.turnover_24h, q.open_interest, q.funding_rate,
                      q.model_dump_json()) for q in quotes],
                )
            if anomalies:
                self._con.executemany(
                    "insert into anomaly_snapshots values (?, ?, ?, ?, ?)",
                    [(a.quote.observed_at_ms, a.canonical_id, a.score, a.severity, a.model_dump_json()) for a in anomalies],
                )
            for item in news:
                self._con.execute(
                    "insert or ignore into news_items values (?, ?, ?, ?, ?)",
                    [item.url, item.published_at_ms, item.source, item.title, item.model_dump_json()],
                )

    def append_log(self, item: RuntimeLog) -> None:
        with self._lock:
            self._con.execute(
                "insert into runtime_logs values (?, ?, ?, ?, ?)",
                [item.ts_ms, item.level, item.component, item.message, json.dumps(item.details, ensure_ascii=False, default=str)],
            )

    def list_logs(self, limit: int = 200, level: str = "", component: str = "") -> list[RuntimeLog]:
        where: list[str] = []
        params: list[object] = []
        if level:
            where.append("level = ?")
            params.append(level)
        if component:
            where.append("component = ?")
            params.append(component)
        sql = "select ts_ms, level, component, message, details_json from runtime_logs"
        if where:
            sql += " where " + " and ".join(where)
        sql += " order by ts_ms desc limit ?"
        params.append(limit)
        with self._lock:
            rows = self._con.execute(sql, params).fetchall()
        return [RuntimeLog(ts_ms=r[0], level=r[1], component=r[2], message=r[3], details=json.loads(r[4] or "{}")) for r in rows]

    def create_hypothesis(self, request: HypothesisCreate, now_ms: int) -> Hypothesis:
        item = Hypothesis(id=f"H-{uuid4().hex[:10].upper()}", created_at_ms=now_ms, **request.model_dump())
        with self._lock:
            self._con.execute("insert into hypotheses values (?, ?, ?, ?, ?, ?, ?, ?)", [
                item.id, item.created_at_ms, item.title, item.idea, item.universe, item.horizon,
                item.status, item.model_dump_json(),
            ])
        return item

    def list_hypotheses(self, limit: int = 100) -> list[Hypothesis]:
        with self._lock:
            rows = self._con.execute(
                "select payload_json from hypotheses order by created_at_ms desc limit ?", [limit]
            ).fetchall()
        return [Hypothesis.model_validate_json(row[0]) for row in rows]

    def price_series(self, bucket_ms: int = 60_000, limit_buckets: int = 1440) -> dict[str, list[tuple[int, float]]]:
        with self._lock:
            rows = self._con.execute(
                """
                with bucketed as (
                    select canonical_id, cast(floor(observed_at_ms / ?) as bigint) as bucket, avg(last) as price
                    from quote_snapshots
                    where last is not null and last > 0
                    group by canonical_id, bucket
                ), recent as (select max(bucket) as mx from bucketed)
                select canonical_id, bucket, price from bucketed, recent
                where bucket >= mx - ? order by canonical_id, bucket
                """, [bucket_ms, limit_buckets]
            ).fetchall()
        result: dict[str, list[tuple[int, float]]] = {}
        for canonical_id, bucket, price in rows:
            result.setdefault(canonical_id, []).append((int(bucket), float(price)))
        return result

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {
                "quote_snapshots": self._con.execute("select count(*) from quote_snapshots").fetchone()[0],
                "anomaly_snapshots": self._con.execute("select count(*) from anomaly_snapshots").fetchone()[0],
                "news_items": self._con.execute("select count(*) from news_items").fetchone()[0],
                "hypotheses": self._con.execute("select count(*) from hypotheses").fetchone()[0],
                "runtime_logs": self._con.execute("select count(*) from runtime_logs").fetchone()[0],
            }
