from tqs_intelligence.stock_research_diagnostics import (
    build_anomaly_diagnostics,
    build_instrument_diagnostics,
    build_trade_diagnostics,
)


def test_trade_diagnostics_group_hour_weekday_and_exit_policy():
    monday_0700_utc = 1766386800000  # 2025-12-22 07:00 UTC -> 10:00 MSK
    rows = [
        {"entry_ts_ms": monday_0700_utc, "net_return_pct": 1.0, "symbol": "SMLT", "exit_policy": "hold", "exit_reason": "time", "mfe_pct": 1.8, "mae_pct": -0.4},
        {"entry_ts_ms": monday_0700_utc + 3_600_000, "net_return_pct": -0.5, "symbol": "SMLT", "exit_policy": "scale_out", "exit_reason": "stop", "mfe_pct": 0.2, "mae_pct": -0.8},
    ]
    out = build_trade_diagnostics(rows)
    assert out["trades"] == 2
    assert out["overall"]["mean"] == 0.25
    assert {x["key"] for x in out["by_hour_msk"]} == {"10:00", "11:00"}
    assert {x["key"] for x in out["by_exit_policy"]} == {"hold", "scale_out"}


def test_anomaly_diagnostics_collect_reason_and_outcome():
    out = build_anomaly_diagnostics(
        [{"episode": {"reasons": ["volume_shock"]}, "outcome": {"return_60m_pct": 2.0}}],
        [{"ts_ms": 1, "score": 91, "severity": "high", "reasons": ["delta_imbalance"]}],
    )
    assert out["episodes"] == 1
    assert out["completed_outcomes"] == 1
    assert out["outcomes"]["return_60m_pct"]["median"] == 2.0
    assert {x["name"] for x in out["reasons"]} >= {"volume_shock", "delta_imbalance"}


def test_workspace_declares_trace_gap_without_trade_records():
    out = build_instrument_diagnostics(
        episode_rows=[{"episode": {"reasons": ["move_z"]}, "outcome": None}],
        scores=[],
        strategy_runs=[{"run_id": "r1", "status": "candidate", "sample_count": 20, "control_count": 60}],
    )
    assert out["strategy"]["sample_total"] == 20
    assert out["strategy"]["control_total"] == 60
    assert "trade_level_trace_for_hour_weekday_exit_diagnostics" in out["research_readiness"]["missing"]
