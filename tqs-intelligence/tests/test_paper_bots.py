from types import SimpleNamespace

import pytest

from tqs_intelligence.lab_store import LabStore
from tqs_intelligence.paper_bots import PaperBotService
from tqs_intelligence.strategy_models import StrategyRunResult, StrategySpec


def _spec():
    return StrategySpec(
        id="S-ROUND",name_ru="Paper round",idea="test",interval="5m",
        event={"type":"round_buffer_bounce","buffer_bps_candidates":[10],"reset_bars":2},
        entry={"type":"next_bar_open_after_first_touch","direction":"rejection"},
        exit={"type":"time","horizon_bars":1},
        costs={"round_trip_bps":10.0},
    )


def _run(status="candidate"):
    return StrategyRunResult(
        run_id="RUN-1" if status=="candidate" else "RUN-X",
        strategy_id="S-ROUND",canonical_id="binance:usdt-futures:TESTUSDT",
        interval="5m",generated_at_ms=1,status=status,events=100,
        round_events=50,control_events=50,
        metrics={"selected_spacing":100.0,"selected_buffer_bps":10.0},
    )


def _snapshot(ts,price):
    q=SimpleNamespace(canonical_id="binance:usdt-futures:TESTUSDT",last=price)
    return SimpleNamespace(generated_at_ms=ts,quotes=[q])
def test_candidate_run_can_execute_paper_trade(tmp_path):
    lab=LabStore(str(tmp_path/"lab.sqlite3"))
    lab.save_strategy(_spec()); lab.save_strategy_run(_run())
    latest={"value":None}
    svc=PaperBotService(lab,lambda:latest["value"],poll_seconds=2)
    bot=svc.create_from_run("RUN-1")
    assert bot.status=="draft"
    assert bot.mode=="paper" and bot.live_allowed is False
    bot=svc.set_status(bot.id,"armed")
    assert bot.status=="armed"

    svc.evaluate_snapshot(_snapshot(1_000_000,102.0))
    svc.evaluate_snapshot(_snapshot(1_060_000,100.05))
    setups=lab.list_paper_signals(bot.id,20)
    assert any(x.kind=="setup" for x in setups)

    svc.evaluate_snapshot(_snapshot(1_120_000,100.20))
    open_trades=lab.list_paper_trades(bot.id,"open",10)
    assert len(open_trades)==1 and open_trades[0].side=="long"

    svc.evaluate_snapshot(_snapshot(1_420_000,101.00))
    assert not lab.list_paper_trades(bot.id,"open",10)
    closed=lab.list_paper_trades(bot.id,"closed",10)
    assert len(closed)==1 and closed[0].pnl_pct is not None and closed[0].pnl_pct>0
    kinds={x.kind for x in lab.list_paper_signals(bot.id,20)}
    assert {"setup","entry","exit"}.issubset(kinds)


def test_rejected_run_is_blocked(tmp_path):
    lab=LabStore(str(tmp_path/"lab.sqlite3"))
    lab.save_strategy(_spec()); lab.save_strategy_run(_run("rejected"))
    svc=PaperBotService(lab,lambda:None)
    bot=svc.create_from_run("RUN-X")
    assert bot.status=="blocked"
    assert bot.live_allowed is False
    with pytest.raises(ValueError):
        svc.set_status(bot.id,"armed")
