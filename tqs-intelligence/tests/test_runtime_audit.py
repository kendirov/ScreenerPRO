from __future__ import annotations

import time
from types import SimpleNamespace

from tqs_intelligence.runtime_audit import audit_text, build_runtime_audit


class Dumpable:
    def __init__(self, **values):
        self.values = values

    def model_dump(self, mode="json"):
        return dict(self.values)


def _quote(*, market_type: str, oi: float | None = None):
    return SimpleNamespace(
        provider="moex",
        market_type=market_type,
        last=100.0,
        turnover_24h=1_000_000.0,
        bid=99.9,
        ask=100.1,
        open_interest=oi,
        meta={"num_trades": 100, "trading_status": "T"},
    )


def test_runtime_audit_proves_declared_layers_without_claiming_everything():
    now = int(time.time() * 1000)
    snapshot = SimpleNamespace(
        generated_at_ms=now,
        quotes=[_quote(market_type="shares"), _quote(market_type="forts", oi=5000)],
        source_health=[Dumpable(provider="moex", status="ok", instruments=2, latency_ms=25)],
    )
    audit = build_runtime_audit(
        version="0.12.0",
        runtime={"running": True, "refresh_count": 12, "refresh_seconds": 60, "last_error": None},
        snapshot=snapshot,
        storage={"quote_snapshots": 100},
        lake={
            "rows": 10_000,
            "files": 10,
            "bad_files": [],
            "metrics": {
                "rows": 5000,
                "metrics": {
                    "futoi_fiz_net_contracts": 1000,
                    "futoi_yur_net_contracts": 1000,
                    "open_interest": 1500,
                    "funding_rate": 1500,
                },
            },
        },
        lab={"queued_jobs": 1, "running_jobs": 0},
        lchi={
            "participants_discovered": 100,
            "participants_with_portfolio": 50,
            "position_events": 500,
            "public_trades": 1000,
            "participants_with_trades": 10,
        },
        pulse={"profiles_tracked": 0, "profiles_synced": 0, "events": 0},
        remote={
            "ready": True,
            "loopback_only": True,
            "tailscale_online": True,
            "serve_configured": True,
            "ai_bridge_task": {"installed": True},
            "ai_bridge": {"fresh": True, "drive_connected": True, "configured": True, "age_s": 30},
        },
        update={"available": True, "dirty": False, "behind": 0, "ahead": 0, "branch": "integration", "reason": None},
        recent_logs=[],
    )

    assert audit["overall"] == "OK"
    by_key = {row["key"]: row for row in audit["checks"]}
    assert by_key["moex_live"]["status"] == "ok"
    assert by_key["futoi"]["status"] == "ok"
    assert by_key["pulse"]["status"] == "not_configured"
    assert by_key["moex_l2"]["status"] == "missing"
    assert by_key["moex_trade_tape"]["status"] == "missing"
    assert audit["missing_or_partial_layers"]
    assert "не утверждает" in audit["scope_note_ru"]


def test_runtime_audit_fails_when_live_snapshot_is_missing():
    audit = build_runtime_audit(
        version="0.12.0",
        runtime={"running": True, "refresh_count": 0, "refresh_seconds": 60, "last_error": None},
        snapshot=None,
        storage={},
        lake={"rows": 0, "files": 0, "bad_files": [], "metrics": {"rows": 0, "metrics": {}}},
        lab={},
        lchi={},
        pulse={},
        remote={
            "ready": True,
            "loopback_only": True,
            "ai_bridge_task": {"installed": True},
            "ai_bridge": {"fresh": True, "drive_connected": True, "configured": True, "age_s": 30},
        },
        update={"available": True, "dirty": False, "behind": 0, "branch": "integration", "reason": None},
        recent_logs=[Dumpable(level="warning", component="market-data", message="no snapshot")],
    )

    assert audit["overall"] == "FAIL"
    assert audit["snapshot"]["fresh"] is False
    assert any(row["key"] == "snapshot" and row["status"] == "fail" for row in audit["checks"])
    text = audit_text(audit)
    assert "TQS LIVE AUDIT" in text
    assert "MARKET-DATA" not in text  # formatting stays literal, no invented taxonomy
