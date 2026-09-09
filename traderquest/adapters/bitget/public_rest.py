from collections.abc import Mapping
from typing import Any

from traderquest.market.models import EventKind, InstrumentKey, MarketType
from traderquest.market.ports import PublicMarketSnapshotAdapter
from .errors import BitgetApiError, BitgetProtocolError, UnsupportedMarketCapability
from .http import BitgetHttpResponse, BitgetPublicHttpTransport, StdlibBitgetPublicHttpTransport
from .normalizer import (market_type, normalize_funding, normalize_instrument, normalize_liquidation,
                         normalize_open_interest, normalize_order_book, normalize_ticker, normalize_trade)

_CATEGORIES = {MarketType.SPOT: "SPOT", MarketType.MARGIN: "MARGIN", MarketType.USDT_FUTURES: "USDT-FUTURES", MarketType.USDC_FUTURES: "USDC-FUTURES", MarketType.COIN_FUTURES: "COIN-FUTURES"}
_TICKERS = {MarketType.SPOT, MarketType.USDT_FUTURES, MarketType.USDC_FUTURES, MarketType.COIN_FUTURES}
_FUTURES = {MarketType.USDT_FUTURES, MarketType.USDC_FUTURES, MarketType.COIN_FUTURES}

def category_for(market_type_value: MarketType) -> str:
    try: return _CATEGORIES[market_type_value]
    except KeyError as error: raise UnsupportedMarketCapability(f"unsupported market type: {market_type_value}") from error

def _validate_envelope(response: BitgetHttpResponse) -> Mapping:
    payload = response.data
    if not isinstance(payload, Mapping) or "code" not in payload or "data" not in payload:
        raise BitgetProtocolError("Bitget response envelope is malformed")
    if payload["code"] != "00000":
        raise BitgetApiError(f"Bitget API returned code {payload['code']!r}")
    return payload

def _list(data: Any, capability: str) -> list[Mapping]:
    if not isinstance(data, list) or not all(isinstance(row, Mapping) for row in data): raise BitgetProtocolError(f"{capability} data is not an object list")
    return data
def _object(data: Any, capability: str) -> Mapping:
    if not isinstance(data, Mapping): raise BitgetProtocolError(f"{capability} data is not an object")
    return data
def _limit(value: int, maximum: int):
    if not isinstance(value, int) or isinstance(value, bool) or not 1 <= value <= maximum: raise ValueError(f"limit must be in range 1..{maximum}")

class BitgetPublicRestAdapter(PublicMarketSnapshotAdapter):
    def __init__(self, transport: BitgetPublicHttpTransport | None = None): self.transport = transport or StdlibBitgetPublicHttpTransport()
    async def _request(self, path: str, params: dict[str, str]) -> tuple[Mapping, BitgetHttpResponse]:
        response = await self.transport.get(path, params); return _validate_envelope(response), response
    async def get_instruments(self, market_type: MarketType, symbol: str | None = None):
        category = category_for(market_type); params = {"category": category};
        if symbol is not None: params["symbol"] = symbol
        envelope, response = await self._request("/api/v3/market/instruments", params)
        return [normalize_instrument({**row, "symbol": row.get("symbol", symbol or "")}, category, response.received_at_ms) for row in _list(envelope["data"], "instruments")]
    async def get_ticker(self, instrument: InstrumentKey):
        category = category_for(instrument.market_type)
        if instrument.market_type not in _TICKERS: raise UnsupportedMarketCapability("ticker is not supported for MARGIN")
        envelope, response = await self._request("/api/v3/market/tickers", {"category": category, "symbol": instrument.symbol})
        rows = [row for row in _list(envelope["data"], "ticker") if row.get("symbol") == instrument.symbol]
        if len(rows) != 1: raise BitgetProtocolError("ticker response did not contain exactly one requested symbol")
        return normalize_ticker(rows[0], category, response.received_at_ms)
    async def get_order_book(self, instrument: InstrumentKey, limit: int = 5):
        _limit(limit, 1000); category = category_for(instrument.market_type)
        envelope, response = await self._request("/api/v3/market/orderbook", {"category": category, "symbol": instrument.symbol, "limit": str(limit)})
        return normalize_order_book(_object(envelope["data"], "orderbook"), category, instrument.symbol, response.received_at_ms)
    async def get_recent_trades(self, instrument: InstrumentKey, limit: int = 100):
        _limit(limit, 100); category = category_for(instrument.market_type)
        envelope, response = await self._request("/api/v3/market/fills", {"category": category, "symbol": instrument.symbol, "limit": str(limit)})
        return [normalize_trade(row, category, instrument.symbol, response.received_at_ms) for row in _list(envelope["data"], "fills")]
    async def _futures_request(self, instrument: InstrumentKey):
        if instrument.market_type not in _FUTURES: raise UnsupportedMarketCapability("capability is futures-only")
        return category_for(instrument.market_type)
    async def get_open_interest(self, instrument: InstrumentKey):
        category = await self._futures_request(instrument); envelope, response = await self._request("/api/v3/market/open-interest", {"category": category, "symbol": instrument.symbol})
        data = _object(envelope["data"], "open interest"); rows = _list(data.get("list"), "open interest list")
        rows = [row for row in rows if row.get("symbol") == instrument.symbol]
        if len(rows) != 1: raise BitgetProtocolError("open interest response did not contain exactly one requested symbol")
        return normalize_open_interest({**rows[0], "ts": data.get("ts")}, category, response.received_at_ms)
    async def get_current_funding(self, instrument: InstrumentKey):
        category = await self._futures_request(instrument); envelope, response = await self._request("/api/v3/market/current-fund-rate", {"category": category, "symbol": instrument.symbol})
        rows = [row for row in _list(envelope["data"], "funding") if row.get("symbol") == instrument.symbol]
        if len(rows) != 1: raise BitgetProtocolError("funding response did not contain exactly one requested symbol")
        return normalize_funding(rows[0], category, response.received_at_ms)
    async def get_recent_liquidations(self, instrument: InstrumentKey, limit: int = 100):
        _limit(limit, 100); category = await self._futures_request(instrument); envelope, response = await self._request("/api/v3/market/liquidations", {"category": category, "symbol": instrument.symbol, "limit": str(limit)})
        data = _object(envelope["data"], "liquidations"); rows = _list(data.get("list"), "liquidations list")
        return [normalize_liquidation(row, category, response.received_at_ms) for row in rows if row.get("symbol") == instrument.symbol]
