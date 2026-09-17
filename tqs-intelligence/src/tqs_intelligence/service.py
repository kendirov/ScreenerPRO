from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass

from .engine import IntelligenceEngine
from .models import AnomalyEpisode, Quote, RuntimeLog, Snapshot, SourceHealth, SourceStatus
from .news import NewsCollector
from .research import build_research_findings
from .sources import MarketSource
from .storage import DuckStore


def _now_ms() -> int: return int(time.time() * 1000)


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
    last_research_ms: int | None = None


class IntelligenceService:
    def __init__(self, sources: list[MarketSource], news: NewsCollector, store: DuckStore, interval_s: int = 60,
                 episode_threshold: float = 70.0, episode_close_grace_s: int = 180,
                 history_backfill_max: int = 8, history_refresh_every: int = 5,
                 research_every_refreshes: int = 15) -> None:
        self.sources, self.news, self.store = sources, news, store
        self.interval_s = max(15, interval_s)
        self.episode_threshold = episode_threshold
        self.episode_close_grace_ms = max(60, episode_close_grace_s) * 1000
        self.history_backfill_max = max(0, history_backfill_max)
        self.history_refresh_every = max(1, history_refresh_every)
        self.research_every_refreshes = max(1, research_every_refreshes)
        self.engine = IntelligenceEngine(); self.state = RuntimeState(); self._task: asyncio.Task | None = None
        self._lock = asyncio.Lock(); self._manual_tasks: set[asyncio.Task] = set(); self._source_status: dict[str, str] = {}
        self._sources_by_provider = {source.provider: source for source in sources}

    def log(self, level: str, component: str, message: str, **details: object) -> None:
        item = RuntimeLog(ts_ms=_now_ms(), level=level, component=component, message=message, details=dict(details))
        try: self.store.append_log(item)
        except Exception: pass

    def current_health(self) -> list[SourceHealth]:
        if self.state.snapshot: return self.state.snapshot.source_health
        return [SourceHealth(provider=s.provider, name=s.name, status=SourceStatus.PENDING) for s in self.sources]

    def runtime_status(self) -> dict[str, object]:
        return {"running":self.state.running,"refreshing":self.state.refreshing,"started_at_ms":self.state.started_at_ms,
                "last_refresh_started_ms":self.state.last_refresh_started_ms,"last_refresh_finished_ms":self.state.last_refresh_finished_ms,
                "last_refresh_duration_ms":self.state.last_refresh_duration_ms,"refresh_count":self.state.refresh_count,
                "last_error":self.state.last_error,"refresh_seconds":self.interval_s,"last_research_ms":self.state.last_research_ms,
                "episode_threshold":self.episode_threshold}

    async def _fetch_history(self, episode: AnomalyEpisode, quote: Quote) -> int:
        source = self._sources_by_provider.get(episode.provider)
        if source is None: return 0
        try:
            candles = await source.fetch_candles(quote, "5m", 500)
            if candles:
                self.store.persist_candles(candles)
                self.log("info","history",f"История {episode.symbol} подгружена",episode_id=episode.id,provider=episode.provider,candles=len(candles))
            return len(candles)
        except Exception as exc:
            self.log("warning","history",f"Не удалось подгрузить историю {episode.symbol}",episode_id=episode.id,provider=episode.provider,error=str(exc)[:500])
            return 0

    async def _backfill_created(self, created: list[AnomalyEpisode], quotes: list[Quote]) -> None:
        if not created or self.history_backfill_max <= 0: return
        by_id = {q.canonical_id:q for q in quotes}; selected = sorted(created,key=lambda x:x.peak_score,reverse=True)[:self.history_backfill_max]
        tasks = [self._fetch_history(ep,by_id[ep.canonical_id]) for ep in selected if ep.canonical_id in by_id]
        if tasks: await asyncio.gather(*tasks, return_exceptions=True)

    async def _refresh_active_history(self, quotes: list[Quote]) -> None:
        active = self.store.list_episodes(limit=20,status="active")
        if not active: return
        by_id = {q.canonical_id:q for q in quotes}; tasks=[]
        for ep in active:
            quote=by_id.get(ep.canonical_id)
            if quote is not None: tasks.append(self._fetch_history(ep,quote))
        if tasks: await asyncio.gather(*tasks, return_exceptions=True)

    def _run_research(self) -> None:
        closed = self.store.list_episodes(limit=2000,status="closed")
        rows=[]
        for episode in closed:
            try: rows.append((episode,self.store.episode_outcome(episode.id)))
            except Exception: continue
        findings=build_research_findings(rows,_now_ms())
        self.store.persist_findings(findings); self.state.last_research_ms=_now_ms()
        self.log("info","research","Автоисследование эпизодов завершено",closed_episodes=len(closed),findings=len(findings),candidates=sum(1 for x in findings if x.status=="candidate"))

    async def refresh(self) -> Snapshot:
        async with self._lock:
            started=_now_ms(); self.state.refreshing=True; self.state.last_refresh_started_ms=started; self.state.last_error=None
            self.log("info","refresh","Сбор рынка запущен",refresh_no=self.state.refresh_count+1)
            try:
                collected=await asyncio.gather(*(source.collect() for source in self.sources)); quotes=[q for rows,_ in collected for q in rows]; health=[item for _,item in collected]
                for item in health:
                    prev=self._source_status.get(item.provider); current=item.status.value; self._source_status[item.provider]=current
                    if item.status in (SourceStatus.ERROR,SourceStatus.DEGRADED):
                        self.log("error" if item.status==SourceStatus.ERROR else "warning",f"source:{item.provider}",f"{item.name}: {current}",instruments=item.instruments,latency_ms=item.latency_ms,error=item.error)
                    elif prev and prev!=SourceStatus.OK.value:
                        self.log("info",f"source:{item.provider}",f"{item.name}: источник восстановлен",instruments=item.instruments,latency_ms=item.latency_ms)
                news=await self.news.collect(); anomalies=self.engine.analyze(quotes); now=_now_ms(); snapshot=Snapshot(generated_at_ms=now,quotes=quotes,anomalies=anomalies,source_health=health,news=news)
                self.store.persist_snapshot(quotes,anomalies,news)
                created=self.store.update_episodes(anomalies,now,self.episode_threshold,self.episode_close_grace_ms)
                if created:
                    self.log("info","episodes","Открыты новые эпизоды аномалий",count=len(created),ids=[x.id for x in created[:20]])
                    await self._backfill_created(created,quotes)
                next_count=self.state.refresh_count+1
                if next_count % self.history_refresh_every == 0: await self._refresh_active_history(quotes)
                if next_count % self.research_every_refreshes == 0: self._run_research()
                self.state.snapshot=snapshot; self.state.refresh_count=next_count; duration=_now_ms()-started; self.state.last_refresh_finished_ms=_now_ms(); self.state.last_refresh_duration_ms=duration
                online=sum(1 for x in health if x.status in (SourceStatus.OK,SourceStatus.DEGRADED))
                self.log("info","refresh","Сбор рынка завершён",instruments=len(quotes),anomalies=len(anomalies),new_episodes=len(created),news=len(news),sources_online=online,sources_total=len(health),duration_ms=duration)
                return snapshot
            except Exception as exc:
                self.state.last_error=str(exc)[:1000]; self.state.last_refresh_finished_ms=_now_ms(); self.state.last_refresh_duration_ms=_now_ms()-started
                self.log("error","refresh","Сбор рынка завершился ошибкой",error=self.state.last_error); raise
            finally: self.state.refreshing=False

    def request_refresh(self) -> bool:
        if self.state.refreshing: return False
        task=asyncio.create_task(self.refresh(),name="tqs-intelligence-manual-refresh"); self._manual_tasks.add(task); task.add_done_callback(self._manual_tasks.discard); return True

    async def _loop(self) -> None:
        self.state.running=True; self.state.started_at_ms=_now_ms(); self.log("info","service","TQS Intelligence запущен",refresh_seconds=self.interval_s)
        try:
            while True:
                try: await self.refresh()
                except Exception: pass
                await asyncio.sleep(self.interval_s)
        finally:
            self.state.running=False; self.log("info","service","TQS Intelligence остановлен")

    def start(self) -> None:
        if self._task is None or self._task.done(): self._task=asyncio.create_task(self._loop(),name="tqs-intelligence-refresh")

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try: await self._task
            except asyncio.CancelledError: pass
