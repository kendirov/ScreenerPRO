from __future__ import annotations

from dataclasses import dataclass


@dataclass
class WatchdogDecision:
    action: str = "none"  # none | wait | start | hard_recover
    offline_for_s: float = 0.0
    reason: str = ""


class WatchdogPolicy:
    """Pure watchdog state machine.

    A slow /api/health response is not equivalent to a dead process. Heavy
    history/research writes can temporarily make the HTTP endpoint slow, so the
    launcher must use hysteresis and process evidence before killing anything.
    """

    def __init__(
        self,
        *,
        start_after_s: float = 12.0,
        hard_recover_after_s: float = 180.0,
        restart_cooldown_s: float = 90.0,
    ) -> None:
        self.start_after_s = float(start_after_s)
        self.hard_recover_after_s = float(hard_recover_after_s)
        self.restart_cooldown_s = float(restart_cooldown_s)
        self.offline_since: float | None = None
        self.last_restart_at: float = -10**9

    def reset(self) -> None:
        self.offline_since = None

    def observe(
        self,
        *,
        now: float,
        healthy: bool,
        mode: str,
        process_count: int,
        busy: bool,
        supervisor_heartbeat_fresh: bool = False,
    ) -> WatchdogDecision:
        mode = str(mode or "light").lower()
        if mode == "stop":
            self.reset()
            return WatchdogDecision("none", 0.0, "режим STOP")

        if healthy:
            self.reset()
            return WatchdogDecision("none", 0.0, "health OK")

        if self.offline_since is None:
            self.offline_since = now
        offline_for = max(0.0, now - self.offline_since)

        if busy:
            return WatchdogDecision("wait", offline_for, "launcher занят")

        # A fresh supervisor heartbeat is stronger evidence than one missed HTTP
        # health probe. Never kill a live supervisor because the event loop/DB is
        # briefly busy.
        if supervisor_heartbeat_fresh:
            return WatchdogDecision("wait", offline_for, "supervisor heartbeat свежий")

        if process_count <= 0:
            if offline_for >= self.start_after_s and now - self.last_restart_at >= self.restart_cooldown_s:
                self.last_restart_at = now
                return WatchdogDecision("start", offline_for, "TQS процессов нет")
            return WatchdogDecision("wait", offline_for, "жду grace period перед запуском")

        # Processes exist but HTTP health is unavailable. Give them a long grace
        # window before a destructive recovery. This is the key protection
        # against restart loops under heavy historical/research load.
        if offline_for >= self.hard_recover_after_s and now - self.last_restart_at >= self.restart_cooldown_s:
            self.last_restart_at = now
            return WatchdogDecision("hard_recover", offline_for, "процессы есть, но health отсутствует слишком долго")

        return WatchdogDecision("wait", offline_for, "процессы живы; не перезапускаю по одному timeout")
