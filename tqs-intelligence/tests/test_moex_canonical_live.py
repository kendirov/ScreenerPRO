import asyncio

from tqs_intelligence.moex_features import MoexFeatureEngine
from tqs_intelligence.models import AssetClass, Quote
from tqs_intelligence.moex_source import MoexSourceV04


class FakeHttp:
    def __init__(self, payload):
        self.payload = payload

    async def get_json(self, *args, **kwargs):
        return self.payload


def section(columns, rows):
    return {"columns": columns, "data": rows}


def test_moex_shares_prefer_primary_board_over_active_smal():
    payload = {
        "securities": section(
            ["SECID", "BOARDID", "SHORTNAME", "CURRENCYID"],
            [
                ["GAZP", "SMAL", "GAZP odd", "RUB"],
                ["GAZP", "TQBR", "Газпром", "RUB"],
            ],
        ),
        "marketdata": section(
            ["SECID", "BOARDID", "LAST", "MARKETPRICE", "BID", "OFFER",
             "VALTODAY", "VOLTODAY", "NUMTRADES", "TRADINGSTATUS"],
            [
                ["GAZP", "SMAL", 97.28, 97.20, 97.28, 97.29, 999999, 1000, 100, "T"],
                ["GAZP", "TQBR", None, 95.50, 96.00, 96.10, 0, 0, 0, "S"],
            ],
        ),
    }
    source = MoexSourceV04(FakeHttp(payload))
    rows = asyncio.run(source._fetch_market("stock", "shares", AssetClass.STOCK, "shares"))

    assert len(rows) == 1
    q = rows[0]
    assert q.canonical_id == "moex:shares:GAZP"
    assert q.meta["board"] == "TQBR"
    assert q.display_symbol == "Газпром"
    assert q.last == 95.50
    assert q.meta["trading_status"] == "S"


def test_moex_live_intelligence_is_available_before_history():
    engine = MoexFeatureEngine(store=None)
    q = Quote(
        provider="moex", venue="MOEX", symbol="SBER", display_symbol="Сбербанк",
        asset_class=AssetClass.STOCK, market_type="shares", currency="RUB",
        last=280.0, bid=279.9, ask=280.1, turnover_24h=0,
        ts_ms=1, observed_at_ms=1,
        meta={"board": "TQBR", "trading_status": "S"},
    )

    engine.publish_live([q], [])
    snap = engine.snapshot()

    assert snap["count"] == 1
    row = snap["rows"][0]
    assert row["canonical_id"] == "moex:shares:SBER"
    assert row["board"] == "TQBR"
    assert row["history_status"] == "warming"
    assert row["baseline_days"] == 0
    assert "не в активной торговой сессии" in row["reasons"][0]



def test_moex_lchi_enrichment_never_waits_for_busy_collector():
    import threading
    import time
    from types import SimpleNamespace

    lock = threading.Lock()
    lock.acquire()
    try:
        class NeverQuery:
            def execute(self, *args, **kwargs):
                raise AssertionError("busy LCHI store must not be queried")

        engine = MoexFeatureEngine(
            store=None,
            lchi_store=SimpleNamespace(_lock=lock, _con=NeverQuery()),
        )
        started = time.perf_counter()
        result = engine._lchi_flows(["SBER", "SiZ6"], 1_000_000)
        elapsed = time.perf_counter() - started
        assert result == {}
        assert elapsed < 0.05
    finally:
        lock.release()
