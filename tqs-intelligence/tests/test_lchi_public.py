from tqs_intelligence.lchi_public import LchiPublicStore


def participant(uid="u1", login="Trader", ranking=1, deals=10):
    return {
        "userId": uid,
        "login": login,
        "brokerCode": "TEST",
        "ranking": ranking,
        "totalProfit": 100,
        "totalYield": 10,
        "totalStartAssets": 1000,
        "totalDeals": deals,
        "eqYield": 1,
        "fortsYield": 9,
        "fxYield": 0,
        "assets": [{"seccode": "SBER"}],
    }


def test_lchi_catalog_and_position_events(tmp_path):
    store = LchiPublicStore(str(tmp_path / "lchi.sqlite3"))
    store.upsert_participants([participant()], 1000)
    assert store.stats()["participants_discovered"] == 1

    first = {
        "positions": [
            {
                "market": "EQ",
                "seccode": "SBER",
                "price": 300,
                "quantity": 100,
                "estimatedValue": 30000,
                "discountEstimatedValue": 30000,
                "balance": 0,
            }
        ]
    }
    r1 = store.save_portfolio("u1", first, 2000)
    assert r1["positions"] == 1
    assert r1["events"] == 1
    events = store.events("SBER")
    assert events[0]["event_type"] == "opened"
    assert events[0]["current_qty"] == 100

    second = {
        "positions": [
            {
                "market": "EQ",
                "seccode": "SBER",
                "price": 305,
                "quantity": 150,
                "estimatedValue": 45750,
                "discountEstimatedValue": 45750,
                "balance": 0,
            }
        ]
    }
    r2 = store.save_portfolio("u1", second, 3000)
    assert r2["events"] == 1
    events = store.events("SBER")
    assert events[0]["event_type"] == "increased"
    assert events[0]["delta_qty"] == 50

    rows = store.current_positions("SBER")
    assert rows[0]["login"] == "Trader"
    assert rows[0]["quantity"] == 150
    assert rows[0]["evidence_level"] == "public_account"


def test_lchi_detects_flip_and_close(tmp_path):
    store = LchiPublicStore(str(tmp_path / "lchi.sqlite3"))
    store.upsert_participants([participant()], 1000)
    store.save_portfolio("u1", {"positions": [{"market": "FORTS", "seccode": "BR-11.26", "quantity": 2, "price": 80}]}, 2000)
    store.save_portfolio("u1", {"positions": [{"market": "FORTS", "seccode": "BR-11.26", "quantity": -3, "price": 79}]}, 3000)
    assert store.events("BR-11.26")[0]["event_type"] == "flipped"
    store.save_portfolio("u1", {"positions": []}, 4000)
    assert store.events("BR-11.26")[0]["event_type"] == "closed"


def test_lchi_portfolio_candidates_prioritize_unsynced_rank(tmp_path):
    store = LchiPublicStore(str(tmp_path / "lchi.sqlite3"))
    store.upsert_participants([participant("u2", "Second", 2), participant("u1", "First", 1)], 1000)
    rows = store.portfolio_candidates(2)
    assert [x["user_id"] for x in rows] == ["u1", "u2"]



def test_lchi_portfolio_candidates_do_not_block_event_loop(tmp_path):
    import asyncio
    import time

    from tqs_intelligence.lchi_public import LchiPublicService

    store = LchiPublicStore(str(tmp_path / "lchi.sqlite3"))

    class DummyHttp:
        pass

    service = LchiPublicService(None, store, DummyHttp())

    def slow_candidates(limit, stale_after_ms=6 * 3600_000):
        time.sleep(0.15)
        return []

    store.portfolio_candidates = slow_candidates

    async def scenario():
        started = time.perf_counter()
        task = asyncio.create_task(service._portfolio_batch(1))
        await asyncio.sleep(0.02)
        elapsed = time.perf_counter() - started
        await task
        assert elapsed < 0.10

    asyncio.run(scenario())
