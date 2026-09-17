from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass

from .engine import IntelligenceEngine
from .models import Snapshot, SourceHealth
from .news import NewsCollector
from .sources import MarketSource
from .storage import DuckStore


@dataclass
class RuntimeState:
    snapshot: Snapshot | None = None
    running: bool = False


class IntelligenceService:
    def __init__(self, sources: list[MarketSource], news: NewsCollector, store: DuckStore, interval_s: int = 60) -> None:
        self.sources, self.news, self.store = sources, news, store
        self.interval_s = max(15, interval_s)
        self.engine = IntelligenceEngine()
        self.state = RuntimeState()
        self._task: asyncio.Task | None = None
        self._lock = asyncio.Lock()

    async def refresh(self) -> Snapshot:
        async with self._lock:
            collected = await asyncio.gather(*(source.collect() for source in self.sources))
            quotes = [quote for rows, _ in collected for quote in rows]
            health: list[SourceHealth] = [item for _, item in collected]
            news = await self.news.collect()
            anomalies = self.engine.analyze(quotes)
            snapshot = Snapshot(generated_at_ms=int(time.time() * 1000), quotes=quotes, anomalies=anomalies,
                                source_health=health, news=news)
            self.store.persist_snapshot(quotes, anomalies, news)
            self.state.snapshot = snapshot
            return snapshot

    async def _loop(self) -> None:
        self.state.running = True
        try:
            while True:
                try:
                    await self.refresh()
                except Exception:
                    pass
                await asyncio.sleep(self.interval_s)
        finally:
            self.state.running = False

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._loop(), name="tqs-intelligence-refresh")

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
