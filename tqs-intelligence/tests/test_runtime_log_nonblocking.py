import time

from tqs_intelligence.models import RuntimeLog
from tqs_intelligence.storage import DuckStore


def test_runtime_log_does_not_block_when_analytical_store_is_busy(tmp_path):
    store = DuckStore(str(tmp_path / "runtime-log.duckdb"))
    item = RuntimeLog(
        ts_ms=1,
        level="info",
        component="test",
        message="nonblocking",
        details={},
    )

    assert store._lock.acquire(timeout=0.1)
    try:
        started = time.perf_counter()
        store.append_log(item)
        elapsed = time.perf_counter() - started
    finally:
        store._lock.release()

    assert elapsed < 0.25
