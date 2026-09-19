from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import urllib.error
import urllib.request

ROOT = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "TQSDesktopAgent"
CONFIG_PATH = ROOT / "config.json"

def config() -> dict:
    if not CONFIG_PATH.exists():
        raise SystemExit(f"Agent config not found: {CONFIG_PATH}")
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))

def call(method: str, path: str, data: dict | None = None) -> dict:
    cfg = config()
    raw = None if data is None else json.dumps(data, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"http://127.0.0.1:{cfg.get('port', 8765)}{path}",
        data=raw,
        method=method,
        headers={
            "Authorization": f"Bearer {cfg['token']}",
            "Content-Type": "application/json; charset=utf-8",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        try:
            payload = json.loads(exc.read().decode("utf-8"))
        except Exception:
            payload = {"error": str(exc)}
        raise SystemExit(json.dumps(payload, ensure_ascii=False, indent=2))
    except urllib.error.URLError as exc:
        raise SystemExit(f"Agent is not reachable: {exc}")

def emit(value: dict) -> None:
    print(json.dumps(value, ensure_ascii=True, indent=2))

def monitor_value(value: str):
    return "all" if value.lower() == "all" else int(value)

def main() -> None:
    p = argparse.ArgumentParser(prog="tqs-agent", description="CLI for TQS Desktop Agent")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("health")
    sub.add_parser("monitors")
    w = sub.add_parser("windows")
    w.add_argument("--contains")
    sub.add_parser("cursor")

    s = sub.add_parser("shot")
    s.add_argument("--monitor", default="1")
    s.add_argument("--prefix", default="chatgpt")

    c = sub.add_parser("capture")
    c.add_argument("--event", default="manual")
    c.add_argument("--metadata", default="{}")

    f = sub.add_parser("focus")
    f.add_argument("title")

    m = sub.add_parser("move")
    m.add_argument("x", type=int)
    m.add_argument("y", type=int)
    m.add_argument("--duration", type=float, default=0)

    click = sub.add_parser("click")
    click.add_argument("x", type=int, nargs="?")
    click.add_argument("y", type=int, nargs="?")
    click.add_argument("--button", choices=["left", "right", "middle"], default="left")
    click.add_argument("--clicks", type=int, default=1)

    typ = sub.add_parser("type")
    typ.add_argument("text")
    typ.add_argument("--interval", type=float, default=0)
    hk = sub.add_parser("hotkey")
    hk.add_argument("keys", nargs="+")

    uf = sub.add_parser("ui-find")
    uf.add_argument("window")
    uf.add_argument("text", nargs="?", default="")
    uf.add_argument("--limit", type=int, default=50)

    uc = sub.add_parser("ui-click")
    uc.add_argument("window")
    uc.add_argument("text")

    sc = sub.add_parser("scenario")
    sc.add_argument("json_file")

    sub.add_parser("pause")
    sub.add_parser("resume")

    args = p.parse_args()
    if args.cmd in {"health", "monitors", "windows", "cursor"}:
        result = call("GET", f"/{args.cmd}")
        if args.cmd == "windows" and args.contains:
            needle = args.contains.casefold()
            result["windows"] = [w for w in result.get("windows", []) if needle in w["title"].casefold()]
    elif args.cmd == "shot":
        result = call("POST", "/screenshot", {"monitor": monitor_value(args.monitor), "prefix": args.prefix})
    elif args.cmd == "capture":
        result = call("POST", "/capture", {"event": args.event, "metadata": json.loads(args.metadata)})
    elif args.cmd == "focus":
        result = call("POST", "/focus", {"title": args.title})
    elif args.cmd == "move":
        result = call("POST", "/mouse/move", {"x": args.x, "y": args.y, "duration": args.duration})
    elif args.cmd == "click":
        result = call("POST", "/mouse/click", {"x": args.x, "y": args.y,
                     "button": args.button, "clicks": args.clicks})
    elif args.cmd == "type":
        result = call("POST", "/keyboard/type", {"text": args.text, "interval": args.interval})
    elif args.cmd == "hotkey":
        result = call("POST", "/keyboard/hotkey", {"keys": args.keys})
    elif args.cmd == "ui-find":
        result = call("POST", "/ui/find", {"window": args.window, "text": args.text, "limit": args.limit})
    elif args.cmd == "ui-click":
        result = call("POST", "/ui/click", {"window": args.window, "text": args.text})
    elif args.cmd == "scenario":
        actions = json.loads(Path(args.json_file).read_text(encoding="utf-8"))
        result = call("POST", "/scenario/run", {"actions": actions})
    elif args.cmd == "pause":
        result = call("POST", "/control/pause", {})
    elif args.cmd == "resume":
        result = call("POST", "/control/resume", {})
    else:
        raise SystemExit("Unknown command")
    emit(result)

if __name__ == "__main__":
    main()