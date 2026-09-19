from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import polars as pl
from pydantic import BaseModel, Field


_SAFE = re.compile(r"[^A-Za-z0-9_.=-]+")


def _safe(value: str) -> str:
    return _SAFE.sub("_", str(value))[:160]


class MetricPoint(BaseModel):
    provider: str
    canonical_id: str
    metric: str
    ts_ms: int
    value: float
    unit: str = ""
    source: str = "provider"
    meta: dict[str, Any] = Field(default_factory=dict)


class MetricLake:
    """Parquet storage for non-candle time series such as OI/funding/FUTOI."""

    def __init__(self, data_root: str | Path) -> None:
        root = Path(data_root).expanduser()
        self.root = root / "metrics"
        self.root.mkdir(parents=True, exist_ok=True)

    def path(self, provider: str, canonical_id: str, metric: str, year: int, month: int) -> Path:
        return (
            self.root
            / f"provider={_safe(provider)}"
            / f"instrument={_safe(canonical_id)}"
            / f"metric={_safe(metric)}"
            / f"year={year:04d}"
            / f"month={month:02d}"
            / "data.parquet"
        )

    def _pattern(self, canonical_id: str, metric: str) -> str:
        return str(
            self.root
            / "provider=*"
            / f"instrument={_safe(canonical_id)}"
            / f"metric={_safe(metric)}"
            / "year=*"
            / "month=*"
            / "data.parquet"
        )

    def write(self, points: Iterable[MetricPoint]) -> dict[str, int]:
        groups: dict[tuple[str, str, str, int, int], list[MetricPoint]] = defaultdict(list)
        for point in points:
            dt = datetime.fromtimestamp(point.ts_ms / 1000, tz=timezone.utc)
            groups[(point.provider, point.canonical_id, point.metric, dt.year, dt.month)].append(point)
        files = rows = 0
        for (provider, canonical_id, metric, year, month), items in groups.items():
            path = self.path(provider, canonical_id, metric, year, month)
            path.parent.mkdir(parents=True, exist_ok=True)
            frame = pl.DataFrame([
                {
                    "provider": x.provider, "canonical_id": x.canonical_id, "metric": x.metric,
                    "ts_ms": x.ts_ms, "value": x.value, "unit": x.unit, "source": x.source,
                    "meta_json": json.dumps(x.meta, ensure_ascii=False, default=str),
                }
                for x in items
            ])
            if path.exists():
                try:
                    frame = pl.concat([pl.read_parquet(path), frame], how="diagonal_relaxed")
                except Exception:
                    pass
            frame = frame.unique(subset=["ts_ms"], keep="last").sort("ts_ms")
            tmp = path.with_suffix(".tmp.parquet")
            frame.write_parquet(tmp, compression="zstd", statistics=True)
            tmp.replace(path)
            files += 1
            rows += len(items)
        return {"files_touched": files, "rows_ingested": rows}

    def read(
        self,
        canonical_id: str,
        metric: str,
        *,
        start_ms: int | None = None,
        end_ms: int | None = None,
        max_points: int = 20_000,
    ) -> list[dict[str, Any]]:
        try:
            lazy = pl.scan_parquet(self._pattern(canonical_id, metric))
        except Exception:
            return []
        if start_ms is not None:
            lazy = lazy.filter(pl.col("ts_ms") >= int(start_ms))
        if end_ms is not None:
            lazy = lazy.filter(pl.col("ts_ms") <= int(end_ms))
        try:
            frame = lazy.sort("ts_ms").collect()
        except Exception:
            return []
        if frame.height > max_points:
            step = max(1, frame.height // max_points)
            frame = frame[::step]
            if frame.height > max_points:
                frame = frame.tail(max_points)
        cols = [x for x in ["ts_ms", "value", "unit", "provider", "source", "meta_json"] if x in frame.columns]
        rows = frame.select(cols).to_dicts()
        for row in rows:
            raw = row.pop("meta_json", "") or ""
            try:
                row["meta"] = json.loads(raw)
            except Exception:
                row["meta"] = {}
        return rows

    def latest(self, canonical_id: str, metric: str, limit: int = 2) -> list[dict[str, Any]]:
        """Return the newest metric points in chronological order.

        This intentionally reuses the persisted provider/source/meta fields so
        trader-facing features can distinguish delayed/public evidence from
        licensed realtime data.
        """
        try:
            lazy = pl.scan_parquet(self._pattern(canonical_id, metric)).sort("ts_ms", descending=True).head(max(1, int(limit)))
            frame = lazy.collect().sort("ts_ms")
        except Exception:
            return []
        cols = [x for x in ["ts_ms", "value", "unit", "provider", "source", "meta_json"] if x in frame.columns]
        rows = frame.select(cols).to_dicts()
        for row in rows:
            raw = row.pop("meta_json", "") or ""
            try:
                row["meta"] = json.loads(raw)
            except Exception:
                row["meta"] = {}
        return rows

    def count(self, canonical_id: str, metric: str) -> int:
        try:
            return int(pl.scan_parquet(self._pattern(canonical_id, metric)).select(pl.len()).collect().item())
        except Exception:
            return 0

    def bounds(self, canonical_id: str, metric: str) -> dict[str, int | None]:
        try:
            row = pl.scan_parquet(self._pattern(canonical_id, metric)).select(
                pl.col("ts_ms").min().alias("first_ms"),
                pl.col("ts_ms").max().alias("last_ms"),
                pl.len().alias("rows"),
            ).collect().row(0, named=True)
            return {"first_ms": int(row["first_ms"]) if row["first_ms"] is not None else None,
                    "last_ms": int(row["last_ms"]) if row["last_ms"] is not None else None,
                    "rows": int(row["rows"] or 0)}
        except Exception:
            return {"first_ms": None, "last_ms": None, "rows": 0}

    def stats(self) -> dict[str, Any]:
        files = list(self.root.glob("**/*.parquet"))
        rows = 0
        bad: list[str] = []
        metrics: dict[str, int] = {}
        for path in files:
            try:
                n = int(pl.scan_parquet(path).select(pl.len()).collect().item())
                rows += n
                metric_part = next((x for x in path.parts if x.startswith("metric=")), "metric=unknown")
                key = metric_part.split("=", 1)[1]
                metrics[key] = metrics.get(key, 0) + n
            except Exception as exc:
                bad.append(f"{path}: {exc}")
        return {"root": str(self.root.resolve()), "files": len(files), "rows": rows, "metrics": metrics, "bad_files": bad[:20]}
