from __future__ import annotations

import json
import re
import shutil
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import polars as pl

from .models import Candle


_SAFE = re.compile(r'[^A-Za-z0-9_.=-]+')


def _safe(value: str) -> str:
    return _SAFE.sub('_', value)[:160]


class DataLake:
    def __init__(self, root: str) -> None:
        self.root = Path(root).expanduser()
        self.history_root = self.root / 'history'
        self.exports_root = self.root / 'exports'
        self.manifests_root = self.root / 'manifests'
        for p in (self.history_root, self.exports_root, self.manifests_root):
            p.mkdir(parents=True, exist_ok=True)

    def candle_path(self, provider: str, canonical_id: str, interval: str, year: int, month: int) -> Path:
        return self.history_root / f'provider={_safe(provider)}' / f'instrument={_safe(canonical_id)}' / f'interval={_safe(interval)}' / f'year={year:04d}' / f'month={month:02d}' / 'candles.parquet'

    def write_candles(self, candles: Iterable[Candle]) -> dict[str, int]:
        groups: dict[tuple[str, str, str, int, int], list[Candle]] = defaultdict(list)
        for candle in candles:
            dt = datetime.fromtimestamp(candle.ts_ms / 1000, tz=timezone.utc)
            groups[(candle.provider, candle.canonical_id, candle.interval, dt.year, dt.month)].append(candle)
        files = rows = 0
        for (provider, canonical_id, interval, year, month), items in groups.items():
            path = self.candle_path(provider, canonical_id, interval, year, month)
            path.parent.mkdir(parents=True, exist_ok=True)
            frame = pl.DataFrame([
                {
                    'provider': x.provider, 'canonical_id': x.canonical_id, 'interval': x.interval,
                    'ts_ms': x.ts_ms, 'open': x.open, 'high': x.high, 'low': x.low, 'close': x.close,
                    'volume': x.volume, 'turnover': x.turnover, 'source': x.source,
                }
                for x in items
            ])
            if path.exists():
                try:
                    old = pl.read_parquet(path)
                    frame = pl.concat([old, frame], how='diagonal_relaxed')
                except Exception:
                    pass
            frame = frame.unique(subset=['ts_ms'], keep='last').sort('ts_ms')
            tmp = path.with_suffix('.tmp.parquet')
            frame.write_parquet(tmp, compression='zstd', statistics=True)
            tmp.replace(path)
            pl.scan_parquet(path).select(pl.len()).collect()
            files += 1
            rows += len(items)
        return {'files_touched': files, 'rows_ingested': rows}

    def read_candles(self, canonical_id: str, interval: str, start_ms: int | None = None, end_ms: int | None = None) -> pl.DataFrame:
        pattern = str(self.history_root / 'provider=*' / f'instrument={_safe(canonical_id)}' / f'interval={_safe(interval)}' / 'year=*' / 'month=*' / 'candles.parquet')
        try:
            lazy = pl.scan_parquet(pattern)
        except Exception:
            return pl.DataFrame()
        if start_ms is not None:
            lazy = lazy.filter(pl.col('ts_ms') >= start_ms)
        if end_ms is not None:
            lazy = lazy.filter(pl.col('ts_ms') <= end_ms)
        try:
            return lazy.sort('ts_ms').collect()
        except Exception:
            return pl.DataFrame()

    def verify(self) -> dict[str, object]:
        files = list(self.history_root.glob('**/*.parquet'))
        bad: list[str] = []
        rows = 0
        for path in files:
            try:
                rows += int(pl.scan_parquet(path).select(pl.len()).collect().item())
            except Exception as exc:
                bad.append(f'{path}: {exc}')
        usage = shutil.disk_usage(self.root)
        return {
            'root': str(self.root.resolve()),
            'files': len(files), 'rows': rows, 'bad_files': bad[:20],
            'free_gb': round(usage.free / (1024**3), 2),
            'total_gb': round(usage.total / (1024**3), 2),
        }

    def write_manifest(self, name: str, payload: dict[str, object]) -> Path:
        path = self.manifests_root / f'{_safe(name)}.json'
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
        return path
