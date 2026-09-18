from __future__ import annotations

import bisect
import json
import math
import statistics
import time
from dataclasses import dataclass
from typing import Any

from .instrument_lab import economic_key
from .models import Anomaly, MarketState, Quote

MOSCOW_OFFSET_MS = 3 * 3_600_000
DAY_MS = 86_400_000
MINUTE_MS = 60_000


def _now_ms() -> int:
    return int(time.time() * 1000)


def _f(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        x = float(value)
    except (TypeError, ValueError):
        return None
    return x if math.isfinite(x) else None


def _percentile(value: float | None, values: list[float]) -> float | None:
    if value is None or not values:
        return None
    clean = sorted(x for x in values if math.isfinite(x))
    if not clean:
        return None
    return bisect.bisect_right(clean, value) / len(clean)


def _median(values: list[float]) -> float | None:
    clean = [x for x in values if math.isfinite(x)]
    return statistics.median(clean) if clean else None


def _ratio(value: float | None, baseline: float | None) -> float | None:
    if value is None or baseline in (None, 0):
        return None
    return value / baseline


def _pct_change(current: float | None, previous: float | None) -> float | None:
    if current is None or previous in (None, 0):
        return None
    return (current / previous - 1.0) * 100.0


def _delta(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None:
        return None
    value = current - previous
    # Cumulative MOEX counters reset at the next session/day.
    return value if value >= 0 else None


def _payload_meta(payload_json: str | None) -> dict[str, Any]:
    if not payload_json:
        return {}
    try:
        payload = json.loads(payload_json)
    except Exception:
        return {}
    meta = payload.get("meta")
    return meta if isinstance(meta, dict) else {}


def _num_trades(payload_json: str | None) -> float | None:
    return _f(_payload_meta(payload_json).get("num_trades"))


def _spread_bps(payload_json: str | None) -> float | None:
    if not payload_json:
        return None
    try:
        payload = json.loads(payload_json)
    except Exception:
        return None
    bid = _f(payload.get("bid"))
    ask = _f(payload.get("ask"))
    if bid in (None, 0) or ask in (None, 0):
        return None
    mid = (bid + ask) / 2.0
    return (ask - bid) / mid * 10_000 if mid else None


def _severity(score: float) -> str:
    if score >= 90:
        return "critical"
    if score >= 80:
        return "high"
    if score >= 70:
        return "medium"
    return "low"


@dataclass
class HistoryPoint:
    ts_ms: int
    last: float | None
    volume: float | None
    turnover: float | None
    oi: float | None
    trades: float | None
    spread_bps: float | None


class MoexFeatureEngine:
    """Trader-first MOEX feature/anomaly layer.

    The generic cross-sectional engine remains useful as a broad watch list.
    This layer adds *own-history* context: same-time-of-day cumulative activity,
    short-horizon price/OI changes, liquidity shocks and observed public LCHI
    position changes. It intentionally does not treat delayed FUTOI as live.
    """

    def __init__(self, store: Any, lchi_store: Any | None = None, metric_lake: Any | None = None) -> None:
        self.store = store
        self.lchi_store = lchi_store
        self.metric_lake = metric_lake
        self.last_rows: list[dict[str, Any]] = []

    @staticmethod
    def _candidate_quotes(quotes: list[Quote], limit: int = 900) -> list[Quote]:
        rows = [q for q in quotes if q.provider == "moex" and q.last not in (None, 0)]
        futures = [q for q in rows if q.market_type == "forts"]
        others = sorted(
            [q for q in rows if q.market_type != "forts"],
            key=lambda q: (float(q.turnover_24h or 0.0), float(q.volume_24h or 0.0)),
            reverse=True,
        )
        seen: set[str] = set()
        out: list[Quote] = []
        for q in futures + others:
            if q.canonical_id in seen:
                continue
            seen.add(q.canonical_id)
            out.append(q)
            if len(out) >= limit:
                break
        return out

    def _same_time_baselines(self, canonical_ids: list[str], now_ms: int) -> dict[str, list[dict[str, Any]]]:
        if not canonical_ids:
            return {}
        # Moscow has no DST. Shift epoch by +3h so integer day/minute arithmetic
        # matches the exchange's local clock without DuckDB timezone extensions.
        moscow_ms = now_ms + MOSCOW_OFFSET_MS
        minute_now = int((moscow_ms % DAY_MS) // MINUTE_MS)
        today_id = int(moscow_ms // DAY_MS)
        cutoff = now_ms - 60 * DAY_MS
        placeholders = ",".join("?" for _ in canonical_ids)
        sql = f"""
            with base as (
              select canonical_id, observed_at_ms, turnover_24h, volume_24h, payload_json,
                     cast(floor((observed_at_ms + {MOSCOW_OFFSET_MS}) / {DAY_MS}) as bigint) as day_id,
                     cast(floor(((observed_at_ms + {MOSCOW_OFFSET_MS}) % {DAY_MS}) / {MINUTE_MS}) as bigint) as minute_id
              from quote_snapshots
              where provider='moex'
                and observed_at_ms>=?
                and cast(floor((observed_at_ms + {MOSCOW_OFFSET_MS}) / {DAY_MS}) as bigint) < ?
                and canonical_id in ({placeholders})
            ), ranked as (
              select *,
                     row_number() over(
                       partition by canonical_id, day_id
                       order by abs(minute_id - ?), observed_at_ms desc
                     ) as rn
              from base
              where abs(minute_id - ?) <= 35
            )
            select canonical_id, observed_at_ms, turnover_24h, volume_24h, payload_json
            from ranked where rn=1
        """
        params: list[Any] = [cutoff, today_id, *canonical_ids, minute_now, minute_now]
        try:
            with self.store._lock:
                rows = self.store._con.execute(sql, params).fetchall()
        except Exception:
            return {}
        out: dict[str, list[dict[str, Any]]] = {}
        for cid, ts, turnover, volume, payload in rows:
            out.setdefault(str(cid), []).append(
                {
                    "ts_ms": int(ts),
                    "turnover": _f(turnover),
                    "volume": _f(volume),
                    "trades": _num_trades(payload),
                }
            )
        return out

    def _recent_history(self, canonical_ids: list[str], now_ms: int) -> dict[str, list[HistoryPoint]]:
        if not canonical_ids:
            return {}
        cutoff = now_ms - 4 * 3_600_000
        placeholders = ",".join("?" for _ in canonical_ids)
        sql = f"""
            select canonical_id, observed_at_ms, last, volume_24h, turnover_24h,
                   open_interest, payload_json
            from quote_snapshots
            where provider='moex' and observed_at_ms>=? and canonical_id in ({placeholders})
            order by canonical_id, observed_at_ms
        """
        try:
            with self.store._lock:
                rows = self.store._con.execute(sql, [cutoff, *canonical_ids]).fetchall()
        except Exception:
            return {}
        out: dict[str, list[HistoryPoint]] = {}
        for cid, ts, last, volume, turnover, oi, payload in rows:
            out.setdefault(str(cid), []).append(
                HistoryPoint(
                    ts_ms=int(ts),
                    last=_f(last),
                    volume=_f(volume),
                    turnover=_f(turnover),
                    oi=_f(oi),
                    trades=_num_trades(payload),
                    spread_bps=_spread_bps(payload),
                )
            )
        return out

    @staticmethod
    def _before(rows: list[HistoryPoint], target_ms: int, tolerance_ms: int = 4 * MINUTE_MS) -> HistoryPoint | None:
        if not rows:
            return None
        times = [x.ts_ms for x in rows]
        idx = bisect.bisect_right(times, target_ms) - 1
        if idx < 0:
            return None
        row = rows[idx]
        return row if target_ms - row.ts_ms <= tolerance_ms else None

    @staticmethod
    def _rolling_abs_returns(rows: list[HistoryPoint], horizon_ms: int) -> list[float]:
        if len(rows) < 4:
            return []
        times = [x.ts_ms for x in rows]
        values: list[float] = []
        for i, row in enumerate(rows):
            if row.last in (None, 0):
                continue
            target = row.ts_ms - horizon_ms
            j = bisect.bisect_right(times, target, hi=i) - 1
            if j < 0 or target - rows[j].ts_ms > 4 * MINUTE_MS:
                continue
            ret = _pct_change(row.last, rows[j].last)
            if ret is not None:
                values.append(abs(ret))
        return values

    @staticmethod
    def _rolling_abs_oi(rows: list[HistoryPoint], horizon_ms: int) -> list[float]:
        if len(rows) < 4:
            return []
        times = [x.ts_ms for x in rows]
        values: list[float] = []
        for i, row in enumerate(rows):
            if row.oi in (None, 0):
                continue
            target = row.ts_ms - horizon_ms
            j = bisect.bisect_right(times, target, hi=i) - 1
            if j < 0 or target - rows[j].ts_ms > 4 * MINUTE_MS:
                continue
            change = _pct_change(row.oi, rows[j].oi)
            if change is not None:
                values.append(abs(change))
        return values

    def _lchi_flow(self, symbol: str, now_ms: int) -> dict[str, Any]:
        if self.lchi_store is None or not hasattr(self.lchi_store, "symbol_flow"):
            return {}
        try:
            return dict(self.lchi_store.symbol_flow(symbol, since_ms=now_ms - 60 * MINUTE_MS) or {})
        except Exception:
            return {}

    def _futoi_context(self, quote: Quote) -> dict[str, Any]:
        if self.metric_lake is None or quote.market_type != "forts":
            return {}
        root = economic_key(quote.symbol, "moex", "forts")
        if not root:
            return {}
        cid = f"moex:futoi:{root}"
        try:
            fiz = self.metric_lake.latest(cid, "futoi_fiz_net_contracts", limit=2)
            yur = self.metric_lake.latest(cid, "futoi_yur_net_contracts", limit=2)
        except Exception:
            return {}
        out: dict[str, Any] = {"root": root}
        for label, rows in (("fiz", fiz), ("yur", yur)):
            if not rows:
                continue
            latest = rows[-1]
            out[f"{label}_net"] = latest.get("value")
            out[f"{label}_ts_ms"] = latest.get("ts_ms")
            meta = latest.get("meta") or {}
            out["delayed"] = bool(meta.get("delayed", True))
            if len(rows) >= 2:
                out[f"{label}_delta"] = _f(rows[-1].get("value")) - _f(rows[-2].get("value")) if _f(rows[-1].get("value")) is not None and _f(rows[-2].get("value")) is not None else None
        return out

    def analyze(self, quotes: list[Quote]) -> list[Anomaly]:
        now_ms = max((int(q.observed_at_ms) for q in quotes if q.provider == "moex"), default=_now_ms())
        candidates = self._candidate_quotes(quotes)
        ids = [q.canonical_id for q in candidates]
        baselines = self._same_time_baselines(ids, now_ms)
        recent = self._recent_history(ids, now_ms)
        anomalies: list[Anomaly] = []
        rows_out: list[dict[str, Any]] = []

        for q in candidates:
            history = recent.get(q.canonical_id, [])
            base = baselines.get(q.canonical_id, [])
            prev5 = self._before(history, now_ms - 5 * MINUTE_MS)
            prev15 = self._before(history, now_ms - 15 * MINUTE_MS)
            prev60 = self._before(history, now_ms - 60 * MINUTE_MS, tolerance_ms=8 * MINUTE_MS)

            ret5 = _pct_change(q.last, prev5.last if prev5 else None)
            ret15 = _pct_change(q.last, prev15.last if prev15 else None)
            ret60 = _pct_change(q.last, prev60.last if prev60 else None)
            oi15 = _pct_change(q.open_interest, prev15.oi if prev15 else None)
            oi60 = _pct_change(q.open_interest, prev60.oi if prev60 else None)

            turnover_median = _median([x["turnover"] for x in base if x.get("turnover") is not None])
            volume_median = _median([x["volume"] for x in base if x.get("volume") is not None])
            trades_now = _f(q.meta.get("num_trades"))
            trades_median = _median([x["trades"] for x in base if x.get("trades") is not None])
            turnover_ratio = _ratio(q.turnover_24h, turnover_median)
            volume_ratio = _ratio(q.volume_24h, volume_median)
            trades_ratio = _ratio(trades_now, trades_median)

            ret_dist = self._rolling_abs_returns(history, 15 * MINUTE_MS)
            oi_dist = self._rolling_abs_oi(history, 15 * MINUTE_MS)
            ret_pct = _percentile(abs(ret15) if ret15 is not None else None, ret_dist)
            oi_pct = _percentile(abs(oi15) if oi15 is not None else None, oi_dist)

            spread_history = [x.spread_bps for x in history if x.spread_bps is not None and x.spread_bps >= 0]
            spread_median = _median(spread_history)
            spread_ratio = _ratio(q.spread_bps, spread_median)

            lchi = self._lchi_flow(q.symbol, now_ms)
            futoi = self._futoi_context(q)

            score = 0.0
            reasons: list[str] = []
            signals: list[str] = []

            if turnover_ratio is not None and turnover_ratio >= 1.8:
                points = min(34.0, 12.0 + 8.0 * math.log2(max(1.0, turnover_ratio)))
                score += points
                reasons.append(f"оборот к этому времени {turnover_ratio:.1f}x своей 60-дневной нормы")
                signals.append("moex_turnover_tod")

            if volume_ratio is not None and volume_ratio >= 1.8:
                score += min(14.0, 5.0 + 4.0 * math.log2(max(1.0, volume_ratio)))
                reasons.append(f"объём к этому времени {volume_ratio:.1f}x нормы")
                signals.append("moex_volume_tod")

            if trades_ratio is not None and trades_ratio >= 1.8:
                score += min(16.0, 6.0 + 5.0 * math.log2(max(1.0, trades_ratio)))
                reasons.append(f"число сделок {trades_ratio:.1f}x нормы к этому времени")
                signals.append("moex_trade_intensity")

            if ret15 is not None and ret_pct is not None and ret_pct >= 0.94:
                score += 14.0 + 16.0 * max(0.0, (ret_pct - 0.94) / 0.06)
                reasons.append(f"движение за 15 мин {ret15:+.2f}% — {ret_pct*100:.0f}-й перцентиль последних часов")
                signals.append("moex_price_impulse")

            if oi15 is not None and oi_pct is not None and oi_pct >= 0.90 and abs(oi15) >= 0.5:
                score += 12.0 + 16.0 * max(0.0, (oi_pct - 0.90) / 0.10)
                reasons.append(f"OI за 15 мин {oi15:+.2f}% — необычное изменение относительно недавней истории")
                signals.append("moex_oi_acceleration")

            if spread_ratio is not None and spread_ratio >= 2.0:
                score += min(15.0, 6.0 + 5.0 * math.log2(spread_ratio))
                reasons.append(f"спред {q.spread_bps:.1f} б.п. — {spread_ratio:.1f}x недавней медианы")
                signals.append("moex_spread_shock")

            # High activity with little displacement is often more interesting
            # to a discretionary trader than another top-gainer.
            if turnover_ratio is not None and turnover_ratio >= 2.5 and ret15 is not None and abs(ret15) <= 0.18:
                score += 24.0
                reasons.append(f"поглощение/сжатие: оборот {turnover_ratio:.1f}x нормы, цена за 15 мин лишь {ret15:+.2f}%")
                signals.append("moex_absorption")

            if ret_pct is not None and ret_pct >= 0.98:
                score += 8.0
                signals.append("moex_expansion")

            if oi15 is not None and ret15 is not None:
                if abs(oi15) >= 1.0 and abs(ret15) <= 0.12:
                    score += 12.0
                    reasons.append(f"OI меняется {oi15:+.2f}% при почти стоящей цене {ret15:+.2f}%")
                    signals.append("moex_price_oi_divergence")
                elif abs(ret15) >= 0.5 and abs(oi15) <= 0.15:
                    score += 7.0
                    reasons.append(f"цена {ret15:+.2f}% за 15 мин без заметного подтверждения OI ({oi15:+.2f}%)")
                    signals.append("moex_price_without_oi")

            lchi_accounts = int(lchi.get("changed_accounts") or 0)
            if lchi_accounts >= 3:
                long_accounts = int(lchi.get("long_increase_accounts") or 0)
                short_accounts = int(lchi.get("short_increase_accounts") or 0)
                score += min(10.0, 3.0 + lchi_accounts / 3.0)
                reasons.append(
                    f"ЛЧИ: {lchi_accounts} публичных счетов изменили позицию за час "
                    f"(LONG+ {long_accounts}, SHORT+ {short_accounts}); время — наблюдение TQS"
                )
                signals.append("lchi_position_cluster")

            # Delayed public FUTOI is valuable evidence but must not masquerade
            # as live flow. Authorized realtime points can score later.
            if futoi:
                delayed = bool(futoi.get("delayed", True))
                if delayed and futoi.get("fiz_net") is not None and futoi.get("yur_net") is not None:
                    reasons.append(
                        f"FUTOI context (задержка): физлица net {float(futoi['fiz_net']):+.0f}, "
                        f"юрлица net {float(futoi['yur_net']):+.0f}"
                    )
                elif not delayed:
                    fd = _f(futoi.get("fiz_delta"))
                    yd = _f(futoi.get("yur_delta"))
                    if fd is not None or yd is not None:
                        score += 8.0
                        reasons.append(f"FUTOI realtime: Δ физлица {fd or 0:+.0f}, Δ юрлица {yd or 0:+.0f}")
                        signals.append("moex_futoi_realtime_shift")

            score = min(100.0, score)
            feature_row = {
                "canonical_id": q.canonical_id,
                "symbol": q.symbol,
                "name": q.display_symbol or q.symbol,
                "market_type": q.market_type,
                "price": q.last,
                "turnover": q.turnover_24h,
                "open_interest": q.open_interest,
                "ret_5m_pct": ret5,
                "ret_15m_pct": ret15,
                "ret_60m_pct": ret60,
                "oi_15m_pct": oi15,
                "oi_60m_pct": oi60,
                "turnover_tod_ratio": turnover_ratio,
                "volume_tod_ratio": volume_ratio,
                "trades_tod_ratio": trades_ratio,
                "ret_15m_percentile": ret_pct,
                "oi_15m_percentile": oi_pct,
                "spread_ratio": spread_ratio,
                "lchi": lchi,
                "futoi": futoi,
                "attention_score": round(score, 2),
                "reasons": reasons,
                "signals": signals,
                "baseline_days": len(base),
            }
            rows_out.append(feature_row)

            if score < 52 or not signals:
                continue

            direction = "flat"
            if ret15 is not None:
                direction = "up" if ret15 > 0.12 else "down" if ret15 < -0.12 else "flat"
            elif q.change_24h_pct is not None:
                direction = "up" if q.change_24h_pct > 0.35 else "down" if q.change_24h_pct < -0.35 else "flat"
            regime = "expansion" if "moex_expansion" in signals else "compression" if "moex_absorption" in signals else "normal"
            liquidity = "thin" if q.spread_bps is not None and q.spread_bps > 35 else "normal"
            state = MarketState(
                canonical_id=q.canonical_id,
                regime=regime,
                direction=direction,
                activity="extreme" if score >= 90 else "high" if score >= 75 else "elevated",
                liquidity=liquidity,
                score=round(score, 2),
                reasons=reasons,
            )
            anomalies.append(
                Anomaly(
                    canonical_id=q.canonical_id,
                    provider=q.provider,
                    symbol=q.symbol,
                    asset_class=q.asset_class,
                    market_type=q.market_type,
                    score=round(score, 2),
                    severity=_severity(score),
                    reasons=reasons,
                    signals=signals,
                    state=state,
                    quote=q,
                )
            )

        self.last_rows = sorted(rows_out, key=lambda x: float(x.get("attention_score") or 0), reverse=True)
        return sorted(anomalies, key=lambda x: x.score, reverse=True)

    def snapshot(self, limit: int = 200) -> dict[str, Any]:
        rows = self.last_rows[: max(1, int(limit))]
        by_signal: dict[str, int] = {}
        for row in rows:
            for signal in row.get("signals") or []:
                by_signal[signal] = by_signal.get(signal, 0) + 1
        return {
            "generated_at_ms": _now_ms(),
            "rows": rows,
            "signals": by_signal,
            "count": len(rows),
            "definition": "MOEX own-history attention layer: same-time-of-day activity + short-horizon price/OI/liquidity + public participant context",
        }


def merge_anomalies(primary: list[Anomaly], extra: list[Anomaly]) -> list[Anomaly]:
    """Merge generic and MOEX-specific evidence without double-counting symbols."""
    by_id: dict[str, Anomaly] = {x.canonical_id: x for x in primary}
    for item in extra:
        current = by_id.get(item.canonical_id)
        if current is None:
            by_id[item.canonical_id] = item
            continue
        if item.score >= current.score:
            chosen, other = item, current
        else:
            chosen, other = current, item
        chosen.reasons = list(dict.fromkeys([*chosen.reasons, *other.reasons]))[:8]
        chosen.signals = list(dict.fromkeys([*chosen.signals, *other.signals]))[:12]
        chosen.state.reasons = chosen.reasons
        by_id[item.canonical_id] = chosen
    return sorted(by_id.values(), key=lambda x: x.score, reverse=True)
