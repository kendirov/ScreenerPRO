from __future__ import annotations

from tqs_intelligence.lchi_public import LchiPublicStore
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


def test_lchi_flow_is_batched_and_preserves_root_family_semantics(tmp_path):
    lchi = LchiPublicStore(str(tmp_path / "lchi.sqlite3"))
    now = 1_800_000_000_000
    rows = [
        ("e1", "u1", now - 1_000, "SBER", "stock", "increased", 10, 20, 10, 100, "x", "public_account"),
        ("e2", "u2", now - 2_000, "RI-9.26", "forts", "opened", 0, 3, 3, 100, "x", "public_account"),
        ("e3", "u3", now - 3_000, "RI-12.26", "forts", "opened", 0, -2, -2, 100, "x", "public_account"),
    ]
    with lchi._lock:
        lchi._con.executemany("insert into lchi_position_events values(?,?,?,?,?,?,?,?,?,?,?,?)", rows)
        lchi._con.commit()

    engine = MoexFeatureEngine(None, lchi_store=lchi)
    flows = engine._lchi_flows(["SBER", "RI-9.26"], now)

    assert flows["SBER"]["events"] == 1
    assert flows["SBER"]["changed_accounts"] == 1
    assert flows["RI-9.26"]["events"] == 2
    assert flows["RI-9.26"]["changed_accounts"] == 2
    assert flows["RI-9.26"]["long_increase_accounts"] == 1
    assert flows["RI-9.26"]["short_increase_accounts"] == 1



def test_moex_history_reader_does_not_wait_for_primary_writer_lock(tmp_path):
    from concurrent.futures import ThreadPoolExecutor

    store = DuckStore(str(tmp_path / "mvcc.duckdb"))
    now = 1_800_000_000_000
    store.persist_snapshot(
        [quote(now - 15 * 60_000, turnover=100, volume=100, trades=100)],
        [], [],
    )
    engine = MoexFeatureEngine(store)
    current = quote(now, turnover=110, volume=110, trades=110)

    store._lock.acquire()
    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(engine.analyze, [current])
            result = future.result(timeout=1.0)
    finally:
        store._lock.release()

    assert isinstance(result, list)
    assert engine.snapshot()["count"] == 1
