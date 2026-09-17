from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable
from zoneinfo import ZoneInfo

from .http import JsonHttp
from .lake import DataLake
from .models import Candle

Progress = Callable[[float, str], Awaitable[None] | None]


def _interval_ms(interval: str) -> int:
    unit = interval[-1].lower(); value = int(interval[:-1])
    if unit == 'm': return value * 60_000
    if unit == 'h': return value * 3_600_000
    if unit == 'd': return value * 86_400_000
    raise ValueError(f'unsupported interval {interval}')


async def _progress(cb: Progress | None, value: float, message: str) -> None:
    if cb is None: return
    result = cb(max(0.0, min(value, 1.0)), message)
    if asyncio.iscoroutine(result): await result


class HistoricalBackfiller:
    def __init__(self, http: JsonHttp, lake: DataLake) -> None:
        self.http = http
        self.lake = lake

    async def backfill_binance(self, *, symbol: str, market_type: str, interval: str,
                               start_ms: int, end_ms: int, progress: Progress | None = None) -> dict[str, Any]:
        futures = market_type != 'spot'
        url = 'https://fapi.binance.com/fapi/v1/klines' if futures else 'https://data-api.binance.vision/api/v3/klines'
        canonical_id = f"binance:{'usdt-futures' if futures else 'spot'}:{symbol}"
        cursor = start_ms; rows_total = 0; pages = 0; step = _interval_ms(interval)
        while cursor <= end_ms:
            payload = await self.http.get_json(url, {'symbol': symbol, 'interval': interval, 'startTime': cursor, 'endTime': end_ms, 'limit': 1000})
            if not isinstance(payload, list) or not payload: break
            candles: list[Candle] = []
            for x in payload:
                if len(x) < 6: continue
                ts = int(x[0])
                candles.append(Candle(provider='binance', canonical_id=canonical_id, interval=interval, ts_ms=ts,
                                      open=float(x[1]), high=float(x[2]), low=float(x[3]), close=float(x[4]),
                                      volume=float(x[5]), turnover=float(x[7]) if len(x) > 7 else None, source='binance-history'))
            if not candles: break
            self.lake.write_candles(candles); rows_total += len(candles); pages += 1
            next_cursor = candles[-1].ts_ms + step
            if next_cursor <= cursor: break
            cursor = next_cursor
            await _progress(progress, (cursor - start_ms) / max(1, end_ms - start_ms), f'Binance {symbol}: {rows_total:,} свечей')
            await asyncio.sleep(0.05)
        await _progress(progress, 1.0, f'Binance {symbol}: готово, {rows_total:,} свечей')
        return {'provider':'binance','canonical_id':canonical_id,'interval':interval,'rows':rows_total,'pages':pages,'start_ms':start_ms,'end_ms':end_ms}

    @staticmethod
    def _moex_interval(interval: str) -> int:
        mapping = {'1m':1, '10m':10, '1h':60, '1d':24, '1w':7, '1mo':31}
        if interval not in mapping: raise ValueError(f'MOEX interval {interval} is not supported; use one of {sorted(mapping)}')
        return mapping[interval]

    @staticmethod
    def _moex_ts(value: Any) -> int:
        text = str(value)
        dt = datetime.fromisoformat(text.replace('Z', '+00:00'))
        if dt.tzinfo is None: dt = dt.replace(tzinfo=ZoneInfo('Europe/Moscow'))
        return int(dt.astimezone(timezone.utc).timestamp() * 1000)

    async def backfill_moex(self, *, symbol: str, engine: str, market: str, market_type: str,
                            interval: str, start_ms: int, end_ms: int, progress: Progress | None = None) -> dict[str, Any]:
        iv = self._moex_interval(interval)
        start_date = datetime.fromtimestamp(start_ms/1000, timezone.utc).date().isoformat()
        end_date = datetime.fromtimestamp(end_ms/1000, timezone.utc).date().isoformat()
        canonical_id = f'moex:{market_type}:{symbol}'
        url = f'https://iss.moex.com/iss/engines/{engine}/markets/{market}/securities/{symbol}/candles.json'
        offset = 0; rows_total = 0; pages = 0
        while True:
            payload = await self.http.get_json(url, {'from': start_date, 'till': end_date, 'interval': iv, 'start': offset, 'iss.meta': 'off'})
            block = payload.get('candles') if isinstance(payload, dict) else None
            if not isinstance(block, dict): break
            columns = block.get('columns') or []; data = block.get('data') or []
            if not data: break
            idx = {name:i for i,name in enumerate(columns)}
            candles: list[Candle] = []
            for row in data:
                try:
                    ts = self._moex_ts(row[idx['begin']]); close = float(row[idx['close']])
                    candles.append(Candle(provider='moex', canonical_id=canonical_id, interval=interval, ts_ms=ts,
                        open=float(row[idx['open']]), high=float(row[idx['high']]), low=float(row[idx['low']]), close=close,
                        volume=float(row[idx['volume']]) if 'volume' in idx and row[idx['volume']] is not None else None,
                        turnover=float(row[idx['value']]) if 'value' in idx and row[idx['value']] is not None else None,
                        source='moex-iss-history'))
                except Exception: continue
            if candles:
                self.lake.write_candles(candles); rows_total += len(candles)
            pages += 1; offset += len(data)
            cursor = payload.get('candles.cursor') if isinstance(payload, dict) else None
            total = None
            if isinstance(cursor, dict) and cursor.get('data'):
                ccols = cursor.get('columns') or []; crow = cursor['data'][0]; cmap = {n:i for i,n in enumerate(ccols)}
                if 'TOTAL' in cmap: total = int(crow[cmap['TOTAL']])
            await _progress(progress, min(0.99, offset/max(1,total or offset+1)), f'MOEX {symbol}: {rows_total:,} свечей')
            if total is not None and offset >= total: break
            if len(data) == 0: break
            await asyncio.sleep(0.08)
        await _progress(progress, 1.0, f'MOEX {symbol}: готово, {rows_total:,} свечей')
        return {'provider':'moex','canonical_id':canonical_id,'interval':interval,'rows':rows_total,'pages':pages,
                'engine':engine,'market':market,'start_ms':start_ms,'end_ms':end_ms}

    async def backfill(self, payload: dict[str, Any], progress: Progress | None = None) -> dict[str, Any]:
        provider = str(payload.get('provider','')).lower()
        start_ms = int(payload.get('start_ms') or int(datetime(2021,1,1,tzinfo=timezone.utc).timestamp()*1000))
        end_ms = int(payload.get('end_ms') or int(time.time()*1000))
        if provider == 'binance':
            return await self.backfill_binance(symbol=str(payload['symbol']), market_type=str(payload.get('market_type','usdt-futures')),
                                                interval=str(payload.get('interval','5m')), start_ms=start_ms, end_ms=end_ms, progress=progress)
        if provider == 'moex':
            return await self.backfill_moex(symbol=str(payload['symbol']), engine=str(payload.get('engine','stock')),
                                            market=str(payload.get('market','shares')), market_type=str(payload.get('market_type','shares')),
                                            interval=str(payload.get('interval','10m')), start_ms=start_ms, end_ms=end_ms, progress=progress)
        raise ValueError(f'provider {provider} does not have bulk historical backfill yet')
