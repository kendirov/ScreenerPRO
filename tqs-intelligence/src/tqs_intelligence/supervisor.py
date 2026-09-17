from __future__ import annotations

import os
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

from .control import ControlCenter
from .update_manager import UpdateManager


class Supervisor:
    def __init__(self) -> None:
        self.root=Path(__file__).resolve().parents[2]
        os.chdir(self.root)
        self.control=ControlCenter('./data/control.json')
        self.updater=UpdateManager('./data/update-request.json')
        self.child: subprocess.Popen|None=None
        self.host=os.getenv('TQS_HOST','127.0.0.1'); self.port=int(os.getenv('TQS_PORT','8787'))
        self.url=f'http://{self.host}:{self.port}'
        self.last_auto_check=0.0

    def start_child(self) -> None:
        self.child=subprocess.Popen([sys.executable,'-m','uvicorn','tqs_intelligence.api:app','--host',self.host,'--port',str(self.port)],cwd=self.root)

    def stop_child(self) -> None:
        if self.child is None or self.child.poll() is not None: return
        self.child.terminate()
        try: self.child.wait(timeout=15)
        except subprocess.TimeoutExpired:
            self.child.kill(); self.child.wait(timeout=5)

    def healthy(self, timeout_s: int=60) -> bool:
        deadline=time.time()+timeout_s
        while time.time()<deadline:
            if self.child and self.child.poll() is not None: return False
            try:
                with urllib.request.urlopen(self.url+'/api/health',timeout=2) as r:
                    if 200 <= r.status < 300: return True
            except Exception: pass
            time.sleep(1)
        return False

    def _run(self,args:list[str],timeout:int=180) -> subprocess.CompletedProcess:
        return subprocess.run(args,cwd=self.root,text=True,capture_output=True,timeout=timeout)

    def _busy(self) -> bool:
        try:
            with urllib.request.urlopen(self.url+'/api/research/runtime',timeout=2) as r:
                import json
                payload=json.loads(r.read().decode('utf-8'))
                return int(payload.get('running_jobs') or 0)>0
        except Exception:
            return False

    def apply_update(self, force: bool=False) -> bool:
        status=self.updater.status(fetch=True)
        if not status.get('available') or not status.get('update_available'): return True
        if status.get('dirty'): return False
        if self._busy() and not force: return False
        old_head=str(status.get('head') or '')
        self.stop_child()
        pull=self._run(['git','-C',str(self.updater.repo_root),'pull','--ff-only'],120)
        if pull.returncode!=0:
            self.start_child(); return False
        install=self._run([sys.executable,'-m','pip','install','-e','.[dev,analytics]'],300)
        self.start_child()
        if install.returncode==0 and self.healthy(75): return True
        self.stop_child()
        if old_head:
            self._run(['git','-C',str(self.updater.repo_root),'reset','--hard',old_head],60)
            self._run([sys.executable,'-m','pip','install','-e','.[dev,analytics]'],300)
        self.start_child(); self.healthy(60)
        return False

    def run(self) -> int:
        self.start_child()
        if not self.healthy(60): return 2
        try: webbrowser.open(self.url)
        except Exception: pass
        self.last_auto_check=time.time()
        try:
            while True:
                if self.child and self.child.poll() is not None:
                    self.start_child(); self.healthy(30)
                request=self.updater.pop_request()
                if request is not None:
                    self.apply_update(bool(request.get('force')))
                state=self.control.get()
                if state.auto_update and time.time()-self.last_auto_check>=1800:
                    self.last_auto_check=time.time(); self.apply_update(False)
                time.sleep(2)
        except KeyboardInterrupt:
            return 0
        finally:
            self.stop_child()


def main() -> None:
    raise SystemExit(Supervisor().run())


if __name__=='__main__': main()
