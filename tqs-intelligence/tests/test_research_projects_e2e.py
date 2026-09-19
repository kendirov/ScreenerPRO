import math
import time

from tqs_intelligence.lab_store import LabStore
from tqs_intelligence.lake import DataLake
from tqs_intelligence.metric_lake import MetricLake, MetricPoint
from tqs_intelligence.models import Candle
from tqs_intelligence.research_experiments import ResearchExperimentEngine
from tqs_intelligence.strategy_machine import StrategyMachine
from tqs_intelligence.strategy_models import ResearchProject


def _project(now: int) -> ResearchProject:
    return ResearchProject(
        id="TQS-TEST-OI",
        title="price flat / OI up",
        hypothesis="future move distribution differs",
        event={"family":"price_oi_divergence","price_abs_return_max_bps":20,"oi_change_percentile":0.80,"lookback_bars":3},
        instruments=["binance:usdt-futures:TESTUSDT"],
        data_requirements=["price","open_interest"],
        controls=["flat OI"],
        regimes=["trend/range"],
        horizons=["5m","15m","1h"],
        validation={"min_events":20,"oos_required":True,"multiple_testing":True,"walk_forward":True},
        created_at_ms=now,updated_at_ms=now,
    )


def test_price_oi_research_and_persistence(tmp_path):
    lake=DataLake(str(tmp_path/"lake"))
    metrics=MetricLake(tmp_path/"lake")
    lab=LabStore(str(tmp_path/"lab.sqlite3"))
    cid="binance:usdt-futures:TESTUSDT"
    start=1_700_000_000_000
    candles=[]; points=[]
    oi=1000.0
    for i in range(900):
        ts=start+i*300_000
        px=100.0+0.01*math.sin(i/7)
        if i % 6 == 0:
            oi *= 1.015
        candles.append(Candle(provider="binance",canonical_id=cid,interval="5m",ts_ms=ts,
            open=px,high=px*1.0005,low=px*0.9995,close=px,
            volume=1000+i,turnover=(1000+i)*px,source="test"))
        points.append(MetricPoint(provider="binance",canonical_id=cid,metric="open_interest",
            ts_ms=ts,value=oi,unit="contracts",source="test"))
    lake.write_candles(candles)
    metrics.write(points)
    now=int(time.time()*1000)
    project=_project(now)
    lab.save_research_project(project)
    engine=ResearchExperimentEngine(lake,metrics,lab,StrategyMachine())
    result=engine.run(project,cid)
    assert result.sample_count >= 20
    assert result.control_count > 0
    assert result.coverage["open_interest_points"] == 900
    assert "holdout" in result.splits
    assert result.metrics["primary_horizon"] == "1h"
    lab.save_research_run(result)
    saved=lab.list_research_runs(project.id,cid,10)
    assert len(saved) == 1
    assert saved[0].run_id == result.run_id
    assert lab.stats()["research_runs"] == 1
