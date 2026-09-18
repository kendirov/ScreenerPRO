from __future__ import annotations

from collections import defaultdict
from typing import Any, Iterable

from .models import Quote

START_2021_MS = 1609459200000

# Full-history is intentionally tiered. MAX progressively fills this priority
# universe instead of trying to download every one of ~16k live instruments at
# once. The planner is deterministic and can be expanded without changing the
# ResearchRuntime worker.
BUCKET_QUOTAS: dict[tuple[str, str], int] = {
    # MOEX is the reference vertical: target the complete currently observable
    # share/FORTS universe, still ranked liquid-first so overnight value appears early.
    ("moex", "shares"): 2_000,
    ("moex", "forts"): 2_000,
    ("moex", "index"): 200,
    ("moex", "selt"): 200,
    # Crypto remains active, but no longer consumes the MOEX reference build first.
    ("binance", "usdt-futures"): 60,
    ("binance", "spot"): 30,
}

BUCKET_ORDER = [
    ("moex", "shares"),
    ("moex", "forts"),
    ("moex", "index"),
    ("moex", "selt"),
    ("binance", "usdt-futures"),
    ("binance", "spot"),
]


def history_key(payload: dict[str, Any]) -> tuple[str, ...]:
    return (
        str(payload.get("provider") or "").lower(),
        str(payload.get("symbol") or ""),
        str(payload.get("market_type") or ""),
        str(payload.get("interval") or ""),
        str(payload.get("engine") or ""),
        str(payload.get("market") or ""),
    )


def _payload_for_quote(q: Quote) -> dict[str, Any] | None:
    if q.provider == "binance" and q.market_type in {"spot", "usdt-futures"}:
        if not q.symbol.endswith("USDT"):
            return None
        return {
            "provider": "binance",
            "symbol": q.symbol,
            "market_type": q.market_type,
            "interval": "5m",
            "start_ms": START_2021_MS,
        }
    if q.provider == "moex" and q.market_type in {"shares", "forts", "index", "selt"}:
        engine = str(q.meta.get("engine") or "")
        market = str(q.meta.get("market") or "")
        if not engine or not market:
            return None
        return {
            "provider": "moex",
            "symbol": q.symbol,
            "market_type": q.market_type,
            "engine": engine,
            "market": market,
            "interval": "10m",
            "start_ms": START_2021_MS,
        }
    return None


def _priority(q: Quote) -> tuple[float, float]:
    # Ranking happens inside each provider/market bucket, so incompatible
    # turnover units never compete directly. Price movement is only a tiebreaker.
    return (float(q.turnover_24h or 0.0), abs(float(q.change_24h_pct or 0.0)))


def build_history_plan(
    quotes: Iterable[Quote],
    jobs: Iterable[Any],
    *,
    batch_size: int = 4,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    buckets: dict[tuple[str, str], list[Quote]] = defaultdict(list)
    for q in quotes:
        bucket = (q.provider, q.market_type)
        if bucket in BUCKET_QUOTAS and _payload_for_quote(q) is not None:
            buckets[bucket].append(q)

    chosen_by_bucket: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for bucket, quota in BUCKET_QUOTAS.items():
        ranked = sorted(buckets.get(bucket, []), key=_priority, reverse=True)[:quota]
        chosen_by_bucket[bucket] = [p for q in ranked if (p := _payload_for_quote(q)) is not None]

    # Round-robin across markets so a single overnight session enriches crypto
    # and MOEX together instead of consuming the whole night on one venue.
    targets: list[dict[str, Any]] = []
    max_len = max((len(v) for v in chosen_by_bucket.values()), default=0)
    for i in range(max_len):
        for bucket in BUCKET_ORDER:
            rows = chosen_by_bucket.get(bucket, [])
            if i < len(rows):
                targets.append(rows[i])

    job_rows = list(jobs)
    existing: dict[tuple[str, ...], str] = {}
    for job in job_rows:
        if getattr(job, "kind", "") != "historical_backfill":
            continue
        key = history_key(dict(getattr(job, "payload", {}) or {}))
        status = str(getattr(job, "status", "") or "")
        # Failed jobs are deliberately remembered for the current planner pass;
        # otherwise a broken symbol/API can spin forever all night.
        existing[key] = status

    remaining = [p for p in targets if history_key(p) not in existing]
    selected = remaining[: max(0, int(batch_size))]
    statuses = list(existing.values())
    stats = {
        "enabled": True,
        "target_total": len(targets),
        "known_total": sum(1 for p in targets if history_key(p) in existing),
        "done": sum(1 for p in targets if existing.get(history_key(p)) == "done"),
        "queued_running": sum(1 for p in targets if existing.get(history_key(p)) in {"queued", "running"}),
        "failed": sum(1 for p in targets if existing.get(history_key(p)) == "failed"),
        "remaining": len(remaining),
        "batch_planned": len(selected),
        "scope": "MOEX complete observable shares/FORTS target + indices/FX, liquid-first from 2021; Binance priority tiers continue",
    }
    return selected, stats


def history_title(payload: dict[str, Any]) -> str:
    provider = str(payload.get("provider") or "").upper()
    symbol = str(payload.get("symbol") or "?")
    interval = str(payload.get("interval") or "")
    return f"Автоистория {provider}: {symbol} / {interval} / 2021→сейчас"
