import unittest
from decimal import Decimal
from traderquest.adapters.bitget.normalizer import *
from traderquest.market.models import *

class NormalizerTests(unittest.TestCase):
    def test_categories_and_ticker_units(self):
        self.assertEqual(market_type("SPOT"),MarketType.SPOT); self.assertEqual(market_type("USDT-FUTURES"),MarketType.USDT_FUTURES)
        with self.assertRaises(ValueError): market_type("UNKNOWN")
        e=normalize_ticker({"symbol":"BTCUSDT","lastPrice":"100.5","price24hPcnt":"0.012","ts":"1700000000000"},"SPOT",1700000000100)
        self.assertEqual(e.payload.change_24h_ratio,Decimal("0.012")); self.assertEqual(e.event_time_ms,1700000000000); self.assertEqual(e.observed_at_ms,1700000000100)
        self.assertIsNone(normalize_funding({"symbol":"BTCUSDT"},"USDT-FUTURES",2).payload.funding_rate)
        self.assertIsNone(normalize_open_interest({"symbol":"BTCUSDT"},"USDT-FUTURES",2).payload.open_interest)
    def test_invalid_and_books(self):
        with self.assertRaises(ValueError): normalize_ticker({"symbol":"BTCUSDT","lastPrice":"bad"},"SPOT",2)
        e=normalize_order_book({"b":[["100.4","2"]],"a":[["100.6","3"]],"ts":"1700000000000"},"SPOT","BTCUSDT",1700000000100)
        self.assertEqual(e.payload.action,BookAction.SNAPSHOT); self.assertIsNone(e.sequence); self.assertEqual(e.event_time_ms,1700000000000)
    def test_trade_and_liquidation(self):
        t=normalize_trade({"execId":"x","price":"100.5","size":"2","side":"buy","ts":"3"},"SPOT","BTCUSDT",4)
        self.assertEqual(t.payload.quantity,Decimal("2")); self.assertEqual(t.payload.side,Side.BUY)
        l=normalize_liquidation({"symbol":"BTCUSDT","price":"100","amount":"1","side":"sell","ts":"3"},"USDT-FUTURES",4)
        self.assertEqual(l.payload.side,Side.SELL)

if __name__ == "__main__": unittest.main()
