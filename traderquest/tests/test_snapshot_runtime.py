import asyncio
import unittest
from decimal import Decimal
from traderquest.market.models import *
from traderquest.runtime.snapshot import SnapshotStatus, capture_market_snapshot

class FakeAdapter:
    def __init__(self, fail=None): self.fail=fail; self.calls=[]; self.market_type=None
    def _event(self, kind):
        key=InstrumentKey(Provider.BITGET,self.market_type,"BTCUSDT"); src=SourceRef(Provider.BITGET,"UTA v3",Transport.REST,"/x")
        return EventEnvelope("1",kind,key,src,None,2,None,None,DataQuality.OK,Freshness.UNKNOWN,None)
    async def get_instruments(self, market_type, symbol=None): self.market_type=market_type; self.calls.append("instruments"); return [self._event(EventKind.INSTRUMENT)]
    async def _get(self, name, kind):
        self.calls.append(name)
        if self.fail == name: raise RuntimeError(name)
        return [] if name == "liquidations" else self._event(kind)
    async def get_ticker(self, i): return await self._get("ticker",EventKind.TICKER)
    async def get_order_book(self, i, limit=5): return await self._get("orderbook",EventKind.ORDER_BOOK)
    async def get_recent_trades(self, i, limit=100): return await self._get("trades",EventKind.TRADE)
    async def get_open_interest(self, i): return await self._get("open_interest",EventKind.OPEN_INTEREST)
    async def get_current_funding(self, i): return await self._get("funding",EventKind.FUNDING)
    async def get_recent_liquidations(self, i, limit=100): return await self._get("liquidations",EventKind.LIQUIDATION)

class SnapshotTests(unittest.TestCase):
    def test_futures_complete_and_partial(self):
        key=InstrumentKey(Provider.BITGET,MarketType.USDT_FUTURES,"BTCUSDT")
        async def run():
            complete=await capture_market_snapshot(FakeAdapter(),key); self.assertEqual(complete.status,SnapshotStatus.COMPLETE); self.assertEqual(complete.events[0].kind, EventKind.INSTRUMENT)
            partial=await capture_market_snapshot(FakeAdapter("funding"),key); self.assertEqual(partial.status,SnapshotStatus.PARTIAL); self.assertEqual(partial.errors[0].capability,"funding"); self.assertTrue(partial.events)
        asyncio.run(run())
    def test_spot_skips_futures_only_calls(self):
        key=InstrumentKey(Provider.BITGET,MarketType.SPOT,"BTCUSDT"); adapter=FakeAdapter()
        async def run():
            result=await capture_market_snapshot(adapter,key); self.assertEqual(result.status,SnapshotStatus.COMPLETE); self.assertNotIn("open_interest",adapter.calls); self.assertNotIn("funding",adapter.calls); self.assertNotIn("liquidations",adapter.calls)
        asyncio.run(run())

if __name__ == "__main__": unittest.main()
