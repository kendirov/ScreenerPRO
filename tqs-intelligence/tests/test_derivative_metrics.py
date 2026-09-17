from pathlib import Path

from tqs_intelligence.derivative_metrics import (
    parse_binance_basis,
    parse_binance_funding,
    parse_binance_open_interest,
    parse_bybit_funding,
    parse_bybit_open_interest,
    parse_moex_futoi,
)
from tqs_intelligence.metric_lake import MetricLake, MetricPoint


def test_metric_lake_round_trip(tmp_path: Path):
    lake = MetricLake(tmp_path)
    cid = "binance:usdt-futures:BTCUSDT"
    rows = [
        MetricPoint(provider="binance", canonical_id=cid, metric="funding_rate", ts_ms=1_700_000_000_000, value=0.0001, unit="ratio"),
        MetricPoint(provider="binance", canonical_id=cid, metric="funding_rate", ts_ms=1_700_028_800_000, value=-0.0002, unit="ratio"),
    ]
    assert lake.write(rows)["rows_ingested"] == 2
    result = lake.read(cid, "funding_rate")
    assert len(result) == 2
    assert result[0]["value"] == 0.0001
    assert lake.count(cid, "funding_rate") == 2
    bounds = lake.bounds(cid, "funding_rate")
    assert bounds["rows"] == 2
    assert bounds["first_ms"] == 1_700_000_000_000
    assert bounds["last_ms"] == 1_700_028_800_000


def test_binance_metric_parsers_keep_units_and_limits():
    cid = "binance:usdt-futures:BTCUSDT"
    funding = parse_binance_funding([
        {"symbol": "BTCUSDT", "fundingRate": "0.0001", "fundingTime": 1_700_000_000_000, "markPrice": "43000"}
    ], cid)
    assert any(x.metric == "funding_rate" and x.unit == "ratio" for x in funding)
    assert any(x.metric == "funding_mark_price" for x in funding)

    oi = parse_binance_open_interest([
        {"symbol": "BTCUSDT", "sumOpenInterest": "20403.5", "sumOpenInterestValue": "176196512.1", "timestamp": 1_700_000_000_000}
    ], cid)
    assert {x.metric for x in oi} == {"open_interest", "open_interest_value"}
    assert all(x.meta["history_limit"] == "latest_1_month" for x in oi)

    basis = parse_binance_basis([
        {"pair": "BTCUSDT", "contractType": "PERPETUAL", "basisRate": "0.0004", "basis": "13.94", "indexPrice": "34400", "futuresPrice": "34414", "timestamp": 1_700_000_000_000}
    ], cid)
    assert "basis_rate" in {x.metric for x in basis}
    assert "basis" in {x.metric for x in basis}


def test_bybit_parsers_keep_provider_specific_provenance():
    cid = "bybit:linear:BTCUSDT"
    oi = parse_bybit_open_interest([
        {"symbol": "BTCUSDT", "openInterest": "12345.67", "timestamp": "1700000000000", "intervalTime": "5min"}
    ], cid)
    assert len(oi) == 1
    assert oi[0].provider == "bybit"
    assert oi[0].metric == "open_interest"
    assert oi[0].source == "bybit-v5-open-interest"
    assert oi[0].meta["interval"] == "5min"

    funding = parse_bybit_funding([
        {"symbol": "BTCUSDT", "fundingRate": "0.00012", "fundingRateTimestamp": "1700000000000"}
    ], cid)
    assert len(funding) == 1
    assert funding[0].provider == "bybit"
    assert funding[0].metric == "funding_rate"
    assert funding[0].unit == "ratio"
    assert funding[0].source == "bybit-v5-funding-history"


def test_moex_futoi_parser_preserves_raw_short_and_normalizes_display_magnitude():
    block = {
        "columns": ["sess_id", "ticker", "clgroup", "pos", "pos_long", "pos_short", "pos_long_num", "pos_short_num", "seqnum", "tradedate", "tradetime", "systime"],
        "data": [
            [5991, "BR", "FIZ", 368523, 516380, -147857, 9477, 3671, 1, "2026-09-01", "19:44:32", "2026-09-01 19:45:13"],
            [5991, "BR", "YUR", -368523, 90772, -459295, 107, 46, 1, "2026-09-01", "19:44:32", "2026-09-01 19:45:13"],
        ],
    }
    points = parse_moex_futoi(block, "moex:futoi:BR", delayed=True)
    by_metric = {x.metric: x for x in points}
    assert by_metric["futoi_fiz_short_contracts"].value == 147857
    assert by_metric["futoi_fiz_net_contracts"].value == 368523
    assert by_metric["futoi_yur_net_contracts"].value == -368523
    assert by_metric["futoi_fiz_short_contracts"].meta["raw_pos_short"] == -147857
    assert by_metric["futoi_fiz_short_contracts"].meta["delayed"] is True
