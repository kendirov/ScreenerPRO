import asyncio
import time
from dataclasses import dataclass
from enum import Enum
from typing import Any

from traderquest.market.models import EventEnvelope, InstrumentKey, MarketType
from traderquest.market.ports import PublicMarketSnapshotAdapter

class SnapshotStatus(str, Enum): COMPLETE = "complete"; PARTIAL = "partial"; FAILED = "failed"

@dataclass(frozen=True)
class SnapshotError:
    capability: str
    error_type: str
    message: str

@dataclass(frozen=True)
class MarketSnapshot:
    instrument: InstrumentKey
    started_at_ms: int
    completed_at_ms: int
    events: tuple[EventEnvelope, ...]
    errors: tuple[SnapshotError, ...]
    status: SnapshotStatus

async def capture_market_snapshot(adapter: PublicMarketSnapshotAdapter, instrument: InstrumentKey, *, book_limit: int = 5, trade_limit: int = 100, liquidation_limit: int = 100) -> MarketSnapshot:
    started = int(time.time() * 1000)
    events: list[EventEnvelope] = []
    errors: list[SnapshotError] = []
    try:
        instrument_events = await adapter.get_instruments(instrument.market_type, instrument.symbol)
        matching = [event for event in instrument_events if event.instrument == instrument]
        if len(matching) != 1:
            raise ValueError("instrument validation did not return exactly one requested symbol")
        events.extend(matching)
    except Exception as error:
        errors.append(SnapshotError("instruments", error.__class__.__name__, str(error)))
        completed = max(started, int(time.time() * 1000))
        return MarketSnapshot(instrument, started, completed, tuple(events), tuple(errors), SnapshotStatus.FAILED)
    expected = ["ticker", "orderbook", "trades"]
    if instrument.market_type in {MarketType.USDT_FUTURES, MarketType.USDC_FUTURES, MarketType.COIN_FUTURES}:
        expected += ["open_interest", "funding", "liquidations"]
    results = await asyncio.gather(
        adapter.get_ticker(instrument), adapter.get_order_book(instrument, book_limit), adapter.get_recent_trades(instrument, trade_limit),
        *( [adapter.get_open_interest(instrument), adapter.get_current_funding(instrument), adapter.get_recent_liquidations(instrument, liquidation_limit)] if len(expected) == 6 else [] ),
        return_exceptions=True,
    )
    for capability, result in zip(expected, results):
        if isinstance(result, Exception):
            errors.append(SnapshotError(capability, result.__class__.__name__, str(result)))
        elif isinstance(result, list):
            events.extend(result)
        elif isinstance(result, EventEnvelope):
            events.append(result)
        else:
            errors.append(SnapshotError(capability, "ProtocolError", "adapter returned an unsupported result"))
    completed = max(started, int(time.time() * 1000))
    status = SnapshotStatus.COMPLETE if not errors else SnapshotStatus.PARTIAL if events else SnapshotStatus.FAILED
    return MarketSnapshot(instrument, started, completed, tuple(events), tuple(errors), status)
