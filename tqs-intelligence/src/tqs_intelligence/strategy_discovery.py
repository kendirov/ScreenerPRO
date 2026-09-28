from __future__ import annotations

import math
import statistics
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import polars as pl

from .strategy_models import StrategyRunResult, StrategySpec


@dataclass
class DiscoveryTrade:
    signal_ts_ms: int
    entry_ts_ms: int
    exit_ts_ms: int
    entry: float
    exit: float
    net_pct: float
    gross_pct: float
    mfe_pct: float
    mae_pct: float
    context: dict[str, Any]


def _stats(values: list[float]) -> dict[str, Any]:
    if not values:
        return {"n": 0, "mean_net_pct": None, "median_net_pct": None, "win_rate": None, "sum_net_pct": 0.0}
    return {
        "n": len(values),
        "mean_net_pct": statistics.fmean(values),
        "median_net_pct": statistics.median(values),
        "win_rate": sum(1 for value in values if value > 0) / len(values),
        "sum_net_pct": sum(values),
        "best_net_pct": max(values),
        "worst_net_pct": min(values),
    }


def _trade_stats(rows: list[DiscoveryTrade]) -> dict[str, Any]:
    result = _stats([row.net_pct for row in rows])
    if rows:
        result["median_mfe_pct"] = statistics.median(row.mfe_pct for row in rows)
        result["median_mae_pct"] = statistics.median(row.mae_pct for row in rows)
    return result


def _rsi(closes: list[float], end: int, period: int = 14) -> float | None:
    if end < period:
        return None
    gains: list[float] = []
    losses: list[float] = []
    for idx in range(end - period + 1, end + 1):
        prev = closes[idx - 1]
        cur = closes[idx]
        delta = cur - prev
        gains.append(max(delta, 0.0))
        losses.append(max(-delta, 0.0))
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    if avg_loss <= 1e-12:
        return 100.0 if avg_gain > 0 else 50.0
    rs = avg_gain / avg_loss
    return 100.0 - 100.0 / (1.0 + rs)


def _volume_z(volumes: list[float], end: int, window: int = 30) -> float | None:
    if end < window:
        return None
    history = volumes[end - window:end]
    if len(history) < max(10, window // 2):
        return None
    mean = statistics.fmean(history)
    std = statistics.pstdev(history)
    if std <= 1e-12:
        return 0.0
    return (volumes[end] - mean) / std


def _round_distance_bps(price: float, step: float | None) -> tuple[float | None, float | None]:
    if price <= 0:
        return None, None
    if step is None or step <= 0:
        magnitude = 10 ** math.floor(math.log10(price))
        step = magnitude if price >= magnitude * 2 else magnitude / 2
        if step <= 0:
            return None, None
    level = round(price / step) * step
    return abs(price - level) / price * 10_000.0, level


def _context(rows: list[dict[str, Any]], closes: list[float], volumes: list[float], signal_i: int, spec: StrategySpec) -> dict[str, Any]:
    bar = rows[signal_i]
    ts_ms = int(bar["ts_ms"])
    dt = datetime.fromtimestamp(ts_ms / 1000.0, tz=timezone.utc)
    hour_msk = (dt.hour + 3) % 24
    weekday = dt.weekday()
    period = max(2, int(spec.filters.get("rsi_period", 14)))
    rsi = _rsi(closes, signal_i, period)
    lookback = max(1, int(spec.filters.get("return_lookback_bars", 15)))
    ret = None
    if signal_i >= lookback and closes[signal_i - lookback] > 0:
        ret = (closes[signal_i] / closes[signal_i - lookback] - 1.0) * 100.0
    volume_window = max(10, int(spec.filters.get("volume_z_window", 30)))
    volume_z = _volume_z(volumes, signal_i, volume_window)
    round_step = spec.filters.get("round_step")
    round_step = float(round_step) if round_step not in (None, "") else None
    round_distance_bps, round_level = _round_distance_bps(closes[signal_i], round_step)
    return {
        "hour_msk": hour_msk,
        "weekday": weekday,
        "rsi": rsi,
        "return_lookback_pct": ret,
        "volume_z": volume_z,
        "round_distance_bps": round_distance_bps,
        "round_level": round_level,
        "signal_close": closes[signal_i],
    }


def _passes(context: dict[str, Any], filters: dict[str, Any]) -> bool:
    hours = {int(x) for x in filters.get("hours_msk", []) if str(x).strip() != ""}
    weekdays = {int(x) for x in filters.get("weekdays", []) if str(x).strip() != ""}
    if hours and int(context["hour_msk"]) not in hours:
        return False
    if weekdays and int(context["weekday"]) not in weekdays:
        return False

    checks = [
        ("rsi_lte", "rsi", lambda value, bound: value <= bound),
        ("rsi_gte", "rsi", lambda value, bound: value >= bound),
        ("return_lte_pct", "return_lookback_pct", lambda value, bound: value <= bound),
        ("return_gte_pct", "return_lookback_pct", lambda value, bound: value >= bound),
        ("volume_z_gte", "volume_z", lambda value, bound: value >= bound),
        ("volume_z_lte", "volume_z", lambda value, bound: value <= bound),
        ("round_distance_bps_lte", "round_distance_bps", lambda value, bound: value <= bound),
    ]
    for filter_key, context_key, compare in checks:
        if filter_key not in filters or filters.get(filter_key) in (None, ""):
            continue
        value = context.get(context_key)
        if value is None or not compare(float(value), float(filters[filter_key])):
            return False
    return True


def _trade(rows: list[dict[str, Any]], signal_i: int, horizon: int, cost_bps: float, side: str, context: dict[str, Any]) -> DiscoveryTrade | None:
    entry_i = signal_i + 1
    exit_i = entry_i + horizon - 1
    if entry_i >= len(rows) or exit_i >= len(rows):
        return None
    entry = float(rows[entry_i]["open"])
    exit_price = float(rows[exit_i]["close"])
    if entry <= 0:
        return None
    future = rows[entry_i:exit_i + 1]
    direction = -1.0 if side == "short" else 1.0
    gross = direction * (exit_price / entry - 1.0) * 100.0
    highs = [float(row["high"]) for row in future]
    lows = [float(row["low"]) for row in future]
    if direction > 0:
        mfe = (max(highs) / entry - 1.0) * 100.0
        mae = (min(lows) / entry - 1.0) * 100.0
    else:
        mfe = (entry / min(lows) - 1.0) * 100.0
        mae = (entry / max(highs) - 1.0) * 100.0
    return DiscoveryTrade(
        signal_ts_ms=int(rows[signal_i]["ts_ms"]),
        entry_ts_ms=int(rows[entry_i]["ts_ms"]),
        exit_ts_ms=int(rows[exit_i]["ts_ms"]),
        entry=entry,
        exit=exit_price,
        gross_pct=gross,
        net_pct=gross - cost_bps / 100.0,
        mfe_pct=mfe,
        mae_pct=mae,
        context=context,
    )


def _split(rows: list[DiscoveryTrade], fractions: tuple[float, float, float]) -> dict[str, list[DiscoveryTrade]]:
    ordered = sorted(rows, key=lambda row: row.entry_ts_ms)
    n = len(ordered)
    a = int(n * fractions[0])
    b = int(n * (fractions[0] + fractions[1]))
    return {"exploration": ordered[:a], "validation": ordered[a:b], "holdout": ordered[b:]}


def _trace(rows: list[DiscoveryTrade], split: str, control: bool = False) -> list[dict[str, Any]]:
    return [{
        "signal_ts_ms": row.signal_ts_ms,
        "entry_ts_ms": row.entry_ts_ms,
        "exit_ts_ms": row.exit_ts_ms,
        "side": "long",
        "entry_price": row.entry,
        "exit_price": row.exit,
        "gross_return_pct": row.gross_pct,
        "net_return_pct": row.net_pct,
        "mfe_pct": row.mfe_pct,
        "mae_pct": row.mae_pct,
        "split": split,
        "exit_reason": "time",
        "exit_policy": "hold",
        "is_control": control,
        "context": row.context,
    } for row in rows]


def _slice(rows: list[DiscoveryTrade], key: str, bucket) -> list[dict[str, Any]]:
    groups: dict[str, list[DiscoveryTrade]] = {}
    for row in rows:
        value = bucket(row.context.get(key))
        groups.setdefault(value, []).append(row)
    result = []
    for name, values in groups.items():
        if len(values) < 3:
            continue
        stats = _trade_stats(values)
        result.append({"key": name, "n": stats["n"], "mean": stats["mean_net_pct"], "median": stats["median_net_pct"], "win_rate": stats["win_rate"], **stats})
    result.sort(key=lambda item: (-int(item["n"]), str(item["key"])))
    return result


def _diagnostics(rows: list[DiscoveryTrade]) -> dict[str, Any]:
    return {
        "by_hour_msk": _slice(rows, "hour_msk", lambda value: f"{int(value):02d}:00" if value is not None else "unknown"),
        "by_weekday": _slice(rows, "weekday", lambda value: str(int(value)) if value is not None else "unknown"),
        "by_rsi": _slice(rows, "rsi", lambda value: "RSI<30" if value is not None and value < 30 else "RSI>70" if value is not None and value > 70 else "RSI 30-70"),
        "by_return": _slice(rows, "return_lookback_pct", lambda value: "<=-0.5%" if value is not None and value <= -0.5 else ">=+0.5%" if value is not None and value >= 0.5 else "-0.5..+0.5%"),
        "by_round_distance": _slice(rows, "round_distance_bps", lambda value: "<=10bp" if value is not None and value <= 10 else "<=25bp" if value is not None and value <= 25 else ">25bp"),
        "by_volume_z": _slice(rows, "volume_z", lambda value: "z>=3" if value is not None and value >= 3 else "z>=1.5" if value is not None and value >= 1.5 else "normal"),
        "principle": "Срезы описательные. Любой найденный фильтр должен стать новым frozen StrategySpec и пройти validation/holdout.",
    }


def run_conditional_entry(spec: StrategySpec, canonical_id: str, frame: pl.DataFrame) -> StrategyRunResult:
    generated = int(time.time() * 1000)
    empty = lambda warning: StrategyRunResult(
        run_id=f"R-{uuid4().hex[:10].upper()}",
        strategy_id=spec.id,
        canonical_id=canonical_id,
        interval=spec.interval,
        generated_at_ms=generated,
        status="inconclusive",
        events=0,
        warnings=[warning],
    )
    if frame.is_empty() or len(frame) < 120:
        return empty("Недостаточно исторических свечей (<120).")
    required = {"ts_ms", "open", "high", "low", "close"}
    if not required.issubset(set(frame.columns)):
        raise ValueError(f"missing columns: {sorted(required-set(frame.columns))}")

    columns = [name for name in ["ts_ms", "open", "high", "low", "close", "volume", "turnover"] if name in frame.columns]
    rows = frame.sort("ts_ms").select(columns).to_dicts()
    closes = [float(row["close"]) for row in rows]
    volumes = [float(row.get("volume") or row.get("turnover") or 0.0) for row in rows]
    horizon = max(1, int(spec.exit.get("horizon_bars", 30)))
    cost_bps = float(spec.costs.get("round_trip_bps", 8.0))
    side = str(spec.entry.get("side", "long")).lower()
    warmup = max(35, int(spec.filters.get("return_lookback_bars", 15)) + 2)
    control_offset = max(1, int(spec.event.get("control_offset_bars", 30)))

    events: list[DiscoveryTrade] = []
    controls: list[DiscoveryTrade] = []
    for signal_i in range(warmup, len(rows) - horizon - control_offset - 2):
        context = _context(rows, closes, volumes, signal_i, spec)
        if not _passes(context, spec.filters):
            continue
        event = _trade(rows, signal_i, horizon, cost_bps, side, context)
        if event:
            events.append(event)
        control_i = signal_i + control_offset
        control_context = _context(rows, closes, volumes, control_i, spec)
        control_context["control"] = f"shifted_{control_offset}_bars"
        control = _trade(rows, control_i, horizon, cost_bps, side, control_context)
        if control:
            controls.append(control)

    fractions = (
        float(spec.validation.get("exploration_fraction", 0.60)),
        float(spec.validation.get("validation_fraction", 0.20)),
        float(spec.validation.get("holdout_fraction", 0.20)),
    )
    event_split = _split(events, fractions)
    control_split = _split(controls, fractions)
    splits: dict[str, Any] = {}
    for name in ("exploration", "validation", "holdout"):
        event_stats = _trade_stats(event_split[name])
        control_stats = _trade_stats(control_split[name])
        excess = None
        if event_stats["median_net_pct"] is not None and control_stats["median_net_pct"] is not None:
            excess = event_stats["median_net_pct"] - control_stats["median_net_pct"]
        splits[name] = {"strategy": event_stats, "control": control_stats, "median_excess_pct": excess}

    baseline = not any(
        spec.filters.get(key) not in (None, "", [])
        for key in ("hours_msk", "weekdays", "rsi_lte", "rsi_gte", "return_lte_pct", "return_gte_pct", "volume_z_gte", "volume_z_lte", "round_distance_bps_lte")
    )
    min_events = int(spec.validation.get("min_events", 40))
    status = "inconclusive"
    warnings: list[str] = []
    if baseline:
        warnings.append("Это baseline «покупать каждую минуту»: результат описательный, не кандидат на торговлю.")
    elif len(events) < min_events:
        warnings.append(f"Событий {len(events)}, требуется минимум {min_events}.")
    else:
        val = splits["validation"]
        hold = splits["holdout"]
        values = [
            val["strategy"].get("median_net_pct"), val.get("median_excess_pct"),
            hold["strategy"].get("median_net_pct"), hold.get("median_excess_pct"),
        ]
        if None not in values and all(float(value) > 0 for value in values):
            status = "candidate"
        elif hold["strategy"].get("median_net_pct") is not None and (
            hold["strategy"]["median_net_pct"] <= 0 or (hold.get("median_excess_pct") or -999.0) <= 0
        ):
            status = "rejected"

    trade_trace: list[dict[str, Any]] = []
    control_trace: list[dict[str, Any]] = []
    for split_name in ("exploration", "validation", "holdout"):
        trade_trace.extend(_trace(event_split[split_name], split_name, False))
        control_trace.extend(_trace(control_split[split_name], split_name, True))

    return StrategyRunResult(
        run_id=f"R-{uuid4().hex[:10].upper()}",
        strategy_id=spec.id,
        canonical_id=canonical_id,
        interval=spec.interval,
        generated_at_ms=generated,
        status=status,
        events=len(events) + len(controls),
        round_events=len(events),
        control_events=len(controls),
        metrics={
            "strategy_all": _trade_stats(events),
            "control_all": _trade_stats(controls),
            "baseline_every_bar": baseline,
            "horizon_bars": horizon,
            "filters": spec.filters,
        },
        splits=splits,
        robustness={"control_offset_bars": control_offset, "anti_overfit": "new discovered filter => new frozen StrategySpec"},
        diagnostics=_diagnostics(events),
        trade_trace=trade_trace,
        control_trace=control_trace,
        warnings=warnings,
    )


def default_minute_discovery_spec() -> StrategySpec:
    return StrategySpec(
        id="TQS-STRAT-MINUTE-DISCOVERY-001",
        name_ru="Каждую минуту — базовая карта возможностей",
        status="exploratory",
        idea="Покупать после каждой завершённой минутной свечи и измерять, в какие часы, дни и режимы результат отличается. Это baseline для последующих frozen-фильтров.",
        universe=["MOEX stocks", "MOEX futures"],
        interval="1m",
        event={"type": "conditional_entry", "control_offset_bars": 30},
        entry={"type": "next_bar_open", "side": "long"},
        exit={"type": "time", "horizon_bars": 30},
        filters={
            "auto_run": False,
            "return_lookback_bars": 15,
            "rsi_period": 14,
            "volume_z_window": 30,
        },
        costs={"round_trip_bps": 8.0},
        notes=[
            "Baseline запускается вручную на выбранном инструменте, чтобы не создавать тяжёлый full-universe job автоматически.",
            "Срезы по часу/дню/RSI/движению/круглому уровню/объёму являются discovery, а не доказательством.",
            "Найденный фильтр нужно сохранить как новый StrategySpec и повторно проверить на validation/holdout.",
        ],
    )
