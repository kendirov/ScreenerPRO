from __future__ import annotations

import asyncio
import time
from abc import ABC, abstractmethod
from typing import Any

from .http import JsonHttp
from .models import AssetClass, Quote, SourceHealth, SourceStatus


def _f(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _i(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _now_ms() -> int:
    return int(time.time() * 1000)


class MarketSource(ABC):
    name: str

    @abstractmethod
    async def fetch_quotes(self) -> list[Quote]: ...

    async def collect(self) -> tuple[list[Quote], SourceHealth]:
        started = time.perf_counter()
        try:
            rows = await self.fetch_quotes()
            latency = int((time.perf_counter() - started) * 1000)
            return rows, SourceHealth(name=self.name, status=SourceStatus.OK, instruments=len(rows), latency_ms=latency, last_success_ms=_now_ms())
        except Exception as exc:
            latency = int((time.perf_counter() - started) * 1000)
            return [], SourceHealth(name=self.name, status=SourceStatus.ERROR, latency_ms=latency, error=str(exc)[:500])


class BitgetSource(MarketSource):
    name = "Bitget UTA v3"
    BASE = "https://api.bitget.com/api/v3/market/tickers"

    def __init__(self, http: JsonHttp, categories: tuple[str, ...] = ("SPOT", "USDT-FUTURES")) -> None:
        self.http = http
        self.categories = categories

    async def _category(self, category: str) -> list[Quote]:
        payload = await self.http.get_json(self.BASE, {"category": category})
        if payload.get("code") != "00000" or not isinstance(payload.get("data"), list):
            raise RuntimeError(f"Bitget protocol error: {payload.get('code')} {payload.get('msg')}")
        observed = _now_ms()
        market_type = "spot" if category == "SPOT" else category.lower()
        asset_class = AssetClass.CRYPTO if category == "SPOT" else AssetClass.FUTURE
        result: list[Quote] = []
        for row in payload["data"]:
            symbol = str(row.get("symbol") or "")
            if not symbol: continue
            result.append(Quote(provider="bitget", venue="Bitget", symbol=symbol, asset_class=asset_class,
                market_type=market_type, currency="USDT" if symbol.endswith("USDT") else None,
                last=_f(row.get("lastPrice")), bid=_f(row.get("bid1Price")), ask=_f(row.get("ask1Price")),
                high_24h=_f(row.get("highPrice24h")), low_24h=_f(row.get("lowPrice24h")), volume_24h=_f(row.get("volume24h")),
                turnover_24h=_f(row.get("turnover24h")),
                change_24h_pct=(_f(row.get("price24hPcnt")) or 0.0) * 100 if row.get("price24hPcnt") not in (None, "") else None,
                open_interest=_f(row.get("openInterest")), funding_rate=_f(row.get("fundingRate")),
                ts_ms=_i(row.get("ts")) or observed, observed_at_ms=observed))
        return result

    async def fetch_quotes(self) -> list[Quote]:
        chunks = await asyncio.gather(*(self._category(c) for c in self.categories))
        return [quote for chunk in chunks for quote in chunk]


class BinanceSource(MarketSource):
    name = "Binance"
    def __init__(self, http: JsonHttp) -> None: self.http = http

    async def _fetch(self, url: str, market_type: str, asset_class: AssetClass) -> list[Quote]:
        payload = await self.http.get_json(url)
        if not isinstance(payload, list): raise RuntimeError("Binance ticker response is not a list")
        observed = _now_ms(); result: list[Quote] = []
        for row in payload:
            symbol = str(row.get("symbol") or "")
            if not symbol: continue
            result.append(Quote(provider="binance", venue="Binance", symbol=symbol, asset_class=asset_class, market_type=market_type,
                currency="USDT" if symbol.endswith("USDT") else None, last=_f(row.get("lastPrice")), bid=_f(row.get("bidPrice")),
                ask=_f(row.get("askPrice")), open_24h=_f(row.get("openPrice")), high_24h=_f(row.get("highPrice")),
                low_24h=_f(row.get("lowPrice")), volume_24h=_f(row.get("volume")), turnover_24h=_f(row.get("quoteVolume")),
                change_24h_pct=_f(row.get("priceChangePercent")), ts_ms=_i(row.get("closeTime")) or observed, observed_at_ms=observed))
        return result

    async def fetch_quotes(self) -> list[Quote]:
        spot, futures = await asyncio.gather(
            self._fetch("https://api.binance.com/api/v3/ticker/24hr", "spot", AssetClass.CRYPTO),
            self._fetch("https://fapi.binance.com/fapi/v1/ticker/24hr", "usdt-futures", AssetClass.FUTURE))
        return spot + futures


class BybitSource(MarketSource):
    name = "Bybit V5"; URL = "https://api.bybit.com/v5/market/tickers"
    def __init__(self, http: JsonHttp) -> None: self.http = http

    async def _fetch(self, category: str) -> list[Quote]:
        payload = await self.http.get_json(self.URL, {"category": category})
        if str(payload.get("retCode")) != "0": raise RuntimeError(f"Bybit error: {payload.get('retMsg')}")
        rows = ((payload.get("result") or {}).get("list")) or []; observed = _now_ms(); result: list[Quote] = []
        for row in rows:
            symbol = str(row.get("symbol") or "")
            if not symbol: continue
            result.append(Quote(provider="bybit", venue="Bybit", symbol=symbol,
                asset_class=AssetClass.CRYPTO if category == "spot" else AssetClass.FUTURE, market_type=category,
                currency="USDT" if symbol.endswith("USDT") else None, last=_f(row.get("lastPrice")), bid=_f(row.get("bid1Price")),
                ask=_f(row.get("ask1Price")), high_24h=_f(row.get("highPrice24h")), low_24h=_f(row.get("lowPrice24h")),
                volume_24h=_f(row.get("volume24h")), turnover_24h=_f(row.get("turnover24h")),
                change_24h_pct=(_f(row.get("price24hPcnt")) or 0.0) * 100 if row.get("price24hPcnt") not in (None, "") else None,
                open_interest=_f(row.get("openInterest")), funding_rate=_f(row.get("fundingRate")),
                ts_ms=_i(payload.get("time")) or observed, observed_at_ms=observed))
        return result

    async def fetch_quotes(self) -> list[Quote]:
        spot, linear = await asyncio.gather(self._fetch("spot"), self._fetch("linear")); return spot + linear


class OkxSource(MarketSource):
    name = "OKX V5"; URL = "https://www.okx.com/api/v5/market/tickers"
    def __init__(self, http: JsonHttp) -> None: self.http = http

    async def _fetch(self, inst_type: str) -> list[Quote]:
        payload = await self.http.get_json(self.URL, {"instType": inst_type})
        if str(payload.get("code")) != "0": raise RuntimeError(f"OKX error: {payload.get('msg')}")
        observed = _now_ms(); result: list[Quote] = []
        for row in payload.get("data") or []:
            symbol = str(row.get("instId") or "")
            if not symbol: continue
            open_24h = _f(row.get("open24h")); last = _f(row.get("last")); pct = ((last / open_24h - 1) * 100) if last is not None and open_24h not in (None, 0) else None
            result.append(Quote(provider="okx", venue="OKX", symbol=symbol, asset_class=AssetClass.CRYPTO if inst_type == "SPOT" else AssetClass.FUTURE,
                market_type=inst_type.lower(), currency=symbol.split("-")[1] if "-" in symbol else None, last=last, bid=_f(row.get("bidPx")),
                ask=_f(row.get("askPx")), open_24h=open_24h, high_24h=_f(row.get("high24h")), low_24h=_f(row.get("low24h")),
                volume_24h=_f(row.get("vol24h")), turnover_24h=_f(row.get("volCcy24h")), change_24h_pct=pct,
                ts_ms=_i(row.get("ts")) or observed, observed_at_ms=observed))
        return result

    async def fetch_quotes(self) -> list[Quote]:
        chunks = await asyncio.gather(*(self._fetch(t) for t in ("SPOT", "SWAP", "FUTURES"))); return [q for chunk in chunks for q in chunk]


class MoexSource(MarketSource):
    name = "MOEX ISS"; BASE = "https://iss.moex.com/iss/engines"
    def __init__(self, http: JsonHttp) -> None: self.http = http

    @staticmethod
    def _section(payload: dict[str, Any], name: str = "marketdata") -> list[dict[str, Any]]:
        section = payload.get(name) or {}; columns = section.get("columns") or []
        return [dict(zip(columns, row, strict=False)) for row in section.get("data") or []]

    async def _fetch_market(self, engine: str, market: str, asset_class: AssetClass, market_type: str) -> list[Quote]:
        payload = await self.http.get_json(f"{self.BASE}/{engine}/markets/{market}/securities.json", {"iss.meta": "off", "iss.only": "marketdata"})
        observed = _now_ms(); result: list[Quote] = []
        for row in self._section(payload):
            symbol = str(row.get("SECID") or "")
            if not symbol: continue
            last = _f(row.get("LAST") or row.get("SETTLEPRICE") or row.get("MARKETPRICE")); pct = _f(row.get("LASTTOPREVPRICE") or row.get("LASTCHANGEPRCNT") or row.get("CHANGE"))
            result.append(Quote(provider="moex", venue="MOEX", symbol=symbol, display_symbol=symbol, asset_class=asset_class, market_type=market_type,
                currency="RUB", last=last, bid=_f(row.get("BID") or row.get("BIDPRICE")), ask=_f(row.get("OFFER") or row.get("OFFERPRICE")),
                high_24h=_f(row.get("HIGH")), low_24h=_f(row.get("LOW")), volume_24h=_f(row.get("VOLTODAY")),
                turnover_24h=_f(row.get("VALTODAY") or row.get("VALTODAY_RUR")), change_24h_pct=pct, open_interest=_f(row.get("OPENPOSITION")),
                ts_ms=observed, observed_at_ms=observed, meta={"board": row.get("BOARDID"), "trading_status": row.get("TRADINGSTATUS")}))
        return result

    async def fetch_quotes(self) -> list[Quote]:
        shares, futures = await asyncio.gather(self._fetch_market("stock", "shares", AssetClass.STOCK, "shares"), self._fetch_market("futures", "forts", AssetClass.FUTURE, "forts")); return shares + futures


class TwelveDataSource(MarketSource):
    name = "Twelve Data"
    def __init__(self, http: JsonHttp, api_key: str, symbols: list[str]) -> None: self.http, self.api_key, self.symbols = http, api_key, symbols

    async def fetch_quotes(self) -> list[Quote]:
        if not self.api_key or not self.symbols: return []
        payload = await self.http.get_json("https://api.twelvedata.com/quote", {"symbol": ",".join(self.symbols), "apikey": self.api_key, "interval": "1min"})
        rows = payload if any(k in payload for k in self.symbols) else {self.symbols[0]: payload}; observed = _now_ms(); result: list[Quote] = []
        for requested, row in rows.items():
            if not isinstance(row, dict) or row.get("status") == "error": continue
            symbol = str(row.get("symbol") or requested); close = _f(row.get("close")); previous = _f(row.get("previous_close")); pct = _f(row.get("percent_change"))
            if pct is None and close is not None and previous not in (None, 0): pct = (close / previous - 1) * 100
            timestamp = _i(row.get("timestamp")); ts_ms = timestamp * 1000 if timestamp and timestamp < 10_000_000_000 else (timestamp or observed)
            result.append(Quote(provider="twelvedata", venue=str(row.get("exchange") or "GLOBAL"), symbol=symbol, asset_class=AssetClass.STOCK,
                market_type="stock", currency=row.get("currency"), last=close, open_24h=_f(row.get("open")), high_24h=_f(row.get("high")),
                low_24h=_f(row.get("low")), volume_24h=_f(row.get("volume")), change_24h_pct=pct, ts_ms=ts_ms,
                observed_at_ms=observed, meta={"name": row.get("name")}))
        return result
