from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
import math
from typing import Any, Iterable

WEEKDAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")


def _num(value: Any) -> float | None:
    try:
        out = float(value)
    except (TypeError, ValueError):
        return None
    return out if math.isfinite(out) else None


def _first_num(row: dict[str, Any], names: Iterable[str]) -> float | None:
    for name in names:
        value = _num(row.get(name))
        if value is not None:
            return value
    return None


def _first_int(row: dict[str, Any], names: Iterable[str]) -> int | None:
    for name in names:
        try:
            value = row.get(name)
            if value is not None:
                return int(value)
        except (TypeError, ValueError):
            pass
    return None


def _stats(values: list[float]) -> dict[str, Any]:
    clean = sorted(x for x in values if math.isfinite(x))
    if not clean:
        return {"n": 0, "mean": None, "median": None, "win_rate": None, "sum": 0.0}
    n = len(clean)
    mid = n // 2
    median = clean[mid] if n % 2 else (clean[mid - 1] + clean[mid]) / 2.0
    return {
        "n": n,
        "mean": sum(clean) / n,
        "median": median,
        "win_rate": sum(1 for x in clean if x > 0) / n,
        "sum": sum(clean),
        "min": clean[0],
        "max": clean[-1],
    }


def _reason_list(row: dict[str, Any]) -> list[str]:
    raw = row.get("reasons") or row.get("signals") or []
    if isinstance(raw, str):
        return [raw]
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        if isinstance(item, str):
            out.append(item)
        elif isinstance(item, dict):
            label = item.get("reason") or item.get("name") or item.get("signal") or item.get("type")
            if label:
                out.append(str(label))
    return out


def _flatten_numeric(prefix: str, value: Any, out: dict[str, float]) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            _flatten_numeric(f"{prefix}.{key}" if prefix else str(key), child, out)
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        number = _num(value)
        if number is not None:
            out[prefix] = number


def build_anomaly_diagnostics(
    episode_rows: list[dict[str, Any]] | None,
    scores: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    episode_rows = episode_rows or []
    scores = scores or []
    reason_counts: Counter[str] = Counter()
    severity_counts: Counter[str] = Counter()
    outcome_values: dict[str, list[float]] = defaultdict(list)
    markers: list[dict[str, Any]] = []

    for row in scores:
        severity = str(row.get("severity") or "unknown")
        severity_counts[severity] += 1
        for reason in _reason_list(row):
            reason_counts[reason] += 1
        if len(markers) < 250:
            markers.append(
                {
                    "ts_ms": _first_int(row, ("ts_ms", "observed_at_ms")),
                    "score": _num(row.get("score")),
                    "severity": severity,
                    "reasons": _reason_list(row)[:5],
                }
            )

    completed = 0
    for wrapper in episode_rows:
        ep = wrapper.get("episode") if isinstance(wrapper.get("episode"), dict) else wrapper
        outcome = wrapper.get("outcome") if isinstance(wrapper.get("outcome"), dict) else None
        if isinstance(ep, dict):
            for reason in _reason_list(ep):
                reason_counts[reason] += 1
            severity = ep.get("severity")
            if severity:
                severity_counts[str(severity)] += 1
        if outcome:
            completed += 1
            flat: dict[str, float] = {}
            _flatten_numeric("", outcome, flat)
            for key, value in flat.items():
                low = key.lower()
                if any(token in low for token in ("return", "ret_", "move", "mfe", "mae", "pct")):
                    outcome_values[key].append(value)

    outcomes = {
        key: _stats(values)
        for key, values in sorted(outcome_values.items(), key=lambda kv: (-len(kv[1]), kv[0]))[:24]
    }
    return {
        "episodes": len(episode_rows),
        "completed_outcomes": completed,
        "anomaly_points": len(scores),
        "reasons": [{"name": key, "count": count} for key, count in reason_counts.most_common(16)],
        "severities": dict(severity_counts),
        "outcomes": outcomes,
        "timeline_markers": markers,
    }


def _extract_trade_rows(run: dict[str, Any]) -> list[dict[str, Any]]:
    candidates = (
        run.get("trades"),
        run.get("trade_trace"),
        run.get("trade_records"),
        run.get("events"),
    )
    for candidate in candidates:
        if isinstance(candidate, list) and candidate and isinstance(candidate[0], dict):
            return candidate
    metrics = run.get("metrics")
    if isinstance(metrics, dict):
        for key in ("trades", "trade_trace", "trade_records", "events"):
            candidate = metrics.get(key)
            if isinstance(candidate, list) and candidate and isinstance(candidate[0], dict):
                return candidate
    return []


def _trade_return(row: dict[str, Any]) -> float | None:
    value = _first_num(row, ("net_return_pct", "net_pct", "return_pct", "pnl_pct", "return"))
    if value is not None:
        return value
    pnl = _first_num(row, ("net_pnl", "pnl", "profit"))
    entry = _first_num(row, ("entry_price", "entry"))
    size = _first_num(row, ("size", "qty", "quantity")) or 1.0
    denom = abs(entry * size) if entry not in (None, 0) else None
    return (pnl / denom * 100.0) if pnl is not None and denom else None


def build_trade_diagnostics(trades: list[dict[str, Any]] | None) -> dict[str, Any]:
    trades = trades or []
    groups: dict[str, dict[str, list[float]]] = {
        "hour_msk": defaultdict(list),
        "weekday": defaultdict(list),
        "symbol": defaultdict(list),
        "exit_reason": defaultdict(list),
        "exit_policy": defaultdict(list),
        "regime": defaultdict(list),
        "side": defaultdict(list),
    }
    all_returns: list[float] = []
    mfe: list[float] = []
    mae: list[float] = []

    for row in trades:
        ret = _trade_return(row)
        if ret is None:
            continue
        all_returns.append(ret)
        ts_ms = _first_int(row, ("entry_ts_ms", "signal_ts_ms", "ts_ms", "entry_time_ms"))
        if ts_ms is not None:
            dt = datetime.fromtimestamp(ts_ms / 1000.0, tz=timezone.utc)
            groups["hour_msk"][f"{(dt.hour + 3) % 24:02d}:00"].append(ret)
            groups["weekday"][WEEKDAYS[dt.weekday()]].append(ret)
        for key, names in {
            "symbol": ("symbol", "secid", "canonical_id"),
            "exit_reason": ("exit_reason", "reason"),
            "exit_policy": ("exit_policy", "exit_mode", "take_profit_mode"),
            "regime": ("regime", "market_regime", "volatility_regime"),
            "side": ("side", "direction"),
        }.items():
            value = next((row.get(name) for name in names if row.get(name) not in (None, "")), None)
            if value is not None:
                groups[key][str(value)].append(ret)
        v = _first_num(row, ("mfe_pct", "mfe"))
        if v is not None:
            mfe.append(v)
        v = _first_num(row, ("mae_pct", "mae"))
        if v is not None:
            mae.append(v)

    def serialize(bucket: dict[str, list[float]]) -> list[dict[str, Any]]:
        rows = [{"key": key, **_stats(values)} for key, values in bucket.items()]
        rows.sort(key=lambda x: (-int(x["n"]), str(x["key"])))
        return rows

    return {
        "trades": len(all_returns),
        "overall": _stats(all_returns),
        "mfe": _stats(mfe),
        "mae": _stats(mae),
        "by_hour_msk": serialize(groups["hour_msk"]),
        "by_weekday": serialize(groups["weekday"]),
        "by_symbol": serialize(groups["symbol"]),
        "by_exit_reason": serialize(groups["exit_reason"]),
        "by_exit_policy": serialize(groups["exit_policy"]),
        "by_regime": serialize(groups["regime"]),
        "by_side": serialize(groups["side"]),
    }


def build_strategy_diagnostics(runs: list[dict[str, Any]] | None) -> dict[str, Any]:
    runs = runs or []
    status_counts: Counter[str] = Counter()
    family_counts: Counter[str] = Counter()
    traces: list[dict[str, Any]] = []
    combined_trades: list[dict[str, Any]] = []
    sample_total = 0
    control_total = 0

    for run in runs:
        status = str(run.get("status") or run.get("validation_state") or run.get("conclusion") or "unknown")
        status_counts[status] += 1
        spec = run.get("spec") if isinstance(run.get("spec"), dict) else {}
        family = (
            run.get("family")
            or run.get("strategy_family")
            or run.get("strategy_key")
            or spec.get("family")
            or spec.get("name")
            or "unknown"
        )
        family_counts[str(family)] += 1
        sample_total += int(_first_num(run, ("sample_count", "event_count", "round_events")) or 0)
        control_total += int(_first_num(run, ("control_count", "control_events")) or 0)
        rows = _extract_trade_rows(run)
        combined_trades.extend(rows)
        traces.append(
            {
                "run_id": run.get("run_id") or run.get("id"),
                "family": family,
                "status": status,
                "sample_count": int(_first_num(run, ("sample_count", "event_count", "round_events")) or 0),
                "control_count": int(_first_num(run, ("control_count", "control_events")) or 0),
                "trade_trace_count": len(rows),
            }
        )

    return {
        "runs": len(runs),
        "status_counts": dict(status_counts),
        "families": [{"name": k, "count": v} for k, v in family_counts.most_common()],
        "sample_total": sample_total,
        "control_total": control_total,
        "run_trace": traces[:100],
        "trade_diagnostics": build_trade_diagnostics(combined_trades),
        "trace_coverage": {
            "runs_with_trade_trace": sum(1 for row in traces if row["trade_trace_count"] > 0),
            "trade_records": len(combined_trades),
            "hour_weekday_exit_analysis_ready": bool(combined_trades),
        },
    }


def build_instrument_diagnostics(
    *,
    episode_rows: list[dict[str, Any]] | None,
    scores: list[dict[str, Any]] | None,
    strategy_runs: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    anomaly = build_anomaly_diagnostics(episode_rows, scores)
    strategy = build_strategy_diagnostics(strategy_runs)
    missing: list[str] = []
    if not anomaly["episodes"]:
        missing.append("anomaly_episode_history")
    if not strategy["runs"]:
        missing.append("strategy_runs")
    if not strategy["trace_coverage"]["trade_records"]:
        missing.append("trade_level_trace_for_hour_weekday_exit_diagnostics")
    return {
        "anomaly": anomaly,
        "strategy": strategy,
        "research_readiness": {
            "ready": not missing,
            "missing": missing,
            "principle": "No post-hoc filter becomes a conclusion without a new preregistered run.",
        },
    }
