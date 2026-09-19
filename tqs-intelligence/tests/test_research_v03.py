from tqs_intelligence.engine import IntelligenceEngine
from tqs_intelligence.models import AssetClass, AnomalyEpisode, EpisodeOutcome, Quote
from tqs_intelligence.research import build_research_findings


def quote(symbol: str, change: float, turnover: float) -> Quote:
    return Quote(provider="test", venue="TEST", symbol=symbol, asset_class=AssetClass.CRYPTO,
                 market_type="spot", last=100, bid=99.9, ask=100.1, change_24h_pct=change,
                 turnover_24h=turnover, ts_ms=1, observed_at_ms=1)


def episode(i: int) -> AnomalyEpisode:
    return AnomalyEpisode(id=f"A-{i}", canonical_id=f"test:spot:X{i}", provider="test", symbol=f"X{i}",
                          asset_class=AssetClass.CRYPTO, market_type="spot", opened_at_ms=i,
                          last_seen_ms=i + 1, closed_at_ms=i + 2, status="closed", first_score=80,
                          peak_score=90, last_score=75, trigger_price=100, last_price=103,
                          direction="up", pattern_key="crypto:spot:up:price_move_extreme+turnover_extreme",
                          signals=["price_move_extreme", "turnover_extreme"], reasons=["test"], hits=3)


def test_engine_emits_machine_readable_signals():
    rows = [quote(f"X{i}", i * 0.1, 1000 + i) for i in range(20)] + [quote("OUT", 15, 5_000_000)]
    result = IntelligenceEngine().analyze(rows)
    assert result[0].symbol == "OUT"
    assert "price_move_extreme" in result[0].signals
    assert "turnover_extreme" in result[0].signals


def test_research_gate_requires_sample():
    items = [(episode(i), EpisodeOutcome(episode_id=f"A-{i}", trigger_price=100,
             returns_pct={"1h": 2.0, "4h": 3.0}, actual_ts_ms={}, complete=True)) for i in range(10)]
    finding = build_research_findings(items, 1000)[0]
    assert finding.status == "watch"


def test_research_can_promote_large_stable_sample():
    items = [(episode(i), EpisodeOutcome(episode_id=f"A-{i}", trigger_price=100,
             returns_pct={"1h": 1.5, "4h": 2.5}, actual_ts_ms={}, complete=True)) for i in range(25)]
    finding = build_research_findings(items, 1000)[0]
    assert finding.status == "candidate"
