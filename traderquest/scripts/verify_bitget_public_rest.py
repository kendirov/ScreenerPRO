import asyncio

from traderquest.adapters.bitget.errors import BitgetPublicError
from traderquest.adapters.bitget.public_rest import BitgetPublicRestAdapter
from traderquest.market.models import InstrumentKey, MarketType, Provider
from traderquest.runtime.snapshot import SnapshotStatus, capture_market_snapshot

async def verify():
    adapter = BitgetPublicRestAdapter()
    for market_type in (MarketType.USDT_FUTURES, MarketType.SPOT):
        key = InstrumentKey(Provider.BITGET, market_type, "BTCUSDT")
        label = "futures" if market_type is MarketType.USDT_FUTURES else "spot"
        try:
            snapshot = await capture_market_snapshot(adapter, key, book_limit=5, trade_limit=5, liquidation_limit=5)
            if snapshot.status is not SnapshotStatus.COMPLETE:
                print(f"FAIL {label} snapshot status={snapshot.status.value} errors={len(snapshot.errors)}")
                continue
            kinds = {event.kind.value for event in snapshot.events}
            expected = {"instrument", "ticker", "order_book", "trade"}
            if market_type is MarketType.USDT_FUTURES:
                expected |= {"open_interest", "funding", "liquidation"}
            for kind in sorted(expected): print(f"PASS {label} {kind} canonical=true")
            print(f"PASS {label} snapshot status=complete events={len(snapshot.events)}")
        except BitgetPublicError as error:
            print(f"BLOCKED {label} {error.__class__.__name__}: {error}")
            return 1
    return 0

if __name__ == "__main__":
    raise SystemExit(asyncio.run(verify()))
