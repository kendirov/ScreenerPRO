import asyncio

from tqs_intelligence.models import AssetClass
from tqs_intelligence.sources import MarketSource, MoexSource


def test_moex_section_dynamic_columns():
    payload = {"marketdata": {"columns": ["SECID", "LAST", "VOLTODAY"], "data": [["SBER", 300.5, 1000]]}}
    assert MoexSource._section(payload) == [{"SECID": "SBER", "LAST": 300.5, "VOLTODAY": 1000}]


def test_moex_capability_lists_core_segments():
    obj = object.__new__(MoexSource)
    cap = MoexSource.capability(obj, True)
    assert "FORTS" in cap["markets"]
    assert "Валютный рынок" in cap["markets"]
    assert AssetClass.BOND.value in cap["asset_classes"]


class Partial(MarketSource):
    provider = "partial"
    name = "Partial"

    async def fetch_quotes(self):
        async def ok():
            return []

        async def bad():
            raise RuntimeError("boom")

        return await self._gather_parts((("ok", ok()), ("bad", bad())))


def test_partial_source_reports_error_when_all_parts_empty_or_failed():
    rows, health = asyncio.run(Partial().collect())
    assert rows == []
    assert health.status.value == "error"
    assert "boom" in (health.error or "")
