from pathlib import Path
import argparse,json,time,uuid
ROOT=Path(__file__).resolve().parent
QUEUE=ROOT/"reverse-queue"; RESULTS=ROOT/"reverse-results"
QUEUE.mkdir(parents=True,exist_ok=True); RESULTS.mkdir(parents=True,exist_ok=True)
p=argparse.ArgumentParser(); p.add_argument("device"); p.add_argument("action"); p.add_argument("--args",default="{}"); p.add_argument("--timeout",type=int,default=30)
a=p.parse_args(); rid=uuid.uuid4().hex
q=QUEUE/f"{a.device.lower()}-{rid}.json"
q.write_text(json.dumps({"id":rid,"device":a.device.lower(),"action":a.action,"args":json.loads(a.args),"created":time.time()},ensure_ascii=False),encoding="utf-8")
result=RESULTS/f"{a.device.lower()}-{rid}.json"; end=time.time()+a.timeout
while time.time()<end:
    if result.exists():
        print(result.read_text(encoding="utf-8")); raise SystemExit(0)
    time.sleep(.25)
print(json.dumps({"ok":False,"error":"timeout","id":rid})); raise SystemExit(2)
