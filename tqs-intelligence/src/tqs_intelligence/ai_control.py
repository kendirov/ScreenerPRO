from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path
from typing import Any

import httpx

from .control import ControlCenter
from .update_manager import UpdateManager


_ALLOWED_CONTROL_KEYS = {
    "mode",
    "auto_update",
    "heavy_workers",
    "history_batch_size",
    "metric_batch_size",
    "refresh_seconds_override",
    "cpu_soft_limit_pct",
    "ram_soft_limit_pct",
}


def _now_ms() -> int:
    return int(time.time() * 1000)


class AiControlBridge:
    """Narrow GitHub -> TQS operational control bridge.

    This is intentionally NOT a remote shell. Commands are allow-listed, expire,
    and are replay-protected. The command file may be public; it must never
    contain credentials or trading secrets.
    """

    def __init__(
        self,
        *,
        url: str,
        control: ControlCenter,
        updater: UpdateManager,
        service: Any,
        state_path: str = "./data/ai-control-state.json",
        poll_seconds: int = 30,
    ) -> None:
        self.url = str(url or "").strip()
        self.control = control
        self.updater = updater
        self.service = service
        self.state_path = Path(state_path)
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        self.poll_seconds = max(15, int(poll_seconds))
        self._task: asyncio.Task | None = None
        self._running = False
        self._last_poll_ms: int | None = None
        self._last_error: str | None = None
        self._last_command: dict[str, Any] | None = None
        self._last_result: dict[str, Any] | None = None
        self._seen_ids: set[str] = set()
        self._load_state()

    def _load_state(self) -> None:
        try:
            payload = json.loads(self.state_path.read_text(encoding="utf-8-sig"))
            if not isinstance(payload, dict):
                return
            ids = payload.get("seen_ids") or []
            self._seen_ids = {str(x) for x in ids[-100:] if x}
            if isinstance(payload.get("last_command"), dict):
                self._last_command = payload["last_command"]
            if isinstance(payload.get("last_result"), dict):
                self._last_result = payload["last_result"]
        except Exception:
            pass

    def _save_state(self) -> None:
        payload = {
            "updated_at_ms": _now_ms(),
            "seen_ids": list(self._seen_ids)[-100:],
            "last_command": self._last_command,
            "last_result": self._last_result,
        }
        try:
            tmp = self.state_path.with_suffix(".tmp")
            tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            tmp.replace(self.state_path)
        except Exception:
            pass

    def status(self) -> dict[str, Any]:
        age_s = None
        if self._last_poll_ms:
            age_s = max(0, int((_now_ms() - self._last_poll_ms) / 1000))
        return {
            "enabled": bool(self.url),
            "running": self._running,
            "poll_seconds": self.poll_seconds,
            "last_poll_ms": self._last_poll_ms,
            "poll_age_s": age_s,
            "last_error": self._last_error,
            "last_command": self._last_command,
            "last_result": self._last_result,
            "transport": "github-raw-allowlist",
            "remote_shell": False,
            "allowed_actions": ["set_control", "refresh_market", "request_update", "noop"],
            "security_note": "No shell, no arbitrary process kill, no order placement. Commands expire and are replay-protected.",
        }

    async def _fetch(self) -> dict[str, Any] | None:
        if not self.url:
            return None
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            response = await client.get(
                self.url,
                headers={"User-Agent": "TQS-AI-Control/1.0", "Cache-Control": "no-cache"},
                params={"t": str(_now_ms())},
            )
            if response.status_code == 404:
                return None
            response.raise_for_status()
            payload = response.json()
            return payload if isinstance(payload, dict) else None

    def _validate(self, payload: dict[str, Any]) -> tuple[bool, str]:
        if int(payload.get("schema_version") or 0) != 1:
            return False, "unsupported schema_version"
        command_id = str(payload.get("command_id") or "").strip()
        if not command_id:
            return False, "command_id missing"
        if command_id in self._seen_ids:
            return False, "already processed"
        action = str(payload.get("action") or "").strip()
        if action not in {"set_control", "refresh_market", "request_update", "noop"}:
            return False, f"action not allowed: {action}"
        now = _now_ms()
        expires = int(payload.get("expires_at_ms") or 0)
        issued = int(payload.get("issued_at_ms") or 0)
        if action != "noop":
            if not issued or not expires:
                return False, "issued_at_ms/expires_at_ms required"
            if issued > now + 5 * 60_000:
                return False, "command issued in the future"
            if expires < now:
                return False, "command expired"
            if expires - issued > 60 * 60_000:
                return False, "command TTL too long"
        return True, ""

    async def _execute(self, payload: dict[str, Any]) -> dict[str, Any]:
        action = str(payload.get("action") or "")
        params = payload.get("params") if isinstance(payload.get("params"), dict) else {}

        if action == "noop":
            return {"ok": True, "action": action, "message": "noop"}

        if action == "set_control":
            safe = {k: v for k, v in params.items() if k in _ALLOWED_CONTROL_KEYS}
            rejected = sorted(set(params) - set(safe))
            if rejected:
                return {"ok": False, "action": action, "error": f"unsupported control keys: {rejected}"}
            state = self.control.update(**safe, changed_by="ai-control")
            try:
                self.service.log(
                    "info",
                    "ai-control",
                    "AI control policy applied",
                    command_id=payload.get("command_id"),
                    changes=safe,
                )
            except Exception:
                pass
            return {
                "ok": True,
                "action": action,
                "applied": safe,
                "mode": state.mode,
                "message": "control applied",
            }

        if action == "refresh_market":
            accepted = bool(self.service.request_refresh())
            return {
                "ok": True,
                "action": action,
                "accepted": accepted,
                "message": "market refresh accepted" if accepted else "market refresh already running",
            }

        if action == "request_update":
            result = self.updater.request(False)
            return {"ok": bool(result.get("ok")), "action": action, "update_request": result}

        return {"ok": False, "action": action, "error": "unhandled action"}

    async def poll_once(self) -> dict[str, Any] | None:
        self._last_poll_ms = _now_ms()
        try:
            payload = await self._fetch()
            self._last_error = None
            if not payload:
                return None
            valid, reason = self._validate(payload)
            if not valid:
                if reason == "already processed":
                    return None
                self._last_command = {
                    "command_id": payload.get("command_id"),
                    "action": payload.get("action"),
                    "rejected_at_ms": _now_ms(),
                }
                self._last_result = {"ok": False, "error": reason, "command_id": payload.get("command_id")}
                self._save_state()
                return self._last_result

            command_id = str(payload.get("command_id"))
            self._last_command = {
                "command_id": command_id,
                "action": payload.get("action"),
                "requested_by": payload.get("requested_by"),
                "issued_at_ms": payload.get("issued_at_ms"),
                "received_at_ms": _now_ms(),
            }
            result = await self._execute(payload)
            result = {**result, "command_id": command_id, "finished_at_ms": _now_ms()}
            self._last_result = result
            self._seen_ids.add(command_id)
            if len(self._seen_ids) > 100:
                self._seen_ids = set(list(self._seen_ids)[-100:])
            self._save_state()
            return result
        except Exception as exc:
            self._last_error = f"{type(exc).__name__}: {exc}"[:1000]
            return None

    async def _loop(self) -> None:
        self._running = True
        try:
            while True:
                await self.poll_once()
                await asyncio.sleep(self.poll_seconds)
        finally:
            self._running = False

    def start(self) -> None:
        if not self.url:
            return
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._loop(), name="tqs-ai-control-bridge")

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
