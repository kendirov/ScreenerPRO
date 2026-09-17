from __future__ import annotations

import re
from typing import Any, Iterable

from .models import Quote

START_2021_MS = 1609459200000
METRIC_QUOTAS: dict[tuple[str, str], int] = {
    ("binance", "usdt-futures"): 40,
    ("bybit", "linear"): 25,
    ("moex", "forts"): 8,
}
# Backwards-compatible name used by CI/older tooling.
BYBIT_LINEAR_QUOTA = METRIC_QUOTAS[("bybit", "linear")]
_MONTH_CODES = "FGHJKMNQUVXZ"


def _moex_root(symbol: str) -> str:
    compact = "".join(ch for ch in str(symbol).upper() if ch.isalnum())
    m = re.match(rf"^([A-ZА-Я]{{1,8}})[{_MONTH_CODES}]\d{{1,2}}$", compact)
    if m:
        return m.group(1)
    m = re.match(r"^([A-ZА-Я]{1,8})\d", compact)
    return m.group(1) if m else compact


def metric_key(payload: dict[str, Any]) -> tuple[str, str, str]:
    return (
        str(payload.get("provider") or "").lower(),
        str(payload.get("symbol") or "").upper(),
        str(payload.get("market_type") or "").lower(),
    )


def _payload(q: Quote) -> dict[str, Any] | None:
    if q.provider == "binance" and q.market_type == "usdt-futures" and q.symbol.endswith("USDT"):
        return {"provider": "binance", "symbol": q.symbol, "market_type": "usdt-futures", "start_ms": START_2021_MS}
    if q.provider == "bybit" and q.market_type == "linear" and q.symbol.endswith("USDT"):
        return {"provider": "bybit", "symbol": q.symbol, "market_type": "linear", "start_ms": START_2021_MS}
    if q.provider == "moex" and q.market_type == "forts":
        root = _moex_root(q.symbol)
        if root:
            return {"provider": "moex", "symbol": root, "market_type": "forts", "start_ms": START_2021_MS, "authorized": False}
    return None


def _priority(q: Quote) -> tuple[float, float, float]:
    return (
        float(q.turnover_24h or 0.0),
        float(q.open_interest or 0.0),
        abs(float(q.change_24h_pct or 0.0)),
    )


def build_metric_plan(
    quotes: Iterable[Quote],
    jobs: Iterable[Any],
    *,
    batch_size: int = 2,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    buckets: dict[tuple[str, str], list[Quote]] = {key: [] for key in METRIC_QUOTAS}
    for q in quotes:
        key = (q.provider, q.market_type)
        if key in buckets and _payload(q) is not None:
            buckets[key].append(q)

    targets: list[dict[str, Any]] = []
    bucket_counts: dict[str, dict[str, int]] = {}
    for bucket, quota in METRIC_QUOTAS.items():
        provider, market_type = bucket
        ranked = sorted(buckets[bucket], key=_priority, reverse=True)
        unique: list[dict[str, Any]] = []
        seen: set[tuple[str, str, str]] = set()
        for q in ranked:
            payload = _payload(q)
            if payload is None:
                continue
            key = metric_key(payload)
            if key in seen:
                continue
            seen.add(key); unique.append(payload)
            if len(unique) >= quota:
                break
        targets.extend(unique)
        bucket_counts[f"{provider}:{market_type}"] = {"target": len(unique), "quota": quota}

    existing: dict[tuple[str, str, str], str] = {}
    for job in jobs:
        if getattr(job, "kind", "") != "derivative_metric_backfill":
            continue
        payload = dict(getattr(job, "payload", {}) or {})
        existing[metric_key(payload)] = str(getattr(job, "status", "") or "")

    remaining = [p for p in targets if metric_key(p) not in existing]
    # Interleave providers instead of exhausting one exchange first.
    provider_order = {"binance": 0, "bybit": 1, "moex": 2}
    remaining.sort(key=lambda p: (sum(1 for x in existing if x[0] == p["provider"]), provider_order.get(p["provider"], 9)))
    selected = remaining[: max(0, int(batch_size))]
    stats = {
        "enabled": True,
        "target_total": len(targets),
        "known_total": sum(1 for p in targets if metric_key(p) in existing),
        "done": sum(1 for p in targets if existing.get(metric_key(p)) == "done"),
        "queued_running": sum(1 for p in targets if existing.get(metric_key(p)) in {"queued", "running"}),
        "failed": sum(1 for p in targets if existing.get(metric_key(p)) == "failed"),
        "remaining": len(remaining),
        "batch_planned": len(selected),
        "buckets": bucket_counts,
        "scope": "Binance OI/funding/basis + Bybit OI/funding + MOEX FUTOI; separate provider provenance",
    }
    return selected, stats


def metric_title(payload: dict[str, Any]) -> str:
    provider = str(payload.get("provider") or "?").upper()
    symbol = payload.get("symbol", "?")
    suffix = "FUTOI физ/юр" if provider == "MOEX" else "OI + funding" if provider == "BYBIT" else "OI + funding + basis"
    return f"Автометрики {provider}: {symbol} / {suffix}"
