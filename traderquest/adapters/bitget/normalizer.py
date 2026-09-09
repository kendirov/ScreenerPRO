from collections.abc import Mapping
from decimal import Decimal, InvalidOperation
from typing import Any
from traderquest.market.models import *

API = "UTA v3"
REST_PATHS = {EventKind.INSTRUMENT:"/api/v3/market/instruments", EventKind.TICKER:"/api/v3/market/tickers", EventKind.TRADE:"/api/v3/market/fills", EventKind.ORDER_BOOK:"/api/v3/market/orderbook", EventKind.OPEN_INTEREST:"/api/v3/market/open-interest", EventKind.FUNDING:"/api/v3/market/current-fund-rate", EventKind.LIQUIDATION:"/api/v3/market/liquidations"}
def market_type(category: str) -> MarketType:
    try: return {"SPOT":MarketType.SPOT,"MARGIN":MarketType.MARGIN,"USDT-FUTURES":MarketType.USDT_FUTURES,"USDC-FUTURES":MarketType.USDC_FUTURES,"COIN-FUTURES":MarketType.COIN_FUTURES}[category]
    except KeyError: raise ValueError(f"unknown Bitget category: {category}")
def decimal_or_none(value: Any) -> Decimal | None:
    if value is None or value == "": return None
    try: return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as e: raise ValueError(f"invalid numeric value: {value!r}") from e
def required_decimal(value: Any, name: str) -> Decimal:
    result = decimal_or_none(value)
    if result is None: raise ValueError(f"missing required numeric field: {name}")
    return result
def timestamp_or_none(value: Any) -> int | None:
    if value is None or value == "": return None
    try: result = int(value)
    except (ValueError, TypeError) as e: raise ValueError(f"invalid timestamp: {value!r}") from e
    if result == 0: return None
    if result < 0: raise ValueError("timestamp must be > 0")
    return result
def text_or_none(value: Any) -> str | None: return None if value is None or value == "" else str(value)
def _key(category, raw): return InstrumentKey(Provider.BITGET, market_type(category), str(raw.get("symbol", "")))
def _env(kind, key, payload, observed, event=None, source=None):
    return EventEnvelope("1", kind, key, SourceRef(Provider.BITGET, API, Transport.REST, source or REST_PATHS[kind]), event, observed, None, None, DataQuality.OK, Freshness.UNKNOWN, payload)
def normalize_instrument(raw: Mapping, category: str, observed_at_ms: int):
    key = _key(category, raw)
    return _env(EventKind.INSTRUMENT, key, Instrument(key, text_or_none(raw.get("baseCoin")), text_or_none(raw.get("quoteCoin")), text_or_none(raw.get("status")), text_or_none(raw.get("symbolType")), text_or_none(raw.get("type")), decimal_or_none(raw.get("maxLeverage")), decimal_or_none(raw.get("minOrderAmount")), timestamp_or_none(raw.get("launchTime"))), observed_at_ms)
def normalize_ticker(raw: Mapping, category: str, observed_at_ms: int):
    key = _key(category, raw)
    p=lambda n: decimal_or_none(raw.get(n))
    payload=TickerSnapshot(p("lastPrice"),p("bid1Price"),p("ask1Price"),p("bid1Size"),p("ask1Size"),p("highPrice24h"),p("lowPrice24h"),p("price24hPcnt"),p("volume24h"),p("turnover24h"),p("markPrice"),p("indexPrice"))
    return _env(EventKind.TICKER,key,payload,observed_at_ms,timestamp_or_none(raw.get("ts")))
def normalize_order_book(raw: Mapping, category: str, symbol: str, observed_at_ms: int):
    key=InstrumentKey(Provider.BITGET,market_type(category),symbol)
    levels=lambda rows: tuple(BookLevel(required_decimal(x[0],"price"), required_decimal(x[1],"quantity")) for x in (rows or []))
    return _env(EventKind.ORDER_BOOK,key,OrderBookUpdate(BookAction.SNAPSHOT,levels(raw.get("b")),levels(raw.get("a"))),observed_at_ms,timestamp_or_none(raw.get("ts")))
def _side(value):
    try: return Side(str(value).lower())
    except ValueError as e: raise ValueError(f"invalid side: {value!r}") from e
def trade_quantity_unit(category: str) -> QuantityUnit:
    return QuantityUnit.QUOTE_ASSET if market_type(category) is MarketType.COIN_FUTURES else QuantityUnit.BASE_ASSET
def normalize_trade(raw: Mapping, category: str, symbol: str, observed_at_ms: int):
    key=InstrumentKey(Provider.BITGET,market_type(category),symbol); payload=Trade(text_or_none(raw.get("execId")),required_decimal(raw.get("price"),"price"),required_decimal(raw.get("size"),"size"),_side(raw.get("side")),trade_quantity_unit(category))
    return _env(EventKind.TRADE,key,payload,observed_at_ms,timestamp_or_none(raw.get("ts")))
def normalize_open_interest(raw: Mapping, category: str, observed_at_ms: int):
    key=_key(category,raw); return _env(EventKind.OPEN_INTEREST,key,OpenInterestSnapshot(decimal_or_none(raw.get("openInterest")),text_or_none(raw.get("unit"))),observed_at_ms,timestamp_or_none(raw.get("ts")))
def normalize_funding(raw: Mapping, category: str, observed_at_ms: int):
    key=_key(category,raw); return _env(EventKind.FUNDING,key,FundingSnapshot(decimal_or_none(raw.get("fundingRate")),timestamp_or_none(raw.get("nextUpdate"))),observed_at_ms,timestamp_or_none(raw.get("ts")))
def normalize_liquidation(raw: Mapping, category: str, observed_at_ms: int):
    key=_key(category,raw); payload=Liquidation(required_decimal(raw.get("price"),"price"),required_decimal(raw.get("amount"),"amount"),_side(raw.get("side")),QuantityUnit.UNKNOWN)
    return _env(EventKind.LIQUIDATION,key,payload,observed_at_ms,timestamp_or_none(raw.get("ts")))
def normalize_open_interest_from_ticker(raw, category, observed_at_ms): return normalize_open_interest({**raw, "ts":raw.get("ts")}, category, observed_at_ms)
def normalize_funding_from_ticker(raw, category, observed_at_ms): return normalize_funding({**raw, "ts":raw.get("ts")}, category, observed_at_ms)
