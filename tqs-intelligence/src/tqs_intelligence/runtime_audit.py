from __future__ import annotations

import time
from collections import Counter
from pathlib import Path
from typing import Any


def _now_ms() -> int:
    return int(time.time() * 1000)


def _status(ok: bool, warn: bool = False) -> str:
    if ok:
        return "ok"
    return "warn" if warn else "fail"


def _ratio(found: int, total: int) -> float | None:
    if total <= 0:
        return None
    return round(found / total, 4)


def _age_s(ts_ms: int | None, now_ms: int) -> int | None:
    if not ts_ms:
        return None
    return max(0, int((now_ms - int(ts_ms)) / 1000))


def build_runtime_audit(
    *,
    version: str,
    runtime: dict[str, Any],
    snapshot: Any,
    storage: dict[str, Any],
    lake: dict[str, Any],
    lab: dict[str, Any],
    lchi: dict[str, Any],
    pulse: dict[str, Any],
    remote: dict[str, Any],
    update: dict[str, Any],
    recent_logs: list[Any],
) -> dict[str, Any]:
    """Build one compact, machine-readable truth packet for owner + AI.

    The audit only claims what the running node can prove. It deliberately
    distinguishes implemented-but-empty, unavailable and not-yet-implemented
    layers so the UI never implies that "all possible market data" is collected.
    """
    now = _now_ms()
    quotes = list(getattr(snapshot, "quotes", []) or [])
    source_health = list(getattr(snapshot, "source_health", []) or [])
    generated_at_ms = getattr(snapshot, "generated_at_ms", None)

    provider_counts = Counter(str(getattr(q, "provider", "") or "") for q in quotes)
    market_counts = Counter(
        f"{getattr(q, 'provider', '')}:{getattr(q, 'market_type', '')}"
        for q in quotes
    )

    sources: list[dict[str, Any]] = []
    source_bad = 0
    source_degraded = 0
    source_ok = 0
    for item in source_health:
        try:
            row = item.model_dump(mode="json")
        except Exception:
            row = dict(item) if isinstance(item, dict) else {"value": str(item)}
        status = str(row.get("status") or "").lower()
        if status == "ok":
            source_ok += 1
        elif status == "degraded":
            source_degraded += 1
        else:
            source_bad += 1
        sources.append(row)

    refresh_seconds = int(runtime.get("effective_refresh_seconds") or runtime.get("refresh_seconds") or 60)
    snapshot_age_s = _age_s(generated_at_ms, now)
    snapshot_fresh = snapshot_age_s is not None and snapshot_age_s <= max(300, refresh_seconds * 4)

    moex = [q for q in quotes if str(getattr(q, "provider", "")) == "moex"]
    moex_futures = [q for q in moex if str(getattr(q, "market_type", "")) == "forts"]
    moex_stocks = [q for q in moex if str(getattr(q, "market_type", "")) == "shares"]

    def present(rows: list[Any], attr: str) -> int:
        return sum(1 for row in rows if getattr(row, attr, None) not in (None, ""))

    num_trades = sum(
        1 for row in moex
        if isinstance(getattr(row, "meta", None), dict)
        and row.meta.get("num_trades") not in (None, "")
    )
    trading_status = sum(
        1 for row in moex
        if isinstance(getattr(row, "meta", None), dict)
        and row.meta.get("trading_status") not in (None, "")
    )

    metrics = dict((lake.get("metrics") or {}).get("metrics") or {})
    metric_rows = int((lake.get("metrics") or {}).get("rows") or 0)
    futoi_points = sum(int(v or 0) for k, v in metrics.items() if str(k).startswith("futoi_"))
    derivative_points = sum(
        int(v or 0)
        for k, v in metrics.items()
        if str(k) in {
            "open_interest",
            "open_interest_value",
            "funding_rate",
            "basis",
            "basis_rate",
            "annualized_basis_rate",
        }
    )

    checks: list[dict[str, Any]] = []

    def add(
        key: str,
        title: str,
        status: str,
        detail: str,
        *,
        evidence: dict[str, Any] | None = None,
        required: bool = True,
    ) -> None:
        checks.append(
            {
                "key": key,
                "title": title,
                "status": status,
                "detail": detail,
                "required": required,
                "evidence": evidence or {},
            }
        )

    add(
        "runtime",
        "TQS runtime",
        _status(bool(runtime.get("running")) and not runtime.get("last_error")),
        f"running={bool(runtime.get('running'))}; refresh_count={int(runtime.get('refresh_count') or 0)}; last_error={runtime.get('last_error') or 'none'}",
        evidence={"runtime": runtime},
    )
    add(
        "snapshot",
        "Fresh market snapshot",
        _status(snapshot_fresh, generated_at_ms is not None),
        f"age={snapshot_age_s if snapshot_age_s is not None else 'none'}s; expected_refresh={refresh_seconds}s; quotes={len(quotes)}",
        evidence={"generated_at_ms": generated_at_ms, "age_s": snapshot_age_s, "quotes": len(quotes)},
    )
    source_status = (
        "ok"
        if sources and source_bad == 0 and source_degraded == 0
        else "warn"
        if sources and (source_ok + source_degraded) > 0
        else "fail"
    )
    add(
        "source_health",
        "Declared live sources",
        source_status,
        f"sources={len(sources)}; ok={source_ok}; degraded={source_degraded}; error/pending={source_bad}",
        evidence={"sources": sources},
    )
    add(
        "moex_live",
        "MOEX ISS live universe",
        _status(len(moex) > 0),
        f"all={len(moex)}; stocks={len(moex_stocks)}; futures={len(moex_futures)}",
        evidence={"all": len(moex), "stocks": len(moex_stocks), "futures": len(moex_futures)},
    )
    add(
        "moex_price_turnover",
        "MOEX price / turnover",
        _status(present(moex, "last") > 0 and present(moex, "turnover_24h") > 0, len(moex) > 0),
        f"price={present(moex, 'last')}/{len(moex)}; turnover={present(moex, 'turnover_24h')}/{len(moex)}",
        evidence={
            "price_ratio": _ratio(present(moex, "last"), len(moex)),
            "turnover_ratio": _ratio(present(moex, "turnover_24h"), len(moex)),
        },
    )
    add(
        "moex_micro_basic",
        "MOEX best bid/ask + NUMTRADES + trading status",
        _status(
            present(moex, "bid") > 0
            and present(moex, "ask") > 0
            and num_trades > 0
            and trading_status > 0,
            len(moex) > 0,
        ),
        f"bid={present(moex, 'bid')}; ask={present(moex, 'ask')}; NUMTRADES={num_trades}; trading_status={trading_status}",
        evidence={
            "bid_ratio": _ratio(present(moex, "bid"), len(moex)),
            "ask_ratio": _ratio(present(moex, "ask"), len(moex)),
            "num_trades_ratio": _ratio(num_trades, len(moex)),
        },
    )
    add(
        "moex_oi",
        "MOEX futures open interest",
        _status(present(moex_futures, "open_interest") > 0, len(moex_futures) > 0),
        f"OI={present(moex_futures, 'open_interest')}/{len(moex_futures)} futures",
        evidence={"oi_ratio": _ratio(present(moex_futures, "open_interest"), len(moex_futures))},
    )
    add(
        "history",
        "Historical candle Data Lake",
        _status(int(lake.get("rows") or 0) > 0, True),
        f"rows={int(lake.get('rows') or 0):,}; files={int(lake.get('files') or 0)}; bad_files={len(lake.get('bad_files') or [])}",
        evidence={"rows": lake.get("rows"), "files": lake.get("files"), "bad_files": lake.get("bad_files") or []},
    )
    add(
        "metric_lake",
        "Derivative Metric Lake",
        _status(metric_rows > 0, True),
        f"points={metric_rows:,}; derivative_points={derivative_points:,}; futoi_points={futoi_points:,}",
        evidence={"metrics": metrics},
    )
    add(
        "futoi",
        "MOEX FUTOI participant aggregate",
        _status(futoi_points > 0, True),
        f"points={futoi_points:,}; public/unauthorized history is delayed and is not treated as realtime",
        evidence={"futoi_points": futoi_points},
    )
    add(
        "lchi",
        "LCHI public participants / portfolios",
        _status(int(lchi.get("participants_discovered") or 0) > 0, True),
        f"participants={int(lchi.get('participants_discovered') or 0):,}; portfolios={int(lchi.get('participants_with_portfolio') or 0):,}; position_events={int(lchi.get('position_events') or 0):,}",
        evidence=lchi,
    )
    add(
        "lchi_trades",
        "LCHI exact public trade history",
        _status(int(lchi.get("public_trades") or 0) > 0, True),
        f"public_trades={int(lchi.get('public_trades') or 0):,}; participants={int(lchi.get('participants_with_trades') or 0):,}",
        evidence={
            "public_trades": lchi.get("public_trades"),
            "participants_with_trades": lchi.get("participants_with_trades"),
            "last_public_trade_ts_ms": lchi.get("last_public_trade_ts_ms"),
        },
    )
    pulse_profiles = int(pulse.get("profiles_tracked") or 0)
    add(
        "pulse",
        "T-Bank Pulse public profiles",
        "ok" if pulse_profiles > 0 and int(pulse.get("profiles_synced") or 0) > 0 else "not_configured" if pulse_profiles == 0 else "warn",
        f"tracked={pulse_profiles}; synced={int(pulse.get('profiles_synced') or 0)}; events={int(pulse.get('events') or 0)}; hidden quantity is never inferred",
        evidence=pulse,
        required=False,
    )
    add(
        "remote",
        "Private remote node",
        _status(bool(remote.get("ready")) and bool(remote.get("loopback_only"))),
        f"ready={bool(remote.get('ready'))}; tailscale={bool(remote.get('tailscale_online'))}; serve={bool(remote.get('serve_configured'))}; loopback_only={bool(remote.get('loopback_only'))}",
        evidence=remote,
    )
    update_ok = bool(update.get("available")) and not bool(update.get("dirty")) and not update.get("reason")
    bridge = remote.get("ai_bridge") or {}
    bridge_task = remote.get("ai_bridge_task") or {}
    add(
        "ai_bridge",
        "ChatGPT runtime bridge -> Google Drive",
        _status(
            bool(bridge.get("fresh")) and bool(bridge.get("drive_connected")),
            bool(bridge_task.get("installed")) or bool(bridge.get("configured")),
        ),
        f"task={bool(bridge_task.get('installed'))}; drive={bool(bridge.get('drive_connected'))}; fresh={bool(bridge.get('fresh'))}; age={bridge.get('age_s') if bridge.get('age_s') is not None else 'none'}s",
        evidence={"task": bridge_task, "state": bridge},
    )

    add(
        "updates",
        "Safe automatic Git update path",
        _status(update_ok, bool(update.get("available"))),
        f"branch={update.get('branch') or 'none'}; dirty={bool(update.get('dirty'))}; behind={int(update.get('behind') or 0)}; reason={update.get('reason') or 'none'}",
        evidence={
            "branch": update.get("branch"),
            "head": update.get("head"),
            "remote_head": update.get("remote_head"),
            "behind": update.get("behind"),
            "ahead": update.get("ahead"),
            "dirty": update.get("dirty"),
            "reason": update.get("reason"),
            "execution": update.get("execution"),
        },
    )

    # Explicitly surface important layers that are not yet collected so the
    # phrase "all possible data" can never be silently interpreted as complete.
    add(
        "moex_l2",
        "MOEX full L2 order book / depth history",
        "missing",
        "Not a current canonical collector. Best bid/ask is collected; persistent full-depth/L2 history is still a roadmap layer.",
        required=False,
    )
    add(
        "moex_trade_tape",
        "MOEX tick-by-tick public trade tape",
        "missing",
        "NUMTRADES/cumulative activity is collected, but a canonical tick-by-tick trade tape is not yet persisted.",
        required=False,
    )
    add(
        "corporate_events",
        "Corporate actions / issuer events / broad Russian news",
        "partial",
        "Some event/news plumbing exists, but this is not yet a complete canonical MOEX corporate-event feed.",
        required=False,
    )

    recent_errors: list[dict[str, Any]] = []
    for item in recent_logs:
        try:
            row = item.model_dump(mode="json")
        except Exception:
            row = dict(item) if isinstance(item, dict) else {"value": str(item)}
        if str(row.get("level") or "").lower() in {"error", "warning"}:
            recent_errors.append(row)
        if len(recent_errors) >= 30:
            break

    required = [x for x in checks if x.get("required")]
    failures = [x for x in required if x["status"] == "fail"]
    warnings = [x for x in required if x["status"] == "warn"]
    overall = "FAIL" if failures else "WARN" if warnings else "OK"

    return {
        "format": "TQS_RUNTIME_AUDIT_V1",
        "generated_at_ms": now,
        "version": version,
        "overall": overall,
        "runtime": runtime,
        "snapshot": {
            "generated_at_ms": generated_at_ms,
            "age_s": snapshot_age_s,
            "fresh": snapshot_fresh,
            "quotes": len(quotes),
            "provider_counts": dict(provider_counts),
            "market_counts": dict(market_counts),
        },
        "sources": sources,
        "storage": storage,
        "data_lake": lake,
        "research": lab,
        "participants": {"lchi": lchi, "pulse": pulse},
        "remote_node": remote,
        "update": {
            "available": update.get("available"),
            "branch": update.get("branch"),
            "head": update.get("head"),
            "remote_head": update.get("remote_head"),
            "behind": update.get("behind"),
            "ahead": update.get("ahead"),
            "dirty": update.get("dirty"),
            "reason": update.get("reason"),
            "execution": update.get("execution"),
        },
        "checks": checks,
        "recent_errors": recent_errors,
        "missing_or_partial_layers": [
            x for x in checks if x["status"] in {"missing", "partial", "not_configured"}
        ],
        "scope_note_ru": (
            "Аудит подтверждает только реально наблюдаемые слои текущего TQS. "
            "Он специально не утверждает, что собраны «все возможные данные рынка»: "
            "отсутствующие/частичные слои перечислены явно."
        ),
    }


def audit_text(audit: dict[str, Any]) -> str:
    lines = [
        "TQS LIVE AUDIT",
        f"generated_at_ms: {audit.get('generated_at_ms')}",
        f"version: {audit.get('version')}",
        f"overall: {audit.get('overall')}",
        "",
        "CHECKS",
    ]
    for row in audit.get("checks") or []:
        lines.append(f"[{str(row.get('status') or '').upper()}] {row.get('title')}: {row.get('detail')}")
    errors = audit.get("recent_errors") or []
    if errors:
        lines += ["", "RECENT WARNINGS / ERRORS"]
        for row in errors[:20]:
            lines.append(
                f"{row.get('level','')} {row.get('component','')}: "
                f"{row.get('message') or row.get('text') or ''}"
            )
    lines += [
        "",
        "AI NOTE",
        str(audit.get("scope_note_ru") or ""),
    ]
    return "\n".join(lines) + "\n"
