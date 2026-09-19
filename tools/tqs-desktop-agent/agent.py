from __future__ import annotations

import argparse
import ctypes
from ctypes import wintypes
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

import mss
import mss.tools
from PIL import Image, ImageDraw
import pystray
import win32api
import win32con
import win32gui
import win32process
import win32clipboard
from pywinauto import Desktop
from pywinauto.keyboard import KeyAction, VirtualKeyAction

VERSION = "0.1.0"
APP_NAME = "TQS Desktop Agent"
ROOT = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "TQSDesktopAgent"
CONFIG_PATH = ROOT / "config.json"
LOG_PATH = ROOT / "agent.log"
CAPTURE_ROOT = ROOT / "captures"
SHOT_ROOT = ROOT / "shots"
SCENARIO_ROOT = ROOT / "scenarios"
STARTED_AT = time.time()
CONFIG: dict[str, Any] = {}
CONFIG_LOCK = threading.RLock()
HTTPD: ThreadingHTTPServer | None = None
MUTEX_HANDLE = None

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

def set_dpi_awareness() -> None:
    try:
        user32.SetProcessDpiAwarenessContext(ctypes.c_void_p(-4))
    except Exception:
        try:
            ctypes.windll.shcore.SetProcessDpiAwareness(2)
        except Exception:
            try:
                user32.SetProcessDPIAware()
            except Exception:
                pass

def ensure_single_instance() -> None:
    global MUTEX_HANDLE
    MUTEX_HANDLE = kernel32.CreateMutexW(None, False, "Local\\TQSDesktopAgent")
    if kernel32.GetLastError() == 183:
        raise SystemExit(0)

def ensure_dirs() -> None:
    for p in (ROOT, CAPTURE_ROOT, SHOT_ROOT, SCENARIO_ROOT):
        p.mkdir(parents=True, exist_ok=True)

def default_config() -> dict[str, Any]:
    return {
        "version": VERSION,
        "port": 8765,
        "token": secrets.token_urlsafe(36),
        "control_enabled": True,
        "capture_all_monitors": True,
    }

def save_config() -> None:
    with CONFIG_LOCK:
        tmp = CONFIG_PATH.with_suffix(".tmp")
        tmp.write_text(json.dumps(CONFIG, indent=2), encoding="utf-8")
        os.replace(tmp, CONFIG_PATH)

def load_config() -> None:
    global CONFIG
    ensure_dirs()
    if CONFIG_PATH.exists():
        loaded = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        cfg = default_config()
        cfg.update(loaded)
        CONFIG = cfg
    else:
        CONFIG = default_config()
        save_config()

def setup_logging() -> None:
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    handler = RotatingFileHandler(LOG_PATH, maxBytes=2_000_000, backupCount=3, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(handler)

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

def safe_name(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9_.-]+", "_", value.strip())
    return value[:80] or "event"

def monitors() -> list[dict[str, int]]:
    with mss.mss() as sct:
        out = []
        for idx, mon in enumerate(sct.monitors[1:], start=1):
            out.append({
                "index": idx,
                "left": int(mon["left"]),
                "top": int(mon["top"]),
                "width": int(mon["width"]),
                "height": int(mon["height"]),
            })
        return out

def enum_windows() -> list[dict[str, Any]]:
    active = win32gui.GetForegroundWindow()
    rows: list[dict[str, Any]] = []

    def callback(hwnd: int, _: Any) -> None:
        try:
            if not win32gui.IsWindowVisible(hwnd):
                return
            title = win32gui.GetWindowText(hwnd).strip()
            if not title:
                return
            left, top, right, bottom = win32gui.GetWindowRect(hwnd)
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            rows.append({
                "hwnd": hwnd,
                "title": title,
                "pid": pid,
                "active": hwnd == active,
                "rect": {"left": left, "top": top, "right": right, "bottom": bottom},
            })
        except Exception:
            return

    win32gui.EnumWindows(callback, None)
    return rows

def find_window(title_contains: str | None = None, hwnd: int | None = None) -> int:
    if hwnd:
        if not win32gui.IsWindow(hwnd):
            raise ValueError(f"Window handle not found: {hwnd}")
        return hwnd
    needle = (title_contains or "").casefold()
    if not needle:
        raise ValueError("title_contains or hwnd is required")
    matches = [w for w in enum_windows() if needle in w["title"].casefold()]
    if not matches:
        raise ValueError(f"No visible window contains: {title_contains}")
    matches.sort(key=lambda w: (not w["active"], len(w["title"])))
    return int(matches[0]["hwnd"])

def focus_window(title_contains: str | None = None, hwnd: int | None = None) -> dict[str, Any]:
    target = find_window(title_contains, hwnd)
    win32gui.ShowWindow(target, win32con.SW_RESTORE)
    try:
        win32gui.BringWindowToTop(target)
        win32gui.SetForegroundWindow(target)
    except Exception:
        user32.keybd_event(win32con.VK_MENU, 0, 0, 0)
        try:
            win32gui.SetForegroundWindow(target)
        finally:
            user32.keybd_event(win32con.VK_MENU, 0, 2, 0)
    time.sleep(0.12)
    return next(w for w in enum_windows() if w["hwnd"] == target)

def cursor_position() -> dict[str, int]:
    x, y = win32gui.GetCursorPos()
    return {"x": int(x), "y": int(y)}

def move_cursor(x: int, y: int, duration: float = 0.0) -> None:
    x, y = int(x), int(y)
    duration = max(0.0, min(float(duration), 5.0))
    if duration <= 0:
        if not user32.SetCursorPos(x, y):
            raise OSError("SetCursorPos failed")
        return
    start_x, start_y = win32gui.GetCursorPos()
    steps = max(2, int(duration * 60))
    for i in range(1, steps + 1):
        t = i / steps
        nx = round(start_x + (x - start_x) * t)
        ny = round(start_y + (y - start_y) * t)
        user32.SetCursorPos(nx, ny)
        time.sleep(duration / steps)

MOUSE_FLAGS = {
    "left": (0x0002, 0x0004),
    "right": (0x0008, 0x0010),
    "middle": (0x0020, 0x0040),
}

def click_mouse(x: int | None, y: int | None, button: str, clicks: int, interval: float) -> None:
    button = button.lower()
    if button not in MOUSE_FLAGS:
        raise ValueError("button must be left, right, or middle")
    if x is not None and y is not None:
        move_cursor(int(x), int(y))
    down, up = MOUSE_FLAGS[button]
    for _ in range(max(1, min(int(clicks), 5))):
        user32.mouse_event(down, 0, 0, 0, 0)
        user32.mouse_event(up, 0, 0, 0, 0)
        time.sleep(max(0.0, min(float(interval), 2.0)))

ULONG_PTR = wintypes.WPARAM

class KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ("wVk", wintypes.WORD),
        ("wScan", wintypes.WORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ULONG_PTR),
    ]

class INPUT_UNION(ctypes.Union):
    _fields_ = [("ki", KEYBDINPUT)]

class INPUT(ctypes.Structure):
    _anonymous_ = ("u",)
    _fields_ = [("type", wintypes.DWORD), ("u", INPUT_UNION)]

def send_unicode_unit(unit: int) -> None:
    down = INPUT(type=1, ki=KEYBDINPUT(0, unit, 0x0004, 0, 0))
    up = INPUT(type=1, ki=KEYBDINPUT(0, unit, 0x0004 | 0x0002, 0, 0))
    arr = (INPUT * 2)(down, up)
    if user32.SendInput(2, arr, ctypes.sizeof(INPUT)) != 2:
        raise OSError("SendInput failed")

def _clipboard_paste(text: str) -> None:
    old_text = None
    had_text = False
    win32clipboard.OpenClipboard()
    try:
        if win32clipboard.IsClipboardFormatAvailable(win32con.CF_UNICODETEXT):
            old_text = win32clipboard.GetClipboardData(win32con.CF_UNICODETEXT)
            had_text = True
        win32clipboard.EmptyClipboard()
        win32clipboard.SetClipboardData(win32con.CF_UNICODETEXT, text)
    finally:
        win32clipboard.CloseClipboard()
    hotkey(["ctrl", "v"])
    time.sleep(0.12)
    win32clipboard.OpenClipboard()
    try:
        win32clipboard.EmptyClipboard()
        if had_text and old_text is not None:
            win32clipboard.SetClipboardData(win32con.CF_UNICODETEXT, old_text)
    finally:
        win32clipboard.CloseClipboard()

def type_text(text: str, interval: float = 0.0) -> None:
    interval = max(0.0, min(float(interval), 1.0))
    layout = user32.GetKeyboardLayout(win32process.GetWindowThreadProcessId(win32gui.GetForegroundWindow())[0])
    encoded = []
    for ch in text:
        if ch in "\n\t":
            encoded.append((ch, None))
            continue
        code = user32.VkKeyScanExW(ctypes.c_wchar(ch), layout)
        if code == -1:
            _clipboard_paste(text)
            return
        encoded.append((ch, int(code)))
    for ch, code in encoded:
        if ch == "\n":
            hotkey(["enter"])
        elif ch == "\t":
            hotkey(["tab"])
        else:
            vk = code & 0xFF
            mods = (code >> 8) & 0xFF
            pressed = []
            if mods & 1:
                pressed.append(0x10)
            if mods & 2:
                pressed.append(0x11)
            if mods & 4:
                pressed.append(0x12)
            for mod in pressed:
                user32.keybd_event(mod, 0, 0, 0)
            user32.keybd_event(vk, user32.MapVirtualKeyW(vk, 0), 0, 0)
            user32.keybd_event(vk, user32.MapVirtualKeyW(vk, 0), 0x0002, 0)
            for mod in reversed(pressed):
                user32.keybd_event(mod, 0, 0x0002, 0)
        if interval:
            time.sleep(interval)

SPECIAL_KEYS = {
    "ctrl": 0x11, "control": 0x11, "shift": 0x10, "alt": 0x12,
    "win": 0x5B, "windows": 0x5B, "enter": 0x0D, "return": 0x0D,
    "tab": 0x09, "esc": 0x1B, "escape": 0x1B, "space": 0x20,
    "backspace": 0x08, "delete": 0x2E, "home": 0x24, "end": 0x23,
    "pageup": 0x21, "pagedown": 0x22, "left": 0x25, "up": 0x26,
    "right": 0x27, "down": 0x28,
}

def key_to_vk(key: str) -> int:
    name = key.lower()
    if name in SPECIAL_KEYS:
        return SPECIAL_KEYS[name]
    if re.fullmatch(r"f([1-9]|1[0-2])", name):
        return 0x70 + int(name[1:]) - 1
    if len(key) == 1 and key.isascii() and key.isalnum():
        return ord(key.upper())
    raise ValueError(f"Unsupported hotkey key: {key}")

def hotkey(keys: list[str]) -> None:
    vks = [key_to_vk(k) for k in keys]
    actions = [VirtualKeyAction(vk, down=True, up=False) for vk in vks]
    actions += [VirtualKeyAction(vk, down=False, up=True) for vk in reversed(vks)]
    for action in actions:
        action.run()

def screenshot(monitor: int | str = 1, prefix: str = "shot") -> dict[str, Any]:
    SHOT_ROOT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
    with mss.mss() as sct:
        if str(monitor).lower() == "all" or int(monitor) == 0:
            mon_idx = 0
        else:
            mon_idx = int(monitor)
            if mon_idx < 1 or mon_idx >= len(sct.monitors):
                raise ValueError(f"monitor must be 1..{len(sct.monitors)-1} or all")
        region = sct.monitors[mon_idx]
        raw = sct.grab(region)
        path = SHOT_ROOT / f"{safe_name(prefix)}_{stamp}_m{mon_idx}.png"
        mss.tools.to_png(raw.rgb, raw.size, output=str(path))
        return {
            "path": str(path),
            "monitor": mon_idx,
            "width": raw.width,
            "height": raw.height,

            "region": {k: int(region[k]) for k in ("left", "top", "width", "height")},
        }

def capture_event(event: str, metadata: dict[str, Any] | None = None, selected: list[int] | None = None) -> dict[str, Any]:
    event = safe_name(event)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
    folder = CAPTURE_ROOT / datetime.now().strftime("%Y-%m-%d") / f"{stamp}_{event}"
    folder.mkdir(parents=True, exist_ok=True)
    files: list[str] = []
    with mss.mss() as sct:
        indexes = selected or list(range(1, len(sct.monitors)))
        for idx in indexes:
            if idx < 1 or idx >= len(sct.monitors):
                continue
            raw = sct.grab(sct.monitors[idx])
            path = folder / f"monitor_{idx}.png"
            mss.tools.to_png(raw.rgb, raw.size, output=str(path))
            files.append(str(path))
    payload = {
        "event": event,
        "timestamp_utc": utc_now(),
        "files": files,
        "metadata": metadata or {},
        "windows": enum_windows(),
    }

    meta_path = folder / "metadata.json"
    meta_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    payload["metadata_path"] = str(meta_path)
    payload["folder"] = str(folder)
    return payload

def ui_elements(window_title: str, text_contains: str = "", limit: int = 50) -> list[dict[str, Any]]:
    needle = window_title.casefold()
    windows = [w for w in Desktop(backend="uia").windows() if needle in w.window_text().casefold()]
    if not windows:
        raise ValueError(f"UIA window not found: {window_title}")
    out: list[dict[str, Any]] = []
    filter_text = text_contains.casefold()
    for el in windows[0].descendants():
        try:
            name = el.window_text() or ""
            if filter_text and filter_text not in name.casefold():
                continue
            rect = el.rectangle()
            out.append({
                "name": name,
                "control_type": el.element_info.control_type,
                "automation_id": el.element_info.automation_id,
                "rect": {"left": rect.left, "top": rect.top, "right": rect.right, "bottom": rect.bottom},
            })

            if len(out) >= min(max(1, int(limit)), 200):
                break
        except Exception:
            continue
    return out

def ui_click(window_title: str, text_contains: str) -> dict[str, Any]:
    needle = window_title.casefold()
    windows = [w for w in Desktop(backend="uia").windows() if needle in w.window_text().casefold()]
    if not windows:
        raise ValueError(f"UIA window not found: {window_title}")
    target_text = text_contains.casefold()
    for el in windows[0].descendants():
        try:
            name = el.window_text() or ""
            if target_text in name.casefold():
                el.click_input()
                rect = el.rectangle()
                return {"name": name, "control_type": el.element_info.control_type,
                        "rect": {"left": rect.left, "top": rect.top, "right": rect.right, "bottom": rect.bottom}}
        except Exception:
            continue
    raise ValueError(f"UI element not found: {text_contains}")

def require_control() -> None:
    with CONFIG_LOCK:
        if not bool(CONFIG.get("control_enabled", True)):
            raise PermissionError("Desktop control is paused from the tray")

def set_control(enabled: bool) -> dict[str, Any]:
    with CONFIG_LOCK:
        CONFIG["control_enabled"] = bool(enabled)
        save_config()
    return {"control_enabled": bool(enabled)}

def run_actions(actions: list[dict[str, Any]]) -> list[Any]:
    require_control()
    results: list[Any] = []
    for action in actions:
        kind = str(action.get("action", "")).lower()
        if kind == "wait":
            seconds = max(0.0, min(float(action.get("seconds", 0)), 30.0))
            time.sleep(seconds)
            results.append({"waited": seconds})
        elif kind == "focus":
            results.append(focus_window(action.get("title"), action.get("hwnd")))
        elif kind == "move":
            move_cursor(action["x"], action["y"], action.get("duration", 0))
            results.append(cursor_position())

        elif kind == "click":
            click_mouse(action.get("x"), action.get("y"), action.get("button", "left"),
                        action.get("clicks", 1), action.get("interval", 0.1))
            results.append(cursor_position())
        elif kind == "type":
            type_text(str(action.get("text", "")), action.get("interval", 0))
            results.append({"typed": len(str(action.get("text", "")))})
        elif kind == "hotkey":
            hotkey(list(action.get("keys", [])))
            results.append({"keys": action.get("keys", [])})
        elif kind == "screenshot":
            results.append(screenshot(action.get("monitor", 1), action.get("prefix", "scenario")))
        else:
            raise ValueError(f"Unknown scenario action: {kind}")
    return results

class APIHandler(BaseHTTPRequestHandler):
    server_version = "TQSDesktopAgent/0.1"

    def log_message(self, fmt: str, *args: Any) -> None:
        logging.info("api " + fmt, *args)

    def _auth(self) -> bool:
        auth = self.headers.get("Authorization", "")
        token = auth.removeprefix("Bearer ").strip()

        with CONFIG_LOCK:
            expected = str(CONFIG["token"])
        return bool(token) and secrets.compare_digest(token, expected)

    def _json_body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        if length > 2_000_000:
            raise ValueError("request body too large")
        data = self.rfile.read(length)
        return json.loads(data.decode("utf-8"))

    def _send(self, status: int, payload: Any) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def _dispatch_error(self, exc: Exception) -> None:
        logging.exception("request failed")
        status = 403 if isinstance(exc, PermissionError) else 400
        self._send(status, {"ok": False, "error": str(exc), "type": type(exc).__name__})

    def do_GET(self) -> None:
        if not self._auth():
            self._send(401, {"ok": False, "error": "unauthorized"})
            return
        try:
            if self.path == "/health":
                self._send(200, {"ok": True, "version": VERSION, "pid": os.getpid(),
                                 "uptime_sec": round(time.time() - STARTED_AT, 1),
                                 "control_enabled": bool(CONFIG.get("control_enabled", True)),
                                 "port": int(CONFIG["port"]), "monitor_count": len(monitors()),
                                 "timestamp_utc": utc_now()})
            elif self.path == "/monitors":
                self._send(200, {"ok": True, "monitors": monitors()})
            elif self.path == "/windows":
                self._send(200, {"ok": True, "windows": enum_windows()})
            elif self.path == "/cursor":
                self._send(200, {"ok": True, "cursor": cursor_position()})
            else:
                self._send(404, {"ok": False, "error": "not found"})
        except Exception as exc:
            self._dispatch_error(exc)

    def do_POST(self) -> None:
        if not self._auth():
            self._send(401, {"ok": False, "error": "unauthorized"})
            return
        try:
            body = self._json_body()
            if self.path == "/screenshot":
                result = screenshot(body.get("monitor", 1), body.get("prefix", "shot"))
            elif self.path == "/capture":
                result = capture_event(body.get("event", "capture"), body.get("metadata"), body.get("monitors"))
            elif self.path == "/event":
                result = capture_event(body.get("type", "event"), body, body.get("monitors"))
            elif self.path == "/focus":
                require_control()
                result = focus_window(body.get("title"), body.get("hwnd"))
            elif self.path == "/mouse/move":
                require_control()
                move_cursor(body["x"], body["y"], body.get("duration", 0))
                result = cursor_position()
            elif self.path == "/mouse/click":
                require_control()
                click_mouse(body.get("x"), body.get("y"), body.get("button", "left"),
                            body.get("clicks", 1), body.get("interval", 0.1))

                result = cursor_position()
            elif self.path == "/keyboard/type":
                require_control()
                text = str(body.get("text", ""))
                type_text(text, body.get("interval", 0))
                result = {"typed": len(text)}
            elif self.path == "/keyboard/hotkey":
                require_control()
                keys = list(body.get("keys", []))
                hotkey(keys)
                result = {"keys": keys}
            elif self.path == "/ui/find":
                result = {"elements": ui_elements(body["window"], body.get("text", ""), body.get("limit", 50))}
            elif self.path == "/ui/click":
                require_control()
                result = ui_click(body["window"], body["text"])
            elif self.path == "/scenario/run":
                result = {"results": run_actions(list(body.get("actions", [])))}
            elif self.path == "/control/pause":
                result = set_control(False)
            elif self.path == "/control/resume":
                result = set_control(True)
            else:
                self._send(404, {"ok": False, "error": "not found"})
                return
            self._send(200, {"ok": True, "result": result})

        except Exception as exc:
            self._dispatch_error(exc)

class ReusableHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True

def make_icon() -> Image.Image:
    image = Image.new("RGB", (64, 64), (25, 25, 28))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((5, 5, 59, 59), radius=12, fill=(55, 190, 120))
    draw.text((15, 23), "TQS", fill=(10, 20, 16))
    return image

def tray_main() -> None:
    def toggle(icon: pystray.Icon, item: pystray.MenuItem) -> None:
        set_control(not bool(CONFIG.get("control_enabled", True)))
        icon.update_menu()

    def open_captures(icon: pystray.Icon, item: pystray.MenuItem) -> None:
        os.startfile(CAPTURE_ROOT)

    def exit_agent(icon: pystray.Icon, item: pystray.MenuItem) -> None:
        if HTTPD:
            threading.Thread(target=HTTPD.shutdown, daemon=True).start()

        icon.stop()

    menu = pystray.Menu(
        pystray.MenuItem("Desktop control enabled", toggle,
                         checked=lambda item: bool(CONFIG.get("control_enabled", True))),
        pystray.MenuItem("Open captures", open_captures),
        pystray.MenuItem("Exit TQS Desktop Agent", exit_agent),
    )
    icon = pystray.Icon("TQSDesktopAgent", make_icon(), APP_NAME, menu)
    icon.run()

def run_server_only() -> None:
    global HTTPD
    HTTPD = ReusableHTTPServer(("127.0.0.1", int(CONFIG["port"])), APIHandler)
    logging.info("%s %s listening on 127.0.0.1:%s", APP_NAME, VERSION, CONFIG["port"])
    HTTPD.serve_forever(poll_interval=0.2)

def main() -> None:
    global HTTPD
    parser = argparse.ArgumentParser()
    parser.add_argument("--server-only", action="store_true")
    args = parser.parse_args()
    set_dpi_awareness()
    ensure_single_instance()
    load_config()
    setup_logging()
    if args.server_only:
        run_server_only()
        return

    HTTPD = ReusableHTTPServer(("127.0.0.1", int(CONFIG["port"])), APIHandler)
    thread = threading.Thread(target=HTTPD.serve_forever, kwargs={"poll_interval": 0.2}, daemon=True)
    thread.start()
    logging.info("%s %s tray started on 127.0.0.1:%s", APP_NAME, VERSION, CONFIG["port"])
    tray_main()

if __name__ == "__main__":
    main()
