from tqs_intelligence.engine import IntelligenceEngine
from tqs_intelligence.models import AssetClass, Quote


def q(symbol: str, change: float, turnover: float, spread: float = 0.1, oi: float | None = None) -> Quote:
    return Quote(provider="test", venue="TEST", symbol=symbol, asset_class=AssetClass.CRYPTO,
                 market_type="spot", last=100, bid=100-spread/2, ask=100+spread/2,
                 change_24h_pct=change, turnover_24h=turnover, open_interest=oi,
                 ts_ms=1, observed_at_ms=1)


def test_outlier_ranks_above_normal_market():
    rows = [q(f"X{i}", i * 0.1, 1_000 + i * 10) for i in range(20)]
    rows.append(q("OUT", 18.0, 5_000_000))
    result = IntelligenceEngine().analyze(rows)
    assert result[0].symbol == "OUT"
    assert result[0].score >= 80
    assert any("движение" in reason for reason in result[0].reasons)


def test_high_turnover_alone_is_not_an_anomaly():
    rows = [q(f"X{i}", 0.1 + i * 0.01, 10_000 + i * 100) for i in range(30)]
    rows.append(q("LIQUID", 0.12, 100_000_000))
    symbols = {x.symbol for x in IntelligenceEngine().analyze(rows)}
    assert "LIQUID" not in symbols


def test_high_open_interest_alone_is_context_not_trigger():
    rows = [q(f"X{i}", 0.1 + i * 0.01, 10_000 + i * 100, oi=1_000 + i * 10) for i in range(30)]
    rows.append(q("BIG_OI", 0.12, 12_000, oi=100_000_000))
    symbols = {x.symbol for x in IntelligenceEngine().analyze(rows)}
    assert "BIG_OI" not in symbols


def test_canonical_ids_keep_provider_and_market():
    quote = q("BTCUSDT", 1, 1000)
    assert quote.canonical_id == "test:spot:BTCUSDT"


def test_relationship_miner_finds_lead_lag():
    from tqs_intelligence.relationships import mine_relationships
    import math
    left_prices = [100.0]
    right_prices = [100.0]
    signal = [0.01 if i % 3 == 0 else -0.006 if i % 3 == 1 else 0.002 for i in range(45)]
    for i, r in enumerate(signal):
        left_prices.append(left_prices[-1] * math.exp(r))
        prev_signal = signal[i-1] if i > 0 else 0.0
        right_prices.append(right_prices[-1] * math.exp(prev_signal))
    rows = mine_relationships({"left": list(enumerate(left_prices)), "right": list(enumerate(right_prices))}, min_samples=20)
    assert any(x.relation == "left_leads_right" and x.coefficient > 0.9 for x in rows)
