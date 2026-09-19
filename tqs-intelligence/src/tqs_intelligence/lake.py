from __future__ import annotations

import json
import re
import shutil
import time
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
        self.quick_stats_cache_path = self.manifests_root / 'quick-stats.json'
        self._quick_stats_cache = self._load_quick_stats_cache()

    def _empty_quick_stats(self) -> dict[str, object]:
        usage = shutil.disk_usage(self.root)
        metric_root = self.root / 'metrics'
        return {
            'root': str(self.root.resolve()),
            'files': None,
            'rows': None,
            'row_count_known': False,
            'bad_files': [],
            'metrics': {
                'root': str(metric_root.resolve()),
                'files': None,
                'rows': None,
                'row_count_known': False,
                'metrics': {},
                'metric_files': {},
                'bad_files': [],
                'stats_mode': 'cached-empty',
            },
            'all_rows': None,
            'free_gb': round(usage.free / (1024**3), 2),
            'total_gb': round(usage.total / (1024**3), 2),
            'stats_mode': 'cached-empty',
            'cached_at_ms': None,
        }

    def _load_quick_stats_cache(self) -> dict[str, object]:
        try:
            payload = json.loads(self.quick_stats_cache_path.read_text(encoding='utf-8'))
            if isinstance(payload, dict):
                payload['stats_mode'] = 'cached'
                return payload
        except Exception:
            pass
        return self._empty_quick_stats()

    def cached_quick_stats(self) -> dict[str, object]:
        return dict(self._quick_stats_cache)

    def _save_quick_stats_cache(self, payload: dict[str, object]) -> None:
        self._quick_stats_cache = dict(payload)
        try:
            tmp = self.quick_stats_cache_path.with_suffix('.tmp.json')
            tmp.write_text(json.dumps(payload, ensure_ascii=False, default=str), encoding='utf-8')
            tmp.replace(self.quick_stats_cache_path)
        except Exception:
            pass

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

    def candle_bounds(self, canonical_id: str, interval: str) -> dict[str, int | None]:
        pattern = str(self.history_root / 'provider=*' / f'instrument={_safe(canonical_id)}' / f'interval={_safe(interval)}' / 'year=*' / 'month=*' / 'candles.parquet')
        try:
            row = (
                pl.scan_parquet(pattern)
                .select(
                    pl.col('ts_ms').min().alias('first_ms'),
                    pl.col('ts_ms').max().alias('last_ms'),
                    pl.len().alias('rows'),
                )
                .collect()
                .to_dicts()[0]
            )
            return {
                'first_ms': int(row['first_ms']) if row.get('first_ms') is not None else None,
                'last_ms': int(row['last_ms']) if row.get('last_ms') is not None else None,
                'rows': int(row.get('rows') or 0),
            }
        except Exception:
            return {'first_ms': None, 'last_ms': None, 'rows': 0}

    def quick_stats(self) -> dict[str, object]:
        """Return cached operational stats without recursively scanning the lake."""
        payload = self.cached_quick_stats()
        try:
            usage = shutil.disk_usage(self.root)
            payload['free_gb'] = round(usage.free / (1024**3), 2)
            payload['total_gb'] = round(usage.total / (1024**3), 2)
        except Exception:
            pass
        payload['stats_mode'] = 'cached'
        return payload

    def refresh_quick_stats(self) -> dict[str, object]:
        """Refresh the cached file-count summary.

        This may scan a large Data Lake and is intentionally designed for a
        background worker, never for a request critical path.
        """
        history_files = list(self.history_root.glob('**/*.parquet'))
        usage = shutil.disk_usage(self.root)
        metric_root = self.root / 'metrics'
        metric_files_list = list(metric_root.glob('**/*.parquet'))
        metric_files: dict[str, int] = {}
        for path in metric_files_list:
            part = next((x for x in path.parts if x.startswith('metric=')), 'metric=unknown')
            key = part.split('=', 1)[1]
            metric_files[key] = metric_files.get(key, 0) + 1
        metric_stats = {
            'root': str(metric_root.resolve()),
            'files': len(metric_files_list),
            'rows': None,
            'row_count_known': False,
            'metrics': {},
            'metric_files': metric_files,
            'bad_files': [],
            'stats_mode': 'cached',
        }
        payload = {
            'root': str(self.root.resolve()),
            'files': len(history_files),
            'rows': None,
            'row_count_known': False,
            'bad_files': [],
            'metrics': metric_stats,
            'all_rows': None,
            'free_gb': round(usage.free / (1024**3), 2),
            'total_gb': round(usage.total / (1024**3), 2),
            'stats_mode': 'cached',
            'cached_at_ms': int(time.time() * 1000),
        }
        self._save_quick_stats_cache(payload)
        return dict(payload)

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
        try:
            from .metric_lake import MetricLake
            metric_stats = MetricLake(self.root).stats()
        except Exception as exc:
            metric_stats = {'root': str((self.root/'metrics').resolve()), 'files': 0, 'rows': 0, 'metrics': {}, 'bad_files': [str(exc)]}
        return {
            'root': str(self.root.resolve()),
            'files': len(files), 'rows': rows, 'bad_files': bad[:20],
            'metrics': metric_stats,
            'all_rows': rows + int(metric_stats.get('rows') or 0),
            'free_gb': round(usage.free / (1024**3), 2),
            'total_gb': round(usage.total / (1024**3), 2),
        }

    def write_manifest(self, name: str, payload: dict[str, object]) -> Path:
        path = self.manifests_root / f'{_safe(name)}.json'
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
        return path
