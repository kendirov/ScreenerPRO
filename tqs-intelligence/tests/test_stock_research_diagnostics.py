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


def test_build_research_payload_calls_diagnostics():
    from types import SimpleNamespace
    from tqs_intelligence.instrument_lab import InstrumentLab

    class Store:
        def list_episodes(self, **kwargs):
            return []

    class Lab:
        def list_strategy_runs_for_instrument(self, canonical_id, limit):
            return []

    obj = object.__new__(InstrumentLab)
    obj.store = Store()
    obj.lab = Lab()
    obj.lake = None
    obj.metric_lake = None

    quote = SimpleNamespace(canonical_id="moex:shares:SBER", symbol="SBER")
    out = obj.build_research("moex:shares:SBER", SimpleNamespace(quotes=[quote]))
    assert out["canonical_id"] == "moex:shares:SBER"
    assert out["deep_coverage"] == {"episodes": 0, "strategy_runs": 0, "trade_records": 0}
    assert out["diagnostics"]["research_readiness"]["ready"] is False


def test_build_research_payload_slims_large_trade_trace():
    from types import SimpleNamespace
    from tqs_intelligence.instrument_lab import InstrumentLab

    class Store:
        def list_episodes(self, **kwargs):
            return []

    class FakeRun:
        def model_dump(self, mode="json"):
            trades = [
                {
                    "entry_ts_ms": i * 600000,
                    "net_return_pct": 0.1 if i % 2 == 0 else -0.05,
                    "mfe_pct": 0.2,
                    "mae_pct": -0.1,
                    "exit_policy": "hold",
                    "exit_reason": "time",
                    "side": "long",
                    "split": "validation",
                }
                for i in range(2000)
            ]
            return {
                "run_id": "r-big",
                "strategy_id": "s",
                "canonical_id": "moex:shares:SBER",
                "interval": "10m",
                "generated_at_ms": 1,
                "status": "candidate",
                "events": 4000,
                "round_events": 2000,
                "control_events": 2000,
                "trade_trace": trades,
                "control_trace": trades,
            }

    class Lab:
        def list_strategy_runs_for_instrument(self, canonical_id, limit):
            return [FakeRun()]

    obj = object.__new__(InstrumentLab)
    obj.store = Store()
    obj.lab = Lab()
    obj.lake = None
    obj.metric_lake = None

    quote = SimpleNamespace(canonical_id="moex:shares:SBER", symbol="SBER")
    out = obj.build_research("moex:shares:SBER", SimpleNamespace(quotes=[quote]))
    run = out["strategy_runs"][0]
    assert "trade_trace" not in run
    assert "control_trace" not in run
    assert len(run["recent_trade_trace"]) == 120
    assert len(run["equity_curve"]) <= 600
    assert len(run["control_equity_curve"]) <= 600
    assert run["trace_counts"] == {"event": 2000, "control": 2000}
    assert out["diagnostics"]["strategy"]["trace_coverage"]["trade_records"] == 2000
