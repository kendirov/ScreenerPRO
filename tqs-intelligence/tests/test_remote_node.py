from __future__ import annotations

import json
from pathlib import Path

from tqs_intelligence import remote_node
from tqs_intelligence.update_manager import UpdateManager


def test_server_node_config_controls_update_interval(tmp_path):
    data = tmp_path / "data"
    data.mkdir()
    (data / "server-node.json").write_text(
        json.dumps({"enabled": True, "server_mode": True, "update_check_seconds": 300}),
        encoding="utf-8",
    )
    assert remote_node.server_mode_enabled(tmp_path) is True
    assert remote_node.auto_update_interval_seconds(tmp_path) == 300


def test_remote_status_reports_private_tailscale_node(tmp_path, monkeypatch):
    data = tmp_path / "data"
    data.mkdir()
    tailscale = tmp_path / "tailscale.exe"
    tailscale.write_text("", encoding="utf-8")
    (tmp_path / ".env").write_text("TQS_HOST=127.0.0.1\n", encoding="utf-8")
    (data / "server-node.json").write_text(
        json.dumps(
            {
                "enabled": True,
                "server_mode": True,
                "task_name": remote_node.TASK_NAME,
                "tailscale_exe": str(tailscale),
                "update_check_seconds": 300,
                "auto_update": True,
            }
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(remote_node, "find_tailscale", lambda root=None: tailscale)
    monkeypatch.setattr(
        remote_node,
        "_json_output",
        lambda args, timeout=8: (
            {
                "BackendState": "Running",
                "Self": {"DNSName": "tqs-office.example.ts.net.", "Online": True},
            },
            "",
        ),
    )
    monkeypatch.setattr(
        remote_node,
        "_run",
        lambda args, timeout=8: (0, '{"Web":{"443":{"Handlers":{"/":{"Proxy":"http://127.0.0.1:8787"}}}}}'),
    )
    monkeypatch.setattr(remote_node, "_task_installed", lambda name: True)

    status = remote_node.remote_node_status(tmp_path)
    assert status["ready"] is True
    assert status["remote_url"] == "https://tqs-office.example.ts.net"
    assert status["loopback_only"] is True
    assert status["public_exposure"] is False
    assert status["serve_configured"] is True


def test_remote_status_rejects_non_loopback_bind(tmp_path, monkeypatch):
    data = tmp_path / "data"
    data.mkdir()
    tailscale = tmp_path / "tailscale.exe"
    tailscale.write_text("", encoding="utf-8")
    (tmp_path / ".env").write_text("TQS_HOST=0.0.0.0\n", encoding="utf-8")
    (data / "server-node.json").write_text(
        json.dumps({"enabled": True, "tailscale_exe": str(tailscale)}),
        encoding="utf-8",
    )
    monkeypatch.setattr(remote_node, "find_tailscale", lambda root=None: tailscale)
    monkeypatch.setattr(
        remote_node,
        "_json_output",
        lambda args, timeout=8: (
            {"BackendState": "Running", "Self": {"DNSName": "node.ts.net.", "Online": True}},
            "",
        ),
    )
    monkeypatch.setattr(remote_node, "_run", lambda args, timeout=8: (0, "127.0.0.1:8787"))
    monkeypatch.setattr(remote_node, "_task_installed", lambda name: True)

    status = remote_node.remote_node_status(tmp_path)
    assert status["ready"] is False
    assert status["loopback_only"] is False


def test_update_request_stays_inside_supervisor_in_server_mode(tmp_path, monkeypatch):
    manager = UpdateManager(str(tmp_path / "update-request.json"))
    monkeypatch.setattr("tqs_intelligence.update_manager.server_mode_enabled", lambda root=None: True)

    def should_not_launch():
        raise AssertionError("external updater must not be launched in server mode")

    monkeypatch.setattr(manager, "_launch_windows_updater", should_not_launch)
    result = manager.request(False)

    assert result["ok"] is True
    assert result["external"] is False
    assert result["server_mode"] is True
    assert (tmp_path / "update-request.json").exists()


def test_ai_bridge_state_reports_fresh_drive_publish(tmp_path, monkeypatch):
    data = tmp_path / "data"
    data.mkdir()
    now_ms = 2_000_000_000_000
    (data / "ai-bridge-state.json").write_text(
        json.dumps(
            {
                "last_publish_ms": now_ms - 60_000,
                "target_path": r"G:\\My Drive\\Trading QS\\RUNTIME",
                "drive_connected": True,
                "audit_overall": "OK",
                "version": "0.12.0",
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(remote_node.__import__("time") if False else remote_node, "__name__", remote_node.__name__)
    # ai_bridge_state uses the real clock; make the saved timestamp current enough.
    import time
    payload = json.loads((data / "ai-bridge-state.json").read_text(encoding="utf-8"))
    payload["last_publish_ms"] = int(time.time() * 1000) - 60_000
    (data / "ai-bridge-state.json").write_text(json.dumps(payload), encoding="utf-8")

    state = remote_node.ai_bridge_state(tmp_path)
    assert state["configured"] is True
    assert state["drive_connected"] is True
    assert state["fresh"] is True
    assert state["audit_overall"] == "OK"
