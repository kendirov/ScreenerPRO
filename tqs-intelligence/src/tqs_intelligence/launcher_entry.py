from __future__ import annotations

import ctypes
import json
import os
import time

from .launcher import TQSLauncher

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
    watchdog = {"last_restart": 0.0, "failures": 0}

    def desired_mode() -> str:
        # When backend is temporarily offline we still need to know whether MAX
        # should keep Windows awake and whether watchdog recovery is desired.
        try:
            raw = json.loads((app.data_dir / "control.json").read_text(encoding="utf-8"))
            return str(raw.get("mode") or "light").lower()
        except Exception:
            return "light"

    def recover_backend() -> None:
        # Recovery runs in Launcher's worker thread. Kill stale TQS processes
        # first: a dead supervisor/uvicorn can keep DuckDB or :8787 locked and
        # make every subsequent start fail.
        app._event("WATCHDOG: очищаю зависшие TQS процессы")
        app._stop_backend()
        time.sleep(1)
        app._start_backend()

    def watchdog_tick() -> None:
        try:
            health = app.health()
            mode = str(((health or {}).get("control") or {}).get("mode") or desired_mode()).lower()
            if health:
                watchdog["failures"] = 0
            elif mode != "stop" and not app._busy:
                now = time.time()
                # Backoff protects against a hard startup error while still
                # recovering quickly from ordinary process/network failures.
                cooldown = min(120.0, 8.0 * (2 ** min(watchdog["failures"], 4)))
                if now - watchdog["last_restart"] >= cooldown:
                    watchdog["last_restart"] = now
                    watchdog["failures"] += 1
                    app._event(
                        f"Backend OFFLINE — запускаю автоматически (watchdog #{watchdog['failures']})"
                    )
                    app._thread(recover_backend)
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
