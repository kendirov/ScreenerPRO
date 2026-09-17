from tqs_intelligence import __version__
from tqs_intelligence.api import RUNTIME_INSTANCE_ID, _identity, app


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
