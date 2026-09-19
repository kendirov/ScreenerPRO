from __future__ import annotations

import asyncio
import time
from collections import deque
from dataclasses import dataclass

from .control import ControlCenter
from .engine import IntelligenceEngine
from .models import Anomaly, AnomalyEpisode, NewsItem, Quote, RuntimeLog, Snapshot, SourceHealth, SourceStatus
from .moex_features import merge_anomalies
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
                 research_every_refreshes: int = 15, control: ControlCenter | None = None,
                 moex_feature_engine: object | None = None) -> None:
        self.sources, self.news, self.store = sources, news, store
        self.interval_s = max(15, interval_s)
        self.episode_threshold = episode_threshold
        self.episode_close_grace_ms = max(60, episode_close_grace_s) * 1000
        self.history_backfill_max = max(0, history_backfill_max)
        self.history_refresh_every = max(1, history_refresh_every)
        self.research_every_refreshes = max(1, research_every_refreshes)
        self.control = control
        self.moex_feature_engine = moex_feature_engine
        self.engine = IntelligenceEngine(); self.state = RuntimeState(); self._task: asyncio.Task | None = None
        self._lock = asyncio.Lock(); self._manual_tasks: set[asyncio.Task] = set(); self._source_status: dict[str, str] = {}
        self._sources_by_provider = {source.provider: source for source in sources}
        self._recent_logs: deque[RuntimeLog] = deque(maxlen=300)
        self._moex_task: asyncio.Task | None = None
        self._moex_cached: list[Anomaly] = []
        self._moex_feature_last_finished_ms: int | None = None
        self._moex_feature_last_error: str | None = None
        self._postprocess_task: asyncio.Task | None = None
        self._snapshot_pending: deque[tuple[list[Quote], list[Anomaly], list[NewsItem]]] = deque()
        self._postprocess_dropped = 0
        self._episode_pending: tuple[list[Anomaly], int, list[Quote], bool] | None = None

    def mode(self) -> str:
        return self.control.get().mode if self.control else 'max'

    def log(self, level: str, component: str, message: str, **details: object) -> None:
        item = RuntimeLog(ts_ms=_now_ms(), level=level, component=component, message=message, details=dict(details))
        self._recent_logs.append(item)
        try: self.store.append_log(item)
        except Exception: pass

    def recent_logs(self) -> list[RuntimeLog]:
        return list(reversed(self._recent_logs))

    def current_health(self) -> list[SourceHealth]:
        if self.state.snapshot: return self.state.snapshot.source_health
        return [SourceHealth(provider=s.provider, name=s.name, status=SourceStatus.PENDING) for s in self.sources]

    def _base_refresh_seconds(self) -> int:
        if self.control is None:
            return self.interval_s
        override = int(self.control.get().refresh_seconds_override or 0)
        return max(15, override or self.interval_s)

    def runtime_status(self) -> dict[str, object]:
        mode=self.mode(); base=self._base_refresh_seconds()
        return {"running":self.state.running,"refreshing":self.state.refreshing,"started_at_ms":self.state.started_at_ms,
                "last_refresh_started_ms":self.state.last_refresh_started_ms,"last_refresh_finished_ms":self.state.last_refresh_finished_ms,
                "last_refresh_duration_ms":self.state.last_refresh_duration_ms,"refresh_count":self.state.refresh_count,
                "last_error":self.state.last_error,"refresh_seconds":self.interval_s,"configured_refresh_seconds":base,"last_research_ms":self.state.last_research_ms,
                "episode_threshold":self.episode_threshold,"mode":mode,
                "effective_refresh_seconds":None if mode=='stop' else (max(15,base//2) if mode=='max' else max(30,base)),
                "moex_features":{"running":bool(self._moex_task and not self._moex_task.done()),
                                 "cached_anomalies":len(self._moex_cached),
                                 "last_finished_ms":self._moex_feature_last_finished_ms,
                                 "last_error":self._moex_feature_last_error},
                "postprocess":{"running":bool(self._postprocess_task and not self._postprocess_task.done()),
                               "snapshot_queue":len(self._snapshot_pending),
                               "dropped_snapshots":self._postprocess_dropped,
                               "episode_pending":self._episode_pending is not None}}

    async def _fetch_history(self, episode: AnomalyEpisode, quote: Quote) -> int:
        source = self._sources_by_provider.get(episode.provider)
        if source is None: return 0
        try:
            candles = await source.fetch_candles(quote, "5m", 500)
            if candles:
                await asyncio.to_thread(self.store.persist_candles, candles)
                self.log("info","history",f"История {episode.symbol} подгружена",episode_id=episode.id,provider=episode.provider,candles=len(candles))
            return len(candles)
        except Exception as exc:
            self.log("warning","history",f"Не удалось подгрузить историю {episode.symbol}",episode_id=episode.id,provider=episode.provider,error=str(exc)[:500])
            return 0

    async def _backfill_created(self, created: list[AnomalyEpisode], quotes: list[Quote], max_items: int | None = None) -> None:
        limit=self.history_backfill_max if max_items is None else max(0,max_items)
        if not created or limit <= 0: return
        by_id = {q.canonical_id:q for q in quotes}; selected = sorted(created,key=lambda x:x.peak_score,reverse=True)[:limit]
        tasks = [self._fetch_history(ep,by_id[ep.canonical_id]) for ep in selected if ep.canonical_id in by_id]
        if tasks: await asyncio.gather(*tasks, return_exceptions=True)

    async def _refresh_active_history(self, quotes: list[Quote]) -> None:
        active = await asyncio.to_thread(self.store.list_episodes, 20, "active")
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

    def _consume_moex_features(self) -> None:
        task = self._moex_task
        if task is None or not task.done():
            return
        self._moex_task = None
        try:
            self._moex_cached = list(task.result() or [])
            self._moex_feature_last_finished_ms = _now_ms()
            self._moex_feature_last_error = None
        except Exception as exc:
            self._moex_feature_last_error = str(exc)[:1000]
            self.log("warning","moex-features","MOEX feature engine не завершил фоновый цикл",error=self._moex_feature_last_error)

    def _start_moex_features(self, quotes: list[Quote]) -> None:
        if self.moex_feature_engine is None or self._moex_task is not None:
            return
        frozen_quotes = list(quotes)
        self._moex_task = asyncio.create_task(
            asyncio.to_thread(self.moex_feature_engine.analyze, frozen_quotes),
            name="tqs-moex-features-background",
        )

    def _spawn_background(self, awaitable: object, name: str) -> None:
        task = asyncio.create_task(awaitable, name=name)
        self._manual_tasks.add(task)
        task.add_done_callback(self._manual_tasks.discard)

    async def _postprocess_loop(self) -> None:
        try:
            while self._snapshot_pending or self._episode_pending is not None:
                if self._snapshot_pending:
                    quotes, anomalies, news = self._snapshot_pending.popleft()
                    try:
                        await asyncio.to_thread(self.store.persist_snapshot, quotes, anomalies, news)
                    except asyncio.CancelledError:
                        raise
                    except Exception as exc:
                        self.log("error","snapshot","Фоновая запись market snapshot завершилась ошибкой",
                                 error=str(exc)[:1000])
                    # Snapshot durability has priority. Episode state can safely
                    # collapse to the newest market state while the DB catches up.
                    continue

                anomalies, now_ms, quotes, heavy = self._episode_pending
                self._episode_pending = None
                try:
                    created = await asyncio.to_thread(
                        self.store.update_episodes,
                        anomalies, now_ms, self.episode_threshold, self.episode_close_grace_ms,
                    )
                    if created:
                        self.log("info","episodes","Открыты новые эпизоды аномалий",
                                 count=len(created),ids=[x.id for x in created[:20]])
                        await self._backfill_created(created, quotes, None if heavy else 1)
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    self.log("error","episodes","Фоновая обработка эпизодов завершилась ошибкой",
                             error=str(exc)[:1000])
        finally:
            self._postprocess_task = None

    def _queue_postprocess(self, quotes: list[Quote], anomalies: list[Anomaly],
                           news: list[NewsItem], now_ms: int, heavy: bool) -> None:
        # Preserve several durable market snapshots during transient DB pressure.
        # If persistence falls far behind, drop the oldest queued snapshot rather
        # than blocking live collection or growing memory without bound.
        if len(self._snapshot_pending) >= 4:
            self._snapshot_pending.popleft()
            self._postprocess_dropped += 1
            self.log("warning","snapshot","Durable snapshot queue overflow; dropped oldest queued snapshot",
                     dropped_total=self._postprocess_dropped)
        self._snapshot_pending.append((list(quotes), list(anomalies), list(news)))
        self._episode_pending = (list(anomalies), int(now_ms), list(quotes), bool(heavy))
        if self._postprocess_task is None or self._postprocess_task.done():
            self._postprocess_task = asyncio.create_task(
                self._postprocess_loop(),
                name="tqs-durable-postprocess",
            )

    async def refresh(self, force: bool = False) -> Snapshot | None:
        if not force and self.mode()=='stop':
            return self.state.snapshot
        async with self._lock:
            started=_now_ms(); self.state.refreshing=True; self.state.last_refresh_started_ms=started; self.state.last_error=None
            self.log("info","refresh","Сбор рынка запущен",refresh_no=self.state.refresh_count+1,mode=self.mode())
            try:
                collected=await asyncio.gather(*(source.collect() for source in self.sources)); quotes=[q for rows,_ in collected for q in rows]; health=[item for _,item in collected]
                for item in health:
                    prev=self._source_status.get(item.provider); current=item.status.value; self._source_status[item.provider]=current
                    if item.status in (SourceStatus.ERROR,SourceStatus.DEGRADED):
                        self.log("error" if item.status==SourceStatus.ERROR else "warning",f"source:{item.provider}",f"{item.name}: {current}",instruments=item.instruments,latency_ms=item.latency_ms,error=item.error)
                    elif prev and prev!=SourceStatus.OK.value:
                        self.log("info",f"source:{item.provider}",f"{item.name}: источник восстановлен",instruments=item.instruments,latency_ms=item.latency_ms)
                news=await self.news.collect()
                anomalies=await asyncio.to_thread(self.engine.analyze, quotes)
                if self.moex_feature_engine is not None:
                    self._consume_moex_features()
                    if self._moex_cached:
                        anomalies = merge_anomalies(anomalies, self._moex_cached)
                now=_now_ms(); snapshot=Snapshot(generated_at_ms=now,quotes=quotes,anomalies=anomalies,source_health=health,news=news)
                # Publish the live market view immediately. Durable snapshot/episode
                # writes may be expensive on a cold start and must not make health/UI
                # look empty while fresh quotes are already available in memory.
                self.state.snapshot=snapshot
                mode=self.mode(); heavy=mode=='max'
                next_count=self.state.refresh_count+1
                schedule_active_history = heavy and next_count % self.history_refresh_every == 0
                schedule_research = heavy and next_count % self.research_every_refreshes == 0
                self.state.refresh_count=next_count; duration=_now_ms()-started; self.state.last_refresh_finished_ms=_now_ms(); self.state.last_refresh_duration_ms=duration
                online=sum(1 for x in health if x.status in (SourceStatus.OK,SourceStatus.DEGRADED))
                self.log("info","refresh","Сбор рынка завершён",instruments=len(quotes),anomalies=len(anomalies),news=len(news),sources_online=online,sources_total=len(health),duration_ms=duration,mode=mode,durable_postprocess="background")
                self._queue_postprocess(quotes, anomalies, news, now, heavy)
                if schedule_active_history:
                    self._spawn_background(self._refresh_active_history(quotes), "tqs-history-active")
                if schedule_research:
                    self._spawn_background(asyncio.to_thread(self._run_research), "tqs-research-auto")
                self._start_moex_features(quotes)
                return snapshot
            except Exception as exc:
                self.state.last_error=str(exc)[:1000]; self.state.last_refresh_finished_ms=_now_ms(); self.state.last_refresh_duration_ms=_now_ms()-started
                self.log("error","refresh","Сбор рынка завершился ошибкой",error=self.state.last_error); raise
            finally: self.state.refreshing=False

    def request_refresh(self) -> bool:
        if self.state.refreshing: return False
        task=asyncio.create_task(self.refresh(force=True),name="tqs-intelligence-manual-refresh"); self._manual_tasks.add(task); task.add_done_callback(self._manual_tasks.discard); return True

    async def _loop(self) -> None:
        self.state.running=True; self.state.started_at_ms=_now_ms(); self.log("info","service","TQS Intelligence запущен",refresh_seconds=self.interval_s,mode=self.mode())
        last_mode=None
        try:
            while True:
                mode=self.mode()
                if mode!=last_mode:
                    self.log('info','control',f'Режим изменён: {mode.upper()}'); last_mode=mode
                if mode=='stop':
                    await asyncio.sleep(2); continue
                try: await self.refresh()
                except Exception: pass
                base=self._base_refresh_seconds()
                delay=max(15,base//2) if mode=='max' else max(30,base)
                await asyncio.sleep(delay)
        finally:
            self.state.running=False; self.log("info","service","TQS Intelligence остановлен")

    def start(self) -> None:
        if self._task is None or self._task.done(): self._task=asyncio.create_task(self._loop(),name="tqs-intelligence-refresh")

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try: await self._task
            except asyncio.CancelledError: pass
