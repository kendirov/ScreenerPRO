from __future__ import annotations

import polars as pl

from tqs_intelligence.strategy_discovery import default_minute_discovery_spec, run_conditional_entry


def _frame(n: int = 520) -> pl.DataFrame:
    rows = []
    base = 100.0
    start = 1_790_000_000_000
    for i in range(n):
        wave = ((i % 40) - 20) * 0.015
        trend = i * 0.002
        close = base + trend + wave
        open_ = close - 0.01
        rows.append({
            "ts_ms": start + i * 60_000,
            "open": open_,
            "high": close + 0.08,
            "low": close - 0.08,
            "close": close,
            "volume": 1000 + (i % 17) * 35,
        })
    return pl.DataFrame(rows)


def test_minute_baseline_is_descriptive_and_has_trace():
    spec = default_minute_discovery_spec()
    result = run_conditional_entry(spec, "moex:shares:SBER", _frame())

    assert result.status == "inconclusive"
    assert result.metrics["baseline_every_bar"] is True
    assert result.round_events > 100
    assert result.trade_trace
    assert result.control_trace
    assert result.diagnostics["by_hour_msk"]
    assert any("baseline" in warning.lower() for warning in result.warnings)


def test_conditional_filter_creates_separate_nonbaseline_run():
    spec = default_minute_discovery_spec().model_copy(deep=True)
    spec.id = "TQS-TEST-CONDITIONAL"
    spec.filters["volume_z_gte"] = -999.0
    spec.filters["hours_msk"] = list(range(24))
    result = run_conditional_entry(spec, "moex:shares:SBER", _frame())

    assert result.metrics["baseline_every_bar"] is False
    assert result.round_events > 100
    assert result.splits["exploration"]["strategy"]["n"] > 0
    assert result.splits["validation"]["strategy"]["n"] > 0
    assert result.splits["holdout"]["strategy"]["n"] > 0
    assert "anti_overfit" in result.robustness


def test_default_minute_discovery_does_not_auto_run_full_universe():
    spec = default_minute_discovery_spec()
    assert spec.interval == "1m"
    assert spec.event["type"] == "conditional_entry"
    assert spec.filters["auto_run"] is False
