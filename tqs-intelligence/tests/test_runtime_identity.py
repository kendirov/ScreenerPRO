from tqs_intelligence import __version__
from tqs_intelligence.api import RUNTIME_INSTANCE_ID, _identity, account_service, app, health, lab, pulse_service, research_runtime, store


def test_api_version_matches_package():
    assert app.version == __version__


def test_runtime_identity_is_consistent():
    identity = _identity()
    assert identity["platform"] == "TQS"
    assert identity["module"] == "TQS Intelligence"
    assert identity["version"] == __version__
    assert identity["runtime_instance_id"] == RUNTIME_INSTANCE_ID
    assert identity["pid"] > 0
    assert identity["started_at_ms"] > 0



async def test_health_is_independent_from_heavy_database_stats(monkeypatch):
    def fail(*_args, **_kwargs):
        raise AssertionError("heavy stats must not run inside /api/health")

    monkeypatch.setattr(store, "stats", fail)
    monkeypatch.setattr(lab, "stats", fail)
    monkeypatch.setattr(research_runtime, "status", fail)
    monkeypatch.setattr(account_service, "status", fail)
    monkeypatch.setattr(pulse_service, "status", fail)

    payload = await health()
    assert payload["ok"] is True
    assert payload["storage"]["deferred"] is True
    assert payload["lab"]["deferred"] is True
    assert "last_action" in payload["research_runtime"]
    assert "last_action" in payload["account_intelligence"]

[executed on device: Kendirov (dbeba00d-0e72-4d4e-b51c-17d1d4fb9e1f)]