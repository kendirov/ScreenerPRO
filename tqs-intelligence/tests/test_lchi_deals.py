from tqs_intelligence.lchi_deals import LchiDealsCollector, parse_deals_csv
from tqs_intelligence.lchi_public import LchiPublicStore


def test_parse_public_lchi_deals_csv_semicolon():
    text = """Дата сделки;Тикер;Операция;Количество;Цена;Рынок
18.09.2026 10:15:30;SBER;Покупка;100;301,25;Фондовый
18.09.2026 10:17:00;BRZ6;Продажа;2;68,42;Срочный
"""
    parsed = parse_deals_csv("u1", text)
    assert len(parsed["rows"]) == 2
    assert parsed["rows"][0]["symbol"] == "SBER"
    assert parsed["rows"][0]["side"] == "buy"
    assert parsed["rows"][0]["quantity"] == 100
    assert parsed["rows"][0]["price"] == 301.25
    assert parsed["rows"][0]["ts_ms"] is not None


def test_lchi_deals_persist_exact_trade_evidence(tmp_path):
    store = LchiPublicStore(str(tmp_path / "lchi.sqlite3"))
    store.upsert_participants([{
        "userId":"u1","login":"Trader","brokerCode":"TEST","ranking":1,
        "totalProfit":1,"totalYield":2,"totalStartAssets":1000,"totalDeals":10,
        "eqYield":1,"fortsYield":1,"fxYield":0,"assets":[]
    }], 1000)

    class DummyHttp:
        pass

    collector = LchiDealsCollector(store, DummyHttp())
    parsed = parse_deals_csv(
        "u1",
        "Дата сделки;Тикер;Операция;Количество;Цена\n18.09.2026 10:15:30;SBER;Покупка;100;301,25\n",
    )
    result = collector._persist("u1", parsed)
    assert result["trades_added"] == 1
    rows = collector.trades(symbol="SBER")
    assert rows[0]["login"] == "Trader"
    assert rows[0]["quantity"] == 100
    assert rows[0]["price"] == 301.25



def test_lchi_deals_candidates_do_not_block_event_loop(tmp_path):
    import asyncio
    import time

    store = LchiPublicStore(str(tmp_path / "lchi.sqlite3"))

    class DummyHttp:
        pass

    collector = LchiDealsCollector(store, DummyHttp())

    def slow_candidates(limit=1, stale_ms=6 * 3_600_000):
        time.sleep(0.15)
        return []

    collector.candidates = slow_candidates

    async def scenario():
        started = time.perf_counter()
        task = asyncio.create_task(collector.sync_batch(1))
        await asyncio.sleep(0.02)
        elapsed = time.perf_counter() - started
        await task
        assert elapsed < 0.10

    asyncio.run(scenario())
