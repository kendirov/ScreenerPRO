from __future__ import annotations

import time
from pathlib import Path

import pytest

from tqs_intelligence.ai_control import AiControlBridge
from tqs_intelligence.control import ControlCenter


class FakeUpdater:
    def __init__(self):
        self.calls = 0

    def request(self, force=False):
        self.calls += 1
        return {"ok": True, "force": bool(force)}


class FakeService:
    def __init__(self):
        self.refresh_calls = 0
        self.logs = []

    def request_refresh(self):
        self.refresh_calls += 1
        return True

    def log(self, *args, **kwargs):
        self.logs.append((args, kwargs))


@pytest.mark.asyncio
async def test_ai_control_applies_allowlisted_resource_policy(tmp_path):
    control = ControlCenter(str(tmp_path / "control.json"))
    service = FakeService()
    updater = FakeUpdater()
    bridge = AiControlBridge(
        url="https://example.invalid/command.json",
        control=control,
        updater=updater,
        service=service,
        state_path=str(tmp_path / "ai-control-state.json"),
        poll_seconds=30,
    )
    now = int(time.time() * 1000)
    payload = {
        "schema_version": 1,
        "command_id": "cmd-1",
        "issued_at_ms": now,
        "expires_at_ms": now + 300_000,
        "requested_by": "test",
        "action": "set_control",
        "params": {
            "mode": "max",
            "heavy_workers": 3,
            "history_batch_size": 8,
            "metric_batch_size": 4,
            "refresh_seconds_override": 30,
            "cpu_soft_limit_pct": 95,
            "ram_soft_limit_pct": 96,
        },
    }

    async def fake_fetch():
        return payload

    bridge._fetch = fake_fetch
    result = await bridge.poll_once()

    assert result["ok"] is True
    state = control.get()
    assert state.mode == "max"
    assert state.heavy_workers == 3
    assert state.history_batch_size == 8
    assert state.metric_batch_size == 4
    assert state.refresh_seconds_override == 30
    assert state.cpu_soft_limit_pct == 95
    assert state.ram_soft_limit_pct == 96

    # replay protection: the same command is ignored
    assert await bridge.poll_once() is None


@pytest.mark.asyncio
async def test_ai_control_rejects_unknown_keys_and_shell_actions(tmp_path):
    control = ControlCenter(str(tmp_path / "control.json"))
    bridge = AiControlBridge(
        url="x",
        control=control,
        updater=FakeUpdater(),
        service=FakeService(),
        state_path=str(tmp_path / "state.json"),
    )
    now = int(time.time() * 1000)

    payload = {
        "schema_version": 1,
        "command_id": "cmd-bad",
        "issued_at_ms": now,
        "expires_at_ms": now + 60_000,
        "action": "set_control",
        "params": {"heavy_workers": 2, "shell": "whoami"},
    }

    async def fake_fetch():
        return payload

    bridge._fetch = fake_fetch
    result = await bridge.poll_once()
    assert result["ok"] is False
    assert "unsupported control keys" in result["error"]

    ok, reason = bridge._validate(
        {
            "schema_version": 1,
            "command_id": "cmd-shell",
            "issued_at_ms": now,
            "expires_at_ms": now + 60_000,
            "action": "shell",
        }
    )
    assert ok is False
    assert "not allowed" in reason


def test_control_center_clamps_live_resource_policy(tmp_path):
    control = ControlCenter(str(tmp_path / "control.json"))
    state = control.update(
        heavy_workers=99,
        history_batch_size=99,
        metric_batch_size=99,
        refresh_seconds_override=9999,
        cpu_soft_limit_pct=10,
        ram_soft_limit_pct=100,
    )
    assert state.heavy_workers == 4
    assert state.history_batch_size == 16
    assert state.metric_batch_size == 8
    assert state.refresh_seconds_override == 900
    assert state.cpu_soft_limit_pct == 50
    assert state.ram_soft_limit_pct == 99
