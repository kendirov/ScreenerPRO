from __future__ import annotations
import argparse, json, os, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REGISTRY = ROOT / "devices.json"
AUDIT = ROOT / "audit.jsonl"
SHOT_DIR = ROOT / "screenshots"
SHOT_DIR.mkdir(parents=True, exist_ok=True)

def load_registry():
    return json.loads(REGISTRY.read_text(encoding="utf-8"))

def device(name):
    data = load_registry()["devices"]
    if name not in data:
        raise SystemExit(f"Unknown device: {name}")
    return data[name]

def base_url(d):
    return f"http://{d['host']}:{d.get('port', 8766)}"

def request(d, path, params=None, binary=False, timeout=15):
    q = ""
    if params:
        q = "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(base_url(d) + path + q, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        body = r.read()
        return body if binary else body.decode("utf-8")

def log(device_name, command, ok, detail=""):
    row = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "device": device_name,
        "command": command,
        "ok": bool(ok),
        "detail": str(detail)[:1000],
    }
    with AUDIT.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")

def run(name, command, args):
    d = device(name)
    try:
        if command == "status":
            out = request(d, "/status")
        elif command == "info":
            out = request(d, "/device-info")
        elif command == "ui":
            out = request(d, "/ui")
        elif command == "apps":
            out = request(d, "/apps")
        elif command == "usage":
            out = request(d, "/usage", {"days": args.days})
        elif command == "screenshot":
            data = request(d, "/screenshot", binary=True)
            p = SHOT_DIR / f"{name}-{time.strftime('%Y%m%d-%H%M%S')}.png"
            p.write_bytes(data)
            latest = SHOT_DIR / f"{name}-latest.png"
            latest.write_bytes(data)
            out = str(latest)
        elif command == "tap":
            out = request(d, "/tap", {"x": args.x, "y": args.y})
        elif command == "swipe":
            out = request(d, "/swipe", {"x1": args.x1, "y1": args.y1, "x2": args.x2, "y2": args.y2, "ms": args.ms})
        elif command == "text":
            out = request(d, "/text", {"value": args.value})
        elif command == "home":
            out = request(d, "/global", {"action": "home"})
        elif command == "back":
            out = request(d, "/global", {"action": "back"})
        elif command == "launch":
            out = request(d, "/launch", {"package": args.package})
        elif command == "lock":
            out = request(d, "/lock")
        elif command == "open-url":
            out = request(d, "/open-url", {"url": args.url})
        elif command == "install-url":
            out = request(d, "/install-url", {"url": args.url})
        elif command == "uninstall":
            out = request(d, "/uninstall", {"package": args.package})
        elif command == "app-settings":
            out = request(d, "/app-settings", {"package": args.package})
        else:
            raise SystemExit("Unsupported command")
        log(name, command, True, out)
        print(out)
    except Exception as e:
        log(name, command, False, repr(e))
        raise

def main():
    p = argparse.ArgumentParser()
    p.add_argument("device")
    sp = p.add_subparsers(dest="command", required=True)
    for c in ["status","info","ui","apps","screenshot","home","back","lock"]:
        sp.add_parser(c)
    u=sp.add_parser("usage"); u.add_argument("--days", type=int, default=1)
    t=sp.add_parser("tap"); t.add_argument("x",type=int); t.add_argument("y",type=int)
    s=sp.add_parser("swipe")
    for n in ["x1","y1","x2","y2"]: s.add_argument(n,type=int)
    s.add_argument("--ms",type=int,default=300)
    tx=sp.add_parser("text"); tx.add_argument("value")
    la=sp.add_parser("launch"); la.add_argument("package")
    for c in ["open-url","install-url"]:
        x=sp.add_parser(c); x.add_argument("url")
    for c in ["uninstall","app-settings"]:
        x=sp.add_parser(c); x.add_argument("package")
    a=p.parse_args()
    run(a.device,a.command,a)

if __name__ == "__main__":
    main()
