from __future__ import annotations

import ctypes
import os

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

    def ensure_backend() -> None:
        if app.health() is None:
            app._event("Backend OFFLINE — запускаю автоматически")
            app.start_backend()

    def power_tick() -> None:
        awake = False
        try:
            health = app.health()
            mode = str(((health or {}).get("control") or {}).get("mode") or "").lower()
            awake = bool(health and mode == "max")
        except Exception:
            awake = False
        if awake != power_state["awake"]:
            _set_system_awake(awake)
            power_state["awake"] = awake
            app._event("MAX: Windows не уснёт, пока Launcher открыт" if awake else "Keep-awake выключен")
        app.root.after(30_000, power_tick)

    def close() -> None:
        _set_system_awake(False)
        app.root.destroy()

    app.root.protocol("WM_DELETE_WINDOW", close)
    app.root.after(800, ensure_backend)
    app.root.after(2_000, power_tick)
    raise SystemExit(app.run())


if __name__ == "__main__":
    main()
