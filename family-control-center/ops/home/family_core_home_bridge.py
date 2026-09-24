from __future__ import annotations
import argparse, json, subprocess, time, urllib.request, urllib.error
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(r"C:\HomeLab")
TOKEN_FILE=ROOT/"secrets"/"family-core-home-token.txt"
SUPABASE_URL="https://hppbuzbrjoyrwpdinlxk.supabase.co"
PUBLISHABLE_KEY="sb_publishable_FPnSkBjbvgAW0VBE_u4_Kw_QAfJ_DFh"
PYTHON=r"C:\Users\Admin\AppData\Local\Programs\Python\Python312\python.exe"
ROBOT=ROOT/"home-automation"/"robot-vacuum"/"robot-cloud.py"
PURIFIER=ROOT/"home-automation"/"purifier"/"purifier-cloud.py"
SMART_INV=ROOT/"home-automation"/"smart-home-inventory.json"
YANDEX=ROOT/"home-automation"/"yandex-smart-home-confirmed.json"
HOME_HEALTH=ROOT/"logs"/"home-health.json"
CORE_HEALTH=ROOT/"logs"/"core-health.json"
CREATE_NO_WINDOW=0x08000000

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def rpc(name,payload,timeout=25):
    req=urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/rpc/{name}",
        data=json.dumps(payload,ensure_ascii=False).encode("utf-8"),
        headers={"apikey":PUBLISHABLE_KEY,"Content-Type":"application/json"},
        method="POST")
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r:
            raw=r.read().decode("utf-8","replace")
            return json.loads(raw) if raw.strip() else None
    except urllib.error.HTTPError as e:
        body=e.read().decode("utf-8","replace")
        raise RuntimeError(f"RPC {name} HTTP {e.code}: {body[:1000]}") from e

def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))

def run_json(args,timeout=90):
    p=subprocess.run(args,capture_output=True,text=True,encoding="utf-8",errors="replace",
                     timeout=timeout,creationflags=CREATE_NO_WINDOW)
    if p.returncode!=0:
        raise RuntimeError((p.stderr or p.stdout or "command failed")[-1600:])
    raw=p.stdout.strip()
    if not raw:
        return {}
    return json.loads(raw.splitlines()[-1])

def token():
    return TOKEN_FILE.read_text(encoding="utf-8").strip()

def room_for(inv,did):
    for room in inv.get("rooms",[]):
        if str(did) in [str(x) for x in room.get("dids",[])]:
            return room.get("name")
    return None
def xiaomi_snapshot():
    inv=read_json(SMART_INV)
    robot_status={}
    purifier_status={}
    robot_ok=purifier_ok=False
    try:
        robot_status=run_json([PYTHON,str(ROBOT),"status"],120); robot_ok=True
    except Exception as e:
        robot_status={"error":type(e).__name__}
    try:
        purifier_status=run_json([PYTHON,str(PURIFIER),"status"],120); purifier_ok=True
    except Exception as e:
        purifier_status={"error":type(e).__name__}

    by_did={str(x.get("did")):x for x in inv.get("official_ru_devices",[])}
    entities=[]
    r=by_did.get("1140089590",{})
    entities.append({
      "entity_key":"xiaomi:1140089590","display_name":"Xiaomi Robot Vacuum X20+",
      "domain":"vacuum","room":room_for(inv,"1140089590"),"provider":"xiaomi",
      "model":r.get("model","xiaomi.vacuum.c102gl"),"available":robot_ok,
      "state":robot_status.get("status","unavailable"),
      "quality":"actual" if robot_ok else "unknown",
      "capabilities":["REFRESH","START","STOP","DOCK","SET_MODE"],
      "attributes":{
        "battery_pct":robot_status.get("battery_pct"),
        "charging":robot_status.get("charging"),"mode":robot_status.get("mode"),
        "fault":robot_status.get("fault"),"firmware":r.get("firmware"),
        "online":r.get("online"),"source":"Xiaomi official OAuth"
      }})

    p=by_did.get("684026998",{})
    entities.append({
      "entity_key":"xiaomi:684026998","display_name":"Очиститель",
      "domain":"air_purifier","room":room_for(inv,"684026998"),"provider":"xiaomi",
      "model":p.get("model","zhimi.airp.meb1"),"available":purifier_ok,
      "state":("on" if purifier_status.get("on") else "off") if purifier_ok else "unavailable",
      "quality":"actual" if purifier_ok else "unknown",
      "capabilities":["REFRESH","TURN_ON","TURN_OFF","SET_MODE"],
      "attributes":{
        "mode":purifier_status.get("mode"),"fan_level":purifier_status.get("fan_level"),
        "pm2_5":purifier_status.get("pm2_5"),"pm10":purifier_status.get("pm10"),
        "temperature_c":purifier_status.get("temperature_c"),
        "humidity_pct":purifier_status.get("humidity_pct"),
        "air_quality":purifier_status.get("air_quality"),
        "filter_life_pct":purifier_status.get("filter_life_pct"),
        "plasma":purifier_status.get("plasma"),"uv":purifier_status.get("uv"),
        "fault":purifier_status.get("fault"),"firmware":p.get("firmware"),
        "online":p.get("online"),"source":"Xiaomi official OAuth"
      }})

    for did,name,domain in [
      ("1072682311","Камера","camera"),
      ("1073979136","Mi Camera 2K (Magnetic Mount)","camera")
    ]:
        c=by_did.get(did,{})
        entities.append({
          "entity_key":f"xiaomi:{did}","display_name":c.get("name",name),
          "domain":domain,"room":room_for(inv,did),"provider":"xiaomi",
          "model":c.get("model"),"available":bool(c.get("online")),
          "state":"online" if c.get("online") else "offline",
          "quality":"actual","capabilities":[],
          "attributes":{"firmware":c.get("firmware"),"online":c.get("online")}
        })
    state="ONLINE" if robot_ok and purifier_ok else ("DEGRADED" if robot_ok or purifier_ok else "OFFLINE")
    return {"occurred_at":now_iso(),"state":state,
            "capabilities":["inventory","state","robot_control","purifier_control"],
            "metadata":{"home":inv.get("xiaomi_home_app",{}).get("home_name"),"region":"ru"},
            "entities":entities}
def yandex_snapshot():
    y=read_json(YANDEX)
    entities=[]
    for idx,x in enumerate(y.get("devices",[])):
        key=(x.get("model") or x.get("name") or str(idx)).lower().replace(" ","-")
        entities.append({
          "entity_key":f"yandex:{key}",
          "display_name":x.get("name","Yandex device"),
          "domain":x.get("type","other"),"room":x.get("room"),
          "provider":"yandex","model":x.get("model"),"available":None,
          "state":"configured","quality":"best_effort","capabilities":[],
          "attributes":{k:v for k,v in x.items() if k not in {"name","type","room","model"}}
        })
    return {"occurred_at":now_iso(),"state":"ONLINE",
            "capabilities":["inventory","voice_layer","zigbee_hub"],
            "metadata":{"home":y.get("home"),"source_updated":y.get("updated")},
            "entities":entities}

def home_services_snapshot():
    core=read_json(CORE_HEALTH) if CORE_HEALTH.exists() else {}
    home=read_json(HOME_HEALTH) if HOME_HEALTH.exists() else {}
    specs=[
      ("service:tailscale","Tailscale","network",bool(core.get("tailscale"))),
      ("service:mqtt","Mosquitto MQTT","service",bool(core.get("mqtt"))),
      ("service:nodered","Node-RED","service",home.get("nodeRed")==200),
      ("service:jellyfin","Jellyfin","media",bool(core.get("jellyfin"))),
      ("service:sunshine","Sunshine","service",bool(core.get("sunshine")))
    ]
    entities=[]
    for key,name,domain,ok in specs:
        entities.append({"entity_key":key,"display_name":name,"domain":domain,
                         "provider":"kendirov-home","available":ok,
                         "state":"online" if ok else "offline","quality":"actual",
                         "capabilities":[],"attributes":{}})
    all_ok=all(x[3] for x in specs)
    return {"occurred_at":now_iso(),"state":"ONLINE" if all_ok else "DEGRADED",
            "capabilities":["health","mqtt","node_red","jellyfin","sunshine"],
            "metadata":{"disk_free_gb":core.get("diskFreeGB"),"memory_free_gb":core.get("memoryFreeGB"),
                        "ethernet_link":core.get("ethernetLink")},
            "entities":entities}

def ingest_all(tok):
    out={}
    for key,fn in [("xiaomi-home",xiaomi_snapshot),("yandex-smart-home",yandex_snapshot),("home-services",home_services_snapshot)]:
        try:
            snap=fn()
            rpc("ingest_control_integration_snapshot",
                {"p_token":tok,"p_integration_key":key,"p_snapshot":snap},30)
            out[key]={"ok":True,"entities":len(snap.get("entities",[])),"state":snap.get("state")}
        except Exception as e:
            out[key]={"ok":False,"error":type(e).__name__,"detail":str(e)[:300]}
    return out
def execute_entity_command(cmd):
    entity=cmd.get("entity_key","")
    action=cmd.get("action","")
    payload=cmd.get("payload") or {}
    if entity=="xiaomi:1140089590":
        mapping={"REFRESH":"status","START":"start","STOP":"stop","DOCK":"dock"}
        if action=="SET_MODE":
            mode=str(payload.get("mode","")).lower()
            mapping["SET_MODE"]={"silent":"speed_slow","basic":"speed_medium",
                                 "strong":"speed_fast","full speed":"speed_turbo",
                                 "turbo":"speed_turbo"}.get(mode)
        sub=mapping.get(action)
        if not sub:
            return False,{"error":"unsupported_robot_action"}
        result=run_json([PYTHON,str(ROBOT),sub],180)
        if action!="REFRESH":
            time.sleep(2)
            try: result={"action_result":result,"state":run_json([PYTHON,str(ROBOT),"status"],120)}
            except Exception: pass
        return True,result

    if entity=="xiaomi:684026998":
        mapping={"REFRESH":"status","TURN_ON":"on","TURN_OFF":"off"}
        if action=="SET_MODE":
            mode=str(payload.get("mode","")).lower()
            mapping["SET_MODE"]={"auto":"auto","sleep":"sleep","low":"low",
                                 "medium":"medium","high":"high"}.get(mode)
        sub=mapping.get(action)
        if not sub:
            return False,{"error":"unsupported_purifier_action"}
        result=run_json([PYTHON,str(PURIFIER),sub],180)
        if action!="REFRESH":
            time.sleep(2)
            try: result={"action_result":result,"state":run_json([PYTHON,str(PURIFIER),"status"],120)}
            except Exception: pass
        return True,result

    return False,{"error":"entity_is_read_only"}

def poll_commands(tok):
    cmds=rpc("poll_control_entity_commands",
             {"p_token":tok,"p_host_node_key":"home-windows"}) or []
    if not isinstance(cmds,list): return 0
    for cmd in cmds:
        try:
            ok,result=execute_entity_command(cmd)
        except Exception as e:
            ok,result=False,{"error":type(e).__name__,"detail":str(e)[:500]}
        rpc("ack_control_entity_command",{
            "p_token":tok,"p_host_node_key":"home-windows",
            "p_command_id":cmd["id"],"p_ok":ok,"p_result":result},30)
    if cmds:
        ingest_all(tok)
    return len(cmds)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--once",action="store_true")
    args=ap.parse_args()
    tok=token()
    if args.once:
        print(json.dumps({"ingest":ingest_all(tok),"commands":poll_commands(tok)},ensure_ascii=False))
        return
    next_sync=0.0
    while True:
        try:
            if time.time()>=next_sync:
                print(json.dumps({"time":now_iso(),"ingest":ingest_all(tok)},ensure_ascii=False),flush=True)
                next_sync=time.time()+120
            n=poll_commands(tok)
            if n: print(json.dumps({"time":now_iso(),"commands":n},ensure_ascii=False),flush=True)
        except Exception as e:
            print(json.dumps({"time":now_iso(),"error":type(e).__name__,"detail":str(e)[:500]},ensure_ascii=False),flush=True)
        time.sleep(5)

if __name__=="__main__":
    main()