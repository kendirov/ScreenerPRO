from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

TASK_NAME = "TQS Intelligence Server"
CONFIG_NAME = "server-node.json"
STOP_MARKER_NAME = "server-stop.flag"


def tqs_root() -> Path:
    return Path(__file__).resolve().parents[2]


def data_dir(root: Path | None = None) -> Path:
    base = Path(root or tqs_root())
    path = base / "data"
    path.mkdir(parents=True, exist_ok=True)
    return path


def config_path(root: Path | None = None) -> Path:
    return data_dir(root) / CONFIG_NAME


def stop_marker_path(root: Path | None = None) -> Path:
    return data_dir(root) / STOP_MARKER_NAME


def load_node_config(root: Path | None = None) -> dict[str, Any]:
    path = config_path(root)
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
        return payload if isinstance(payload, dict) else {}
    except Exception:
        return {}


def server_mode_enabled(root: Path | None = None) -> bool:
    cfg = load_node_config(root)
    return bool(cfg.get("enabled") and cfg.get("server_mode", True))


def auto_update_interval_seconds(root: Path | None = None) -> int:
    cfg = load_node_config(root)
    fallback = 300 if server_mode_enabled(root) else 1800
    try:
        value = int(cfg.get("update_check_seconds") or fallback)
    except Exception:
        value = fallback
    return max(60, min(value, 86_400))


def _candidate_tailscale_paths(cfg: dict[str, Any]) -> list[Path]:
    values: list[str] = []
    if cfg.get("tailscale_exe"):
        values.append(str(cfg["tailscale_exe"]))
    found = shutil.which("tailscale") or shutil.which("tailscale.exe")
    if found:
        values.append(found)
    for env_name in ("ProgramFiles", "ProgramW6432"):
        base = os.environ.get(env_name)
        if base:
            values.append(str(Path(base) / "Tailscale" / "tailscale.exe"))
    return [Path(x) for x in dict.fromkeys(values) if x]


def find_tailscale(root: Path | None = None) -> Path | None:
    cfg = load_node_config(root)
    for path in _candidate_tailscale_paths(cfg):
        if path.exists():
            return path
    return None


def _run(args: list[str], timeout: int = 8) -> tuple[int, str]:
    try:
        proc = subprocess.run(args, text=True, capture_output=True, timeout=timeout, check=False)
        text = ((proc.stdout or "") + ("\n" + proc.stderr if proc.stderr else "")).strip()
        return int(proc.returncode), text
    except Exception as exc:
        return 1, f"{type(exc).__name__}: {exc}"


def _json_output(args: list[str], timeout: int = 8) -> tuple[dict[str, Any] | None, str]:
    code, text = _run(args, timeout)
    if code != 0:
        return None, text
    try:
        value = json.loads(text)
        return value if isinstance(value, dict) else {}, text
    except Exception:
        return None, text


def _task_installed(task_name: str) -> bool:
    if os.name != "nt":
        return False
    code, _ = _run(["schtasks.exe", "/Query", "/TN", task_name], timeout=5)
    return code == 0


def request_server_task_start(root: Path | None = None) -> bool:
    """Best-effort start of the Windows scheduled server task.

    The normal user may not have rights to start a SYSTEM task on every Windows
    policy. Callers should fall back to starting the supervisor directly.
    """
    if os.name != "nt":
        return False
    cfg = load_node_config(root)
    task_name = str(cfg.get("task_name") or TASK_NAME)
    code, _ = _run(["schtasks.exe", "/Run", "/TN", task_name], timeout=10)
    return code == 0


def remote_node_status(root: Path | None = None) -> dict[str, Any]:
    base = Path(root or tqs_root())
    cfg = load_node_config(base)
    enabled = bool(cfg.get("enabled"))
    task_name = str(cfg.get("task_name") or TASK_NAME)
    tailscale = find_tailscale(base)
    ts_status: dict[str, Any] | None = None
    ts_error = ""
    serve_configured = False
    serve_raw = ""

    if tailscale is not None:
        ts_status, ts_error = _json_output([str(tailscale), "status", "--json"], timeout=8)
        code, serve_raw = _run([str(tailscale), "serve", "status", "--json"], timeout=8)
        if code == 0:
            normalized = serve_raw.lower()
            serve_configured = "8787" in normalized and (
                "127.0.0.1" in normalized or "localhost" in normalized
            )

    backend_state = str((ts_status or {}).get("BackendState") or "")
    self_info = (ts_status or {}).get("Self") or {}
    dns_name = str(self_info.get("DNSName") or "").strip().rstrip(".")
    online = bool(self_info.get("Online", backend_state.lower() == "running"))
    remote_url = str(cfg.get("remote_url") or "").strip()
    if not remote_url and dns_name:
        remote_url = f"https://{dns_name}"

    host = "127.0.0.1"
    env_path = base / ".env"
    try:
        for line in env_path.read_text(encoding="utf-8-sig").splitlines():
            if line.startswith("TQS_HOST="):
                host = line.split("=", 1)[1].strip() or host
                break
    except Exception:
        pass
    loopback_only = host in {"127.0.0.1", "localhost", "::1"}

    task_installed = _task_installed(task_name) if enabled else False
    stopped_by_owner = stop_marker_path(base).exists()
    ready = bool(
        enabled
        and tailscale is not None
        and online
        and backend_state.lower() == "running"
        and serve_configured
        and remote_url
        and task_installed
        and loopback_only
        and not stopped_by_owner
    )

    return {
        "enabled": enabled,
        "server_mode": bool(cfg.get("server_mode", enabled)),
        "ready": ready,
        "provider": str(cfg.get("remote_provider") or "tailscale"),
        "remote_url": remote_url or None,
        "dns_name": dns_name or None,
        "tailscale_installed": tailscale is not None,
        "tailscale_exe": str(tailscale) if tailscale is not None else None,
        "tailscale_backend_state": backend_state or None,
        "tailscale_online": online,
        "tailscale_error": ts_error[:500] if ts_error else None,
        "serve_configured": serve_configured,
        "scheduled_task": {
            "name": task_name,
            "installed": task_installed,
        },
        "stopped_by_owner": stopped_by_owner,
        "auto_update": bool(cfg.get("auto_update", True)),
        "update_check_seconds": auto_update_interval_seconds(base),
        "bind_host": host,
        "loopback_only": loopback_only,
        "public_exposure": False,
        "setup_at_ms": cfg.get("setup_at_ms"),
        "security_note": "TQS remains bound to loopback; remote access is private through Tailscale Serve, not Funnel.",
    }
