from __future__ import annotations

import json
import threading
from pathlib import Path
from uuid import uuid4

import duckdb

from .models import (
    Anomaly,
    AnomalyEpisode,
    Candle,
    EpisodeOutcome,
    Hypothesis,
    HypothesisCreate,
    NewsItem,
    Quote,
    ResearchFinding,
    RuntimeLog,
)


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
            create table if not exists candles (
                canonical_id varchar, provider varchar, interval varchar, ts_ms bigint,
                open double, high double, low double, close double,
                volume double, turnover double, source varchar
            );
            create table if not exists anomaly_episodes (
                id varchar primary key, canonical_id varchar, provider varchar, symbol varchar,
                asset_class varchar, market_type varchar, opened_at_ms bigint, last_seen_ms bigint,
                closed_at_ms bigint, status varchar, first_score double, peak_score double,
                last_score double, trigger_price double, last_price double, direction varchar,
                pattern_key varchar, signals_json varchar, reasons_json varchar, hits integer
            );
            create table if not exists research_findings (
                pattern_key varchar primary key, updated_at_ms bigint, sample_count integer,
                status varchar, payload_json varchar
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

    @staticmethod
    def _pattern_key(anomaly: Anomaly) -> str:
        signals = "+".join(sorted(set(anomaly.signals or ["composite"])))
        return f"{anomaly.asset_class.value}:{anomaly.market_type}:{anomaly.state.direction}:{signals}"

    @staticmethod
    def _episode_from_row(row: tuple[object, ...]) -> AnomalyEpisode:
        return AnomalyEpisode(
            id=str(row[0]), canonical_id=str(row[1]), provider=str(row[2]), symbol=str(row[3]),
            asset_class=str(row[4]), market_type=str(row[5]), opened_at_ms=int(row[6]), last_seen_ms=int(row[7]),
            closed_at_ms=int(row[8]) if row[8] is not None else None, status=str(row[9]), first_score=float(row[10]),
            peak_score=float(row[11]), last_score=float(row[12]), trigger_price=float(row[13]) if row[13] is not None else None,
            last_price=float(row[14]) if row[14] is not None else None, direction=str(row[15]), pattern_key=str(row[16]),
            signals=json.loads(str(row[17]) or "[]"), reasons=json.loads(str(row[18]) or "[]"), hits=int(row[19]),
        )

    def update_episodes(self, anomalies: list[Anomaly], now_ms: int, threshold: float = 70.0,
                        close_after_ms: int = 180_000) -> list[AnomalyEpisode]:
        qualifying = [a for a in anomalies if a.score >= threshold]
        created: list[AnomalyEpisode] = []
        with self._lock:
            rows = self._con.execute("select * from anomaly_episodes where status = 'active'").fetchall()
            active = {str(row[1]): self._episode_from_row(row) for row in rows}
            seen: set[str] = set()
            for anomaly in qualifying:
                seen.add(anomaly.canonical_id)
                current = active.get(anomaly.canonical_id)
                pattern_key = self._pattern_key(anomaly)
                signals_json = json.dumps(anomaly.signals, ensure_ascii=False)
                reasons_json = json.dumps(anomaly.reasons, ensure_ascii=False)
                price = anomaly.quote.last
                if current is None:
                    item = AnomalyEpisode(
                        id=f"A-{uuid4().hex[:12].upper()}", canonical_id=anomaly.canonical_id,
                        provider=anomaly.provider, symbol=anomaly.symbol, asset_class=anomaly.asset_class,
                        market_type=anomaly.market_type, opened_at_ms=now_ms, last_seen_ms=now_ms,
                        first_score=anomaly.score, peak_score=anomaly.score, last_score=anomaly.score,
                        trigger_price=price, last_price=price, direction=anomaly.state.direction,
                        pattern_key=pattern_key, signals=anomaly.signals, reasons=anomaly.reasons, hits=1,
                    )
                    self._con.execute(
                        "insert into anomaly_episodes values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        [item.id, item.canonical_id, item.provider, item.symbol, item.asset_class.value, item.market_type,
                         item.opened_at_ms, item.last_seen_ms, None, item.status, item.first_score, item.peak_score,
                         item.last_score, item.trigger_price, item.last_price, item.direction, item.pattern_key,
                         signals_json, reasons_json, item.hits],
                    )
                    created.append(item)
                    active[item.canonical_id] = item
                else:
                    peak = max(current.peak_score, anomaly.score)
                    self._con.execute(
                        """update anomaly_episodes set last_seen_ms=?, peak_score=?, last_score=?, last_price=?,
                           direction=?, pattern_key=?, signals_json=?, reasons_json=?, hits=hits+1 where id=?""",
                        [now_ms, peak, anomaly.score, price, anomaly.state.direction, pattern_key,
                         signals_json, reasons_json, current.id],
                    )
            stale_before = now_ms - close_after_ms
            for canonical_id, current in active.items():
                if canonical_id not in seen and current.last_seen_ms <= stale_before:
                    self._con.execute(
                        "update anomaly_episodes set status='closed', closed_at_ms=? where id=?",
                        [current.last_seen_ms, current.id],
                    )
        return created

    def list_episodes(self, limit: int = 200, status: str = "", provider: str = "", q: str = "") -> list[AnomalyEpisode]:
        where: list[str] = []
        params: list[object] = []
        if status:
            where.append("status = ?")
            params.append(status)
        if provider:
            where.append("provider = ?")
            params.append(provider)
        if q:
            where.append("(lower(symbol) like ? or lower(canonical_id) like ?)")
            needle = f"%{q.lower()}%"
            params.extend([needle, needle])
        sql = "select * from anomaly_episodes"
        if where:
            sql += " where " + " and ".join(where)
        sql += " order by case when status='active' then 0 else 1 end, peak_score desc, opened_at_ms desc limit ?"
        params.append(limit)
        with self._lock:
            rows = self._con.execute(sql, params).fetchall()
        return [self._episode_from_row(row) for row in rows]

    def get_episode(self, episode_id: str) -> AnomalyEpisode | None:
        with self._lock:
            row = self._con.execute("select * from anomaly_episodes where id = ?", [episode_id]).fetchone()
        return self._episode_from_row(row) if row else None

    def persist_candles(self, candles: list[Candle]) -> None:
        if not candles:
            return
        groups: dict[tuple[str, str], list[Candle]] = {}
        for candle in candles:
            groups.setdefault((candle.canonical_id, candle.interval), []).append(candle)
        with self._lock:
            for (canonical_id, interval), rows in groups.items():
                lo = min(x.ts_ms for x in rows)
                hi = max(x.ts_ms for x in rows)
                self._con.execute(
                    "delete from candles where canonical_id=? and interval=? and ts_ms between ? and ?",
                    [canonical_id, interval, lo, hi],
                )
                self._con.executemany(
                    "insert into candles values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [(x.canonical_id, x.provider, x.interval, x.ts_ms, x.open, x.high, x.low, x.close,
                      x.volume, x.turnover, x.source) for x in rows],
                )

    def episode_series(self, episode_id: str, before_ms: int = 24 * 3600_000,
                       after_ms: int = 24 * 3600_000, max_points: int = 1800) -> dict[str, list[dict[str, float | int | str]]]:
        episode = self.get_episode(episode_id)
        if episode is None:
            return {"price": [], "score": []}
        end_anchor = episode.closed_at_ms or episode.last_seen_ms
        start = episode.opened_at_ms - before_ms
        end = end_anchor + after_ms
        with self._lock:
            candle_rows = self._con.execute(
                """select ts_ms, open, high, low, close, source from candles
                   where canonical_id=? and ts_ms between ? and ? order by ts_ms""",
                [episode.canonical_id, start, end],
            ).fetchall()
            snap_rows = self._con.execute(
                """select observed_at_ms, last from quote_snapshots
                   where canonical_id=? and observed_at_ms between ? and ? and last is not null
                   order by observed_at_ms""",
                [episode.canonical_id, start, end],
            ).fetchall()
            score_rows = self._con.execute(
                """select observed_at_ms, score from anomaly_snapshots
                   where canonical_id=? and observed_at_ms between ? and ? order by observed_at_ms""",
                [episode.canonical_id, start, end],
            ).fetchall()
        points: dict[int, dict[str, float | int | str]] = {}
        for ts, o, h, l, c, source in candle_rows:
            points[int(ts)] = {"ts_ms": int(ts), "price": float(c), "open": float(o), "high": float(h), "low": float(l), "close": float(c), "source": str(source)}
        for ts, price in snap_rows:
            points[int(ts)] = {"ts_ms": int(ts), "price": float(price), "source": "snapshot"}
        price = [points[k] for k in sorted(points)]
        if len(price) > max_points:
            step = max(1, len(price) // max_points)
            price = price[::step]
        score = [{"ts_ms": int(ts), "score": float(value)} for ts, value in score_rows]
        if len(score) > max_points:
            step = max(1, len(score) // max_points)
            score = score[::step]
        return {"price": price, "score": score}

    def _future_price(self, canonical_id: str, target_ms: int, max_delay_ms: int) -> tuple[int | None, float | None]:
        row = self._con.execute(
            """select observed_at_ms, last from quote_snapshots
               where canonical_id=? and observed_at_ms >= ? and observed_at_ms <= ? and last is not null and last > 0
               order by observed_at_ms limit 1""",
            [canonical_id, target_ms, target_ms + max_delay_ms],
        ).fetchone()
        return (int(row[0]), float(row[1])) if row else (None, None)

    def episode_outcome(self, episode_id: str) -> EpisodeOutcome:
        episode = self.get_episode(episode_id)
        if episode is None:
            raise KeyError(episode_id)
        trigger = episode.trigger_price
        horizons = {"5m": 5 * 60_000, "15m": 15 * 60_000, "1h": 3600_000, "4h": 4 * 3600_000, "24h": 24 * 3600_000}
        returns: dict[str, float | None] = {}
        actual: dict[str, int | None] = {}
        with self._lock:
            for label, delta in horizons.items():
                delay = max(10 * 60_000, min(12 * 3600_000, delta // 3))
                ts, price = self._future_price(episode.canonical_id, episode.opened_at_ms + delta, delay)
                actual[label] = ts
                returns[label] = ((price / trigger - 1) * 100) if trigger and price else None
            end = episode.closed_at_ms or episode.last_seen_ms
            extrema = self._con.execute(
                """select min(last), max(last) from quote_snapshots
                   where canonical_id=? and observed_at_ms between ? and ? and last is not null and last > 0""",
                [episode.canonical_id, episode.opened_at_ms, end],
            ).fetchone()
        low, high = extrema if extrema else (None, None)
        mfe = ((high / trigger - 1) * 100) if trigger and high else None
        mae = ((low / trigger - 1) * 100) if trigger and low else None
        complete = returns.get("4h") is not None
        return EpisodeOutcome(episode_id=episode.id, trigger_price=trigger, returns_pct=returns,
                              actual_ts_ms=actual, mfe_pct=mfe, mae_pct=mae, complete=complete)

    def similar_episodes(self, episode: AnomalyEpisode, limit: int = 20) -> list[AnomalyEpisode]:
        with self._lock:
            rows = self._con.execute(
                """select * from anomaly_episodes where id <> ? and status='closed'
                   and (canonical_id=? or pattern_key=?)
                   order by case when canonical_id=? then 0 else 1 end, opened_at_ms desc limit ?""",
                [episode.id, episode.canonical_id, episode.pattern_key, episode.canonical_id, limit],
            ).fetchall()
        return [self._episode_from_row(row) for row in rows]

    def persist_findings(self, items: list[ResearchFinding]) -> None:
        with self._lock:
            for item in items:
                self._con.execute("delete from research_findings where pattern_key=?", [item.pattern_key])
                self._con.execute(
                    "insert into research_findings values (?, ?, ?, ?, ?)",
                    [item.pattern_key, item.updated_at_ms, item.sample_count, item.status, item.model_dump_json()],
                )

    def list_findings(self, limit: int = 100) -> list[ResearchFinding]:
        with self._lock:
            rows = self._con.execute(
                "select payload_json from research_findings order by case when status='candidate' then 0 else 1 end, sample_count desc limit ?",
                [limit],
            ).fetchall()
        return [ResearchFinding.model_validate_json(row[0]) for row in rows]

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
            rows = self._con.execute("select payload_json from hypotheses order by created_at_ms desc limit ?", [limit]).fetchall()
        return [Hypothesis.model_validate_json(row[0]) for row in rows]

    def price_series(self, bucket_ms: int = 60_000, limit_buckets: int = 1440) -> dict[str, list[tuple[int, float]]]:
        with self._lock:
            rows = self._con.execute(
                """
                with bucketed as (
                    select canonical_id, cast(floor(observed_at_ms / ?) as bigint) as bucket, avg(last) as price
                    from quote_snapshots where last is not null and last > 0 group by canonical_id, bucket
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
                "anomaly_episodes": self._con.execute("select count(*) from anomaly_episodes").fetchone()[0],
                "active_episodes": self._con.execute("select count(*) from anomaly_episodes where status='active'").fetchone()[0],
                "candles": self._con.execute("select count(*) from candles").fetchone()[0],
                "research_findings": self._con.execute("select count(*) from research_findings").fetchone()[0],
                "news_items": self._con.execute("select count(*) from news_items").fetchone()[0],
                "hypotheses": self._con.execute("select count(*) from hypotheses").fetchone()[0],
                "runtime_logs": self._con.execute("select count(*) from runtime_logs").fetchone()[0],
            }
