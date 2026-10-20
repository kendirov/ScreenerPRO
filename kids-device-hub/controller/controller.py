from __future__ import annotations
import argparse, json, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REGISTRY = ROOT / "devices.json"
HOSTS_REGISTRY = ROOT / "controller-hosts.json"
AUDIT = ROOT / "audit.jsonl"
SHOT_DIR = ROOT / "screenshots"
SHOT_DIR.mkdir(parents=True, exist_ok=True)
def controller_hosts():
    return json.loads(HOSTS_REGISTRY.read_text(encoding="utf-8"))

def active_controller():
    cfg=controller_hosts()
    key=cfg["active_controller"]
    return cfg["controllers"][key]

def default_update_url():
    host=active_controller()
    return f"http://{host['tailscale_ip']}:{host.get('update_port',8770)}/Kendirov-Kids-Device-Hub-stable.apk"
def token_file_for(device_key, d):
    name=d.get("token_file") or ("pair-token.txt" if device_key=="roma" else f"pair-token-{device_key}.txt")
    return ROOT.parent / name

def auth_headers(device_key,d):
    try:
        token=token_file_for(device_key,d).read_text(encoding="utf-8").strip()
        return {"X-Hub-Token":token} if token else {}
    except Exception:
        return {}

def load_registry():
    return json.loads(REGISTRY.read_text(encoding="utf-8"))

def resolve_device_key(name):
    data=load_registry()["devices"]
    if name in data:
        return name
    needle=name.casefold()
    for key,item in data.items():
        aliases=[key]+item.get("aliases",[])
        if any(str(a).casefold()==needle for a in aliases):
            return key
    raise SystemExit(f"Unknown device alias: {name}")

def device(name):
    return load_registry()["devices"][resolve_device_key(name)]

def base_url(d):
    return f"http://{d['host']}:{d.get('port',8766)}"

def request(device_key,d,path,params=None,binary=False,timeout=30):
    q="?" + urllib.parse.urlencode(params) if params else ""
    req=urllib.request.Request(base_url(d)+path+q,headers=auth_headers(device_key,d),method="GET")
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
    device_key=resolve_device_key(name)
    d=load_registry()["devices"][device_key]
    try:
        platform=str(d.get("platform","")).lower()
        if cmd in ("status","health"): out=request(device_key,d,"/status")
        elif cmd=="info": out=request(device_key,d,"/status" if platform=="windows" else "/device-info")
        elif cmd=="ui": out=request(device_key,d,"/ui")
        elif cmd=="apps": out=request(device_key,d,"/apps")
        elif cmd=="usage": out=request(device_key,d,"/usage",None if platform=="windows" else {"days":a.days})
        elif cmd=="processes": out=request(device_key,d,"/processes")
        elif cmd=="startup": out=request(device_key,d,"/startup")
        elif cmd=="services": out=request(device_key,d,"/services")
        elif cmd=="drives": out=request(device_key,d,"/drives")
        elif cmd=="audit": out=request(device_key,d,"/audit")
        elif cmd=="large-files": out=request(device_key,d,"/large-files",{"path":a.path,"minBytes":a.min_bytes,"max":a.max})
        elif cmd=="screenshot": out=save_shot(name,request(device_key,d,"/screenshot",binary=True))
        elif cmd=="tap": out=request(device_key,d,"/click" if platform=="windows" else "/tap",{"x":a.x,"y":a.y})
        elif cmd=="long-press": out=request(device_key,d,"/long-press",{"x":a.x,"y":a.y,"ms":a.ms})
        elif cmd=="swipe": out=request(device_key,d,"/swipe",{"x1":a.x1,"y1":a.y1,"x2":a.x2,"y2":a.y2,"ms":a.ms})
        elif cmd=="drag": out=request(device_key,d,"/drag",{"x1":a.x1,"y1":a.y1,"x2":a.x2,"y2":a.y2,"holdMs":a.hold_ms,"moveMs":a.move_ms})
        elif cmd=="text": out=request(device_key,d,"/text",{"value":a.value})
        elif cmd=="click-text": out=request(device_key,d,"/click-text",{"text":a.text})
        elif cmd in ("home","back"): out=request(device_key,d,"/global",{"action":cmd})
        elif cmd=="wake": out=request(device_key,d,"/wake")
        elif cmd=="launch": out=request(device_key,d,"/launch",{"file":a.package} if platform=="windows" else {"package":a.package})
        elif cmd=="lock": out=request(device_key,d,"/lock")
        elif cmd=="key": out=request(device_key,d,"/key",{"vk":a.vk,"repeats":a.repeats,"delayMs":a.delay_ms})
        elif cmd=="overlay": out=request(device_key,d,"/overlay",{"text":a.text,"seconds":a.seconds,"mode":a.mode})
        elif cmd=="timer": out=request(device_key,d,"/timer",{"minutes":a.minutes,"text":a.text,"endAction":a.end_action})
        elif cmd=="kill": out=request(device_key,d,"/kill",{"pid":a.pid})
        elif cmd=="safe-delete": out=request(device_key,d,"/safe-delete",{"path":a.path})
        elif cmd=="winget-install": out=request(device_key,d,"/winget-install",{"id":a.id},timeout=600)
        elif cmd=="winget-uninstall": out=request(device_key,d,"/winget-uninstall",{"id":a.id},timeout=600)
        elif cmd=="open-url": out=request(device_key,d,"/open-url",{"url":a.url})
        elif cmd=="install-url": out=request(device_key,d,"/install-url",{"url":a.url},timeout=60)
        elif cmd=="update": out=request(device_key,d,"/update",{"url":a.url or default_update_url()},timeout=60)
        elif cmd=="install-status": out=request(device_key,d,"/install-status")
        elif cmd=="uninstall": out=request(device_key,d,"/uninstall",{"package":a.package})
        elif cmd=="app-settings": out=request(device_key,d,"/app-settings",{"package":a.package})
        elif cmd=="files": out=request(device_key,d,"/files",{"path":a.path})
        elif cmd=="mkdir": out=request(device_key,d,"/mkdir",{"path":a.path})
        elif cmd=="move": out=request(device_key,d,"/move",{"src":a.src,"dst":a.dst})
        elif cmd=="trash": out=request(device_key,d,"/trash",{"path":a.path})
        elif cmd=="script":
            spec=Path(a.file).read_text(encoding="utf-8") if a.file else a.json
            out=request(device_key,d,"/script",{"spec":spec},timeout=30)
        elif cmd=="script-status": out=request(device_key,d,"/script-status")
        elif cmd=="stop-script": out=request(device_key,d,"/stop-script")
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
    for c in ["status","health","info","ui","apps","screenshot","home","back","wake","lock","install-status","script-status","stop-script","processes","startup","services","drives","audit"]:
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
    x=sp.add_parser("key"); x.add_argument("vk",type=int); x.add_argument("--repeats",type=int,default=1); x.add_argument("--delay-ms",type=int,default=80)
    x=sp.add_parser("overlay"); x.add_argument("text"); x.add_argument("--seconds",type=int,default=10); x.add_argument("--mode",default="card")
    x=sp.add_parser("timer"); x.add_argument("--minutes",type=int,default=60); x.add_argument("--text",default=""); x.add_argument("--end-action",default="none")
    x=sp.add_parser("kill"); x.add_argument("pid",type=int)
    x=sp.add_parser("safe-delete"); x.add_argument("path")
    x=sp.add_parser("winget-install"); x.add_argument("id")
    x=sp.add_parser("winget-uninstall"); x.add_argument("id")
    x=sp.add_parser("large-files"); x.add_argument("path",nargs="?",default="%USERPROFILE%"); x.add_argument("--min-bytes",type=int,default=524288000); x.add_argument("--max",type=int,default=200)
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
