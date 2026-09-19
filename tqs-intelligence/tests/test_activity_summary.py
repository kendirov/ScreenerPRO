from __future__ import annotations

import json
import time
from pathlib import Path

from tqs_intelligence.lab_store import LabStore


def test_recent_job_activity_uses_finished_or_updated_time(tmp_path: Path) -> None:
    lab = LabStore(str(tmp_path / "lab.sqlite3"))
    now = int(time.time() * 1000)
    recent = lab.enqueue_job("historical_backfill", "recently finished", {"symbol": "BTCUSDT"})
    old = lab.enqueue_job("historical_backfill", "old finished", {"symbol": "ETHUSDT"})

    with lab._lock:
        lab._con.execute(
            """update research_jobs
               set created_at_ms=?, updated_at_ms=?, finished_at_ms=?, status='done', progress=1, result_json=?
               where id=?""",
            [now - 48 * 3_600_000, now - 5 * 60_000, now - 5 * 60_000, json.dumps({"rows": 123}), recent.id],
        )
        lab._con.execute(
            """update research_jobs
               set created_at_ms=?, updated_at_ms=?, finished_at_ms=?, status='done', progress=1, result_json=?
               where id=?""",
            [now - 72 * 3_600_000, now - 48 * 3_600_000, now - 48 * 3_600_000, json.dumps({"rows": 456}), old.id],
        )
        lab._con.commit()

    rows = lab.recent_job_activity(now - 24 * 3_600_000)
    ids = {row["id"] for row in rows}
    assert recent.id in ids
    assert old.id not in ids
    row = next(row for row in rows if row["id"] == recent.id)
    assert row["status"] == "done"
    assert row["result"]["rows"] == 123
    assert row["finished_at_ms"] == now - 5 * 60_000
