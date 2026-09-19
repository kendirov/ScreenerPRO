from __future__ import annotations

import asyncio
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable
from zoneinfo import ZoneInfo

from .http import JsonHttp
from .metric_lake import MetricLake, MetricPoint

Progress = Callable[[float, str], Awaitable[None] | None]
_DAY_MS = 86_400_000


async def _progress(cb: Progress | None, value: float, message: str) -> None:
    if cb is None:
        return
    result = cb(max(0.0, min(float(value), 1.0)), message)
    if asyncio.iscoroutine(result):
        await result


def _f(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _moex_ts(tradedate: Any, tradetime: Any) -> int | None:
    if not tradedate:
        return None
    try:
        text = f"{tradedate}T{tradetime or '00:00:00'}"
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=ZoneInfo("Europe/Moscow"))
        return int(dt.astimezone(timezone.utc).timestamp() * 1000)
    except Exception:
        return None


def parse_binance_funding(rows: list[dict[str, Any]], canonical_id: str) -> list[MetricPoint]:
    out: list[MetricPoint] = []
    for row in rows:
        rate = _f(row.get("fundingRate")); ts = int(row.get("fundingTime") or 0)
        if not ts or rate is None:
            continue
        meta = {"symbol": row.get("symbol"), "rate_type": row.get("rateType") or "Regular"}
        mark = _f(row.get("markPrice"))
        out.append(MetricPoint(provider="binance", canonical_id=canonical_id, metric="funding_rate", ts_ms=ts,
                               value=rate, unit="ratio", source="binance-fapi-fundingRate", meta=meta))
        if mark is not None:
            out.append(MetricPoint(provider="binance", canonical_id=canonical_id, metric="funding_mark_price", ts_ms=ts,
                                   value=mark, unit="quote_currency", source="binance-fapi-fundingRate", meta=meta))
    return out


def parse_binance_open_interest(rows: list[dict[str, Any]], canonical_id: str) -> list[MetricPoint]:
    out: list[MetricPoint] = []
    for row in rows:
        ts = int(row.get("timestamp") or 0); oi = _f(row.get("sumOpenInterest")); oi_value = _f(row.get("sumOpenInterestValue"))
        if not ts:
            continue
        meta = {"symbol": row.get("symbol"), "history_limit": "latest_1_month",
                "cmc_circulating_supply": _f(row.get("CMCCirculatingSupply"))}
        if oi is not None:
            out.append(MetricPoint(provider="binance", canonical_id=canonical_id, metric="open_interest", ts_ms=ts,
                                   value=oi, unit="provider_contract_or_base_quantity", source="binance-openInterestHist", meta=meta))
        if oi_value is not None:
            out.append(MetricPoint(provider="binance", canonical_id=canonical_id, metric="open_interest_value", ts_ms=ts,
                                   value=oi_value, unit="quote_value", source="binance-openInterestHist", meta=meta))
    return out


def parse_binance_basis(rows: list[dict[str, Any]], canonical_id: str) -> list[MetricPoint]:
    out: list[MetricPoint] = []
    for row in rows:
        ts = int(row.get("timestamp") or 0)
        if not ts:
            continue
        meta = {"pair": row.get("pair"), "contract_type": row.get("contractType") or "PERPETUAL"}
        for metric, field, unit in (
            ("basis_rate", "basisRate", "ratio"), ("annualized_basis_rate", "annualizedBasisRate", "ratio"),
            ("basis", "basis", "quote_currency"), ("basis_index_price", "indexPrice", "quote_currency"),
            ("basis_futures_price", "futuresPrice", "quote_currency"),
        ):
            value = _f(row.get(field))
            if value is not None:
                out.append(MetricPoint(provider="binance", canonical_id=canonical_id, metric=metric, ts_ms=ts,
                                       value=value, unit=unit, source="binance-basis", meta=meta))
    return out


def parse_bybit_funding(rows: list[dict[str, Any]], canonical_id: str) -> list[MetricPoint]:
    out: list[MetricPoint] = []
    for row in rows:
        ts = int(row.get("fundingRateTimestamp") or row.get("timestamp") or 0); value = _f(row.get("fundingRate"))
        if not ts or value is None:
            continue
        out.append(MetricPoint(provider="bybit", canonical_id=canonical_id, metric="funding_rate", ts_ms=ts,
                               value=value, unit="ratio", source="bybit-v5-funding-history",
                               meta={"symbol": row.get("symbol"), "category": "linear"}))
    return out


def parse_bybit_open_interest(rows: list[dict[str, Any]], canonical_id: str) -> list[MetricPoint]:
    out: list[MetricPoint] = []
    for row in rows:
        ts = int(row.get("timestamp") or 0); value = _f(row.get("openInterest"))
        if not ts or value is None:
            continue
        out.append(MetricPoint(provider="bybit", canonical_id=canonical_id, metric="open_interest", ts_ms=ts,
                               value=value, unit="provider_contract_or_base_quantity", source="bybit-v5-open-interest",
                               meta={"symbol": row.get("symbol"), "category": "linear", "interval": row.get("intervalTime") or "5min"}))
    return out


def parse_moex_futoi(block: dict[str, Any], canonical_id: str, *, delayed: bool = True) -> list[MetricPoint]:
    columns = [str(x).lower() for x in (block.get("columns") or [])]; idx = {name: i for i, name in enumerate(columns)}
    out: list[MetricPoint] = []
    required = {"clgroup", "pos_long", "pos_short", "pos_long_num", "pos_short_num", "tradedate"}
    if not required.issubset(idx):
        return out
    for row in block.get("data") or []:
        try:
            group = str(row[idx["clgroup"]] or "").lower()
            if group not in {"fiz", "yur"}:
                continue
            ts = _moex_ts(row[idx["tradedate"]], row[idx.get("tradetime", idx["tradedate"])] if "tradetime" in idx else None)
            if not ts:
                continue
            raw_short = _f(row[idx["pos_short"]]); raw_pos = _f(row[idx["pos"]]) if "pos" in idx else None
            meta = {"ticker": row[idx["ticker"]] if "ticker" in idx else None, "client_group": group, "delayed": delayed,
                    "delay_note": "unauthorized ISS is delayed by 15 days" if delayed else "authorized real-time",
                    "raw_pos": raw_pos, "raw_pos_short": raw_short,
                    "seqnum": row[idx["seqnum"]] if "seqnum" in idx else None,
                    "session_id": row[idx["sess_id"]] if "sess_id" in idx else None,
                    "systime": row[idx["systime"]] if "systime" in idx else None}
            values = {
                f"futoi_{group}_long_contracts": (_f(row[idx["pos_long"]]), "contracts"),
                f"futoi_{group}_short_contracts": (abs(raw_short) if raw_short is not None else None, "contracts"),
                f"futoi_{group}_long_accounts": (_f(row[idx["pos_long_num"]]), "accounts"),
                f"futoi_{group}_short_accounts": (_f(row[idx["pos_short_num"]]), "accounts"),
                f"futoi_{group}_net_contracts": (raw_pos, "contracts_signed"),
            }
            for metric, (value, unit) in values.items():
                if value is not None:
                    out.append(MetricPoint(provider="moex", canonical_id=canonical_id, metric=metric, ts_ms=ts,
                                           value=float(value), unit=unit, source="moex-algopack-futoi", meta=meta))
        except Exception:
            continue
    return out


class DerivativeMetricBackfiller:
    """Historical derivative context that complements candles.

    Provider limitations are stored in provenance. Binance public OI/basis is
    deliberately treated as recent-only; Bybit is a second independent OI/funding
    history source; MOEX FUTOI stays an underlying-level participant aggregate.
    """

    def __init__(self, http: JsonHttp, lake: MetricLake) -> None:
        self.http = http; self.lake = lake

    async def _binance_paged(self, url: str, params: dict[str, Any], *, start_ms: int, end_ms: int, ts_field: str,
                             limit: int, period_ms: int, progress: Progress | None, label: str, lo: float, hi: float) -> list[dict[str, Any]]:
        cursor = int(start_ms); collected: list[dict[str, Any]] = []
        while cursor <= end_ms:
            query = dict(params); query.update({"startTime": cursor, "endTime": int(end_ms), "limit": int(limit)})
            payload = await self.http.get_json(url, query)
            if not isinstance(payload, list) or not payload:
                break
            rows = [x for x in payload if isinstance(x, dict)]; collected.extend(rows)
            last = max((int(x.get(ts_field) or 0) for x in rows), default=0)
            if last <= cursor:
                break
            cursor = last + max(1, period_ms); frac = (cursor - start_ms) / max(1, end_ms - start_ms)
            await _progress(progress, lo + min(1.0, frac) * (hi - lo), f"{label}: {len(collected):,} точек")
            if len(rows) < limit:
                break
            await asyncio.sleep(0.04)
        return collected

    async def _binance_recent_backward(self, url: str, params: dict[str, Any], *, start_ms: int, end_ms: int,
                                       ts_field: str, limit: int, period_ms: int, progress: Progress | None,
                                       label: str, lo: float, hi: float) -> list[dict[str, Any]]:
        end_cursor=int(end_ms); collected: list[dict[str, Any]]=[]
        while end_cursor >= int(start_ms):
            query=dict(params); query.update({"startTime":int(start_ms),"endTime":end_cursor,"limit":int(limit)})
            payload=await self.http.get_json(url,query)
            if not isinstance(payload,list) or not payload: break
            rows=[x for x in payload if isinstance(x,dict)]
            collected.extend(rows)
            first=min((int(x.get(ts_field) or 0) for x in rows),default=0)
            if first <= int(start_ms) or len(rows) < limit: break
            next_end=first-max(1,period_ms)
            if next_end >= end_cursor: break
            end_cursor=next_end
            frac=(int(end_ms)-end_cursor)/max(1,int(end_ms)-int(start_ms))
            await _progress(progress,lo+min(1.0,frac)*(hi-lo),f"{label}: {len(collected):,} точек")
            await asyncio.sleep(0.15)
        unique={int(x.get(ts_field) or 0):x for x in collected if int(x.get(ts_field) or 0)}
        return [unique[k] for k in sorted(unique)]

    async def backfill_binance(self, *, symbol: str, start_ms: int, end_ms: int, progress: Progress | None = None) -> dict[str, Any]:
        canonical_id=f"binance:usdt-futures:{symbol}"; written: dict[str,int]=defaultdict(int); warnings=[]
        month_start=max(int(start_ms),int(end_ms)-29*_DAY_MS)
        await _progress(progress,0.02,f"Binance {symbol}: OI recent public window")
        oi=await self._binance_recent_backward(
            "https://fapi.binance.com/futures/data/openInterestHist",{"symbol":symbol,"period":"15m"},
            start_ms=month_start,end_ms=end_ms,ts_field="timestamp",limit=500,period_ms=900_000,
            progress=progress,label=f"Binance {symbol} OI",lo=0.02,hi=0.56)
        oi_stats=await asyncio.to_thread(self.lake.write,parse_binance_open_interest(oi,canonical_id))
        written["open_interest"]+=oi_stats["rows_ingested"]
        funding=[]
        try:
            await _progress(progress,0.58,f"Binance {symbol}: funding history")
            funding=await self._binance_paged("https://fapi.binance.com/fapi/v1/fundingRate",{"symbol":symbol},
                start_ms=start_ms,end_ms=end_ms,ts_field="fundingTime",limit=1000,period_ms=1,
                progress=progress,label=f"Binance {symbol} funding",lo=0.58,hi=0.78)
            st=await asyncio.to_thread(self.lake.write,parse_binance_funding(funding,canonical_id)); written["funding_rate"]+=st["rows_ingested"]
        except Exception as exc:
            warnings.append(f"funding partial: {type(exc).__name__}: {str(exc)[:220]}")
        basis=[]
        try:
            await _progress(progress,0.80,f"Binance {symbol}: basis optional")
            basis=await self._binance_recent_backward(
                "https://fapi.binance.com/futures/data/basis",{"pair":symbol,"contractType":"PERPETUAL","period":"15m"},
                start_ms=month_start,end_ms=end_ms,ts_field="timestamp",limit=500,period_ms=900_000,
                progress=progress,label=f"Binance {symbol} basis",lo=0.80,hi=0.98)
            st=await asyncio.to_thread(self.lake.write,parse_binance_basis(basis,canonical_id)); written["basis"]+=st["rows_ingested"]
        except Exception as exc:
            warnings.append(f"basis partial: {type(exc).__name__}: {str(exc)[:220]}")
        await _progress(progress,1.0,f"Binance {symbol}: OI ready; optional metrics best effort")
        return {"provider":"binance","canonical_id":canonical_id,"symbol":symbol,
                "funding_rows":len(funding),"oi_rows":len(oi),"basis_rows":len(basis),"points_written":dict(written),
                "warnings":warnings,"status":"partial" if warnings else "ok",
                "coverage":{"funding_start_ms":start_ms,"oi_basis_public_limit":"latest_30_days","oi_period":"15m"}}

    async def _bybit_open_interest(self, symbol: str, start_ms: int, end_ms: int, progress: Progress | None) -> list[dict[str, Any]]:
        url = "https://api.bybit.com/v5/market/open-interest"; cursor: str | None = None; rows: list[dict[str, Any]] = []
        while True:
            params: dict[str, Any] = {"category": "linear", "symbol": symbol, "intervalTime": "5min", "startTime": int(start_ms), "endTime": int(end_ms), "limit": 200}
            if cursor:
                params["cursor"] = cursor
            payload = await self.http.get_json(url, params)
            if str(payload.get("retCode")) != "0":
                raise RuntimeError(f"Bybit OI: {payload.get('retMsg')}")
            result = payload.get("result") or {}; chunk = [x for x in (result.get("list") or []) if isinstance(x, dict)]
            rows.extend(chunk); cursor = str(result.get("nextPageCursor") or "") or None
            await _progress(progress, min(0.48, 0.05 + len(rows) / 5000 * 0.4), f"Bybit {symbol} OI: {len(rows):,} точек")
            if not cursor or not chunk:
                break
            await asyncio.sleep(0.05)
        return rows

    async def _bybit_funding(self, symbol: str, start_ms: int, end_ms: int, progress: Progress | None) -> list[dict[str, Any]]:
        # Funding history is returned newest-first. Walk backwards by endTime.
        url = "https://api.bybit.com/v5/market/funding/history"; cursor_end = int(end_ms); rows: list[dict[str, Any]] = []
        while cursor_end >= start_ms:
            payload = await self.http.get_json(url, {"category": "linear", "symbol": symbol, "endTime": cursor_end, "limit": 200})
            if str(payload.get("retCode")) != "0":
                raise RuntimeError(f"Bybit funding: {payload.get('retMsg')}")
            chunk = [x for x in ((payload.get("result") or {}).get("list") or []) if isinstance(x, dict)]
            if not chunk:
                break
            eligible = [x for x in chunk if int(x.get("fundingRateTimestamp") or 0) >= start_ms]
            rows.extend(eligible)
            earliest = min((int(x.get("fundingRateTimestamp") or 0) for x in chunk if int(x.get("fundingRateTimestamp") or 0) > 0), default=0)
            await _progress(progress, min(0.98, 0.52 + len(rows) / 4000 * 0.42), f"Bybit {symbol} funding: {len(rows):,} точек")
            if not earliest or earliest <= start_ms or len(chunk) < 200:
                break
            cursor_end = earliest - 1
            await asyncio.sleep(0.05)
        return rows

    async def backfill_bybit(self, *, symbol: str, start_ms: int, end_ms: int, progress: Progress | None = None) -> dict[str, Any]:
        canonical_id = f"bybit:linear:{symbol}"
        oi = await self._bybit_open_interest(symbol, start_ms, end_ms, progress)
        funding = await self._bybit_funding(symbol, start_ms, end_ms, progress)
        oi_stats = self.lake.write(parse_bybit_open_interest(oi, canonical_id)); fund_stats = self.lake.write(parse_bybit_funding(funding, canonical_id))
        await _progress(progress, 1.0, f"Bybit {symbol}: OI/funding готовы")
        return {"provider": "bybit", "canonical_id": canonical_id, "symbol": symbol, "oi_rows": len(oi), "funding_rows": len(funding),
                "points_written": oi_stats["rows_ingested"] + fund_stats["rows_ingested"],
                "coverage": {"requested_start_ms": start_ms, "requested_end_ms": end_ms, "oi_endpoint": "v5/open-interest", "funding_endpoint": "v5/funding/history"}}

    async def backfill_moex_futoi(self, *, symbol: str, start_ms: int, end_ms: int, progress: Progress | None = None,
                                  authorized: bool = False) -> dict[str, Any]:
        root = str(symbol).upper(); canonical_id = f"moex:futoi:{root}"
        start_date = datetime.fromtimestamp(start_ms / 1000, timezone.utc).date(); end_date = datetime.fromtimestamp(end_ms / 1000, timezone.utc).date()
        cursor_date = start_date; total_rows = total_points = pages = 0; window_days = 7
        while cursor_date <= end_date:
            window_end = min(end_date, cursor_date + timedelta(days=window_days - 1)); offset = 0
            while True:
                url = f"https://iss.moex.com/iss/analyticalproducts/futoi/securities/{root}.json"
                params = {"from": cursor_date.isoformat(), "till": window_end.isoformat(), "start": offset, "iss.meta": "off"}
                payload = await self.http.get_json(url, params, timeout_s=20); block = payload.get("futoi") if isinstance(payload, dict) else None
                if not isinstance(block, dict):
                    break
                data = block.get("data") or []
                if not data:
                    break
                stats = await asyncio.to_thread(self.lake.write, parse_moex_futoi(block, canonical_id, delayed=not authorized)); total_rows += len(data); total_points += stats["rows_ingested"]; pages += 1; offset += len(data)
                if len(data) < 1000:
                    break
                await asyncio.sleep(0.05)
            elapsed = (window_end - start_date).days + 1; total_days = max(1, (end_date - start_date).days + 1)
            await _progress(progress, elapsed / total_days, f"MOEX FUTOI {root}: {total_rows:,} строк · {total_points:,} метрик")
            cursor_date = window_end + timedelta(days=1); await asyncio.sleep(0.03)
        await _progress(progress, 1.0, f"MOEX FUTOI {root}: готово")
        return {"provider": "moex", "canonical_id": canonical_id, "symbol": root, "rows": total_rows, "points": total_points, "pages": pages,
                "delayed": not authorized, "delay_note": "unauthorized ISS: 15-day delay" if not authorized else "authorized real-time"}

    async def backfill(self, payload: dict[str, Any], progress: Progress | None = None) -> dict[str, Any]:
        provider = str(payload.get("provider") or "").lower(); start_ms = int(payload.get("start_ms") or int(datetime(2021, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)); end_ms = int(payload.get("end_ms") or int(time.time() * 1000))
        if provider == "binance":
            return await self.backfill_binance(symbol=str(payload["symbol"]), start_ms=start_ms, end_ms=end_ms, progress=progress)
        if provider == "bybit":
            from .bybit_metrics import BybitLongHistoryBackfiller
            return await BybitLongHistoryBackfiller(self.http, self.lake).backfill(
                symbol=str(payload["symbol"]), start_ms=start_ms, end_ms=end_ms, progress=progress
            )
        if provider == "moex":
            return await self.backfill_moex_futoi(symbol=str(payload["symbol"]), start_ms=start_ms, end_ms=end_ms, progress=progress, authorized=bool(payload.get("authorized", False)))
        raise ValueError(f"provider {provider} does not have derivative metric backfill yet")
