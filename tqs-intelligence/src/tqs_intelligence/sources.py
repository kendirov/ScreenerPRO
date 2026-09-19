from __future__ import annotations

import asyncio
import time
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Any, Iterable
from zoneinfo import ZoneInfo

from .http import JsonHttp
from .models import AssetClass, Candle, Quote, SourceHealth, SourceStatus


def _f(value: Any) -> float | None:
    if value is None or value == "": return None
    try: return float(value)
    except (TypeError, ValueError): return None


def _i(value: Any) -> int | None:
    try: return int(value)
    except (TypeError, ValueError): return None


def _now_ms() -> int: return int(time.time() * 1000)


def _required(value: Any, name: str) -> float:
    result = _f(value)
    if result is None: raise ValueError(f"missing {name}")
    return result


class MarketSource(ABC):
    provider = "unknown"; name = "Unknown"; markets: tuple[str, ...] = (); asset_classes: tuple[AssetClass, ...] = ()
    data_fields: tuple[str, ...] = ("цена",); access = "Публичный API, без ключа"; description = ""

    def __init__(self) -> None: self._warnings: list[str] = []
    @abstractmethod
    async def fetch_quotes(self) -> list[Quote]: ...
    async def fetch_candles(self, quote: Quote, interval: str = "5m", limit: int = 500) -> list[Candle]: return []

    def capability(self, enabled: bool = True) -> dict[str, Any]:
        return {"provider": self.provider, "name": self.name, "enabled": enabled, "markets": list(self.markets),
                "asset_classes": [x.value for x in self.asset_classes], "data_fields": list(self.data_fields),
                "access": self.access, "description": self.description}

    async def _gather_parts(self, parts: Iterable[tuple[str, Any]]) -> list[Quote]:
        items = list(parts); rows = await asyncio.gather(*(coro for _, coro in items), return_exceptions=True); result: list[Quote] = []
        for (label, _), chunk in zip(items, rows, strict=True):
            if isinstance(chunk, BaseException): self._warnings.append(f"{label}: {chunk}")
            else: result.extend(chunk)
        if not result and self._warnings: raise RuntimeError(" | ".join(self._warnings))
        return result

    async def collect(self) -> tuple[list[Quote], SourceHealth]:
        self._warnings = []; started = time.perf_counter()
        try:
            rows = await self.fetch_quotes(); latency = int((time.perf_counter() - started) * 1000)
            status = SourceStatus.DEGRADED if self._warnings else SourceStatus.OK
            return rows, SourceHealth(provider=self.provider, name=self.name, status=status, instruments=len(rows), latency_ms=latency,
                                      last_success_ms=_now_ms(), error="; ".join(self._warnings)[:1000] or None)
        except Exception as exc:
            latency = int((time.perf_counter() - started) * 1000)
            return [], SourceHealth(provider=self.provider, name=self.name, status=SourceStatus.ERROR, latency_ms=latency, error=str(exc)[:1000])


class BitgetSource(MarketSource):
    provider="bitget"; name="Bitget UTA v3"; markets=("Крипто spot","USDT perpetual futures")
    asset_classes=(AssetClass.CRYPTO,AssetClass.FUTURE); data_fields=("цена","bid/ask","24ч","объём/оборот","OI","funding","свечи")
    description="Основной крипто-источник TQS."; BASE="https://api.bitget.com/api/v3/market/tickers"
    def __init__(self,http:JsonHttp,categories:tuple[str,...]=("SPOT","USDT-FUTURES"))->None: super().__init__(); self.http=http; self.categories=categories
    async def _category(self,category:str)->list[Quote]:
        payload=await self.http.get_json(self.BASE,{"category":category})
        if payload.get("code")!="00000" or not isinstance(payload.get("data"),list): raise RuntimeError(f"Bitget protocol error: {payload.get('code')} {payload.get('msg')}")
        observed=_now_ms(); market_type="spot" if category=="SPOT" else category.lower(); asset_class=AssetClass.CRYPTO if category=="SPOT" else AssetClass.FUTURE; result=[]
        for row in payload["data"]:
            symbol=str(row.get("symbol") or "")
            if not symbol: continue
            result.append(Quote(provider=self.provider,venue="Bitget",symbol=symbol,asset_class=asset_class,market_type=market_type,currency="USDT" if symbol.endswith("USDT") else None,
                last=_f(row.get("lastPrice")),bid=_f(row.get("bid1Price")),ask=_f(row.get("ask1Price")),high_24h=_f(row.get("highPrice24h")),low_24h=_f(row.get("lowPrice24h")),
                volume_24h=_f(row.get("volume24h")),turnover_24h=_f(row.get("turnover24h")),change_24h_pct=(_f(row.get("price24hPcnt")) or 0.0)*100 if row.get("price24hPcnt") not in (None,"") else None,
                open_interest=_f(row.get("openInterest")),funding_rate=_f(row.get("fundingRate")),ts_ms=_i(row.get("ts")) or observed,observed_at_ms=observed))
        return result
    async def fetch_quotes(self)->list[Quote]: return await self._gather_parts((c,self._category(c)) for c in self.categories)
    async def fetch_candles(self,quote:Quote,interval:str="5m",limit:int=500)->list[Candle]:
        category="SPOT" if quote.market_type=="spot" else "USDT-FUTURES"
        payload=await self.http.get_json("https://api.bitget.com/api/v3/market/candles",{"category":category,"symbol":quote.symbol,"interval":interval,"limit":str(min(limit,1000))})
        if payload.get("code")!="00000": raise RuntimeError(f"Bitget candles: {payload.get('msg')}")
        rows=[]
        for x in payload.get("data") or []:
            if len(x)<5: continue
            rows.append(Candle(provider=self.provider,canonical_id=quote.canonical_id,interval=interval,ts_ms=int(x[0]),open=_required(x[1],"open"),high=_required(x[2],"high"),low=_required(x[3],"low"),close=_required(x[4],"close"),volume=_f(x[5]) if len(x)>5 else None,turnover=_f(x[6]) if len(x)>6 else None,source="bitget"))
        return sorted(rows,key=lambda x:x.ts_ms)


class BinanceSource(MarketSource):
    provider="binance"; name="Binance"; markets=("Крипто spot","USDT perpetual futures"); asset_classes=(AssetClass.CRYPTO,AssetClass.FUTURE)
    data_fields=("цена","bid/ask","24ч","объём/оборот","свечи"); description="Кросс-проверка крипторынка и широкий universe."
    def __init__(self,http:JsonHttp)->None: super().__init__(); self.http=http
    async def _fetch(self,url:str,market_type:str,asset_class:AssetClass)->list[Quote]:
        payload=await self.http.get_json(url)
        if not isinstance(payload,list): raise RuntimeError("Binance ticker response is not a list")
        observed=_now_ms(); result=[]
        for row in payload:
            symbol=str(row.get("symbol") or "")
            if not symbol: continue
            result.append(Quote(provider=self.provider,venue="Binance",symbol=symbol,asset_class=asset_class,market_type=market_type,currency="USDT" if symbol.endswith("USDT") else None,
                last=_f(row.get("lastPrice")),bid=_f(row.get("bidPrice")),ask=_f(row.get("askPrice")),open_24h=_f(row.get("openPrice")),high_24h=_f(row.get("highPrice")),low_24h=_f(row.get("lowPrice")),
                volume_24h=_f(row.get("volume")),turnover_24h=_f(row.get("quoteVolume")),change_24h_pct=_f(row.get("priceChangePercent")),ts_ms=_i(row.get("closeTime")) or observed,observed_at_ms=observed))
        return result
    async def fetch_quotes(self)->list[Quote]: return await self._gather_parts((("spot",self._fetch("https://api.binance.com/api/v3/ticker/24hr","spot",AssetClass.CRYPTO)),("futures",self._fetch("https://fapi.binance.com/fapi/v1/ticker/24hr","usdt-futures",AssetClass.FUTURE))))
    async def fetch_candles(self,quote:Quote,interval:str="5m",limit:int=500)->list[Candle]:
        url="https://api.binance.com/api/v3/klines" if quote.market_type=="spot" else "https://fapi.binance.com/fapi/v1/klines"
        payload=await self.http.get_json(url,{"symbol":quote.symbol,"interval":interval,"limit":str(min(limit,1000))})
        if not isinstance(payload,list): raise RuntimeError("Binance candles response is not a list")
        result=[]
        for x in payload:
            if len(x)<6: continue
            result.append(Candle(provider=self.provider,canonical_id=quote.canonical_id,interval=interval,ts_ms=int(x[0]),open=_required(x[1],"open"),high=_required(x[2],"high"),low=_required(x[3],"low"),close=_required(x[4],"close"),volume=_f(x[5]),turnover=_f(x[7]) if len(x)>7 else None,source="binance"))
        return sorted(result,key=lambda x:x.ts_ms)


class BybitSource(MarketSource):
    provider="bybit"; name="Bybit V5"; URL="https://api.bybit.com/v5/market/tickers"; markets=("Крипто spot","Linear perpetual futures")
    asset_classes=(AssetClass.CRYPTO,AssetClass.FUTURE); data_fields=("цена","bid/ask","24ч","объём/оборот","OI","funding","свечи"); description="Кросс-проверка деривативов и funding/OI."
    def __init__(self,http:JsonHttp)->None: super().__init__(); self.http=http
    async def _fetch(self,category:str)->list[Quote]:
        payload=await self.http.get_json(self.URL,{"category":category})
        if str(payload.get("retCode"))!="0": raise RuntimeError(f"Bybit error: {payload.get('retMsg')}")
        rows=((payload.get("result") or {}).get("list")) or []; observed=_now_ms(); result=[]
        for row in rows:
            symbol=str(row.get("symbol") or "")
            if not symbol: continue
            result.append(Quote(provider=self.provider,venue="Bybit",symbol=symbol,asset_class=AssetClass.CRYPTO if category=="spot" else AssetClass.FUTURE,market_type=category,currency="USDT" if symbol.endswith("USDT") else None,
                last=_f(row.get("lastPrice")),bid=_f(row.get("bid1Price")),ask=_f(row.get("ask1Price")),high_24h=_f(row.get("highPrice24h")),low_24h=_f(row.get("lowPrice24h")),volume_24h=_f(row.get("volume24h")),turnover_24h=_f(row.get("turnover24h")),
                change_24h_pct=(_f(row.get("price24hPcnt")) or 0.0)*100 if row.get("price24hPcnt") not in (None,"") else None,open_interest=_f(row.get("openInterest")),funding_rate=_f(row.get("fundingRate")),ts_ms=_i(payload.get("time")) or observed,observed_at_ms=observed))
        return result
    async def fetch_quotes(self)->list[Quote]: return await self._gather_parts((("spot",self._fetch("spot")),("linear",self._fetch("linear"))))
    async def fetch_candles(self,quote:Quote,interval:str="5m",limit:int=500)->list[Candle]:
        category="spot" if quote.market_type=="spot" else "linear"; bybit_interval=interval[:-1] if interval.endswith("m") else interval
        payload=await self.http.get_json("https://api.bybit.com/v5/market/kline",{"category":category,"symbol":quote.symbol,"interval":bybit_interval,"limit":str(min(limit,1000))})
        if str(payload.get("retCode"))!="0": raise RuntimeError(f"Bybit candles: {payload.get('retMsg')}")
        result=[]
        for x in ((payload.get("result") or {}).get("list")) or []:
            if len(x)<5: continue
            result.append(Candle(provider=self.provider,canonical_id=quote.canonical_id,interval=interval,ts_ms=int(x[0]),open=_required(x[1],"open"),high=_required(x[2],"high"),low=_required(x[3],"low"),close=_required(x[4],"close"),volume=_f(x[5]) if len(x)>5 else None,turnover=_f(x[6]) if len(x)>6 else None,source="bybit"))
        return sorted(result,key=lambda x:x.ts_ms)


class OkxSource(MarketSource):
    provider="okx"; name="OKX V5"; URL="https://www.okx.com/api/v5/market/tickers"; markets=("Крипто spot","Perpetual swaps","Futures")
    asset_classes=(AssetClass.CRYPTO,AssetClass.FUTURE); data_fields=("цена","bid/ask","24ч","объём/оборот","свечи"); description="Дополнительная биржа для дивергенций между площадками."
    def __init__(self,http:JsonHttp)->None: super().__init__(); self.http=http
    async def _fetch(self,inst_type:str)->list[Quote]:
        payload=await self.http.get_json(self.URL,{"instType":inst_type})
        if str(payload.get("code"))!="0": raise RuntimeError(f"OKX error: {payload.get('msg')}")
        observed=_now_ms(); result=[]
        for row in payload.get("data") or []:
            symbol=str(row.get("instId") or "")
            if not symbol: continue
            open_24h=_f(row.get("open24h")); last=_f(row.get("last")); pct=((last/open_24h-1)*100) if last is not None and open_24h not in (None,0) else None
            result.append(Quote(provider=self.provider,venue="OKX",symbol=symbol,asset_class=AssetClass.CRYPTO if inst_type=="SPOT" else AssetClass.FUTURE,market_type=inst_type.lower(),currency=symbol.split("-")[1] if "-" in symbol else None,last=last,bid=_f(row.get("bidPx")),ask=_f(row.get("askPx")),open_24h=open_24h,high_24h=_f(row.get("high24h")),low_24h=_f(row.get("low24h")),volume_24h=_f(row.get("vol24h")),turnover_24h=_f(row.get("volCcy24h")),change_24h_pct=pct,ts_ms=_i(row.get("ts")) or observed,observed_at_ms=observed))
        return result
    async def fetch_quotes(self)->list[Quote]: return await self._gather_parts((t,self._fetch(t)) for t in ("SPOT","SWAP","FUTURES"))
    async def fetch_candles(self,quote:Quote,interval:str="5m",limit:int=300)->list[Candle]:
        bar=interval.replace("m","m").replace("h","H"); payload=await self.http.get_json("https://www.okx.com/api/v5/market/candles",{"instId":quote.symbol,"bar":bar,"limit":str(min(limit,300))})
        if str(payload.get("code"))!="0": raise RuntimeError(f"OKX candles: {payload.get('msg')}")
        result=[]
        for x in payload.get("data") or []:
            if len(x)<5: continue
            result.append(Candle(provider=self.provider,canonical_id=quote.canonical_id,interval=interval,ts_ms=int(x[0]),open=_required(x[1],"open"),high=_required(x[2],"high"),low=_required(x[3],"low"),close=_required(x[4],"close"),volume=_f(x[5]) if len(x)>5 else None,turnover=_f(x[7]) if len(x)>7 else _f(x[6]) if len(x)>6 else None,source="okx"))
        return sorted(result,key=lambda x:x.ts_ms)


class MoexSource(MarketSource):
    provider="moex"; name="MOEX ISS"; BASE="https://iss.moex.com/iss/engines"; markets=("Акции","FORTS","Валютный рынок","Индексы","Облигации")
    asset_classes=(AssetClass.STOCK,AssetClass.FUTURE,AssetClass.FX,AssetClass.INDEX,AssetClass.BOND); data_fields=("цена","bid/ask","изменение","объём/оборот","OI FORTS","торговый статус","свечи ISS")
    description="Московская биржа: акции, срочный рынок, валюты, индексы и облигации через ISS."
    def __init__(self,http:JsonHttp)->None: super().__init__(); self.http=http
    @staticmethod
    def _section(payload:dict[str,Any],name:str="marketdata")->list[dict[str,Any]]:
        section=payload.get(name) or {}; columns=section.get("columns") or []; return [dict(zip(columns,row,strict=False)) for row in section.get("data") or []]
    async def _fetch_market(self,engine:str,market:str,asset_class:AssetClass,market_type:str)->list[Quote]:
        payload=await self.http.get_json(f"{self.BASE}/{engine}/markets/{market}/securities.json",{"iss.meta":"off","iss.only":"securities,marketdata"})
        observed=_now_ms(); securities={str(x.get("SECID")):x for x in self._section(payload,"securities") if x.get("SECID")}; best={}
        for row in self._section(payload,"marketdata"):
            symbol=str(row.get("SECID") or "")
            if not symbol: continue
            sec=securities.get(symbol,{}); last=_f(row.get("LAST") or row.get("SETTLEPRICE") or row.get("MARKETPRICE") or row.get("CURRENTVALUE")); pct=_f(row.get("LASTTOPREVPRICE") or row.get("LASTCHANGEPRCNT") or row.get("CHANGE") or row.get("LASTCHANGE")); turnover=_f(row.get("VALTODAY") or row.get("VALTODAY_RUR") or row.get("VALUE"))
            quote=Quote(provider=self.provider,venue="MOEX",symbol=symbol,display_symbol=str(sec.get("SHORTNAME") or sec.get("SECNAME") or symbol),asset_class=asset_class,market_type=market_type,currency=str(sec.get("CURRENCYID") or "RUB"),last=last,bid=_f(row.get("BID") or row.get("BIDPRICE")),ask=_f(row.get("OFFER") or row.get("OFFERPRICE")),high_24h=_f(row.get("HIGH")),low_24h=_f(row.get("LOW")),volume_24h=_f(row.get("VOLTODAY") or row.get("VOLUME")),turnover_24h=turnover,change_24h_pct=pct,open_interest=_f(row.get("OPENPOSITION")),ts_ms=observed,observed_at_ms=observed,meta={"board":row.get("BOARDID"),"trading_status":row.get("TRADINGSTATUS"),"shortname":sec.get("SHORTNAME"),"secname":sec.get("SECNAME"),"type":sec.get("TYPE"),"group":sec.get("GROUP"),"engine":engine,"market":market})
            previous=best.get(symbol)
            if previous is None or (quote.turnover_24h or -1)>(previous.turnover_24h or -1): best[symbol]=quote
        return list(best.values())
    async def fetch_quotes(self)->list[Quote]:
        return await self._gather_parts((("shares",self._fetch_market("stock","shares",AssetClass.STOCK,"shares")),("forts",self._fetch_market("futures","forts",AssetClass.FUTURE,"forts")),("currency",self._fetch_market("currency","selt",AssetClass.FX,"selt")),("indices",self._fetch_market("stock","index",AssetClass.INDEX,"index")),("bonds",self._fetch_market("stock","bonds",AssetClass.BOND,"bonds"))))
    async def fetch_candles(self,quote:Quote,interval:str="5m",limit:int=500)->list[Candle]:
        engine=str(quote.meta.get("engine") or ""); market=str(quote.meta.get("market") or ""); board=str(quote.meta.get("board") or "")
        if not engine or not market or not board: return []
        days=max(3,min(14,(limit*10)//(60*10)+3)); start=(datetime.now(ZoneInfo("Europe/Moscow"))-timedelta(days=days)).date().isoformat()
        url=f"{self.BASE}/{engine}/markets/{market}/boards/{board}/securities/{quote.symbol}/candles.json"
        payload=await self.http.get_json(url,{"iss.meta":"off","interval":"10","from":start})
        result=[]
        for row in self._section(payload,"candles"):
            begin=row.get("begin")
            if not begin: continue
            try:
                dt=datetime.fromisoformat(str(begin)).replace(tzinfo=ZoneInfo("Europe/Moscow")); ts_ms=int(dt.timestamp()*1000)
            except ValueError: continue
            o,h,l,c=_f(row.get("open")),_f(row.get("high")),_f(row.get("low")),_f(row.get("close"))
            if None in (o,h,l,c): continue
            result.append(Candle(provider=self.provider,canonical_id=quote.canonical_id,interval="10m",ts_ms=ts_ms,open=float(o),high=float(h),low=float(l),close=float(c),volume=_f(row.get("volume")),turnover=_f(row.get("value")),source="moex-iss"))
        return sorted(result,key=lambda x:x.ts_ms)[-limit:]


class TwelveDataSource(MarketSource):
    provider="twelvedata"; name="Twelve Data"; markets=("США/мировые акции","ETF","другие тикеры по подписке"); asset_classes=(AssetClass.STOCK,AssetClass.ETF,AssetClass.FX)
    data_fields=("цена","OHLC","объём","изменение"); access="Нужен API key Twelve Data"; description="Опциональный мировой рынок. Включается через .env."
    def __init__(self,http:JsonHttp,api_key:str,symbols:list[str])->None: super().__init__(); self.http,self.api_key,self.symbols=http,api_key,symbols
    async def fetch_quotes(self)->list[Quote]:
        if not self.api_key or not self.symbols: return []
        payload=await self.http.get_json("https://api.twelvedata.com/quote",{"symbol":",".join(self.symbols),"apikey":self.api_key,"interval":"1min"}); rows=payload if any(k in payload for k in self.symbols) else {self.symbols[0]:payload}; observed=_now_ms(); result=[]
        for requested,row in rows.items():
            if not isinstance(row,dict) or row.get("status")=="error": continue
            symbol=str(row.get("symbol") or requested); close=_f(row.get("close")); previous=_f(row.get("previous_close")); pct=_f(row.get("percent_change"))
            if pct is None and close is not None and previous not in (None,0): pct=(close/previous-1)*100
            timestamp=_i(row.get("timestamp")); ts_ms=timestamp*1000 if timestamp and timestamp<10_000_000_000 else (timestamp or observed)
            result.append(Quote(provider=self.provider,venue=str(row.get("exchange") or "GLOBAL"),symbol=symbol,asset_class=AssetClass.STOCK,market_type="stock",currency=row.get("currency"),last=close,open_24h=_f(row.get("open")),high_24h=_f(row.get("high")),low_24h=_f(row.get("low")),volume_24h=_f(row.get("volume")),change_24h_pct=pct,ts_ms=ts_ms,observed_at_ms=observed,meta={"name":row.get("name")}))
        return result
