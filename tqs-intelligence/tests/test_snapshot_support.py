from types import SimpleNamespace

from tqs_intelligence.snapshot_export import _diagnose, _redact_account_id, _redact_value


def test_support_redacts_secrets_and_wallets():
    wallet = "0x1234567890abcdef1234567890abcdef12345678"
    payload = {
        "api_key": "secret-value",
        "nested": {"text": f"wallet={wallet}", "normal": 42},
    }
    safe = _redact_value(payload)
    assert safe["api_key"] == "[REDACTED]"
    assert wallet not in safe["nested"]["text"]
    assert "[REDACTED_ACCOUNT]" in safe["nested"]["text"]
    assert safe["nested"]["normal"] == 42


def test_account_ref_is_stable_but_not_raw():
    wallet = "0x1234567890abcdef1234567890abcdef12345678"
    first = _redact_account_id("hyperliquid", wallet)
    second = _redact_account_id("hyperliquid", wallet)
    assert first == second
    assert wallet not in first
    assert first.startswith("hyperliquid:acct-")


def test_diagnosis_marks_dead_runtime_error():
    runtime = {"running": False, "last_error": "collector failed", "refresh_seconds": 60}
    research = {"mode": "max", "running_jobs": 0, "queued_jobs": 0, "auto_history": {"remaining": 0}}
    result = _diagnose(runtime, research, None)
    assert result["overall"] == "ERROR"
    assert result["snapshot_stale"] is True


def test_diagnosis_accepts_fresh_healthy_snapshot():
    import time

    now = int(time.time() * 1000)
    snapshot = SimpleNamespace(generated_at_ms=now, source_health=[])
    runtime = {"running": True, "last_error": None, "refresh_seconds": 60}
    research = {"mode": "light", "running_jobs": 0, "queued_jobs": 0, "last_error": None}
    result = _diagnose(runtime, research, snapshot)
    assert result["overall"] == "OK"
    assert result["snapshot_stale"] is False
