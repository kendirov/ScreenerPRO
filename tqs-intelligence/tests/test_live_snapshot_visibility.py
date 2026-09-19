import asyncio
import threading

from tqs_intelligence.models import AssetClass, Quote, SourceHealth, SourceStatus
from tqs_intelligence.service import IntelligenceService


class DummySource:
    provider = "test"
    name = "Test"

    async def collect(self):
        quote = Quote(
            provider="test", venue="TEST", symbol="ABC", asset_class=AssetClass.STOCK,
            market_type="shares", last=100.0, ts_ms=1, observed_at_ms=1,
        )
        health = SourceHealth(
            provider="test", name="Test", status=SourceStatus.OK,
            instruments=1, latency_ms=1, last_success_ms=1,
        )
        return [quote], health


class DummyNews:
    async def collect(self):
        return []


class SlowEpisodeStore:
    def __init__(self, entered, release):
        self.entered = entered
        self.release = release
        self.persist_calls = 0
        self.episode_calls = 0

    def append_log(self, item):
        return None

    def persist_snapshot(self, quotes, anomalies, news):
        self.persist_calls += 1
        if self.persist_calls == 1:
            self.entered.set()
            self.release.wait(timeout=5)

    def update_episodes(self, anomalies, now_ms, threshold, close_after_ms):
        self.episode_calls += 1
        return []


def test_live_snapshot_is_visible_before_slow_episode_postprocessing():
    entered = threading.Event()
    release = threading.Event()
    service = IntelligenceService(
        [DummySource()], DummyNews(), SlowEpisodeStore(entered, release),
        interval_s=60, control=None,
    )

    async def scenario():
        store = service.store
        await asyncio.wait_for(service.refresh(force=True), timeout=2)
        reached = await asyncio.to_thread(entered.wait, 2)
        assert reached is True
        assert service.state.refreshing is False
        assert service.state.refresh_count == 1
        assert service.state.snapshot is not None
        assert service.state.snapshot.quotes[0].canonical_id == "test:shares:ABC"
        assert service.current_health()[0].status == SourceStatus.OK
        assert service.runtime_status()["postprocess"]["running"] is True

        # A second market refresh must finish while the first durable snapshot
        # write is blocked. Snapshot durability queues; episode state collapses
        # to the newest market state.
        await asyncio.wait_for(service.refresh(force=True), timeout=2)
        assert service.state.refresh_count == 2
        assert service.runtime_status()["postprocess"]["snapshot_queue"] == 1
        assert service.runtime_status()["postprocess"]["episode_pending"] is True

        release.set()
        for _ in range(100):
            if not service.runtime_status()["postprocess"]["running"]:
                break
            await asyncio.sleep(0.02)
        assert store.persist_calls == 2
        assert store.episode_calls == 1
        assert service.runtime_status()["postprocess"]["dropped_snapshots"] == 0
        assert service.runtime_status()["postprocess"]["running"] is False

    asyncio.run(scenario())
