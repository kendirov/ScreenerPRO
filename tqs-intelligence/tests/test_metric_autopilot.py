from types import SimpleNamespace

from tqs_intelligence.metric_autopilot import METRIC_QUOTAS, build_metric_plan, metric_key
from tqs_intelligence.models import AssetClass, Quote


def bybit_quote(symbol: str, turnover: float) -> Quote:
    return Quote(
        provider="bybit", venue="Bybit", symbol=symbol,
        asset_class=AssetClass.FUTURE, market_type="linear",
        turnover_24h=turnover, open_interest=turnover / 10,
        ts_ms=1_700_000_000_000, observed_at_ms=1_700_000_000_000,
    )


def test_metric_plan_ranks_and_avoids_duplicate_jobs():
    quotes = [bybit_quote("ETHUSDT", 200), bybit_quote("BTCUSDT", 500), bybit_quote("SOLUSDT", 100)]
    existing_payload = {"provider": "bybit", "symbol": "BTCUSDT", "market_type": "linear", "start_ms": 1609459200000}
    jobs = [SimpleNamespace(kind="derivative_metric_backfill", payload=existing_payload, status="done")]
    payloads, stats = build_metric_plan(quotes, jobs, batch_size=2)
    assert [x["symbol"] for x in payloads] == ["ETHUSDT", "SOLUSDT"]
    assert stats["target_total"] == 3
    assert stats["known_total"] == 1
    assert stats["done"] == 1
    assert metric_key(payloads[0]) == ("bybit", "ETHUSDT", "linear")


def test_metric_plan_accepts_binance_and_ignores_spot():
    spot = bybit_quote("BTCUSDT", 1000).model_copy(update={"market_type": "spot"})
    binance = bybit_quote("BTCUSDT", 2000).model_copy(update={"provider": "binance", "venue": "Binance", "market_type": "usdt-futures"})
    payloads, stats = build_metric_plan([spot, binance], [], batch_size=2)
    assert len(payloads) == 1
    assert payloads[0]["provider"] == "binance"
    assert stats["target_total"] == 1


def test_metric_plan_deduplicates_moex_contracts_by_underlying():
    first = bybit_quote("BRU6", 1000).model_copy(update={"provider":"moex","venue":"MOEX FORTS","market_type":"forts","asset_class":AssetClass.FUTURE})
    second = bybit_quote("BRZ6", 500).model_copy(update={"provider":"moex","venue":"MOEX FORTS","market_type":"forts","asset_class":AssetClass.FUTURE})
    payloads, stats = build_metric_plan([first, second], [], batch_size=5)
    assert len(payloads) == 1
    assert payloads[0]["provider"] == "moex"
    assert payloads[0]["symbol"] == "BR"
    assert stats["buckets"]["moex:forts"]["target"] == 1
    assert METRIC_QUOTAS[("moex","forts")] >= 1
