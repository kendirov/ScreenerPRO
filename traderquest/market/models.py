from dataclasses import dataclass
from decimal import Decimal
from enum import Enum
from typing import Generic, TypeVar


class Provider(str, Enum): BITGET = "bitget"
class MarketType(str, Enum):
    SPOT = "spot"; MARGIN = "margin"; USDT_FUTURES = "usdt-futures"; USDC_FUTURES = "usdc-futures"; COIN_FUTURES = "coin-futures"
class Transport(str, Enum): REST = "rest"; WEBSOCKET = "websocket"
class Side(str, Enum): BUY = "buy"; SELL = "sell"
class QuantityUnit(str, Enum):
    BASE_ASSET = "base_asset"
    QUOTE_ASSET = "quote_asset"
    UNKNOWN = "unknown"
class EventKind(str, Enum):
    INSTRUMENT = "instrument"; TICKER = "ticker"; TRADE = "trade"; ORDER_BOOK = "order_book"; OPEN_INTEREST = "open_interest"; FUNDING = "funding"; LIQUIDATION = "liquidation"
class BookAction(str, Enum): SNAPSHOT = "snapshot"; UPDATE = "update"
class DataQuality(str, Enum): OK = "ok"; PARTIAL = "partial"; INVALID = "invalid"
class Freshness(str, Enum): UNKNOWN = "unknown"; FRESH = "fresh"; STALE = "stale"


def _nonempty(value: str, name: str) -> str:
    if not isinstance(value, str) or not value.strip(): raise ValueError(f"{name} cannot be empty")
    return value

def _positive(value: Decimal, name: str) -> Decimal:
    if value <= 0: raise ValueError(f"{name} must be > 0")
    return value

def _nonnegative(value: Decimal, name: str) -> Decimal:
    if value < 0: raise ValueError(f"{name} cannot be negative")
    return value

@dataclass(frozen=True)
class InstrumentKey:
    provider: Provider
    market_type: MarketType
    symbol: str
    def __post_init__(self): _nonempty(self.symbol, "symbol")
    @property
    def canonical_id(self) -> str: return f"{self.provider.value}:{self.market_type.value}:{self.symbol}"

@dataclass(frozen=True)
class SourceRef:
    provider: Provider
    api_family: str
    transport: Transport
    endpoint_or_topic: str

@dataclass(frozen=True)
class Instrument:
    key: InstrumentKey; base_asset: str | None; quote_asset: str | None; status: str | None; symbol_type: str | None; contract_type: str | None
    max_leverage: Decimal | None; min_order_amount: Decimal | None; launch_time_ms: int | None
    def __post_init__(self):
        if self.max_leverage is not None: _nonnegative(self.max_leverage, "max_leverage")
        if self.min_order_amount is not None: _nonnegative(self.min_order_amount, "min_order_amount")

@dataclass(frozen=True)
class TickerSnapshot:
    last_price: Decimal | None; bid_price: Decimal | None; ask_price: Decimal | None; bid_size: Decimal | None; ask_size: Decimal | None
    high_24h: Decimal | None; low_24h: Decimal | None; change_24h_ratio: Decimal | None; volume_24h: Decimal | None; turnover_24h: Decimal | None
    mark_price: Decimal | None; index_price: Decimal | None
    def __post_init__(self):
        for n in ("last_price", "bid_price", "ask_price", "high_24h", "low_24h", "mark_price", "index_price"):
            v = getattr(self, n)
            if v is not None: _positive(v, n)

@dataclass(frozen=True)
class Trade:
    trade_id: str | None; price: Decimal; quantity: Decimal; side: Side; quantity_unit: QuantityUnit = QuantityUnit.UNKNOWN
    def __post_init__(self): _positive(self.price, "price"); _nonnegative(self.quantity, "quantity")

@dataclass(frozen=True)
class BookLevel:
    price: Decimal; quantity: Decimal
    def __post_init__(self): _positive(self.price, "price"); _nonnegative(self.quantity, "quantity")

@dataclass(frozen=True)
class OrderBookUpdate:
    action: BookAction; bids: tuple[BookLevel, ...]; asks: tuple[BookLevel, ...]; quantity_unit: QuantityUnit = QuantityUnit.UNKNOWN

@dataclass(frozen=True)
class OpenInterestSnapshot: open_interest: Decimal | None; unit: str | None
@dataclass(frozen=True)
class FundingSnapshot: funding_rate: Decimal | None; next_funding_time_ms: int | None
@dataclass(frozen=True)
class Liquidation:
    price: Decimal; quantity: Decimal; side: Side; quantity_unit: QuantityUnit = QuantityUnit.UNKNOWN
    def __post_init__(self): _positive(self.price, "price"); _nonnegative(self.quantity, "quantity")

T = TypeVar("T")
@dataclass(frozen=True)
class EventEnvelope(Generic[T]):
    schema_version: str; kind: EventKind; instrument: InstrumentKey; source: SourceRef
    event_time_ms: int | None; observed_at_ms: int; sequence: int | None; previous_sequence: int | None
    quality: DataQuality; freshness: Freshness; payload: T
    def __post_init__(self):
        if self.observed_at_ms <= 0: raise ValueError("observed_at_ms must be > 0")
        if self.event_time_ms is not None and self.event_time_ms <= 0: raise ValueError("event_time_ms must be > 0")
        for n in ("sequence", "previous_sequence"):
            v = getattr(self, n)
            if v is not None and (not isinstance(v, int) or isinstance(v, bool) or v < 0): raise ValueError(f"{n} must be non-negative")
