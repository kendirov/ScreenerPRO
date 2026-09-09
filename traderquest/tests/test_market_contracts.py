import unittest
from decimal import Decimal
from traderquest.market.models import *
from traderquest.market.serialization import to_primitive

class ContractTests(unittest.TestCase):
    def test_identity_and_serialization(self):
        key=InstrumentKey(Provider.BITGET,MarketType.USDT_FUTURES,"BTCUSDT")
        self.assertEqual(key.canonical_id,"bitget:usdt-futures:BTCUSDT")
        self.assertEqual(to_primitive(Decimal("100.50")),"100.50"); self.assertEqual(to_primitive(Side.BUY),"buy"); self.assertIsNone(to_primitive(None))
        self.assertEqual(to_primitive((Decimal("1"),)),["1"])
    def test_envelope_validation(self):
        key=InstrumentKey(Provider.BITGET,MarketType.SPOT,"BTCUSDT"); src=SourceRef(Provider.BITGET,"UTA v3",Transport.REST,"/x")
        with self.assertRaises(ValueError): EventEnvelope("1",EventKind.TICKER,key,src,None,0,None,None,DataQuality.OK,Freshness.UNKNOWN,None)
        with self.assertRaises(ValueError): EventEnvelope("1",EventKind.TICKER,key,src,None,1,-1,None,DataQuality.OK,Freshness.UNKNOWN,None)
        with self.assertRaises(ValueError): InstrumentKey(Provider.BITGET,MarketType.SPOT,"")
        with self.assertRaises(ValueError): BookLevel(Decimal("0"),Decimal("1"))

if __name__ == "__main__": unittest.main()
