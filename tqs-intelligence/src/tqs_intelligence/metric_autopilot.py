from __future__ import annotations

from typing import Any, Iterable

from .models import Quote

START_2021_MS = 1609459200000
BYBIT_LINEAR_QUOTA = 30


def metric_key(payload: dict[str, Any]) -> tuple[str, str, str]:
    return (
        str(payload.get("provider") or "").lower(),
        str(payload.get("symbol") or "").upper(),
        str(payload.get("market_type") or "").lower(),
    )


def _payload(q: Quote) -> dict[str, Any] | None:
    if q.provider == "bybit" and q.market_type == "linear" and q.symbol.endswith("USDT"):
        return {
            "provider": "bybit",
            "symbol": q.symbol,
            "market_type": "linear",
            "start_ms": START_2021_MS,
        }
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
    ranked = sorted(
        [q for q in quotes if _payload(q) is not None],
        key=_priority,
        reverse=True,
    )[:BYBIT_LINEAR_QUOTA]
    targets = [_payload(q) for q in ranked]
    targets = [x for x in targets if x is not None]

    existing: dict[tuple[str, str, str], str] = {}
    for job in jobs:
        if getattr(job, "kind", "") != "derivative_metric_backfill":
            continue
        payload = dict(getattr(job, "payload", {}) or {})
        existing[metric_key(payload)] = str(getattr(job, "status", "") or "")

    remaining = [p for p in targets if metric_key(p) not in existing]
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
        "scope": "Bybit top linear USDT: historical OI + funding; provider-specific provenance preserved",
    }
    return selected, stats


def metric_title(payload: dict[str, Any]) -> str:
    return f"Автометрики BYBIT: {payload.get('symbol', '?')} / OI + funding"
