from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import json, time

ROOT=Path(__file__).resolve().parent
QUEUE=ROOT/"reverse-queue"
RESULTS=ROOT/"reverse-results"
QUEUE.mkdir(parents=True,exist_ok=True)
RESULTS.mkdir(parents=True,exist_ok=True)

def token(device):
    name="pair-token.txt" if device=="roma" else f"pair-token-{device}.txt"
    p=ROOT/name
    return p.read_text(encoding="utf-8").strip() if p.exists() else ""

def authorized(h,device):
    return h.headers.get("X-Hub-Token","")==token(device) and len(token(device))>=32

class H(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def send_json(self,status,obj):
        b=json.dumps(obj,ensure_ascii=False,separators=(",",":")).encode("utf-8")
        self.send_response(status); self.send_header("Content-Type","application/json; charset=utf-8")
        self.send_header("Content-Length",str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u=urlparse(self.path)
        if u.path=="/health": self.send_json(200,{"ok":True,"ts":time.time()}); return
        if u.path!="/poll": self.send_json(404,{"error":"not_found"}); return
        device=parse_qs(u.query).get("device",[""])[0].lower()
        if not authorized(self,device): self.send_json(403,{"error":"forbidden"}); return
        files=sorted(QUEUE.glob(f"{device}-*.json"),key=lambda p:p.stat().st_mtime)
        if not files: self.send_response(204); self.end_headers(); return
        self.send_json(200,json.loads(files[0].read_text(encoding="utf-8")))
    def do_POST(self):
        u=urlparse(self.path)
        if u.path!="/result": self.send_json(404,{"error":"not_found"}); return
        n=int(self.headers.get("Content-Length","0") or 0)
        data=json.loads(self.rfile.read(n).decode("utf-8"))
        device=str(data.get("device","")).lower()
        if not authorized(self,device): self.send_json(403,{"error":"forbidden"}); return
        rid=str(data.get("id",""))
        if not rid: self.send_json(400,{"error":"missing_id"}); return
        (RESULTS/f"{device}-{rid}.json").write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf-8")
        for p in QUEUE.glob(f"{device}-*.json"):
            try:
                q=json.loads(p.read_text(encoding="utf-8"))
                if str(q.get("id"))==rid: p.unlink(missing_ok=True)
            except: pass
        self.send_json(200,{"ok":True})
class S(ThreadingHTTPServer):
    daemon_threads=True; allow_reuse_address=True
if __name__=="__main__": S(("0.0.0.0",8775),H).serve_forever()
