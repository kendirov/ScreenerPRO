import polars as pl

from tqs_intelligence.strategy_machine import StrategyMachine, default_scheduled_entry_spec
from tqs_intelligence.strategy_models import StrategyRunResult


def _frame(n: int = 720) -> pl.DataFrame:
    start = 1767571200000  # 2026-01-05 00:00 UTC
    rows = []
    price = 100.0
    for i in range(n):
        ts = start + i * 10 * 60 * 1000
        # deterministic intraday texture plus a small drift
        wave = ((i % 18) - 9) * 0.015
        o = price
        c = o + 0.025 + wave * 0.08
        h = max(o, c) + 0.08
        l = min(o, c) - 0.08
        rows.append({
            "ts_ms": ts,
            "open": o,
            "high": h,
            "low": l,
            "close": c,
            "volume": 1000 + (i % 25) * 20,
            "turnover": (1000 + (i % 25) * 20) * c,
        })
        price = c
    return pl.DataFrame(rows)


def test_scheduled_entry_produces_frozen_trade_and_control_trace():
    spec = default_scheduled_entry_spec()
    spec.validation["min_events"] = 10
    result = StrategyMachine().run(spec, "moex:shares:SMLT", _frame())

    assert result.events > 0
    assert result.trade_trace
    assert result.control_trace
    assert result.metrics["selected_exit_policy"] in {"hold", "scale_out_25_25_50"}
    assert set(x["split"] for x in result.trade_trace) <= {"exploration", "validation", "holdout"}
    assert any(x["split"] == "holdout" for x in result.trade_trace)

    row = result.trade_trace[0]
    for key in (
        "signal_ts_ms", "entry_ts_ms", "exit_ts_ms", "side",
        "entry_price", "exit_price", "gross_return_pct", "net_return_pct",
        "mfe_pct", "mae_pct", "split", "exit_reason", "exit_policy", "context",
    ):
        assert key in row
    assert row["entry_ts_ms"] >= row["signal_ts_ms"]
    assert row["exit_ts_ms"] > row["entry_ts_ms"]
    assert row["is_control"] is False
    assert all(x["is_control"] is True for x in result.control_trace)


def test_strategy_run_old_payload_remains_backward_compatible():
    old = {
        "run_id": "R-OLD",
        "strategy_id": "S",
        "canonical_id": "moex:shares:SBER",
        "interval": "10m",
        "generated_at_ms": 1,
        "status": "inconclusive",
        "events": 0,
    }
    restored = StrategyRunResult.model_validate(old)
    assert restored.trade_trace == []
    assert restored.control_trace == []
