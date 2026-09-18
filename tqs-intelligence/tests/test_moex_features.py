from __future__ import annotations

from tqs_intelligence.models import AssetClass, Quote
from tqs_intelligence.moex_features import DAY_MS, MoexFeatureEngine
from tqs_intelligence.storage import DuckStore


def quote(ts: int, *, turnover: float, volume: float, trades: int, price: float = 100.0) -> Quote:
    return Quote(
        provider="moex",
        venue="MOEX",
        symbol="SBER",
        display_symbol="Сбербанк",
        asset_class=AssetClass.STOCK,
        market_type="shares",
        currency="RUB",
        last=price,
        bid=99.99,
        ask=100.01,
        volume_24h=volume,
        turnover_24h=turnover,
        change_24h_pct=0.1,
        ts_ms=ts,
        observed_at_ms=ts,
        meta={"num_trades": trades, "board": "TQBR"},
    )


def test_moex_engine_detects_same_time_activity_and_absorption(tmp_path):
    store = DuckStore(str(tmp_path / "tqs.duckdb"))
    now = 1_800_000_000_000

    # Ten prior sessions: normal cumulative activity at the same Moscow minute.
    for day in range(1, 11):
        q = quote(now - day * DAY_MS, turnover=100.0, volume=100.0, trades=100)
        store.persist_snapshot([q], [], [])

    # Same-day point 15 minutes earlier keeps price nearly unchanged.
    prev = quote(now - 15 * 60_000, turnover=900.0, volume=900.0, trades=900, price=100.0)
    store.persist_snapshot([prev], [], [])

    current = quote(now, turnover=3000.0, volume=3000.0, trades=3000, price=100.05)
    engine = MoexFeatureEngine(store)
    anomalies = engine.analyze([current])

    assert anomalies
    item = anomalies[0]
    assert item.symbol == "SBER"
    assert "moex_turnover_tod" in item.signals
    assert "moex_absorption" in item.signals
    assert any("оборот к этому времени" in reason for reason in item.reasons)

    row = engine.snapshot()["rows"][0]
    assert row["turnover_tod_ratio"] >= 20
    assert row["baseline_days"] >= 10
    assert abs(row["ret_15m_pct"]) < 0.1


def test_quiet_moex_instrument_is_not_promoted(tmp_path):
    store = DuckStore(str(tmp_path / "tqs.duckdb"))
    now = 1_800_000_000_000
    for day in range(1, 8):
        store.persist_snapshot([quote(now - day * DAY_MS, turnover=100, volume=100, trades=100)], [], [])
    store.persist_snapshot([quote(now - 15 * 60_000, turnover=90, volume=90, trades=90)], [], [])

    engine = MoexFeatureEngine(store)
    anomalies = engine.analyze([quote(now, turnover=105, volume=105, trades=105, price=100.02)])
    assert anomalies == []
