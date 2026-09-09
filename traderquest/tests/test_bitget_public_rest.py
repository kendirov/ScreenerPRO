import asyncio
import unittest
from decimal import Decimal
from traderquest.adapters.bitget.errors import BitgetApiError, BitgetProtocolError, UnsupportedMarketCapability
from traderquest.adapters.bitget.http import BitgetHttpResponse
from traderquest.adapters.bitget.public_rest import BitgetPublicRestAdapter
from traderquest.market.models import MarketType, QuantityUnit, InstrumentKey, Provider

class FakeTransport:
    def __init__(self, responses): self.responses = responses; self.calls = []
    async def get(self, path, params):
        self.calls.append((path, params)); return self.responses[path]

def response(data, code="00000"):
    return BitgetHttpResponse({"code": code, "msg": "ok", "requestTime": 999, "data": data}, 999, 2000, 1)

class RestTests(unittest.TestCase):
    def test_public_shapes_and_semantics(self):
        fake=FakeTransport({
            "/api/v3/market/instruments":response([{"symbol":"BTCUSDT","baseCoin":"BTC","quoteCoin":"USDT"}]),
            "/api/v3/market/tickers":response([{"symbol":"BTCUSDT","lastPrice":"100","ts":"123"}]),
            "/api/v3/market/orderbook":response({"a":[["101","2"]],"b":[["99","3"]],"ts":"124"}),
            "/api/v3/market/fills":response([{"execId":"x","price":"100","size":"2","side":"buy","ts":"125"}]),
            "/api/v3/market/open-interest":response({"list":[{"symbol":"BTCUSDT","openInterest":"4"}],"ts":"126"}),
            "/api/v3/market/current-fund-rate":response([{"symbol":"BTCUSDT","fundingRate":"0.01","nextUpdate":"127"}]),
            "/api/v3/market/liquidations":response({"list":[]}),
        })
        adapter=BitgetPublicRestAdapter(fake); key=InstrumentKey(Provider.BITGET,MarketType.USDT_FUTURES,"BTCUSDT")
        async def run():
            self.assertEqual(len(await adapter.get_instruments(MarketType.USDT_FUTURES,"BTCUSDT")),1)
            ticker=await adapter.get_ticker(key); self.assertEqual(ticker.event_time_ms,123); self.assertEqual(ticker.observed_at_ms,2000)
            self.assertIsNone((await adapter.get_order_book(key)).sequence)
            self.assertEqual((await adapter.get_recent_trades(key))[0].payload.quantity_unit,QuantityUnit.BASE_ASSET)
            self.assertEqual((await adapter.get_open_interest(key)).event_time_ms,126)
            self.assertEqual((await adapter.get_current_funding(key)).payload.funding_rate, Decimal("0.01"))
            self.assertEqual(await adapter.get_recent_liquidations(key),[])
        asyncio.run(run())
    def test_capability_and_protocol_errors(self):
        fake=FakeTransport({"/api/v3/market/tickers":response([],"10001")})
        adapter=BitgetPublicRestAdapter(fake); margin=InstrumentKey(Provider.BITGET,MarketType.MARGIN,"BTCUSDT")
        async def run():
            with self.assertRaises(UnsupportedMarketCapability): await adapter.get_ticker(margin)
            with self.assertRaises(BitgetApiError): await adapter.get_ticker(InstrumentKey(Provider.BITGET,MarketType.SPOT,"BTCUSDT"))
            with self.assertRaises(ValueError): await adapter.get_order_book(margin,0)
        asyncio.run(run())

if __name__ == "__main__": unittest.main()
