import asyncio
from types import SimpleNamespace

from tqs_intelligence.research_runtime import ResearchRuntime


def test_planner_loop_runs_even_when_workers_are_not_idle():
    runtime = object.__new__(ResearchRuntime)
    runtime.control = SimpleNamespace(get=lambda: SimpleNamespace(heavy_allowed=True))
    runtime._planner_lock = asyncio.Lock()
    runtime.last_error = None
    runtime.last_action = ""
    calls = {"n": 0}

    async def fake_plan():
        calls["n"] += 1
        return 0

    runtime._autoplan_idle = fake_plan

    async def scenario():
        task = asyncio.create_task(runtime._planner_loop())
        try:
            for _ in range(50):
                if calls["n"]:
                    break
                await asyncio.sleep(0.01)
            assert calls["n"] == 1
        finally:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    asyncio.run(scenario())
