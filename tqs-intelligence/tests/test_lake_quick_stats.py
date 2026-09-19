from __future__ import annotations

from pathlib import Path

from tqs_intelligence.lake import DataLake


def test_quick_stats_reports_cached_file_coverage_without_row_scan(tmp_path):
    lake = DataLake(str(tmp_path))
    history = tmp_path / "history" / "provider=moex" / "instrument=moex_shares_SBER" / "interval=1m" / "year=2026" / "month=09"
    metrics = tmp_path / "metrics" / "provider=moex" / "instrument=moex_forts_Si" / "metric=futoi_fiz_net_contracts" / "year=2026" / "month=09"
    history.mkdir(parents=True)
    metrics.mkdir(parents=True)
    (history / "candles.parquet").write_bytes(b"not-opened-by-quick-stats")
    (metrics / "data.parquet").write_bytes(b"not-opened-by-quick-stats")

    refreshed = lake.refresh_quick_stats()
    state = lake.quick_stats()

    assert refreshed["files"] == 1
    assert state["stats_mode"] == "cached"
    assert state["files"] == 1
    assert state["rows"] is None
    assert state["metrics"]["files"] == 1
    assert state["metrics"]["metric_files"]["futoi_fiz_net_contracts"] == 1
