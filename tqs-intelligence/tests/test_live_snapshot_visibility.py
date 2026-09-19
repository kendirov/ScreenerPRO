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

    def append_log(self, item):
        return None

    def persist_snapshot(self, quotes, anomalies, news):
        return None

    def update_episodes(self, anomalies, now_ms, threshold, close_after_ms):
        self.entered.set()
        self.release.wait(timeout=5)
        return []


def test_live_snapshot_is_visible_before_slow_episode_postprocessing():
    entered = threading.Event()
    release = threading.Event()
    service = IntelligenceService(
        [DummySource()], DummyNews(), SlowEpisodeStore(entered, release),
        interval_s=60, control=None,
    )

    async def scenario():
        task = asyncio.create_task(service.refresh(force=True))
        reached = await asyncio.to_thread(entered.wait, 2)
        assert reached is True
        assert task.done() is False
        assert service.state.refreshing is True
        assert service.state.refresh_count == 0
        assert service.state.snapshot is not None
        assert service.state.snapshot.quotes[0].canonical_id == "test:shares:ABC"
        assert service.current_health()[0].status == SourceStatus.OK
        release.set()
        await asyncio.wait_for(task, timeout=2)
        assert service.state.refresh_count == 1
        assert service.state.refreshing is False

    asyncio.run(scenario())
