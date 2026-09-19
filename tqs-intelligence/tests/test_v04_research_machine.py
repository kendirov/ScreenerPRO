from __future__ import annotations

import math
from pathlib import Path

import polars as pl

from tqs_intelligence.control import ControlCenter
from tqs_intelligence.lake import DataLake
from tqs_intelligence.models import Candle
from tqs_intelligence.replay import HistoricalReplayEngine
from tqs_intelligence.strategy_machine import StrategyMachine, default_round_buffer_spec


def synthetic_frame(n: int = 2500) -> pl.DataFrame:
    rows=[]
    base_ts=1_700_000_000_000
    prev=100.0
    for i in range(n):
        # Repeated approaches/crosses of 100/105 create round-level episodes.
        close=100.0 + 5.2*math.sin(i/13.0) + 0.7*math.sin(i/3.7)
        if i and i % 160 == 0:
            close += 3.5
        open_=prev
        high=max(open_,close)+0.25
        low=min(open_,close)-0.25
        volume=1000.0 + (6500.0 if i % 160 in (0,1) else 150.0*abs(math.sin(i/5)))
        rows.append({'ts_ms':base_ts+i*600_000,'open':open_,'high':high,'low':low,'close':close,'volume':volume,'turnover':volume*close})
        prev=close
    return pl.DataFrame(rows)


def test_control_center_persists_modes(tmp_path: Path):
    c=ControlCenter(str(tmp_path/'control.json'))
    c.update(mode='max',data_lake_root=str(tmp_path/'lake'),drive_export_root=str(tmp_path/'drive'))
    c2=ControlCenter(str(tmp_path/'control.json'))
    assert c2.get().mode == 'max'
    assert c2.status()['heavy_allowed'] is True
    assert Path(c2.get().data_lake_root).exists()


def test_data_lake_and_historical_replay(tmp_path: Path):
    lake=DataLake(str(tmp_path/'lake'))
    frame=synthetic_frame(1800)
    candles=[Candle(provider='moex',canonical_id='moex:shares:TEST',interval='10m',ts_ms=int(r['ts_ms']),
                    open=float(r['open']),high=float(r['high']),low=float(r['low']),close=float(r['close']),
                    volume=float(r['volume']),turnover=float(r['turnover']),source='test') for r in frame.to_dicts()]
    written=lake.write_candles(candles)
    assert written['rows_ingested'] == len(candles)
    assert lake.verify()['bad_files'] == []
    result=HistoricalReplayEngine(lake).run('moex:shares:TEST','10m',threshold=35.0,baseline_window=48)
    assert result['bars'] == len(candles)
    assert result['events'] > 0
    assert result['status'] in {'movement_candidate','inconclusive','rejected'}
    assert Path(result['summary_path']).exists()


def test_round_buffer_strategy_has_controls_and_splits():
    frame=synthetic_frame(2600)
    spec=default_round_buffer_spec()
    spec.validation['min_events']=10
    result=StrategyMachine().run(spec,'moex:shares:TEST',frame)
    assert result.round_events > 0
    assert result.control_events > 0
    assert set(result.splits) == {'exploration','validation','holdout'}
    assert 'walk_forward' in result.robustness
    assert result.status in {'candidate','inconclusive','rejected'}
