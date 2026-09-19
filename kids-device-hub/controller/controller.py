from __future__ import annotations
import argparse, json, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REGISTRY = ROOT / "devices.json"
AUDIT = ROOT / "audit.jsonl"
SHOT_DIR = ROOT / "screenshots"
SHOT_DIR.mkdir(parents=True, exist_ok=True)
DEFAULT_UPDATE_URL = "http://100.95.246.112:8770/Kendirov-Kids-Device-Hub-stable.apk"
TOKEN_FILE = ROOT.parent / "pair-token.txt"

def auth_headers():
    try:
        token=TOKEN_FILE.read_text(encoding="utf-8").strip()
        return {"X-Hub-Token":token} if token else {}
    except Exception:
        return {}

def load_registry():
    return json.loads(REGISTRY.read_text(encoding="utf-8"))

def device(name):
    data=load_registry()["devices"]
    if name not in data: raise SystemExit(f"Unknown device: {name}")
    return data[name]

def base_url(d):
    return f"http://{d['host']}:{d.get('port',8766)}"

def request(d,path,params=None,binary=False,timeout=30):
    q="?" + urllib.parse.urlencode(params) if params else ""
    req=urllib.request.Request(base_url(d)+path+q,headers=auth_headers(),method="GET")
    with urllib.request.urlopen(req,timeout=timeout) as r:
        body=r.read()
        return body if binary else body.decode("utf-8")

def audit(device_name,command,ok,detail=""):
    row={"ts":time.strftime("%Y-%m-%dT%H:%M:%S%z"),"device":device_name,"command":command,"ok":bool(ok),"detail":str(detail)[:1500]}
    with AUDIT.open("a",encoding="utf-8") as f:
        f.write(json.dumps(row,ensure_ascii=False)+"\n")

def save_shot(name,data):
    p=SHOT_DIR/f"{name}-{time.strftime('%Y%m%d-%H%M%S')}.png"
    latest=SHOT_DIR/f"{name}-latest.png"
    p.write_bytes(data); latest.write_bytes(data)
    return str(latest)

def run(name,cmd,a):
    d=device(name)
    try:
        if cmd in ("status","health"): out=request(d,"/status")
        elif cmd=="info": out=request(d,"/device-info")
        elif cmd=="ui": out=request(d,"/ui")
        elif cmd=="apps": out=request(d,"/apps")
        elif cmd=="usage": out=request(d,"/usage",{"days":a.days})
        elif cmd=="screenshot": out=save_shot(name,request(d,"/screenshot",binary=True))
        elif cmd=="tap": out=request(d,"/tap",{"x":a.x,"y":a.y})
        elif cmd=="long-press": out=request(d,"/long-press",{"x":a.x,"y":a.y,"ms":a.ms})
        elif cmd=="swipe": out=request(d,"/swipe",{"x1":a.x1,"y1":a.y1,"x2":a.x2,"y2":a.y2,"ms":a.ms})
        elif cmd=="drag": out=request(d,"/drag",{"x1":a.x1,"y1":a.y1,"x2":a.x2,"y2":a.y2,"holdMs":a.hold_ms,"moveMs":a.move_ms})
        elif cmd=="text": out=request(d,"/text",{"value":a.value})
        elif cmd=="click-text": out=request(d,"/click-text",{"text":a.text})
        elif cmd in ("home","back"): out=request(d,"/global",{"action":cmd})
        elif cmd=="wake": out=request(d,"/wake")
        elif cmd=="launch": out=request(d,"/launch",{"package":a.package})
        elif cmd=="lock": out=request(d,"/lock")
        elif cmd=="open-url": out=request(d,"/open-url",{"url":a.url})
        elif cmd=="install-url": out=request(d,"/install-url",{"url":a.url},timeout=60)
        elif cmd=="update": out=request(d,"/update",{"url":a.url or DEFAULT_UPDATE_URL},timeout=60)
        elif cmd=="install-status": out=request(d,"/install-status")
        elif cmd=="uninstall": out=request(d,"/uninstall",{"package":a.package})
        elif cmd=="app-settings": out=request(d,"/app-settings",{"package":a.package})
        elif cmd=="files": out=request(d,"/files",{"path":a.path})
        elif cmd=="mkdir": out=request(d,"/mkdir",{"path":a.path})
        elif cmd=="move": out=request(d,"/move",{"src":a.src,"dst":a.dst})
        elif cmd=="trash": out=request(d,"/trash",{"path":a.path})
        elif cmd=="script":
            spec=Path(a.file).read_text(encoding="utf-8") if a.file else a.json
            out=request(d,"/script",{"spec":spec},timeout=30)
        elif cmd=="script-status": out=request(d,"/script-status")
        elif cmd=="stop-script": out=request(d,"/stop-script")
        else: raise SystemExit("Unsupported command")
        audit(name,cmd,True,out)
        print(out)
    except Exception as e:
        audit(name,cmd,False,repr(e))
        raise

def main():
    p=argparse.ArgumentParser(prog="hub",description="Kendirov Family Device Hub controller")
    p.add_argument("device")
    sp=p.add_subparsers(dest="command",required=True)
    for c in ["status","health","info","ui","apps","screenshot","home","back","wake","lock","install-status","script-status","stop-script"]:
        sp.add_parser(c)
    u=sp.add_parser("usage"); u.add_argument("--days",type=int,default=1)
    for c in ["tap","long-press"]:
        x=sp.add_parser(c); x.add_argument("x",type=int); x.add_argument("y",type=int); x.add_argument("--ms",type=int,default=800)
    s=sp.add_parser("swipe")
    for n in ["x1","y1","x2","y2"]: s.add_argument(n,type=int)
    s.add_argument("--ms",type=int,default=300)
    g=sp.add_parser("drag")
    for n in ["x1","y1","x2","y2"]: g.add_argument(n,type=int)
    g.add_argument("--hold-ms",type=int,default=700)
    g.add_argument("--move-ms",type=int,default=600)
    x=sp.add_parser("text"); x.add_argument("value")
    x=sp.add_parser("click-text"); x.add_argument("text")
    x=sp.add_parser("launch"); x.add_argument("package")
    for c in ["open-url","install-url"]:
        x=sp.add_parser(c); x.add_argument("url")
    x=sp.add_parser("update"); x.add_argument("url",nargs="?")
    for c in ["uninstall","app-settings"]:
        x=sp.add_parser(c); x.add_argument("package")
    for c in ["files","mkdir","trash"]:
        x=sp.add_parser(c); x.add_argument("path",nargs="?",default="")
    x=sp.add_parser("move"); x.add_argument("src"); x.add_argument("dst")
    x=sp.add_parser("script"); g=x.add_mutually_exclusive_group(required=True); g.add_argument("--json"); g.add_argument("--file")
    a=p.parse_args()
    run(a.device,a.command,a)

if __name__=="__main__":
    main()
