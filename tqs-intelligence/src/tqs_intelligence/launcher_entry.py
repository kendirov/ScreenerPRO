from __future__ import annotations

import ctypes
import json
import os
import time

from .launcher import TQSLauncher
from .watchdog_policy import WatchdogPolicy

ES_CONTINUOUS = 0x80000000
ES_SYSTEM_REQUIRED = 0x00000001


def _set_system_awake(enabled: bool) -> None:
    if os.name != "nt":
        return
    flags = ES_CONTINUOUS | (ES_SYSTEM_REQUIRED if enabled else 0)
    try:
        ctypes.windll.kernel32.SetThreadExecutionState(flags)
    except Exception:
        pass


def main() -> None:
    app = TQSLauncher()
    power_state = {"awake": False}
    policy = WatchdogPolicy(start_after_s=12, hard_recover_after_s=180, restart_cooldown_s=90)
    watchdog = {"last_notice": 0.0, "recoveries": 0}
    heartbeat_path = app.data_dir / "supervisor-heartbeat.json"

    def desired_mode() -> str:
        # When backend is temporarily offline we still need to know whether MAX
        # should keep Windows awake and whether watchdog recovery is desired.
        try:
            raw = json.loads((app.data_dir / "control.json").read_text(encoding="utf-8"))
            return str(raw.get("mode") or "light").lower()
        except Exception:
            return "light"

    def supervisor_heartbeat_fresh(max_age_s: float = 15.0) -> bool:
        try:
            raw = json.loads(heartbeat_path.read_text(encoding="utf-8"))
            ts_ms = int(raw.get("ts_ms") or 0)
            if ts_ms <= 0:
                return False
            return (time.time() * 1000 - ts_ms) <= max_age_s * 1000
        except Exception:
            return False

    def hard_recover_backend() -> None:
        # Destructive cleanup is a last resort only after a sustained outage.
        # A single /api/health timeout must never kill heavy overnight work.
        app._event("WATCHDOG: длительный outage — очищаю зависшие TQS процессы")
        app._stop_backend()
        time.sleep(1)
        app._start_backend()

    def start_missing_backend() -> None:
        app._event("WATCHDOG: TQS процессов нет — запускаю supervisor")
        app._start_backend()

    def watchdog_tick() -> None:
        try:
            health = app.health()
            mode = str(((health or {}).get("control") or {}).get("mode") or desired_mode()).lower()
            processes = app._matching_tqs_processes()
            fresh_supervisor = supervisor_heartbeat_fresh()
            decision = policy.observe(
                now=time.time(),
                healthy=health is not None,
                mode=mode,
                process_count=len(processes),
                busy=app._busy,
                supervisor_heartbeat_fresh=fresh_supervisor,
            )

            if decision.action == "start":
                watchdog["recoveries"] += 1
                app._thread(start_missing_backend)
            elif decision.action == "hard_recover":
                watchdog["recoveries"] += 1
                app._thread(hard_recover_backend)
            elif decision.action == "wait" and health is None:
                # Do not spam the owner every five seconds. Show a diagnostic
                # reminder at most once per minute while preserving the work.
                now = time.time()
                if now - watchdog["last_notice"] >= 60:
                    watchdog["last_notice"] = now
                    app._event(
                        f"WATCHDOG: health временно недоступен {decision.offline_for_s:.0f}с; "
                        f"процессов {len(processes)}; {decision.reason}"
                    )
        except Exception as exc:
            app._event(f"WATCHDOG: ошибка проверки — {str(exc)[:180]}")
        app.root.after(5_000, watchdog_tick)

    def power_tick() -> None:
        awake = False
        try:
            health = app.health()
            mode = str(((health or {}).get("control") or {}).get("mode") or desired_mode()).lower()
            # In MAX keep Windows awake even through a temporary backend crash,
            # otherwise the machine may sleep before watchdog finishes recovery.
            awake = mode == "max"
        except Exception:
            awake = desired_mode() == "max"
        if awake != power_state["awake"]:
            _set_system_awake(awake)
            power_state["awake"] = awake
            app._event("MAX: Windows не уснёт, пока Launcher открыт" if awake else "Keep-awake выключен")
        app.root.after(30_000, power_tick)

    def log_tick() -> None:
        # Runtime log must remain visible even while a start/recovery thread is
        # busy waiting for health; otherwise the owner sees OFFLINE but not why.
        try:
            app._refresh_log()
        except Exception:
            pass
        app.root.after(2_000, log_tick)

    def close() -> None:
        _set_system_awake(False)
        app.root.destroy()

    app.root.protocol("WM_DELETE_WINDOW", close)
    app.root.after(700, watchdog_tick)
    app.root.after(1_500, power_tick)
    app.root.after(1_000, log_tick)
    raise SystemExit(app.run())


if __name__ == "__main__":
    main()
