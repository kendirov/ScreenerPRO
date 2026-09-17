from types import SimpleNamespace

from tqs_intelligence.metric_autopilot import build_metric_plan, metric_key
from tqs_intelligence.models import AssetClass, Quote


def quote(symbol: str, turnover: float) -> Quote:
    return Quote(
        provider="bybit", venue="Bybit", symbol=symbol,
        asset_class=AssetClass.FUTURE, market_type="linear",
        turnover_24h=turnover, open_interest=turnover / 10,
        ts_ms=1_700_000_000_000, observed_at_ms=1_700_000_000_000,
    )


def test_metric_plan_ranks_and_avoids_duplicate_jobs():
    quotes = [quote("ETHUSDT", 200), quote("BTCUSDT", 500), quote("SOLUSDT", 100)]
    existing_payload = {"provider": "bybit", "symbol": "BTCUSDT", "market_type": "linear", "start_ms": 1609459200000}
    jobs = [SimpleNamespace(kind="derivative_metric_backfill", payload=existing_payload, status="done")]
    payloads, stats = build_metric_plan(quotes, jobs, batch_size=2)
    assert [x["symbol"] for x in payloads] == ["ETHUSDT", "SOLUSDT"]
    assert stats["target_total"] == 3
    assert stats["known_total"] == 1
    assert stats["done"] == 1
    assert metric_key(payloads[0]) == ("bybit", "ETHUSDT", "linear")


def test_metric_plan_ignores_spot_and_non_bybit():
    spot = quote("BTCUSDT", 1000).model_copy(update={"market_type": "spot"})
    binance = quote("BTCUSDT", 2000).model_copy(update={"provider": "binance", "venue": "Binance", "market_type": "usdt-futures"})
    payloads, stats = build_metric_plan([spot, binance], [], batch_size=2)
    assert payloads == []
    assert stats["target_total"] == 0
