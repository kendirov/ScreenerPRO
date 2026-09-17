from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable

from .derivative_metrics import parse_bybit_funding, parse_bybit_open_interest
from .http import JsonHttp
from .metric_lake import MetricLake

Progress = Callable[[float, str], Awaitable[None] | None]


async def _progress(cb: Progress | None, value: float, message: str) -> None:
    if cb is None:
        return
    result = cb(max(0.0, min(float(value), 1.0)), message)
    if asyncio.iscoroutine(result):
        await result


class BybitLongHistoryBackfiller:
    """Bounded provider-native Bybit OI/funding history for visual/research context.

    OI uses 1h bars for long history. This is deliberate: 5m history across
    years is unnecessarily expensive for the initial context layer. The live
    collector still provides current values independently.
    """

    OI_URL = "https://api.bybit.com/v5/market/open-interest"
    FUNDING_URL = "https://api.bybit.com/v5/market/funding/history"
    OI_INTERVAL = "1h"
    MAX_OI_PAGES = 500
    MAX_FUNDING_PAGES = 250

    def __init__(self, http: JsonHttp, lake: MetricLake) -> None:
        self.http = http
        self.lake = lake

    async def _oi(self, symbol: str, start_ms: int, end_ms: int, progress: Progress | None) -> tuple[list[dict[str, Any]], int]:
        cursor: str | None = None
        rows: list[dict[str, Any]] = []
        pages = 0
        while pages < self.MAX_OI_PAGES:
            params: dict[str, Any] = {
                "category": "linear", "symbol": symbol, "intervalTime": self.OI_INTERVAL,
                "startTime": int(start_ms), "endTime": int(end_ms), "limit": 200,
            }
            if cursor:
                params["cursor"] = cursor
            payload = await self.http.get_json(self.OI_URL, params, timeout_s=20)
            if str(payload.get("retCode")) != "0":
                raise RuntimeError(f"Bybit OI: {payload.get('retMsg')}")
            result = payload.get("result") or {}
            chunk = [x for x in (result.get("list") or []) if isinstance(x, dict)]
            for row in chunk:
                row.setdefault("intervalTime", self.OI_INTERVAL)
            rows.extend(chunk); pages += 1
            cursor = str(result.get("nextPageCursor") or "") or None
            await _progress(progress, min(.62, .04 + pages / self.MAX_OI_PAGES * .58), f"Bybit {symbol} OI 1h: {len(rows):,} точек · page {pages}")
            if not cursor or not chunk:
                break
            await asyncio.sleep(.05)
        if cursor and pages >= self.MAX_OI_PAGES:
            raise RuntimeError(f"Bybit {symbol} OI exceeded {self.MAX_OI_PAGES} page safety limit; narrow/deepen history in tiers")
        return rows, pages

    async def _funding(self, symbol: str, start_ms: int, end_ms: int, progress: Progress | None) -> tuple[list[dict[str, Any]], int]:
        cursor_end = int(end_ms); rows: list[dict[str, Any]] = []; pages = 0
        while cursor_end >= start_ms and pages < self.MAX_FUNDING_PAGES:
            payload = await self.http.get_json(self.FUNDING_URL, {"category":"linear","symbol":symbol,"endTime":cursor_end,"limit":200}, timeout_s=20)
            if str(payload.get("retCode")) != "0":
                raise RuntimeError(f"Bybit funding: {payload.get('retMsg')}")
            chunk = [x for x in ((payload.get("result") or {}).get("list") or []) if isinstance(x, dict)]
            pages += 1
            if not chunk:
                break
            eligible = [x for x in chunk if int(x.get("fundingRateTimestamp") or 0) >= start_ms]
            rows.extend(eligible)
            earliest = min((int(x.get("fundingRateTimestamp") or 0) for x in chunk if int(x.get("fundingRateTimestamp") or 0)>0), default=0)
            await _progress(progress, min(.96,.64+pages/self.MAX_FUNDING_PAGES*.32), f"Bybit {symbol} funding: {len(rows):,} точек · page {pages}")
            if not earliest or earliest <= start_ms or len(chunk) < 200:
                break
            cursor_end = earliest - 1
            await asyncio.sleep(.05)
        if pages >= self.MAX_FUNDING_PAGES and cursor_end >= start_ms:
            raise RuntimeError(f"Bybit {symbol} funding exceeded {self.MAX_FUNDING_PAGES} page safety limit")
        return rows, pages

    async def backfill(self, *, symbol: str, start_ms: int, end_ms: int, progress: Progress | None = None) -> dict[str, Any]:
        cid = f"bybit:linear:{symbol}"
        # Incremental continuation with a small overlap.
        oi_bounds = self.lake.bounds(cid, "open_interest")
        fund_bounds = self.lake.bounds(cid, "funding_rate")
        oi_start = max(int(start_ms), int(oi_bounds.get("last_ms") or start_ms) - 3_600_000)
        fund_start = max(int(start_ms), int(fund_bounds.get("last_ms") or start_ms) - 8 * 3_600_000)
        oi, oi_pages = await self._oi(symbol, oi_start, end_ms, progress)
        funding, funding_pages = await self._funding(symbol, fund_start, end_ms, progress)
        oi_stats = self.lake.write(parse_bybit_open_interest(oi, cid))
        fund_stats = self.lake.write(parse_bybit_funding(funding, cid))
        await _progress(progress, 1.0, f"Bybit {symbol}: long-history OI/funding готовы")
        return {
            "provider":"bybit","canonical_id":cid,"symbol":symbol,
            "oi_rows":len(oi),"funding_rows":len(funding),"oi_pages":oi_pages,"funding_pages":funding_pages,
            "points_written":oi_stats["rows_ingested"]+fund_stats["rows_ingested"],
            "coverage":{"requested_start_ms":start_ms,"oi_start_ms":oi_start,"funding_start_ms":fund_start,"oi_interval":"1h","page_safety":True},
        }
