from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass

from .engine import IntelligenceEngine
from .models import RuntimeLog, Snapshot, SourceHealth, SourceStatus
from .news import NewsCollector
from .sources import MarketSource
from .storage import DuckStore


def _now_ms() -> int:
    return int(time.time() * 1000)


@dataclass
class RuntimeState:
    snapshot: Snapshot | None = None
    running: bool = False
    refreshing: bool = False
    started_at_ms: int | None = None
    last_refresh_started_ms: int | None = None
    last_refresh_finished_ms: int | None = None
    last_refresh_duration_ms: int | None = None
    refresh_count: int = 0
    last_error: str | None = None


class IntelligenceService:
    def __init__(self, sources: list[MarketSource], news: NewsCollector, store: DuckStore, interval_s: int = 60) -> None:
        self.sources, self.news, self.store = sources, news, store
        self.interval_s = max(15, interval_s)
        self.engine = IntelligenceEngine()
        self.state = RuntimeState()
        self._task: asyncio.Task | None = None
        self._lock = asyncio.Lock()
        self._manual_tasks: set[asyncio.Task] = set()
        self._source_status: dict[str, str] = {}

    def log(self, level: str, component: str, message: str, **details: object) -> None:
        item = RuntimeLog(ts_ms=_now_ms(), level=level, component=component, message=message, details=dict(details))
        try:
            self.store.append_log(item)
        except Exception:
            pass

    def current_health(self) -> list[SourceHealth]:
        if self.state.snapshot:
            return self.state.snapshot.source_health
        return [SourceHealth(provider=s.provider, name=s.name, status=SourceStatus.PENDING) for s in self.sources]

    def runtime_status(self) -> dict[str, object]:
        return {
            "running": self.state.running,
            "refreshing": self.state.refreshing,
            "started_at_ms": self.state.started_at_ms,
            "last_refresh_started_ms": self.state.last_refresh_started_ms,
            "last_refresh_finished_ms": self.state.last_refresh_finished_ms,
            "last_refresh_duration_ms": self.state.last_refresh_duration_ms,
            "refresh_count": self.state.refresh_count,
            "last_error": self.state.last_error,
            "refresh_seconds": self.interval_s,
        }

    async def refresh(self) -> Snapshot:
        async with self._lock:
            started = _now_ms()
            self.state.refreshing = True
            self.state.last_refresh_started_ms = started
            self.state.last_error = None
            self.log("info", "refresh", "Сбор рынка запущен", refresh_no=self.state.refresh_count + 1)
            try:
                collected = await asyncio.gather(*(source.collect() for source in self.sources))
                quotes = [quote for rows, _ in collected for quote in rows]
                health: list[SourceHealth] = [item for _, item in collected]
                for item in health:
                    prev = self._source_status.get(item.provider)
                    current = item.status.value
                    self._source_status[item.provider] = current
                    if item.status in (SourceStatus.ERROR, SourceStatus.DEGRADED):
                        self.log(
                            "error" if item.status == SourceStatus.ERROR else "warning",
                            f"source:{item.provider}",
                            f"{item.name}: {current}",
                            instruments=item.instruments,
                            latency_ms=item.latency_ms,
                            error=item.error,
                        )
                    elif prev and prev != SourceStatus.OK.value:
                        self.log("info", f"source:{item.provider}", f"{item.name}: источник восстановлен", instruments=item.instruments, latency_ms=item.latency_ms)
                news = await self.news.collect()
                anomalies = self.engine.analyze(quotes)
                snapshot = Snapshot(generated_at_ms=_now_ms(), quotes=quotes, anomalies=anomalies, source_health=health, news=news)
                self.store.persist_snapshot(quotes, anomalies, news)
                self.state.snapshot = snapshot
                self.state.refresh_count += 1
                duration = _now_ms() - started
                self.state.last_refresh_finished_ms = _now_ms()
                self.state.last_refresh_duration_ms = duration
                online = sum(1 for x in health if x.status in (SourceStatus.OK, SourceStatus.DEGRADED))
                self.log(
                    "info", "refresh", "Сбор рынка завершён",
                    instruments=len(quotes), anomalies=len(anomalies), news=len(news),
                    sources_online=online, sources_total=len(health), duration_ms=duration,
                )
                return snapshot
            except Exception as exc:
                self.state.last_error = str(exc)[:1000]
                self.state.last_refresh_finished_ms = _now_ms()
                self.state.last_refresh_duration_ms = _now_ms() - started
                self.log("error", "refresh", "Сбор рынка завершился ошибкой", error=self.state.last_error)
                raise
            finally:
                self.state.refreshing = False

    def request_refresh(self) -> bool:
        if self.state.refreshing:
            return False
        task = asyncio.create_task(self.refresh(), name="tqs-intelligence-manual-refresh")
        self._manual_tasks.add(task)
        task.add_done_callback(self._manual_tasks.discard)
        return True

    async def _loop(self) -> None:
        self.state.running = True
        self.state.started_at_ms = _now_ms()
        self.log("info", "service", "TQS Intelligence запущен", refresh_seconds=self.interval_s)
        try:
            while True:
                try:
                    await self.refresh()
                except Exception:
                    pass
                await asyncio.sleep(self.interval_s)
        finally:
            self.state.running = False
            self.log("info", "service", "TQS Intelligence остановлен")

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
