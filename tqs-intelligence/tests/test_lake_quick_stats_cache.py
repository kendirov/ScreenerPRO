from pathlib import Path

from tqs_intelligence.lake import DataLake


def test_quick_stats_does_not_scan_lake(tmp_path, monkeypatch):
    lake = DataLake(str(tmp_path / "lake"))

    def fail_glob(self, pattern):
        raise AssertionError(f"quick_stats must not scan: {pattern}")

    monkeypatch.setattr(Path, "glob", fail_glob)
    stats = lake.quick_stats()

    assert stats["stats_mode"] == "cached"
    assert stats["rows"] is None


def test_refresh_quick_stats_populates_persistent_cache(tmp_path):
    root = tmp_path / "lake"
    lake = DataLake(str(root))
    history = root / "history" / "provider=moex" / "instrument=SBER" / "interval=5m" / "year=2026" / "month=09"
    metric = root / "metrics" / "metric=open_interest" / "provider=bybit"
    history.mkdir(parents=True)
    metric.mkdir(parents=True)
    (history / "candles.parquet").touch()
    (metric / "data.parquet").touch()

    refreshed = lake.refresh_quick_stats()

    assert refreshed["files"] == 1
    assert refreshed["metrics"]["files"] == 1
    assert refreshed["metrics"]["metric_files"]["open_interest"] == 1
    assert refreshed["cached_at_ms"] is not None
    assert lake.quick_stats_cache_path.exists()

    reloaded = DataLake(str(root)).quick_stats()
    assert reloaded["files"] == 1
    assert reloaded["metrics"]["files"] == 1
    assert reloaded["stats_mode"] == "cached"
