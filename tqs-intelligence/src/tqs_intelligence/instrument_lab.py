from __future__ import annotations

import json
from typing import Any


class InstrumentLab:
    """Universal trader-facing drill-down for one canonical instrument.

    It deliberately reads compact, already-normalized state. Heavy history lives in DataLake;
    live context lives in DuckStore. The UI can request backfill through the existing job API.
    """

    def __init__(self, store: Any, lake: Any, lab: Any) -> None:
        self.store = store
        self.lake = lake
        self.lab = lab

    def _live_series(self, canonical_id: str, limit: int = 4000) -> list[dict[str, Any]]:
        with self.store._lock:
            rows = self.store._con.execute(
                """select observed_at_ms,last,change_24h_pct,volume_24h,turnover_24h,open_interest,funding_rate
                   from quote_snapshots where canonical_id=? and last is not null
                   order by observed_at_ms desc limit ?""",
                [canonical_id, limit],
            ).fetchall()
        rows.reverse()
        return [
            {
                'ts_ms': int(r[0]), 'price': float(r[1]),
                'change_24h_pct': float(r[2]) if r[2] is not None else None,
                'volume_24h': float(r[3]) if r[3] is not None else None,
                'turnover_24h': float(r[4]) if r[4] is not None else None,
                'open_interest': float(r[5]) if r[5] is not None else None,
                'funding_rate': float(r[6]) if r[6] is not None else None,
            }
            for r in rows
        ]

    def _scores(self, canonical_id: str, limit: int = 4000) -> list[dict[str, Any]]:
        with self.store._lock:
            rows = self.store._con.execute(
                """select observed_at_ms,score,severity,payload_json from anomaly_snapshots
                   where canonical_id=? order by observed_at_ms desc limit ?""",
                [canonical_id, limit],
            ).fetchall()
        rows.reverse()
        out = []
        for ts, score, severity, payload in rows:
            reasons: list[str] = []
            signals: list[str] = []
            try:
                obj = json.loads(payload or '{}')
                reasons = obj.get('reasons') or []
                signals = obj.get('signals') or []
            except Exception:
                pass
            out.append({'ts_ms': int(ts), 'score': float(score), 'severity': str(severity), 'reasons': reasons, 'signals': signals})
        return out

    def _history(self, canonical_id: str, interval: str, max_points: int = 3500) -> list[dict[str, Any]]:
        frame = self.lake.read_candles(canonical_id, interval)
        if frame.is_empty():
            return []
        if frame.height > max_points:
            frame = frame.tail(max_points)
        cols = [x for x in ['ts_ms','open','high','low','close','volume','turnover','source'] if x in frame.columns]
        return frame.select(cols).to_dicts()

    def build(self, canonical_id: str, snapshot: Any) -> dict[str, Any]:
        quotes = snapshot.quotes if snapshot else []
        quote = next((q for q in quotes if q.canonical_id == canonical_id), None)
        live = self._live_series(canonical_id)
        symbol = quote.symbol if quote is not None else (canonical_id.rsplit(':', 1)[-1] if ':' in canonical_id else canonical_id)
        provider = quote.provider if quote is not None else (canonical_id.split(':', 1)[0] if ':' in canonical_id else '')
        market_type = quote.market_type if quote is not None else (canonical_id.split(':', 2)[1] if canonical_id.count(':') >= 2 else '')
        interval = '10m' if provider == 'moex' else '5m'
        candles = self._history(canonical_id, interval)
        episodes = [x for x in self.store.list_episodes(limit=1000, q=symbol) if x.canonical_id == canonical_id][:200]
        episode_rows = []
        for ep in episodes:
            try:
                outcome = self.store.episode_outcome(ep.id).model_dump(mode='json')
            except Exception:
                outcome = None
            episode_rows.append({'episode': ep.model_dump(mode='json'), 'outcome': outcome})
        scores = self._scores(canonical_id)
        news = []
        if snapshot:
            needle = symbol.upper()
            for item in snapshot.news:
                if needle in {x.upper() for x in item.symbols}:
                    news.append(item.model_dump(mode='json'))
        runs = []
        for run in self.lab.list_strategy_runs(limit=2000):
            if run.canonical_id == canonical_id:
                runs.append(run.model_dump(mode='json'))
                if len(runs) >= 50:
                    break
        related = []
        if quote is not None:
            prefix = ''.join(ch for ch in quote.symbol.upper() if ch.isalpha())[:3]
            for q in quotes:
                if q.canonical_id == canonical_id:
                    continue
                if prefix and q.symbol.upper().startswith(prefix):
                    related.append(q.model_dump(mode='json'))
                if len(related) >= 20:
                    break
        latest = live[-1] if live else None
        coverage = {
            'live_snapshots': len(live),
            'historical_candles': len(candles),
            'anomaly_points': len(scores),
            'episodes': len(episode_rows),
            'news': len(news),
            'strategy_runs': len(runs),
            'has_oi': any(x.get('open_interest') is not None for x in live[-500:]),
            'has_funding': any(x.get('funding_rate') is not None for x in live[-500:]),
        }
        backfill = None
        if provider in {'moex','binance'}:
            backfill = {'provider': provider, 'symbol': symbol, 'market_type': market_type or ('shares' if provider == 'moex' else 'usdt-futures'), 'interval': interval}
        return {
            'canonical_id': canonical_id,
            'quote': quote.model_dump(mode='json') if quote is not None else None,
            'latest_live': latest,
            'coverage': coverage,
            'interval': interval,
            'candles': candles,
            'live': live,
            'scores': scores,
            'episodes': episode_rows,
            'news': news[:100],
            'strategy_runs': runs,
            'related': related,
            'suggested_backfill': backfill,
        }
